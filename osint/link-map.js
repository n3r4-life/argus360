(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let linkData = null;
  let activeFilter = 'all';

  /* ── Bootstrap ── */

  async function init() {
    // Read the storage key from the URL parameter
    const params = new URLSearchParams(window.location.search);
    const storeKey = params.get('id');

    if (storeKey) {
      try {
        const result = await browser.storage.local.get(storeKey);
        linkData = result[storeKey];
      } catch {
        try {
          const result = await chrome.storage.local.get(storeKey);
          linkData = result[storeKey];
        } catch {
          linkData = null;
        }
      }
    }

    // Fallback: try legacy key
    if (!linkData) {
      try {
        const result = await browser.storage.local.get('linkMapData');
        linkData = result.linkMapData;
      } catch {
        linkData = null;
      }
    }

    if (!linkData || !linkData.links) {
      $('#empty-state').textContent = 'No link data found.';
      return;
    }

    // Normalize field names from extraction format
    normalizeLinkData(linkData.links);

    // Clean up storage after loading
    if (storeKey) {
      try { browser.storage.local.remove(storeKey); } catch {}
    }

    renderHeader();
    renderStats();
    renderLinks();
    bindTabs();
    bindActions();
  }

  /* ── Normalize extraction data ── */

  function normalizeLinkData(links) {
    // External links: add domain field from URL
    (links.external || []).forEach((link) => {
      if (!link.domain && link.url) {
        try { link.domain = new URL(link.url).hostname.replace(/^www\./, ''); } catch {}
      }
    });

    // Emails: extraction returns { email, text, href }, display expects { address }
    (links.emails || []).forEach((item) => {
      if (!item.address && item.email) item.address = item.email;
    });

    // Phones: extraction returns { phone, text, href }, display expects { number }
    (links.phones || []).forEach((item) => {
      if (!item.number && item.phone) item.number = item.phone;
    });

    // Files: add extension from URL
    (links.files || []).forEach((link) => {
      if (!link.extension && link.url) {
        const match = link.url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
        if (match) link.extension = match[1].toLowerCase();
      }
    });
  }

  /* ── Header ── */

  function renderHeader() {
    const urlEl = $('#page-url');
    urlEl.textContent = linkData.pageUrl || '';
    urlEl.href = linkData.pageUrl || '#';
    urlEl.title = linkData.pageTitle || linkData.pageUrl || '';
  }

  /* ── Stats ── */

  function renderStats() {
    const links = linkData.links;
    const totalLinks =
      (links.external || []).length +
      (links.internal || []).length +
      (links.social || []).length +
      (links.emails || []).length +
      (links.phones || []).length +
      (links.files || []).length;

    const domains = new Set();
    (links.external || []).forEach((l) => { if (l.domain) domains.add(l.domain); });
    (links.social || []).forEach((l) => {
      try { domains.add(new URL(l.url).hostname); } catch {}
    });

    $('#stat-total').textContent = totalLinks;
    $('#stat-domains').textContent = domains.size;
    $('#stat-external').textContent = (links.external || []).length;
    $('#stat-internal').textContent = (links.internal || []).length;
  }

  /* ── Tabs ── */

  function bindTabs() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        activeFilter = tab.dataset.filter;
        renderLinks();
      });
    });
  }

  /* ── Render links ── */

  function renderLinks() {
    const container = $('#link-list');
    container.innerHTML = '';
    const links = linkData.links;

    const sections = {
      external: { label: 'External Links', items: links.external || [] },
      internal: { label: 'Internal Links', items: links.internal || [] },
      social: { label: 'Social Links', items: links.social || [] },
      emails: { label: 'Emails', items: links.emails || [] },
      phones: { label: 'Phones', items: links.phones || [] },
      files: { label: 'Files', items: links.files || [] },
    };

    const keys = activeFilter === 'all' ? Object.keys(sections) : [activeFilter];

    let hasContent = false;

    keys.forEach((key) => {
      const section = sections[key];
      if (!section || section.items.length === 0) return;
      hasContent = true;

      const sectionEl = document.createElement('div');
      sectionEl.className = 'category-section';

      const header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = escapeHTML(section.label) +
        '<span class="category-count">(' + section.items.length + ')</span>';
      sectionEl.appendChild(header);

      if (key === 'external') {
        renderDomainGrouped(sectionEl, section.items);
      } else if (key === 'internal') {
        renderPlainLinks(sectionEl, section.items);
      } else if (key === 'social') {
        renderSocialLinks(sectionEl, section.items);
      } else if (key === 'emails') {
        renderEmails(sectionEl, section.items);
      } else if (key === 'phones') {
        renderPhones(sectionEl, section.items);
      } else if (key === 'files') {
        renderFileLinks(sectionEl, section.items);
      }

      container.appendChild(sectionEl);
    });

    if (!hasContent) {
      container.innerHTML = '<div class="empty-state"><p>No links found for this filter.</p></div>';
    }
  }

  /* ── External: domain-grouped collapsible sections ── */

  function renderDomainGrouped(parent, items) {
    const grouped = {};
    items.forEach((link) => {
      const domain = link.domain || 'unknown';
      if (!grouped[domain]) grouped[domain] = [];
      grouped[domain].push(link);
    });

    const sortedDomains = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

    sortedDomains.forEach((domain) => {
      const group = document.createElement('div');
      group.className = 'domain-group';

      const header = document.createElement('div');
      header.className = 'domain-header';
      header.innerHTML =
        '<span class="domain-chevron">&#9660;</span>' +
        '<span class="domain-name">' + escapeHTML(domain) + '</span>' +
        '<span class="domain-count">' + grouped[domain].length + '</span>';
      header.addEventListener('click', () => group.classList.toggle('collapsed'));
      group.appendChild(header);

      const linksContainer = document.createElement('div');
      linksContainer.className = 'domain-links';
      grouped[domain].forEach((link) => {
        linksContainer.appendChild(createLinkItem(link.url, link.text));
      });
      group.appendChild(linksContainer);

      parent.appendChild(group);
    });
  }

  /* ── Internal links (flat list) ── */

  function renderPlainLinks(parent, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'domain-links';
    items.forEach((link) => {
      wrapper.appendChild(createLinkItem(link.url, link.text));
    });
    parent.appendChild(wrapper);
  }

  /* ── Social links with platform badge ── */

  function renderSocialLinks(parent, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'domain-links';
    items.forEach((link) => {
      const item = createLinkItem(link.url, link.text);
      if (link.platform) {
        const badge = document.createElement('span');
        badge.className = 'platform-badge';
        badge.textContent = link.platform;
        item.prepend(badge);
      }
      wrapper.appendChild(item);
    });
    parent.appendChild(wrapper);
  }

  /* ── Emails ── */

  function renderEmails(parent, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'domain-links';
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'contact-item';
      const val = document.createElement('a');
      val.className = 'link-url';
      val.href = 'mailto:' + encodeURIComponent(item.address);
      val.textContent = item.address;
      row.appendChild(val);
      wrapper.appendChild(row);
    });
    parent.appendChild(wrapper);
  }

  /* ── Phones ── */

  function renderPhones(parent, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'domain-links';
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'contact-item';
      const val = document.createElement('span');
      val.className = 'contact-value';
      val.textContent = item.number;
      row.appendChild(val);
      wrapper.appendChild(row);
    });
    parent.appendChild(wrapper);
  }

  /* ── File links with extension badge ── */

  function renderFileLinks(parent, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'domain-links';
    items.forEach((link) => {
      const item = createLinkItem(link.url, link.text);
      if (link.extension) {
        const badge = document.createElement('span');
        badge.className = 'ext-badge';
        badge.textContent = link.extension;
        item.prepend(badge);
      }
      wrapper.appendChild(item);
    });
    parent.appendChild(wrapper);
  }

  /* ── Shared link item builder ── */

  function createLinkItem(url, text) {
    const item = document.createElement('div');
    item.className = 'link-item';

    const a = document.createElement('a');
    a.className = 'link-url';
    a.href = url || '#';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = url || '';
    item.appendChild(a);

    if (text && text !== url) {
      const span = document.createElement('span');
      span.className = 'link-text';
      span.textContent = text;
      span.title = text;
      item.appendChild(span);
    }

    return item;
  }

  /* ── Actions ── */

  function bindActions() {
    $('#export-csv').addEventListener('click', exportCSV);
    $('#add-to-project').addEventListener('click', toggleProjectPicker);

    document.addEventListener('click', (e) => {
      const picker = $('#project-picker');
      if (!picker.classList.contains('hidden') &&
          !e.target.closest('.project-picker-wrapper')) {
        picker.classList.add('hidden');
      }
    });
  }

  /* ── Project picker ── */

  async function toggleProjectPicker() {
    const picker = $('#project-picker');
    if (!picker.classList.contains('hidden')) {
      picker.classList.add('hidden');
      return;
    }

    picker.innerHTML = '';

    let projects = [];
    try {
      const result = await (typeof browser !== 'undefined'
        ? browser.storage.local.get('projects')
        : chrome.storage.local.get('projects'));
      projects = result.projects || [];
    } catch {}

    if (projects.length === 0) {
      picker.innerHTML = '<div class="project-picker-empty">No projects found</div>';
    } else {
      projects.forEach((proj) => {
        const item = document.createElement('div');
        item.className = 'project-picker-item';
        item.textContent = proj.name || proj.id;
        item.addEventListener('click', () => addAllToProject(proj.id));
        picker.appendChild(item);
      });
    }

    picker.classList.remove('hidden');
  }

  function addAllToProject(projectId) {
    const urls = collectAllURLs();
    const message = {
      action: 'addToProject',
      projectId: projectId,
      items: urls.map((u) => ({
        url: u,
        source: 'link-map',
        addedAt: Date.now(),
      })),
    };

    try {
      if (typeof browser !== 'undefined') {
        browser.runtime.sendMessage(message);
      } else {
        chrome.runtime.sendMessage(message);
      }
    } catch {}

    $('#project-picker').classList.add('hidden');
  }

  function collectAllURLs() {
    const links = linkData.links;
    const urls = [];
    (links.external || []).forEach((l) => { if (l.url) urls.push(l.url); });
    (links.internal || []).forEach((l) => { if (l.url) urls.push(l.url); });
    (links.social || []).forEach((l) => { if (l.url) urls.push(l.url); });
    (links.files || []).forEach((l) => { if (l.url) urls.push(l.url); });
    (links.emails || []).forEach((l) => urls.push('mailto:' + l.address));
    return urls;
  }

  /* ── CSV Export ── */

  function exportCSV() {
    const links = linkData.links;
    const rows = [['Category', 'URL / Value', 'Text', 'Domain / Platform', 'Extension']];

    (links.external || []).forEach((l) => {
      rows.push(['external', l.url, l.text || '', l.domain || '', '']);
    });
    (links.internal || []).forEach((l) => {
      rows.push(['internal', l.url, l.text || '', '', '']);
    });
    (links.social || []).forEach((l) => {
      rows.push(['social', l.url, l.text || '', l.platform || '', '']);
    });
    (links.emails || []).forEach((l) => {
      rows.push(['email', l.address, '', '', '']);
    });
    (links.phones || []).forEach((l) => {
      rows.push(['phone', l.number, '', '', '']);
    });
    (links.files || []).forEach((l) => {
      rows.push(['file', l.url, l.text || '', '', l.extension || '']);
    });

    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'link-map-' + new Date().toISOString().slice(0, 10) + '.csv';
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
