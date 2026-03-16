(function () {
  'use strict';

  let currentLocation = null;

  // Set default dates (today and 6 months ago)
  const today = new Date();
  const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
  document.getElementById('satDateB').value = today.toISOString().slice(0, 10);
  document.getElementById('satDateA').value = sixMonthsAgo.toISOString().slice(0, 10);

  // ── Location Search ──
  document.getElementById('satLoadBtn').addEventListener('click', () => satLoad());
  document.getElementById('satSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') satLoad();
  });

  async function satLoad() {
    const query = document.getElementById('satSearchInput').value.trim();
    if (!query) return;

    const btn = document.getElementById('satLoadBtn');
    btn.disabled = true;
    btn.textContent = 'Loading...';

    try {
      const resp = await browser.runtime.sendMessage({ action: 'intelGetStatus' });
      const sh = resp?.providers?.sentinelhub;

      if (!sh || sh.status !== 'connected') {
        document.getElementById('satImageA').innerHTML = `<div class="sat-placeholder">
          Sentinel Hub is not configured. <a href="../options/options.html#intel-providers" style="color:var(--accent);">Add your API key</a> to load satellite imagery.
        </div>`;
        document.getElementById('satImageB').innerHTML = `<div class="sat-placeholder">
          Configure Sentinel Hub to enable comparison view.
        </div>`;
      } else {
        // Stub — will call Sentinel Hub when provider is implemented
        currentLocation = query;
        document.getElementById('satPanelADate').textContent = document.getElementById('satDateA').value;
        document.getElementById('satPanelBDate').textContent = document.getElementById('satDateB').value;
        document.getElementById('satPanelAMeta').textContent = 'Cloud cover: —';
        document.getElementById('satPanelBMeta').textContent = 'Cloud cover: —';

        document.getElementById('satImageA').innerHTML = `<div class="sat-placeholder">
          <strong>Location: ${escapeHtml(query)}</strong><br>
          Date: ${document.getElementById('satDateA').value}<br><br>
          Sentinel Hub imagery will render here when the provider is connected.<br>
          Supports true color, false color, NDVI, and custom band combinations.
        </div>`;
        document.getElementById('satImageB').innerHTML = `<div class="sat-placeholder">
          <strong>Location: ${escapeHtml(query)}</strong><br>
          Date: ${document.getElementById('satDateB').value}<br><br>
          Second date imagery for side-by-side comparison.
        </div>`;

        document.getElementById('satCompareBtn').disabled = false;
        document.getElementById('satSaveToKg').disabled = false;
      }
    } catch (e) {
      console.warn('[Satellite] Load error:', e);
    }

    btn.disabled = false;
    btn.textContent = 'Load';
    refreshChatContext();
  }

  // ── Compare (stub) ──
  document.getElementById('satCompareBtn')?.addEventListener('click', () => {
    if (!currentLocation) return;
    document.getElementById('satPanelADate').textContent = document.getElementById('satDateA').value;
    document.getElementById('satPanelBDate').textContent = document.getElementById('satDateB').value;
    refreshChatContext();
  });

  // ── KG Actions ──
  document.getElementById('satSaveToKg')?.addEventListener('click', async () => {
    if (!currentLocation) return;
    try {
      const dateA = document.getElementById('satDateA').value;
      const dateB = document.getElementById('satDateB').value;
      await browser.runtime.sendMessage({
        action: 'extractAndUpsert',
        text: `Satellite comparison: ${currentLocation} (${dateA} vs ${dateB})`,
        pageUrl: `sentinel:${currentLocation}`,
        pageTitle: `Satellite — ${currentLocation}`
      });
      const btn = document.getElementById('satSaveToKg');
      btn.textContent = 'Saved!';
      setTimeout(() => { btn.textContent = 'Save Comparison to KG'; }, 2000);
    } catch (e) { console.warn(e); }
  });

  // ── Helpers ──
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── AI Chat ──
  function refreshChatContext() {
    if (typeof ArgusChat === 'undefined') return;
    const lines = ['Satellite Intelligence Page\n'];
    if (currentLocation) {
      lines.push(`Location: ${currentLocation}`);
      lines.push(`Date A: ${document.getElementById('satDateA').value}`);
      lines.push(`Date B: ${document.getElementById('satDateB').value}`);
    }
    ArgusChat.updateContext(lines.join('\n'));
  }

  // ── Init ──
  if (typeof ArgusChat !== 'undefined') {
    ArgusChat.init({
      container: document.getElementById('argus-chat-container'),
      contextType: 'Satellite Intelligence',
      contextData: 'Satellite imagery comparison page. Provider: Sentinel Hub. Load a location to compare imagery across dates.',
      pageUrl: window.location.href,
      pageTitle: 'Satellite — Argus Intelligence'
    });
  }
})();
