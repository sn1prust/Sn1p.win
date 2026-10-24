# Sn1p.win

Personal site for **Sn1p**, founder of OneGrid Rust and AutoTurret. Live at [sn1p.win](https://sn1p.win).

A static page with an opening animation (scissors cut the name in half), live status data and a visitor-country counter.

## Files

| File | What it is |
|------|------------|
| `index.html` | The site: one page, inline CSS and JavaScript |
| `status.html` | Status page, reads `status.json` |
| `og.png` | Link-preview image (1200x630) |
| `bg.mp4`, `pfp.mp4`, `music.mp3`, images | Media used by the page |
| `server/sn1p-status.py` | Checks OneGrid, AutoTurret and sn1p.win once a minute and writes `status.json` with 90-day history |
| `server/countries.php` | Counts visits per country. Stores totals only: no IP addresses, no cookies |
| `server/geo-build.py` | Turns the free DB-IP country database into the lookup file `countries.php` reads |
| `server/nginx-snippet.conf`, `server/sn1p-status.cron` | The web server and scheduler settings those two scripts need |

## Live data

The page reads public data only: Discord presence (Lanyard), Discord member counts (public invites), GitHub contributions (public), the OneGrid player count and AutoTurret's active-ban total (`/api/public/stats`, a count with no player details).

IP geolocation by [DB-IP.com](https://db-ip.com) (CC BY 4.0).

## Running locally

It is a static site, so any web server works:

    python3 -m http.server 8000

The live-data parts need the server scripts and will fall back quietly when they are missing.
