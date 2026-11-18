// Static build for Cloudflare Pages: copies public/ to dist/ and writes the
// article data the frontend reads. Run on a schedule by GitHub Actions.
//
//   node scripts/build.js
//
// Exits non-zero (so CI skips the deploy and the last good version stays live)
// if the fetch looks broken — too few articles or most feeds failing.
const fs = require('fs');
const path = require('path');
const { FEEDS, fetchAll, sourceNames } = require('../lib/aggregator');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const MIN_ARTICLES = parseInt(process.env.MIN_ARTICLES, 10) || 20;

(async () => {
  const { articles, feedErrors } = await fetchAll();
  console.log(`[build] ${articles.length} articles, ${feedErrors}/${FEEDS.length} feeds failed`);

  if (articles.length < MIN_ARTICLES || feedErrors > FEEDS.length / 2) {
    console.error('[build] Fetch looks unhealthy — not writing dist/, keeping the current deploy');
    process.exit(1);
  }

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });
  fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(DIST, 'data', 'articles.json'),
    JSON.stringify({ articles, lastFetched: Date.now() })
  );
  fs.writeFileSync(path.join(DIST, 'data', 'sources.json'), JSON.stringify(sourceNames()));
  console.log(`[build] Wrote ${path.relative(ROOT, DIST)}/`);
  // rss-parser leaves keep-alive sockets open, which would hang the CI job
  process.exit(0);
})().catch(err => {
  console.error('[build] Failed:', err);
  process.exit(1);
});
