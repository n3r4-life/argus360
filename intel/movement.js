(function () {
  'use strict';

  let currentMode = 'aviation';
  let searchResults = [];
  let selectedItem = null;
  let watchlist = [];

  // ── Mode Toggle ──
  document.querySelectorAll('.mvmt-mode-toggle .pill-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      document.querySelectorAll('.mvmt-mode-toggle .pill-chip').forEach(b => b.classList.toggle('active', b === btn));

      const input = document.getElementById('mvmtSearchInput');
      switch (currentMode) {
        case 'aviation': input.placeholder = 'Search tail number, callsign, or ICAO hex...'; break;
        case 'maritime': input.placeholder = 'Search IMO, MMSI, or vessel name...'; break;
        case 'radio':    input.placeholder = 'Search location, frequency, or feed name...'; break;
      }
      refreshChatContext();
    });
  });

  // ── Search ──
  document.getElementById('mvmtSearchBtn').addEventListener('click', () => mvmtSearch());
  document.getElementById('mvmtSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') mvmtSearch();
  });

  async function mvmtSearch() {
    const query = document.getElementById('mvmtSearchInput').value.trim();
    if (!query) return;

    const btn = document.getElementById('mvmtSearchBtn');
    btn.disabled = true;
    btn.textContent = 'Searching...';

    try {
      const resp = await browser.runtime.sendMessage({ action: 'intelGetStatus' });
      const providers = resp?.providers || {};

      if (currentMode === 'aviation') {
        const oskyOk = providers.opensky?.status === 'connected';
        const adsbOk = providers.adsbexchange?.status === 'connected';

        if (!oskyOk && !adsbOk) {
          renderNoProvider('OpenSky or ADS-B Exchange');
        } else {
          // Stub — will call provider when implemented
          renderStubResults('aviation', query);
        }
      } else if (currentMode === 'maritime') {
        const mtOk = providers.marinetraffic?.status === 'connected';
        if (!mtOk) {
          renderNoProvider('MarineTraffic');
        } else {
          renderStubResults('maritime', query);
        }
      } else if (currentMode === 'radio') {
        renderStubResults('radio', query);
      }
    } catch (e) {
      console.warn('[Movement] Search error:', e);
    }

    btn.disabled = false;
    btn.textContent = 'Search';
    refreshChatContext();
  }

  function renderNoProvider(name) {
    const container = document.getElementById('mvmtResults');
    container.innerHTML = `<div class="comp-empty">
      ${name} is not configured. <a href="../options/options.html#intel-providers" style="color:var(--accent);">Add your API key</a> to enable search.
    </div>`;
  }

  function renderStubResults(mode, query) {
    const container = document.getElementById('mvmtResults');
    const title = document.getElementById('mvmtResultsTitle');
    const empty = document.getElementById('mvmtResultsEmpty');

    const modeLabels = { aviation: 'Aircraft', maritime: 'Vessel', radio: 'Radio Feed' };
    title.textContent = `${modeLabels[mode]} Results`;

    container.innerHTML = `<div class="comp-empty">
      <strong>${modeLabels[mode]} search for "${query}"</strong><br>
      Provider integration pending. When connected, this will show:<br><br>
      ${mode === 'aviation' ? '• Tail number, operator, aircraft type<br>• Current position, altitude, speed<br>• Origin → Destination route<br>• Flight history timeline' : ''}
      ${mode === 'maritime' ? '• Vessel name, IMO, MMSI, flag state<br>• Current position, heading, speed<br>• Port calls and voyage history<br>• Ownership chain' : ''}
      ${mode === 'radio' ? '• Feed name, frequency, location<br>• Coverage radius on map<br>• Live stream link<br>• Archive search' : ''}
    </div>`;
  }

  // ── KG Actions (stubs) ──
  document.getElementById('mvmtAddToKg')?.addEventListener('click', async () => {
    if (!selectedItem) return;
    try {
      await browser.runtime.sendMessage({
        action: 'extractAndUpsert',
        text: selectedItem.name || selectedItem.query,
        pageUrl: `movement:${currentMode}:${selectedItem.id || ''}`,
        pageTitle: `Movement — ${selectedItem.name || ''}`
      });
      const btn = document.getElementById('mvmtAddToKg');
      btn.textContent = 'Added!';
      setTimeout(() => { btn.textContent = 'Add to KG'; }, 2000);
    } catch (e) { console.warn(e); }
  });

  // ── Watchlist persistence ──
  async function loadWatchlist() {
    const { mvmtWatchlist = [] } = await browser.storage.local.get({ mvmtWatchlist: [] });
    watchlist = mvmtWatchlist;
    renderWatchlist();
  }

  function renderWatchlist() {
    const container = document.getElementById('mvmtWatchlist');
    if (!watchlist.length) {
      container.innerHTML = '<div class="comp-empty">No tracked aircraft or vessels. Use "Watch" on search results to add items here.</div>';
      return;
    }
    container.innerHTML = watchlist.map(w => `
      <div class="mvmt-watch-item">
        <span class="mvmt-watch-icon">${w.mode === 'aviation' ? '✈' : w.mode === 'maritime' ? '🚢' : '📻'}</span>
        <span class="mvmt-watch-name">${w.name || w.id}</span>
        <span class="mvmt-watch-mode">${w.mode}</span>
        <button class="pill-chip mvmt-unwatch" data-id="${w.id}" style="font-size:8px;padding:1px 6px;">Remove</button>
      </div>
    `).join('');

    container.querySelectorAll('.mvmt-unwatch').forEach(btn => {
      btn.addEventListener('click', async () => {
        watchlist = watchlist.filter(w => w.id !== btn.dataset.id);
        await browser.storage.local.set({ mvmtWatchlist: watchlist });
        renderWatchlist();
      });
    });
  }

  // ── AI Chat ──
  function refreshChatContext() {
    if (typeof ArgusChat === 'undefined') return;
    const lines = [`Movement Intelligence — Mode: ${currentMode}\n`];
    if (searchResults.length) {
      lines.push(`Search results: ${searchResults.length}`);
    }
    if (watchlist.length) {
      lines.push(`\nWatchlist (${watchlist.length}):`);
      watchlist.forEach(w => lines.push(`- ${w.name || w.id} (${w.mode})`));
    }
    ArgusChat.updateContext(lines.join('\n'));
  }

  // ── Init ──
  async function init() {
    await loadWatchlist();

    if (typeof ArgusChat !== 'undefined') {
      ArgusChat.init({
        container: document.getElementById('argus-chat-container'),
        contextType: 'Movement Intelligence',
        contextData: `Movement tracking page. Mode: ${currentMode}. Providers: OpenSky, ADS-B Exchange, MarineTraffic, Broadcastify.`,
        pageUrl: window.location.href,
        pageTitle: 'Movement — Argus Intelligence'
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
