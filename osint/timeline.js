(function () {
  'use strict';

  const TYPE_COLORS = {
    published: '#4caf50',
    mentioned: '#64b5f6',
    event:     '#e94560',
    modified:  '#ffb74d'
  };

  const TYPE_LABELS = {
    published: 'Published',
    mentioned: 'Mentioned',
    event:     'Event',
    modified:  'Modified'
  };

  let allEvents = [];
  let visibleTypes = new Set(Object.keys(TYPE_COLORS));

  /* ---- Data loading ---- */
  function loadData() {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get('timelineData').then(result => {
        if (result.timelineData) initTimeline(result.timelineData);
        else initTimeline(demoData());
      });
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('timelineData', result => {
        if (result.timelineData) initTimeline(result.timelineData);
        else initTimeline(demoData());
      });
    } else {
      initTimeline(demoData());
    }
  }

  function demoData() {
    return {
      projectName: 'Demo Project',
      events: [
        { date: '2025-01-15T10:00:00Z', event: 'Initial article published about Acme Corp restructuring', source: 'TechNews Daily', url: 'https://example.com/article1', type: 'published' },
        { date: '2025-01-18T14:30:00Z', event: 'John Smith mentioned in connection with Acme Corp merger', source: 'Business Wire', url: 'https://example.com/article2', type: 'mentioned' },
        { date: '2025-01-18T16:00:00Z', event: 'Press conference held in New York regarding merger details', source: 'Reuters', url: 'https://example.com/article3', type: 'event' },
        { date: '2025-02-02T09:00:00Z', event: 'SEC filing updated with new ownership structure', source: 'SEC EDGAR', url: 'https://example.com/filing1', type: 'modified' },
        { date: '2025-02-10T11:00:00Z', event: 'Jane Doe appointed as interim CEO of Globex Inc', source: 'PR Newswire', url: 'https://example.com/article4', type: 'published' },
        { date: '2025-02-10T15:00:00Z', event: 'Globex Inc stock price mentioned in analyst report', source: 'Market Watch', url: 'https://example.com/article5', type: 'mentioned' },
        { date: '2025-03-01T08:00:00Z', event: 'Regulatory hearing scheduled in Washington DC', source: 'Federal Register', url: 'https://example.com/hearing1', type: 'event' },
        { date: '2025-03-05T12:00:00Z', event: 'Original merger article updated with corrected figures', source: 'TechNews Daily', url: 'https://example.com/article1', type: 'modified' }
      ]
    };
  }

  function initTimeline(data) {
    if (data.projectName) {
      document.getElementById('projectName').textContent = data.projectName + ' - Timeline';
    }

    allEvents = (data.events || []).map(e => ({
      ...e,
      dateObj: new Date(e.date)
    })).sort((a, b) => a.dateObj - b.dateObj);

    render();
    initChat(data.projectName);
  }

  function initChat(projectName) {
    const summary = allEvents.slice(0, 80).map(e =>
      `- [${e.type || "event"}] ${e.date}: ${e.title || e.text || ""}${e.source ? " (" + e.source + ")" : ""}`
    ).join("\n");
    ArgusChat.init({
      container: document.getElementById("argus-chat-container"),
      contextType: "Timeline",
      contextData: `Timeline events for project "${projectName || "Unknown"}" (${allEvents.length} total):\n${summary}`,
      pageTitle: projectName
    });
  }

  /* ---- Rendering ---- */
  function formatDate(d) {
    const opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleDateString('en-US', opts);
  }

  function formatDateGroup(d) {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function dateKey(d) {
    return d.toISOString().slice(0, 10);
  }

  function getFilteredEvents() {
    const fromVal = document.getElementById('dateFrom').value;
    const toVal = document.getElementById('dateTo').value;
    const from = fromVal ? new Date(fromVal + 'T00:00:00') : null;
    const to = toVal ? new Date(toVal + 'T23:59:59') : null;

    return allEvents.filter(e => {
      if (!visibleTypes.has(e.type)) return false;
      if (from && e.dateObj < from) return false;
      if (to && e.dateObj > to) return false;
      return true;
    });
  }

  function render() {
    const container = document.getElementById('eventsContainer');
    const emptyState = document.getElementById('emptyState');
    container.innerHTML = '';

    const filtered = getFilteredEvents();

    if (filtered.length === 0) {
      emptyState.classList.add('visible');
      return;
    }
    emptyState.classList.remove('visible');

    // Group by date
    let currentGroup = null;

    filtered.forEach((evt, i) => {
      const key = dateKey(evt.dateObj);

      if (key !== currentGroup) {
        currentGroup = key;
        const groupEl = document.createElement('div');
        groupEl.className = 'tl-date-group';
        const marker = document.createElement('div');
        marker.className = 'tl-date-marker';
        const markerDot = document.createElement('div');
        markerDot.className = 'tl-date-marker-dot';
        marker.appendChild(markerDot);
        const groupLabel = document.createElement('div');
        groupLabel.className = 'tl-date-group-label';
        groupLabel.textContent = formatDateGroup(evt.dateObj);
        groupEl.appendChild(marker);
        groupEl.appendChild(groupLabel);
        container.appendChild(groupEl);
      }

      const color = TYPE_COLORS[evt.type] || '#a0a0b0';
      const label = TYPE_LABELS[evt.type] || evt.type;

      const el = document.createElement('div');
      el.className = 'tl-event';
      el.style.animationDelay = (i * 0.05) + 's';

      const dot = document.createElement('div');
      dot.className = 'tl-dot';
      dot.style.background = color;
      el.appendChild(dot);
      const card = document.createElement('div');
      card.className = 'tl-card';
      const cardHeader = document.createElement('div');
      cardHeader.className = 'tl-card-header';
      const dateSpan = document.createElement('span');
      dateSpan.className = 'tl-date';
      dateSpan.textContent = formatDate(evt.dateObj);
      cardHeader.appendChild(dateSpan);
      const badge = document.createElement('span');
      badge.className = 'tl-type-badge';
      badge.style.background = color;
      badge.textContent = label;
      cardHeader.appendChild(badge);
      card.appendChild(cardHeader);
      const desc = document.createElement('div');
      desc.className = 'tl-description';
      desc.textContent = evt.event;
      card.appendChild(desc);
      if (evt.source || evt.url) {
        const source = document.createElement('a');
        source.className = 'tl-source';
        source.href = evt.url || '#';
        source.target = '_blank';
        source.rel = 'noopener';
        source.textContent = evt.source || evt.url;
        card.appendChild(source);
      }
      el.appendChild(card);

      container.appendChild(el);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---- Export markdown ---- */
  function exportMarkdown() {
    const filtered = getFilteredEvents();
    if (filtered.length === 0) return;

    const projectName = document.getElementById('projectName').textContent;
    let md = '# ' + projectName + '\n\n';

    let currentGroup = null;
    filtered.forEach(evt => {
      const key = dateKey(evt.dateObj);
      if (key !== currentGroup) {
        currentGroup = key;
        md += '## ' + formatDateGroup(evt.dateObj) + '\n\n';
      }

      const label = TYPE_LABELS[evt.type] || evt.type;
      md += '- **[' + label + ']** ' + evt.event;
      if (evt.source) md += ' (' + evt.source + ')';
      if (evt.url) md += ' [Link](' + evt.url + ')';
      md += '\n';
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.download = 'timeline-export.md';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* ---- Events ---- */
  function setupEvents() {
    document.getElementById('dateFrom').addEventListener('change', render);
    document.getElementById('dateTo').addEventListener('change', render);
    document.getElementById('clearDates').addEventListener('click', () => {
      document.getElementById('dateFrom').value = '';
      document.getElementById('dateTo').value = '';
      render();
    });
    document.getElementById('exportMd').addEventListener('click', exportMarkdown);

    document.querySelectorAll('.type-checkbox input').forEach(cb => {
      cb.addEventListener('change', () => {
        const type = cb.dataset.type;
        if (cb.checked) visibleTypes.add(type);
        else visibleTypes.delete(type);
        render();
      });
    });
  }

  /* ---- Init ---- */
  function init() {
    setupEvents();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
