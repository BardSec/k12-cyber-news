const express = require('express');
const Parser = require('rss-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'K12CyberNews/1.0 RSS Aggregator'
  }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// RSS feed sources — mix of cybersecurity and ed-tech outlets
const FEEDS = [
  {
    name: 'Google News – K-12 Cybersecurity',
    url: 'https://news.google.com/rss/search?q=k12+cybersecurity+school+district&hl=en-US&gl=US&ceid=US:en',
    alwaysInclude: true,
  },
  {
    name: 'Google News – School Ransomware',
    url: 'https://news.google.com/rss/search?q=school+district+ransomware+data+breach&hl=en-US&gl=US&ceid=US:en',
    alwaysInclude: true,
  },
  {
    name: 'CISA Advisories',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    alwaysInclude: false,
  },
  {
    name: 'EdScoop',
    url: 'https://edscoop.com/feed/',
    alwaysInclude: false,
  },
  {
    name: 'StateScoop',
    url: 'https://statescoop.com/feed/',
    alwaysInclude: false,
  },
  {
    name: 'The Hacker News',
    url: 'https://feeds.feedburner.com/TheHackersNews',
    alwaysInclude: false,
  },
  {
    name: 'Cybersecurity Dive',
    url: 'https://www.cybersecuritydive.com/feeds/news/',
    alwaysInclude: false,
  },
  {
    name: 'Bleeping Computer',
    url: 'https://www.bleepingcomputer.com/feed/',
    alwaysInclude: false,
  },
  {
    name: 'Dark Reading',
    url: 'https://www.darkreading.com/rss_simple.asp',
    alwaysInclude: false,
  },
  {
    name: 'SecurityWeek',
    url: 'https://feeds.feedburner.com/Securityweek',
    alwaysInclude: false,
  },
];

// Keywords that indicate K-12 / education relevance
const K12_KEYWORDS = [
  'k-12', 'k12', 'school', 'district', 'student', 'education',
  'classroom', 'teacher', 'university', 'college', 'campus',
  'kindergarten', 'elementary', 'middle school', 'high school',
  'superintendent', 'principal', 'edtech', 'ed tech', 'learning management',
  'canvas', 'schoology', 'powerschool', 'infinite campus',
  'student data', 'ferpa', 'coppa', 'children', 'minors',
];

function isK12Relevant(item) {
  const text = [
    item.title || '',
    item.contentSnippet || '',
    item.content || '',
    item.categories?.join(' ') || '',
  ].join(' ').toLowerCase();

  return K12_KEYWORDS.some(kw => text.includes(kw));
}

function normalizeItem(item, feedName) {
  return {
    title: item.title || 'Untitled',
    link: item.link || item.guid || '#',
    published: item.pubDate || item.isoDate || new Date().toISOString(),
    summary: item.contentSnippet || item.summary || '',
    source: feedName,
    guid: item.guid || item.link || item.title,
  };
}

// In-memory cache — refreshes every 15 minutes
let cache = { articles: [], lastFetched: null };
const CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
    const items = result.items || [];
    const normalized = items.map(i => normalizeItem(i, feed.name));
    if (feed.alwaysInclude) return normalized;
    return normalized.filter(isK12Relevant);
  } catch (err) {
    console.warn(`[warn] Failed to fetch "${feed.name}": ${err.message}`);
    return [];
  }
}

async function refreshCache() {
  console.log('[info] Refreshing article cache…');
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));

  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));

  // Deduplicate by guid/link
  const seen = new Set();
  const deduped = all.filter(a => {
    if (seen.has(a.guid)) return false;
    seen.add(a.guid);
    return true;
  });

  // Sort newest first
  deduped.sort((a, b) => new Date(b.published) - new Date(a.published));

  cache = { articles: deduped, lastFetched: Date.now() };
  console.log(`[info] Cache refreshed — ${deduped.length} articles`);
}

function isCacheStale() {
  return !cache.lastFetched || Date.now() - cache.lastFetched > CACHE_TTL_MS;
}

// --- API routes ---

app.get('/api/articles', async (req, res) => {
  try {
    if (isCacheStale()) await refreshCache();

    const { q = '', source = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    let articles = cache.articles;

    if (q) {
      const term = q.toLowerCase();
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
    const paged = articles.slice(start, start + pageSize);

    res.json({
      articles: paged,
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
  res.json(FEEDS.map(f => f.name));
});

app.get('/api/refresh', async (req, res) => {
  await refreshCache();
  res.json({ ok: true, total: cache.articles.length });
});

// Serve SPA for any other route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`K-12 Cyber News running on http://localhost:${PORT}`);
  // Kick off initial cache load
  refreshCache();
});
