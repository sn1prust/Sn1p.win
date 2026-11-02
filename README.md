# Sn1p.win

Personal site for **Sn1p**, founder of OneGrid Rust and AutoTurret. Live at [sn1p.win](https://sn1p.win).

One self-contained page laid out like the object view of a data-analysis app: a header with properties, Overview / Projects / Links tabs, a link graph connecting Sn1p to each project and account, a filterable project table, a detail drawer per project, and Ctrl/Cmd+K search. No build step and no dependencies; the only external request is Google Fonts. Dark theme by default.

Projects and contacts are three constants at the top of the page script: `PROFILE`, `PROJECTS` and `CONTACT`.

## Files

| File | What it is |
|------|------------|
| `index.html` | The site: one page, inline CSS, JavaScript and SVG |
| `assets/` | Favicon, Apple touch icon and link-preview image |
| `status.html` | Status page, reads `status.json` |
| `og.png`, `favicon*.png`, `bg.mp4`, `pfp.*`, `music.mp3`, other images | Left over from earlier designs, no longer referenced |
| `server/sn1p-status.py` | Checks OneGrid, AutoTurret and sn1p.win once a minute and writes `status.json` with 90-day history |
| `server/countries.php` | Counts visits per country. Stores totals only: no IP addresses, no cookies |
| `server/geo-build.py` | Turns the free DB-IP country database into the lookup file `countries.php` reads |
| `server/nginx-snippet.conf`, `server/sn1p-status.cron` | The web server and scheduler settings those two scripts need |
| `tools/gitea-mirror/` | Copies Gitea repos to GitHub so they count on the contribution graph |

## Status page

`status.html` shows the uptime data that `server/sn1p-status.py` writes. IP geolocation for the visitor counter by [DB-IP.com](https://db-ip.com) (CC BY 4.0).

## Running locally

It is a static site, so any web server works:

    python3 -m http.server 8000
