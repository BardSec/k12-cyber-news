# K12 Cyber Watch

A self-hosted RSS aggregator that surfaces cybersecurity news relevant to K12 schools and districts. Articles are pulled from multiple industry sources, filtered for education relevance, deduplicated, and served through a clean web interface.

## Features

- Aggregates from 10 RSS sources including CISA, EdScoop, Bleeping Computer, Dark Reading, EdTechIRL, and Google News searches scoped to K12 and ransomware
- Keyword filtering ensures general-purpose security feeds only surface education-relevant stories
- Runs as a static site on Cloudflare Pages, rebuilt every 30 minutes by GitHub Actions — no server or database required
- Can also run as a Node/Express server in Docker, with an in-memory cache that refreshes every 15 minutes
- Search, source filter, and sort controls in the UI
- Quick-access tag cloud for common K12 threat topics (ransomware, FERPA, PowerSchool, etc.)
- Pagination with configurable page size

## Sources

| Source | Always included |
|---|---|
| Google News – K12 Cybersecurity | Yes |
| Google News – School Ransomware | Yes |
| CISA Advisories | Filtered |
| EdScoop | Filtered |
| StateScoop | Filtered |
| The Hacker News | Filtered |
| Cybersecurity Dive | Filtered |
| Bleeping Computer | Filtered |
| Dark Reading | Filtered |
| SecurityWeek | Filtered |
| The 74 Million | Filtered |
| EdSurge | Filtered |
| eSchool News | Filtered |
| K12 Dive | Filtered |
| The Independent – Education | Filtered |
| Chalkbeat | Filtered |
| Education Next | Filtered |
| NYT – Education | Filtered |
| EdTech IRL | Yes |
| Zero Breach Zone (Podcast) | Yes |

"Filtered" sources are checked against a keyword list (school, district, student, FERPA, COPPA, edtech, etc.) before inclusion.

## Deploying to Cloudflare Pages

The Pages site is plain static files. `scripts/build.js` fetches every feed, writes
`dist/data/articles.json` and `dist/data/sources.json`, and copies `public/` into `dist/`.
The frontend loads those two files and does search, filtering and paging in the browser.

`.github/workflows/deploy.yml` runs the build and deploys `dist/` with Wrangler:

- every 30 minutes on a schedule (GitHub may run scheduled jobs late)
- on every push to `claude/k12-security-news-aggregator-CZ9zy`
- by hand from the Actions tab ("Run workflow")

If fewer than 20 articles come back, or more than half the feeds fail, the build exits
with an error and the deploy is skipped, so the last good version stays live.

GitHub disables scheduled workflows in public repos after 60 days with no commits. To
prevent that, the scheduled run pushes an empty "keepalive" commit when the last commit
is 25 or more days old.

**One-time setup:**

1. Create the Pages project: `npx wrangler pages project create k12-cyber-news --production-branch=main`
2. Add repository secrets `CLOUDFLARE_API_TOKEN` (with Cloudflare Pages: Edit permission) and `CLOUDFLARE_ACCOUNT_ID`
3. Run the workflow once from the Actions tab, then add the custom domain to the Pages project

To build locally: `npm run build`, then serve `dist/` with any static file server.

## Running with Docker

```bash
docker compose up -d --build
```

The app will be available at `http://localhost:30303`.

## Running locally

```bash
npm install
npm start        # production
npm run dev      # development (auto-restarts on file change)
```

Defaults to port `3000` unless the `PORT` environment variable is set.

## API (Docker / local server only)

The static Pages site has no API. The server also serves `/data/articles.json` and `/data/sources.json`, the same files the static build writes.

| Endpoint | Description |
|---|---|
| `GET /api/articles` | Paginated article list. Query params: `q`, `source`, `page`, `limit` (max 100) |
| `GET /api/sources` | List of all configured source names |
| `GET /api/refresh` | Force a cache refresh immediately |

## RSS feed

Each build also writes `feed.xml`, an RSS 2.0 feed of the 50 newest articles, at `<site>/feed.xml`. Pages link to it from a `<link rel="alternate">` tag and from the **Subscribe** card in the sidebar.

- Site name, description and URL for the feed come from `site.json`.
- `lib/feed.js` is identical in all three news repos.
- The feed exists only in the static build (`npm run build`), not in the local Express server.

## Sponsor

The EdTech IRL news sites are sponsored by [SoftwareStudioK12](https://softwarestudiok12.com/). Each page shows a sponsor card in the sidebar and a "Sponsored by" line in the footer, both with a disclosure that the sponsor has no say in which articles appear.

- The sponsor's name, logo, link, per-site message, call to action, disclosure and `utm_source` live in the `sponsor` section of `site.json`. Edit that to change the sponsor or its message.
- At build time, `lib/sponsor.js` (identical in all three repos) replaces the `<!-- SPONSOR_CARD -->` and `<!-- SPONSOR_FOOTER -->` placeholders in `index.html`.
- The local Express server serves `public/` unbuilt, so it doesn't show the sponsor block.
- Sponsor links carry UTM tags (`utm_medium=sponsor`, `utm_campaign=edtechirl-news`, `utm_content=sidebar|footer`). Clicks show up in SoftwareStudioK12's analytics. The news sites themselves track nothing.
- The logo is `public/brand/sponsor-softwarestudiok12.svg`, a light-only copy of the mark from softwarestudiok12.com. The original switches its lines to white in dark mode, which would vanish on these white cards.

## Branding (EdTech IRL network)

This site is one of three EdTech IRL news feeds: [K12 Cyber Watch](https://news.edtechirl.com/), [HiEd Security News](https://hied-news.edtechirl.com/) and [Research Security News](https://ressec-news.edtechirl.com/). Each has the same top bar and footer linking the three sites and the [EdTech IRL blog](https://www.edtechirl.com/).

- `public/brand/brand.css` is **identical in all three repos**. It sets the light theme, the network bar, the footer and each site's accent colors. Edit it in one repo and copy it to the other two.
- Each page picks its accent with `<html data-site="k12|hied|ressec">`. Accents: K12 blue `#1D4ED8`, HiEd teal `#0F766E`, ResSec orange `#B45309` for text with `#FF8200` for highlights. The EdTech IRL coral `#FD5353` is used only in the top bar.
- `public/brand/` also holds the IRL badge (`edtechirl-badge-64.png`, `-180.png`, `favicon-32.png`).

## Tech stack

- Node.js 20 / Express
- [rss-parser](https://github.com/rbren/rss-parser)
- Vanilla JS frontend (no framework)
- Cloudflare Pages (static build) + GitHub Actions (schedule)
- Docker multi-stage build (builder + runtime, non-root user)
