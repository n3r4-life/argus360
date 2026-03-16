(function () {
  'use strict';

  let articles = [];
  let volumeData = [];
  let toneData = [];
  let searchQuery = '';

  // Set default date range (last 7 days)
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  document.getElementById('evtDateTo').value = today.toISOString().slice(0, 10);
  document.getElementById('evtDateFrom').value = weekAgo.toISOString().slice(0, 10);

  // ── Helpers ──
  function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function dateToGdelt(dateStr) {
    // Convert YYYY-MM-DD to YYYYMMDDHHMMSS
    return dateStr.replace(/-/g, '') + '000000';
  }

  function buildTimespan() {
    const from = document.getElementById('evtDateFrom').value;
    const to = document.getElementById('evtDateTo').value;
    if (from && to) {
      return { startDate: dateToGdelt(from), endDate: dateToGdelt(to) };
    }
    return { timespan: '7d' };
  }

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
    btn.style.opacity = '1';
    btn.style.color = 'var(--accent)';

    const timeOpts = buildTimespan();

    try {
      // Fire all 3 requests in parallel
      const [artResp, volResp, toneResp] = await Promise.all([
        browser.runtime.sendMessage({
          action: 'intelSearch', provider: 'gdelt', query,
          options: { maxRecords: 50, sort: 'DateDesc', ...timeOpts }
        }),
        browser.runtime.sendMessage({
          action: 'gdeltTimeline', query,
          options: { raw: true, ...timeOpts }
        }),
        browser.runtime.sendMessage({
          action: 'gdeltTone', query,
          options: timeOpts
        }),
      ]);

      // Articles
      if (artResp?.success) {
        articles = artResp.results?.articles || [];
        renderArticles(articles);
      } else {
        renderArticleError(artResp?.error || 'Search failed');
      }

      // Volume timeline
      if (volResp?.success && volResp.data?.timeline) {
        volumeData = volResp.data.timeline[0]?.data || [];
        renderVolumeChart(volumeData);
      }

      // Tone timeline
      if (toneResp?.success && toneResp.data?.timeline) {
        toneData = toneResp.data.timeline[0]?.data || [];
        renderToneChart(toneData);
      }

      document.getElementById('evtAddEventToKg').disabled = false;
      document.getElementById('evtExport').disabled = false;
    } catch (e) {
      console.warn('[Events] Search error:', e);
      renderArticleError(e.message);
    }

    btn.disabled = false;
    btn.textContent = 'Search';
    btn.style.opacity = '';
    btn.style.color = '';
    refreshChatContext();
  }

  // ── Render Articles ──
  function renderArticles(arts) {
    const container = document.getElementById('evtArticles');
    const countEl = document.getElementById('evtArticleCount');
    const empty = document.getElementById('evtArticlesEmpty');

    countEl.textContent = `${arts.length} article${arts.length !== 1 ? 's' : ''}`;

    if (!arts.length) {
      container.innerHTML = '';
      if (empty) { empty.style.display = ''; empty.textContent = 'No articles found for this query.'; }
      return;
    }
    if (empty) empty.style.display = 'none';

    container.innerHTML = arts.map(a => {
      const date = a.seendate ? formatGdeltDate(a.seendate) : '';
      const domain = a.domain || '';
      const lang = a.language || '';
      const country = a.sourcecountry || '';
      return `<div class="evt-article">
        <a class="evt-article-title" href="${escHtml(a.url)}" target="_blank" rel="noopener">${escHtml(a.title)}</a>
        <div class="evt-article-meta">
          <span class="evt-article-source">${escHtml(domain)}</span>
          ${country ? `<span class="evt-article-country">${escHtml(country)}</span>` : ''}
          ${lang ? `<span class="evt-article-lang">${escHtml(lang)}</span>` : ''}
          <span class="evt-article-date">${escHtml(date)}</span>
        </div>
      </div>`;
    }).join('');
  }

  function renderArticleError(msg) {
    const container = document.getElementById('evtArticles');
    container.innerHTML = `<div class="comp-error">Error: ${escHtml(msg)}</div>`;
  }

  function formatGdeltDate(seendate) {
    // GDELT format: "20260315T120000Z" → readable
    if (!seendate) return '';
    const y = seendate.slice(0, 4);
    const m = seendate.slice(4, 6);
    const d = seendate.slice(6, 8);
    return `${y}-${m}-${d}`;
  }

  // ── Render Volume Chart (SVG bar chart) ──
  function renderVolumeChart(data) {
    const container = document.getElementById('evtVolumeChart');
    if (!data.length) {
      container.innerHTML = '<div class="evt-chart-label">No volume data available.</div>';
      return;
    }

    const values = data.map(d => d.value || d.norm || 0);
    const maxVal = Math.max(...values, 1);
    const barWidth = Math.max(4, Math.floor(800 / data.length) - 2);
    const chartWidth = data.length * (barWidth + 2);
    const chartHeight = 120;

    let barsHtml = '';
    data.forEach((d, i) => {
      const val = d.value || d.norm || 0;
      const h = Math.max(2, (val / maxVal) * chartHeight);
      const x = i * (barWidth + 2);
      barsHtml += `<rect x="${x}" y="${chartHeight - h}" width="${barWidth}" height="${h}" fill="var(--accent, #e94560)" opacity="0.6" rx="1">
        <title>${d.date}: ${val}</title>
      </rect>`;
    });

    const firstDate = data[0]?.date || '';
    const lastDate = data[data.length - 1]?.date || '';

    container.innerHTML = `
      <svg viewBox="0 0 ${chartWidth} ${chartHeight + 20}" preserveAspectRatio="none" style="width:100%;height:${chartHeight + 20}px;">
        <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="var(--border, #2a2a4a)" stroke-width="1"/>
        ${barsHtml}
      </svg>
      <div class="evt-chart-dates">
        <span>${escHtml(firstDate)}</span>
        <span>Article volume over time (${data.length} intervals)</span>
        <span>${escHtml(lastDate)}</span>
      </div>
    `;
  }

  // ── Render Tone Chart (SVG line chart) ──
  function renderToneChart(data) {
    const container = document.getElementById('evtSentimentChart');
    if (!data.length) {
      container.innerHTML = '<div class="evt-chart-label">No sentiment data available.</div>';
      return;
    }

    const values = data.map(d => d.value || 0);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = Math.max(maxVal - minVal, 0.1);
    const chartWidth = 800;
    const chartHeight = 80;
    const midY = chartHeight / 2;

    const points = data.map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * chartWidth;
      const normalized = ((d.value || 0) - minVal) / range;
      const y = chartHeight - normalized * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    const firstDate = data[0]?.date || '';
    const lastDate = data[data.length - 1]?.date || '';

    container.innerHTML = `
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" style="width:100%;height:${chartHeight}px;">
        <line x1="0" y1="${midY}" x2="${chartWidth}" y2="${midY}" stroke="var(--text-muted, #6a6a80)" stroke-width="0.5" stroke-dasharray="4"/>
        <polyline points="${points}" fill="none" stroke="var(--accent, #e94560)" stroke-width="2" opacity="0.8"/>
      </svg>
      <div class="evt-chart-dates">
        <span>${escHtml(firstDate)}</span>
        <span>Sentiment tone — positive (top) / negative (bottom)</span>
        <span>${escHtml(lastDate)}</span>
      </div>
    `;
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

  document.getElementById('evtExport')?.addEventListener('click', () => {
    if (!articles.length) return;
    const csv = 'Title,URL,Source,Country,Language,Date\n' +
      articles.map(a => {
        return [a.title, a.url, a.domain, a.sourcecountry, a.language, a.seendate]
          .map(v => `"${(v || '').replace(/"/g, '""')}"`)
          .join(',');
      }).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gdelt-${searchQuery.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── AI Chat ──
  function refreshChatContext() {
    if (typeof ArgusChat === 'undefined') return;
    const lines = ['Events Intelligence Page — GDELT\n'];
    if (searchQuery) lines.push(`Current search: "${searchQuery}"`);
    if (articles.length) {
      lines.push(`\n== Articles (${articles.length}) ==`);
      articles.slice(0, 15).forEach(a => {
        lines.push(`- ${a.title} (${a.domain}, ${formatGdeltDate(a.seendate)})`);
      });
    }
    if (volumeData.length) {
      const total = volumeData.reduce((s, d) => s + (d.value || d.norm || 0), 0);
      lines.push(`\nVolume: ${volumeData.length} data points, total ~${Math.round(total)} articles`);
    }
    if (toneData.length) {
      const avg = toneData.reduce((s, d) => s + (d.value || 0), 0) / toneData.length;
      lines.push(`Avg sentiment: ${avg.toFixed(2)} (${avg > 0 ? 'positive' : avg < 0 ? 'negative' : 'neutral'})`);
    }
    ArgusChat.updateContext(lines.join('\n'));
  }

  // ── Init ──
  if (typeof ArgusChat !== 'undefined') {
    ArgusChat.init({
      container: document.getElementById('argus-chat-container'),
      contextType: 'Events Intelligence',
      contextData: 'Events monitoring page. Provider: GDELT (live, free). Search for any topic to see global media coverage, article volume over time, and sentiment analysis.',
      pageUrl: window.location.href,
      pageTitle: 'Events — Argus Intelligence'
    });
  }
})();
