/* K-12 Cyber Watch — frontend */

const API = '';          // same origin
const PAGE_SIZE = 15;

let state = {
  articles: [],
  filtered: [],
  page: 1,
  query: '',
  source: '',
  sort: 'newest',
  total: 0,
  lastFetched: null,
  sources: [],
  loading: false,
};

// ── DOM refs ─────────────────────────────────────────────────────────────
const feed          = document.getElementById('feed');
const pagination    = document.getElementById('pagination');
const searchInput   = document.getElementById('search-input');
const sourceSelect  = document.getElementById('source-select');
const sortSelect    = document.getElementById('sort-select');
const feedTitle     = document.getElementById('feed-title');
const articleCount  = document.getElementById('article-count');
const statTotal     = document.getElementById('stat-total');
const statSources   = document.getElementById('stat-sources');
const statRefresh   = document.getElementById('stat-refresh');
const sourceList    = document.getElementById('source-list');
const btnRefresh    = document.getElementById('btn-refresh');
const tagCloud      = document.getElementById('tag-cloud');
const cardTpl       = document.getElementById('card-tpl');
const skeletonTpl   = document.getElementById('skeleton-tpl');

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(str, max = 200) {
  if (!str) return '';
  const clean = str.replace(/<[^>]+>/g, '').trim();
  return clean.length > max ? clean.slice(0, max).trimEnd() + '…' : clean;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render ────────────────────────────────────────────────────────────────
function showSkeletons(n = 6) {
  feed.innerHTML = '';
  for (let i = 0; i < n; i++) {
    feed.appendChild(skeletonTpl.content.cloneNode(true));
  }
}

function renderArticles() {
  feed.innerHTML = '';

  const start = (state.page - 1) * PAGE_SIZE;
  const slice = state.filtered.slice(start, start + PAGE_SIZE);

  if (slice.length === 0) {
    feed.innerHTML = `
      <div class="state-msg">
        <div class="state-icon">🔎</div>
        <h3>No articles found</h3>
        <p>Try a different search term or clear the filters.</p>
      </div>`;
    pagination.innerHTML = '';
    return;
  }

  for (const article of slice) {
    const node = cardTpl.content.cloneNode(true);

    node.querySelector('.card-source').textContent = article.source;
    node.querySelector('.card-date').textContent   = formatDate(article.published);

    const link = node.querySelector('.card-link');
    link.href        = escapeHtml(article.link);
    link.textContent = article.title;

    node.querySelector('.card-summary').textContent = truncate(article.summary);

    const readMore = node.querySelector('.card-read-more');
    readMore.href = escapeHtml(article.link);

    feed.appendChild(node);
  }

  renderPagination();
}

function renderPagination() {
  pagination.innerHTML = '';
  const pages = Math.ceil(state.filtered.length / PAGE_SIZE);
  if (pages <= 1) return;

  const mkBtn = (label, page, disabled = false) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (page === state.page ? ' active' : '');
    btn.textContent = label;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener('click', () => { state.page = page; renderArticles(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    return btn;
  };

  pagination.appendChild(mkBtn('← Prev', state.page - 1, state.page === 1));

  // show at most 7 page buttons
  const range = 3;
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - state.page) <= range) {
      pagination.appendChild(mkBtn(p, p));
    } else if (Math.abs(p - state.page) === range + 1) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '…';
      ellipsis.style.cssText = 'color:var(--text-muted);padding:0 4px;align-self:center';
      pagination.appendChild(ellipsis);
    }
  }

  pagination.appendChild(mkBtn('Next →', state.page + 1, state.page === pages));
}

function updateStats() {
  statTotal.textContent   = state.total.toLocaleString();
  statSources.textContent = state.sources.length;
  statRefresh.textContent = state.lastFetched ? formatDate(state.lastFetched) : '—';

  articleCount.textContent = `${state.filtered.length} article${state.filtered.length !== 1 ? 's' : ''}`;
  feedTitle.textContent = state.query
    ? `Results for "${state.query}"`
    : state.source
    ? state.source
    : 'Latest Articles';
}

function populateSourceSelect() {
  // Preserve current value
  const current = sourceSelect.value;
  sourceSelect.innerHTML = '<option value="">All Sources</option>';
  for (const s of state.sources) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sourceSelect.appendChild(opt);
  }
  sourceSelect.value = current;

  sourceList.innerHTML = '';
  for (const s of state.sources) {
    const li = document.createElement('li');
    li.textContent = s;
    sourceList.appendChild(li);
  }
}

// ── Filter & sort ─────────────────────────────────────────────────────────
function applyFilters() {
  let arr = [...state.articles];

  if (state.query) {
    const q = state.query.toLowerCase();
    arr = arr.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.source.toLowerCase().includes(q)
    );
  }

  if (state.source) {
    arr = arr.filter(a => a.source === state.source);
  }

  if (state.sort === 'oldest') {
    arr.sort((a, b) => new Date(a.published) - new Date(b.published));
  } else {
    arr.sort((a, b) => new Date(b.published) - new Date(a.published));
  }

  state.filtered = arr;
  state.page = 1;
  updateStats();
  renderArticles();
}

// ── Fetch ─────────────────────────────────────────────────────────────────
async function fetchArticles(forceRefresh = false) {
  if (state.loading) return;
  state.loading = true;
  btnRefresh.classList.add('spinning');
  showSkeletons();

  try {
    if (forceRefresh) {
      await fetch(`${API}/api/refresh`);
    }

    const [articlesRes, sourcesRes] = await Promise.all([
      fetch(`${API}/api/articles?limit=500`),
      fetch(`${API}/api/sources`),
    ]);

    if (!articlesRes.ok) throw new Error('Failed to load articles');

    const data    = await articlesRes.json();
    const sources = await sourcesRes.json();

    state.articles    = data.articles || [];
    state.total       = data.total || state.articles.length;
    state.lastFetched = data.lastFetched;
    state.sources     = sources || [];

    populateSourceSelect();
    applyFilters();

  } catch (err) {
    feed.innerHTML = `
      <div class="state-msg">
        <div class="state-icon">⚠️</div>
        <h3>Could not load articles</h3>
        <p>${escapeHtml(err.message)}</p>
        <p style="margin-top:8px;font-size:.8rem">Make sure the server is running, then try refreshing.</p>
      </div>`;
  } finally {
    state.loading = false;
    btnRefresh.classList.remove('spinning');
    updateStats();
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────
let debounceTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    state.query = searchInput.value.trim();
    // Clear active tag highlight
    document.querySelectorAll('.tag.active').forEach(t => t.classList.remove('active'));
    if (state.query) {
      document.querySelectorAll(`.tag[data-q="${state.query}"]`).forEach(t => t.classList.add('active'));
    }
    applyFilters();
  }, 300);
});

sourceSelect.addEventListener('change', () => {
  state.source = sourceSelect.value;
  applyFilters();
});

sortSelect.addEventListener('change', () => {
  state.sort = sortSelect.value;
  applyFilters();
});

btnRefresh.addEventListener('click', () => fetchArticles(true));

tagCloud.addEventListener('click', e => {
  const tag = e.target.closest('.tag');
  if (!tag) return;
  const q = tag.dataset.q;

  if (tag.classList.contains('active')) {
    tag.classList.remove('active');
    state.query = '';
    searchInput.value = '';
  } else {
    document.querySelectorAll('.tag.active').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');
    state.query = q;
    searchInput.value = q;
  }
  applyFilters();
});

// Auto-refresh every 15 minutes
setInterval(() => fetchArticles(false), 15 * 60 * 1000);

// ── Boot ──────────────────────────────────────────────────────────────────
fetchArticles();
