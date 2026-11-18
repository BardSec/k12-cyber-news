// Sponsor block for the EdTech IRL news sites. scripts/build.js swaps the
// <!-- SPONSOR_CARD --> and <!-- SPONSOR_FOOTER --> placeholders in index.html
// for this markup, using the "sponsor" section of site.json. To change the
// sponsor or its message, edit site.json, not this file.
//
// This file is IDENTICAL in all EdTech IRL news repos.

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// UTM tags let the sponsor's own analytics see which site and spot a visit came
// from. Nothing is tracked on the news sites themselves.
function trackedUrl(sponsor, siteKey, placement) {
  const u = new URL(sponsor.url);
  u.searchParams.set('utm_source', sponsor.utm_source || siteKey);
  u.searchParams.set('utm_medium', 'sponsor');
  u.searchParams.set('utm_campaign', 'edtechirl-news');
  u.searchParams.set('utm_content', placement);
  return u.href;
}

function sponsorCard(site) {
  const s = site.sponsor;
  if (!s) return '';
  const href = esc(trackedUrl(s, site.key, 'sidebar'));
  return `<div class="sidebar-card sponsor-card">
        <h3>Sponsor</h3>
        <a class="sponsor-name" href="${href}" rel="sponsored noopener" target="_blank">
          <img src="${esc(s.logo)}" alt="" width="28" height="28" />
          <span>${esc(s.name)}</span>
        </a>
        <p>${esc(s.message)}</p>
        <a class="sponsor-cta" href="${href}" rel="sponsored noopener" target="_blank">${esc(s.cta)} →</a>
        <p class="sponsor-disclosure">${esc(s.disclosure)}</p>
      </div>`;
}

function sponsorFooter(site) {
  const s = site.sponsor;
  if (!s) return '';
  const href = esc(trackedUrl(s, site.key, 'footer'));
  return `<p class="footer-sponsor">Sponsored by
        <a href="${href}" rel="sponsored noopener" target="_blank"><img src="${esc(s.logo)}" alt="" width="20" height="20" />${esc(s.name)}</a>
      </p>`;
}

function applySponsor(html, site) {
  return html
    .replace('<!-- SPONSOR_CARD -->', sponsorCard(site))
    .replace('<!-- SPONSOR_FOOTER -->', sponsorFooter(site));
}

module.exports = { applySponsor };
