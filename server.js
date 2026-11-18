// Local dev / Docker server. The Cloudflare Pages deployment is a static site
// (see scripts/build.js); this server serves the same /data/*.json paths from an
// in-memory cache so the frontend works identically in both places.
const express = require('express');
const cors = require('cors');
const path = require('path');
const { fetchAll, sourceNames } = require('./lib/aggregator');

const app = express();
app.use(cors());

// ── In-memory cache — refreshes every 15 minutes ──────────────────────────
let cache = { articles: [], lastFetched: null };
const CACHE_TTL_MS = 15 * 60 * 1000;
// Floor between forced refreshes so /api/refresh can't be used to hammer upstream feeds
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
let inFlight = null;

// Collapse concurrent refresh requests onto one fetch
function refreshCache() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    console.log('[info] Refreshing article cache…');
    const { articles } = await fetchAll();
    cache = { articles, lastFetched: Date.now() };
    console.log(`[info] Cache refreshed — ${articles.length} articles`);
  })().finally(() => { inFlight = null; });
  return inFlight;
}

function isCacheStale() {
  return !cache.lastFetched || Date.now() - cache.lastFetched > CACHE_TTL_MS;
}

// ── Data routes (same shape as the static build's files) ──────────────────

app.get('/data/articles.json', async (_req, res) => {
  try {
    if (isCacheStale()) await refreshCache();
    res.json({ articles: cache.articles, lastFetched: cache.lastFetched });
  } catch (err) {
    console.error('[error]', err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.get('/data/sources.json', (_req, res) => {
  res.json(sourceNames());
});

// ── API routes (kept for scripting against the Docker deployment) ─────────

app.get('/api/articles', async (req, res) => {
  try {
    if (isCacheStale()) await refreshCache();

    const { q = '', source = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    let articles = cache.articles;

    if (q) {
      const term = String(q).toLowerCase();
      articles = articles.filter(a =>
        a.title.toLowerCase().includes(term) ||
        a.summary.toLowerCase().includes(term)
      );
    }

    if (source) {
      articles = articles.filter(a => a.source === source);
    }

    const total = articles.length;
    const start = (pageNum - 1) * pageSize;

    res.json({
      articles: articles.slice(start, start + pageSize),
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
      lastFetched: cache.lastFetched,
    });
  } catch (err) {
    console.error('[error]', err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.get('/api/sources', (_req, res) => {
  res.json(sourceNames());
});

app.get('/api/refresh', async (_req, res) => {
  if (cache.lastFetched && Date.now() - cache.lastFetched < MIN_REFRESH_INTERVAL_MS) {
    return res.json({ ok: true, skipped: true, total: cache.articles.length });
  }
  await refreshCache();
  res.json({ ok: true, total: cache.articles.length });
});

app.use(express.static(path.join(__dirname, 'public')));

// Serve SPA for any other route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`K12 Cyber News running on http://localhost:${PORT}`);
  // Kick off initial cache load
  refreshCache();
});
