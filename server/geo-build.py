#!/usr/bin/env python3
"""Turns the DB-IP country CSV (gzipped) into a sorted binary lookup file.

Record = 16 bytes start + 16 bytes end + 2 bytes country code. IPv4 is stored IPv4-mapped (::ffff:a.b.c.d)
so one binary search handles both families. Usage: geo-build.py in.csv.gz out.bin
"""
import csv
import gzip
import ipaddress
import sys

src, dst = sys.argv[1], sys.argv[2]
MAP = b"\x00" * 10 + b"\xff\xff"


def norm(ip):
    return MAP + ip.packed if ip.version == 4 else ip.packed


rows = []
with gzip.open(src, "rt", newline="") as f:
    for r in csv.reader(f):
        if len(r) < 3 or len(r[2]) != 2:
            continue
        try:
            a, b = ipaddress.ip_address(r[0]), ipaddress.ip_address(r[1])
        except ValueError:
            continue
        if a.version != b.version:
            continue
        rows.append((norm(a), norm(b), r[2].upper().encode("ascii")))

rows.sort()
with open(dst, "wb") as out:
    for s, e, cc in rows:
        out.write(s + e + cc)
print("records:", len(rows))
