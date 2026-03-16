(function () {
  'use strict';

  let articles = [];
  let searchQuery = '';

  // Set default date range (last 7 days)
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  document.getElementById('evtDateTo').value = today.toISOString().slice(0, 10);
  document.getElementById('evtDateFrom').value = weekAgo.toISOString().slice(0, 10);

  // ── Search ──
  document.getElementById('evtSearchBtn').addEventListener('click', () => evtSearch());
  document.getElementById('evtSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') evtSearch();
  });

  async function evtSearch() {
    const query = document.getElementById('evtSearchInput').value.trim();
    if (!query) return;
    searchQuery = query;

    const btn = document.getElementById('evtSearchBtn');
    btn.disabled = true;
    btn.textContent = 'Searching...';

    try {
      const resp = await browser.runtime.sendMessage({ action: 'intelGetStatus' });
      const gdelt = resp?.providers?.gdelt;

      if (!gdelt || gdelt.status !== 'connected') {
        renderNoProvider();
      } else {
        // Stub — will call GDELT when provider is implemented
        renderStubResults(query);
      }
    } catch (e) {
      console.warn('[Events] Search error:', e);
    }

    btn.disabled = false;
    btn.textContent = 'Search';
    refreshChatContext();
  }

  function renderNoProvider() {
    const container = document.getElementById('evtArticles');
    container.innerHTML = `<div class="comp-empty">
      GDELT is not configured. <a href="../options/options.html#intel-providers" style="color:var(--accent);">Add your API key</a> to enable global event monitoring.
    </div>`;
  }

  function renderStubResults(query) {
    const container = document.getElementById('evtArticles');
    const countEl = document.getElementById('evtArticleCount');
    countEl.textContent = '';

    container.innerHTML = `<div class="comp-empty">
      <strong>Event search for "${query}"</strong><br>
      GDELT provider integration pending. When connected, this will show:<br><br>
      • Article titles, sources, and publication dates<br>
      • Sentiment tone scores per article<br>
      • Coverage volume chart populated with daily article counts<br>
      • Geographic heat map showing source country distribution<br>
      • Coverage spike detection for KG event creation
    </div>`;

    document.getElementById('evtAddEventToKg').disabled = false;
  }

  // ── KG Actions ──
  document.getElementById('evtAddEventToKg')?.addEventListener('click', async () => {
    if (!searchQuery) return;
    try {
      await browser.runtime.sendMessage({
        action: 'extractAndUpsert',
        text: `Global event: ${searchQuery}`,
        pageUrl: `gdelt:${searchQuery}`,
        pageTitle: `GDELT — ${searchQuery}`
      });
      const btn = document.getElementById('evtAddEventToKg');
      btn.textContent = 'Added!';
      setTimeout(() => { btn.textContent = 'Add Coverage Spike as KG Event'; }, 2000);
    } catch (e) { console.warn(e); }
  });

  // ── AI Chat ──
  function refreshChatContext() {
    if (typeof ArgusChat === 'undefined') return;
    const lines = ['Events Intelligence Page\n'];
    if (searchQuery) lines.push(`Current search: ${searchQuery}`);
    if (articles.length) {
      lines.push(`Articles: ${articles.length}`);
      articles.slice(0, 10).forEach(a => {
        lines.push(`- ${a.title} (${a.source}, ${a.date}) — tone: ${a.tone || '?'}`);
      });
    }
    ArgusChat.updateContext(lines.join('\n'));
  }

  // ── Init ──
  if (typeof ArgusChat !== 'undefined') {
    ArgusChat.init({
      container: document.getElementById('argus-chat-container'),
      contextType: 'Events Intelligence',
      contextData: 'Events monitoring page. Provider: GDELT. Search for topics to analyze global media coverage.',
      pageUrl: window.location.href,
      pageTitle: 'Events — Argus Intelligence'
    });
  }
})();
