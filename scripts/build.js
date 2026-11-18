// Static build for Cloudflare Pages: copies public/ to dist/ and writes the
// article data the frontend reads. Run on a schedule by GitHub Actions.
//
//   node scripts/build.js
//
// Exits non-zero (so CI skips the deploy and the last good version stays live)
// if the fetch looks broken — too few articles or most feeds failing.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { FEEDS, fetchAll, sourceNames } = require('../lib/aggregator');
const { buildRss } = require('../lib/feed');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = require('../site.json');   // title, description, url for the RSS feed
const MIN_ARTICLES = parseInt(process.env.MIN_ARTICLES, 10) || 20;

(async () => {
  const { articles, feedErrors } = await fetchAll();
  console.log(`[build] ${articles.length} articles, ${feedErrors}/${FEEDS.length} feeds failed`);

  if (articles.length < MIN_ARTICLES || feedErrors > FEEDS.length / 2) {
    console.error('[build] Fetch looks unhealthy — not writing dist/, keeping the current deploy');
    process.exit(1);
  }

  const builtAt = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });

  // Cache-bust scripts and stylesheets. The edtechirl.com zone tells browsers to
  // keep JS/CSS for 4 hours (Cloudflare Browser Cache TTL), while HTML is always
  // revalidated, so after a deploy a returning visitor could get new HTML with an
  // old app.js and a broken page. Stamping each URL with a hash of its contents
  // makes every changed file a new URL.
  const indexPath = path.join(DIST, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace(/(href|src)="([^"?#:]+\.(?:css|js))"/g, (match, attr, file) => {
    const assetPath = path.join(DIST, file);
    if (!fs.existsSync(assetPath)) return match;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(assetPath)).digest('hex').slice(0, 10);
    return `${attr}="${file}?v=${hash}"`;
  });
  fs.writeFileSync(indexPath, html);
  fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(DIST, 'data', 'articles.json'),
    JSON.stringify({ articles, lastFetched: builtAt })
  );
  fs.writeFileSync(path.join(DIST, 'data', 'sources.json'), JSON.stringify(sourceNames()));
  fs.writeFileSync(path.join(DIST, 'feed.xml'), buildRss(SITE, articles, builtAt));
  console.log(`[build] Wrote ${path.relative(ROOT, DIST)}/`);
  // rss-parser leaves keep-alive sockets open, which would hang the CI job
  process.exit(0);
})().catch(err => {
  console.error('[build] Failed:', err);
  process.exit(1);
});
