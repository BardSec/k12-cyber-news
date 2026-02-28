# K12 Cyber Watch

A self-hosted RSS aggregator that surfaces cybersecurity news relevant to K12 schools and districts. Articles are pulled from multiple industry sources, filtered for education relevance, deduplicated, and served through a clean web interface.

## Features

- Aggregates from 10 RSS sources including CISA, EdScoop, Bleeping Computer, Dark Reading, EdTechIRL, and Google News searches scoped to K12 and ransomware
- Keyword filtering ensures general-purpose security feeds only surface education-relevant stories
- In-memory cache refreshes every 15 minutes — no database required
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

## API

| Endpoint | Description |
|---|---|
| `GET /api/articles` | Paginated article list. Query params: `q`, `source`, `page`, `limit` (max 100) |
| `GET /api/sources` | List of all configured source names |
| `GET /api/refresh` | Force a cache refresh immediately |

## Tech stack

- Node.js 20 / Express
- [rss-parser](https://github.com/rbren/rss-parser)
- Vanilla JS frontend (no framework)
- Docker multi-stage build (builder + runtime, non-root user)
