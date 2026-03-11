(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let techData = null;
  let activeFilter = 'all';

  /* ── Bootstrap ── */

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const storeKey = params.get('id');

    if (storeKey) {
      try {
        const result = await browser.storage.local.get(storeKey);
        techData = result[storeKey];
      } catch {
        try {
          const result = await chrome.storage.local.get(storeKey);
          techData = result[storeKey];
        } catch {
          techData = null;
        }
      }
    }

    if (!techData || !techData.technologies) {
      $('#empty-state').textContent = 'No tech stack data found.';
      return;
    }

    // Clean up storage after loading
    if (storeKey) {
      try { browser.storage.local.remove(storeKey); } catch {}
    }

    renderHeader();
    renderStats();
    renderTechnologies();
    bindTabs();
    bindActions();
    initChat();
  }

  function initChat() {
    const summary = (techData.technologies || []).map(t =>
      `- ${t.name} (${t.category || "Other"})${t.version ? " v" + t.version : ""}${t.evidence ? " — " + t.evidence : ""}`
    ).join("\n");
    ArgusChat.init({
      container: document.getElementById("argus-chat-container"),
      contextType: "Tech Stack",
      contextData: `Technologies detected on ${techData.pageUrl || "this page"}:\n${summary}`,
      pageUrl: techData.pageUrl,
      pageTitle: techData.pageTitle
    });
  }

  /* ── Header ── */

  function renderHeader() {
    const urlEl = $('#page-url');
    urlEl.textContent = techData.pageUrl || '';
    urlEl.href = techData.pageUrl || '#';
    urlEl.title = techData.pageTitle || techData.pageUrl || '';
  }

  /* ── Stats ── */

  function renderStats() {
    const techs = techData.technologies;
    const categories = new Set(techs.map((t) => t.category));
    $('#stat-total').textContent = techs.length;
    $('#stat-categories').textContent = categories.size;
  }

  /* ── Tabs ── */

  function bindTabs() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        activeFilter = tab.dataset.filter;
        renderTechnologies();
      });
    });
  }

  /* ── Render technologies ── */

  function renderTechnologies() {
    const container = $('#tech-grid');
    container.innerHTML = '';

    const techs = techData.technologies;
    const filtered = activeFilter === 'all'
      ? techs
      : techs.filter((t) => t.category === activeFilter);

    if (filtered.length === 0) {
      container.textContent = "";
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "empty-state";
      const emptyP = document.createElement("p");
      emptyP.textContent = "No technologies found for this filter.";
      emptyDiv.appendChild(emptyP);
      container.appendChild(emptyDiv);
      return;
    }

    // Group by category
    const grouped = {};
    filtered.forEach((tech) => {
      const cat = tech.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tech);
    });

    // Render each category group
    const categoryOrder = ['Server', 'Framework', 'CMS', 'JS Library', 'CSS', 'Analytics', 'CDN', 'Security', 'E-commerce', 'Other'];
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    sortedKeys.forEach((category) => {
      const items = grouped[category];

      const sectionEl = document.createElement('div');
      sectionEl.className = 'category-section';

      const header = document.createElement('div');
      header.className = 'category-header';
      header.appendChild(document.createTextNode(category));
      const countSpan = document.createElement('span');
      countSpan.className = 'category-count';
      countSpan.textContent = '(' + items.length + ')';
      header.appendChild(countSpan);
      sectionEl.appendChild(header);

      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'tech-cards';

      items.forEach((tech) => {
        cardsContainer.appendChild(createTechCard(tech));
      });

      sectionEl.appendChild(cardsContainer);
      container.appendChild(sectionEl);
    });
  }

  /* ── Tech card builder ── */

  function createTechCard(tech) {
    const card = document.createElement('div');
    card.className = 'tech-card';

    const headerEl = document.createElement('div');
    headerEl.className = 'tech-card-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'tech-name';
    nameEl.textContent = tech.name;
    headerEl.appendChild(nameEl);

    if (tech.version) {
      const versionEl = document.createElement('span');
      versionEl.className = 'tech-version';
      versionEl.textContent = 'v' + tech.version;
      headerEl.appendChild(versionEl);
    }

    card.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'tech-card-body';

    if (tech.description) {
      const descEl = document.createElement('div');
      descEl.className = 'tech-description';
      descEl.textContent = tech.description;
      bodyEl.appendChild(descEl);
    }

    const metaEl = document.createElement('div');
    metaEl.className = 'tech-meta';

    const catBadge = document.createElement('span');
    catBadge.className = 'category-badge';
    catBadge.setAttribute('data-category', tech.category || 'Other');
    catBadge.textContent = tech.category || 'Other';
    metaEl.appendChild(catBadge);

    const confClass = 'confidence confidence-' + (tech.confidence || 'medium');
    const confEl = document.createElement('span');
    confEl.className = confClass;
    confEl.textContent = tech.confidence || 'medium';
    metaEl.appendChild(confEl);

    if (tech.method) {
      const methodEl = document.createElement('span');
      methodEl.className = 'method-tag';
      methodEl.textContent = tech.method;
      metaEl.appendChild(methodEl);
    }

    bodyEl.appendChild(metaEl);
    card.appendChild(bodyEl);

    return card;
  }

  /* ── Actions ── */

  function bindActions() {
    $('#export-csv').addEventListener('click', exportCSV);
  }

  /* ── CSV Export ── */

  function exportCSV() {
    const techs = techData.technologies;
    const rows = [['Category', 'Name', 'Version', 'Confidence', 'Method']];

    techs.forEach((t) => {
      rows.push([
        t.category || '',
        t.name || '',
        t.version || '',
        t.confidence || '',
        t.method || ''
      ]);
    });

    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'techstack-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const str = String(value || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /* ── Util ── */

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── Go ── */
  document.addEventListener('DOMContentLoaded', init);
})();
