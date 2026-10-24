#!/usr/bin/env python3
"""Checks sn1p services once a minute (cron) and writes /var/www/sn1p/status.json.

States: ok, degraded, down. History is kept per UTC day as [ok, degraded, down] counts.
"""
import datetime
import json
import os
import time
import urllib.error
import urllib.request

OUT = "/var/www/sn1p/status.json"
STATE_DIR = "/var/lib/sn1p-status"
HISTORY = os.path.join(STATE_DIR, "history.json")
PLAYERS = "/var/www/html/players.json"
DAYS = 90
SLOW_MS = 3000

SERVICES = [
    {"id": "onegrid-server", "name": "OneGrid Rust game server", "kind": "game"},
    {"id": "onegrid-web", "name": "onegridrust.com", "kind": "http", "url": "https://onegridrust.com"},
    {"id": "autoturret", "name": "AutoTurret", "kind": "http", "url": "https://autoturret.xyz"},
    {"id": "sn1p", "name": "sn1p.win", "kind": "http", "url": "https://sn1p.win"},
]


def check_http(url):
    last = ("down", None, "No response")
    for attempt in range(2):
        start = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "sn1p-status/1.0"})
            with urllib.request.urlopen(req, timeout=10) as r:
                code = r.status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception as e:  # timeout, DNS, TLS, refused
            last = ("down", None, "No response")
            time.sleep(3)
            continue
        ms = int((time.time() - start) * 1000)
        if code >= 500:
            last = ("down", ms, "Server error (%d)" % code)
            time.sleep(3)
            continue
        if ms > SLOW_MS:
            return ("degraded", ms, "Slow response")
        return ("ok", ms, "Responding")
    return last


def check_game():
    try:
        with open(PLAYERS) as f:
            a = json.load(f)["data"]["attributes"]
        age = time.time() - a.get("updated", 0) / 1000.0
    except Exception:
        return ("degraded", None, "Status feed unavailable")
    if age > 600:
        return ("degraded", None, "Status feed is stale")
    if a.get("status") != "online":
        return ("down", None, "Server offline")
    q = (a.get("details") or {}).get("rust_queued_players", 0)
    detail = "%d / %d players" % (a.get("players", 0), a.get("maxPlayers", 0))
    if q:
        detail += ", %d queued" % q
    return ("ok", None, detail)


def main():
    os.makedirs(STATE_DIR, exist_ok=True)
    try:
        with open(HISTORY) as f:
            hist = json.load(f)
    except Exception:
        hist = {}

    today = datetime.datetime.utcnow().date()
    dates = [(today - datetime.timedelta(days=i)).isoformat() for i in range(DAYS - 1, -1, -1)]
    results = []
    for svc in SERVICES:
        state, ms, detail = check_game() if svc["kind"] == "game" else check_http(svc["url"])
        h = hist.setdefault(svc["id"], {})
        day = h.setdefault(today.isoformat(), [0, 0, 0])
        day[{"ok": 0, "degraded": 1, "down": 2}[state]] += 1
        for d in list(h):
            if d < dates[0]:
                del h[d]
        days = [[d] + h.get(d, [0, 0, 0]) for d in dates]
        up = sum(x[1] + x[2] for x in days)
        total = sum(x[1] + x[2] + x[3] for x in days)
        results.append({
            "id": svc["id"], "name": svc["name"], "state": state, "latency_ms": ms, "detail": detail,
            "uptime": round(100.0 * up / total, 2) if total else None, "days": days,
        })

    states = [r["state"] for r in results]
    overall = "outage" if "down" in states else ("degraded" if "degraded" in states else "operational")
    out = {"updated": int(time.time()), "overall": overall, "services": results}

    tmp = HISTORY + ".tmp"
    with open(tmp, "w") as f:
        json.dump(hist, f)
    os.replace(tmp, HISTORY)
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    os.chmod(tmp, 0o644)
    os.replace(tmp, OUT)


if __name__ == "__main__":
    main()
