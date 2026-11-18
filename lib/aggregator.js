// Feed list, relevance filters and fetch/dedupe logic.
// Shared by server.js (Docker / local dev) and scripts/build.js (static Cloudflare Pages build).
const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'K12CyberNews/1.0 RSS Aggregator'
  }
});

// ── Feed sources ──────────────────────────────────────────────────────────
// `filter` controls which articles from a feed are kept:
//   'none'  – keep everything (the feed is already on-topic)
//   'k12'   – general security feed: keep only K12 / education stories
//   'cyber' – education feed: keep only cybersecurity stories
const FEEDS = [
  { name: 'Google News – K-12 Cybersecurity', url: 'https://news.google.com/rss/search?q=k12+cybersecurity+school+district&hl=en-US&gl=US&ceid=US:en', filter: 'none' },
  { name: 'Google News – School Ransomware',   url: 'https://news.google.com/rss/search?q=school+district+ransomware+data+breach&hl=en-US&gl=US&ceid=US:en', filter: 'none' },

  // General security and public-sector outlets — keep the K12 stories
  { name: 'CISA Advisories',    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', filter: 'k12' },
  { name: 'EdScoop',            url: 'https://edscoop.com/feed/',                       filter: 'k12' },
  { name: 'StateScoop',         url: 'https://statescoop.com/feed/',                    filter: 'k12' },
  { name: 'The Hacker News',    url: 'https://feeds.feedburner.com/TheHackersNews',     filter: 'k12' },
  { name: 'Cybersecurity Dive', url: 'https://www.cybersecuritydive.com/feeds/news/',   filter: 'k12' },
  { name: 'Bleeping Computer',  url: 'https://www.bleepingcomputer.com/feed/',          filter: 'k12' },
  { name: 'Dark Reading',       url: 'https://www.darkreading.com/rss_simple.asp',      filter: 'k12' },
  { name: 'SecurityWeek',       url: 'https://feeds.feedburner.com/Securityweek',       filter: 'k12' },

  // Education outlets — keep the cybersecurity stories
  { name: 'The 74 Million',              url: 'https://the74million.org/feed',                   filter: 'cyber' },
  { name: 'EdSurge',                     url: 'https://www.edsurge.com/articles_rss',            filter: 'cyber' },
  { name: 'eSchool News',                url: 'https://eschoolnews.com/feed',                    filter: 'cyber' },
  { name: 'K-12 Dive',                   url: 'https://www.k12dive.com/feeds/news/',             filter: 'cyber' },
  { name: 'The Independent – Education', url: 'http://www.independent.co.uk/news/education/rss', filter: 'cyber' },
  { name: 'Chalkbeat',                   url: 'https://www.chalkbeat.org/arc/outboundfeeds/rss/', filter: 'cyber' },
  { name: 'Education Next',              url: 'https://www.educationnext.org/feed/',             filter: 'cyber' },
  { name: 'NYT – Education',             url: 'https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/section/education/rss.xml', filter: 'cyber' },

  // Our own content — always included
  { name: 'EdTech IRL',                 url: 'https://www.edtechirl.com/feed',             filter: 'none' },
  { name: 'Zero Breach Zone (Podcast)', url: 'https://feeds.transistor.fm/zero-breach-zone', filter: 'none' },
];

// Keywords that indicate cybersecurity relevance (substring match)
const CYBER_KEYWORDS = [
  'cybersecurity', 'cyber security', 'cyber attack', 'cyberattack',
  'ransomware', 'malware', 'phishing', 'data breach', 'hack', 'hacker',
  'vulnerability', 'exploit', 'cisa', 'nist', 'incident response',
  'data privacy', 'identity theft', 'credential', 'password', 'mfa',
  'two-factor', 'zero-day', 'patch', 'firewall', 'encryption',
  'infosec', 'threat', 'intrusion', 'ddos', 'spyware', 'trojan',
  'social engineering', 'vishing', 'smishing', 'dark web',
  'powerschool', 'ferpa', 'coppa', 'student data', 'data protection',
];

// Keywords that indicate K12 / education relevance (substring match)
const K12_KEYWORDS = [
  'k-12', 'k12', 'school', 'district', 'student', 'education',
  'classroom', 'teacher', 'university', 'college', 'campus',
  'kindergarten', 'elementary', 'middle school', 'high school',
  'superintendent', 'principal', 'edtech', 'ed tech', 'learning management',
  'canvas', 'schoology', 'powerschool', 'infinite campus',
  'student data', 'ferpa', 'coppa', 'children', 'minors',
];

function itemText(item) {
  return [
    item.title || '',
    item.contentSnippet || '',
    item.content || '',
    // Some feeds give categories as objects ({ _: 'name', $: {...} }) rather than strings
    item.categories?.map(c => (typeof c === 'string' ? c : c?._ || '')).join(' ') || '',
  ].join(' ').toLowerCase();
}

const FILTERS = {
  none:  () => true,
  k12:   item => { const t = itemText(item); return K12_KEYWORDS.some(kw => t.includes(kw)); },
  cyber: item => { const t = itemText(item); return CYBER_KEYWORDS.some(kw => t.includes(kw)); },
};

// Only pass through http(s) links — a feed could otherwise inject a
// javascript: URL that runs when a reader clicks the card.
function safeLink(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '#';
  } catch {
    return '#';
  }
}

function normalizeItem(item, feedName) {
  const link = safeLink(item.link || item.guid || '');
  return {
    title: item.title || 'Untitled',
    link,
    published: item.isoDate || item.pubDate || new Date().toISOString(),
    summary: item.contentSnippet || item.summary || '',
    source: feedName,
    guid: item.guid || (link !== '#' ? link : item.title),
  };
}

// Returns the feed's kept items, or null if the fetch failed
async function fetchFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
    const keep = FILTERS[feed.filter] || FILTERS.none;
    return (result.items || []).filter(keep).map(i => normalizeItem(i, feed.name));
  } catch (err) {
    console.warn(`[warn] Failed to fetch "${feed.name}": ${err.message}`);
    return null;
  }
}

// Fetch every feed, filter, dedupe and sort newest first.
// Returns { articles, feedErrors } — feedErrors counts feeds that failed to fetch.
async function fetchAll() {
  let feedErrors = 0;
  const results = await Promise.all(FEEDS.map(f => fetchFeed(f).then(r => {
    if (r === null) { feedErrors++; return []; }
    return r;
  })));

  const seen = new Set();
  const articles = results.flat().filter(a => {
    if (seen.has(a.guid)) return false;
    seen.add(a.guid);
    return true;
  });

  articles.sort((a, b) => new Date(b.published) - new Date(a.published));
  return { articles, feedErrors };
}

const sourceNames = () => FEEDS.map(f => f.name);

module.exports = { FEEDS, fetchAll, sourceNames };
