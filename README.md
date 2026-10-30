# Sn1p.win

Personal site for **Sn1p**, founder of OneGrid Rust and AutoTurret. Live at [sn1p.win](https://sn1p.win).

A static page whose name is a live field of text characters. A canvas grid samples the word SN1P as a mask every frame and picks a character per cell: heavy ones inside the letterforms, light ones at the edges, sparse drifting dust elsewhere. It resolves out of noise on load, and the cursor bends where each cell samples, so the letters stretch and glow as you move through them. Also live status data and a visitor-country counter. No images are used anywhere on the page.

## Files

| File | What it is |
|------|------------|
| `index.html` | The site: one page, inline CSS and JavaScript |
| `status.html` | Status page, reads `status.json` |
| `og.png` | Link-preview image (1200x630) |
| `og.png`, `favicon*.png` | Link preview and icons, the only images the page still uses |
| `bg.mp4`, `pfp.mp4`, `music.mp3`, other images | Left over from earlier designs, no longer referenced |
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
