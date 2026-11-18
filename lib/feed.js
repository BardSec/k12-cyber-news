// RSS 2.0 feed of the newest articles, written to dist/feed.xml by scripts/build.js.
// Feed readers poll it, and an RSS-to-email service can turn it into a daily digest.
//
// This file is IDENTICAL in all EdTech IRL news repos; per-site details come from site.json.

const MAX_ITEMS = 50;

// Escape for XML text/attributes, and drop control characters XML 1.0 forbids
// (some upstream feeds include them, and one would make the whole feed invalid)
function xml(s) {
  return String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(date) {
  const d = new Date(date);
  return (isNaN(d) ? new Date() : d).toUTCString();
}

/**
 * @param {object} site      { title, description, url } from site.json
 * @param {Array}  articles  newest-first, as produced by fetchAll()
 * @param {number} builtAt   ms timestamp of this build
 */
function buildRss(site, articles, builtAt) {
  const base = site.url.replace(/\/?$/, '/');
  const items = articles
    .filter(a => a.link && a.link !== '#')
    .slice(0, MAX_ITEMS)
    .map(a => `    <item>
      <title>${xml(a.title)}</title>
      <link>${xml(a.link)}</link>
      <guid isPermaLink="true">${xml(a.link)}</guid>
      <pubDate>${rfc822(a.published)}</pubDate>
      <category>${xml(a.source)}</category>
      <description>${xml(`${a.summary ? a.summary.slice(0, 400) + ' ' : ''}(Source: ${a.source})`)}</description>
    </item>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(site.title)}</title>
    <link>${xml(base)}</link>
    <description>${xml(site.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${rfc822(builtAt)}</lastBuildDate>
    <ttl>30</ttl>
    <atom:link href="${xml(base)}feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${xml(base)}brand/edtechirl-badge-180.png</url>
      <title>${xml(site.title)}</title>
      <link>${xml(base)}</link>
    </image>
${items}
  </channel>
</rss>
`;
}

module.exports = { buildRss };
