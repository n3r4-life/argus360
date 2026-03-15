(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let linkData = null;
  let activeFilter = 'all';
  let searchQuery = '';
  let regexMode = false;
  let isCachedMode = false;
  let cachedAt = 0;
  let diffResult = null;       // { added, removed, unchanged } per category
  let diffView = 'current';    // 'current' or 'changes'
  let oldLinkData = null;      // previous scan data for comparison

  /* ── Collector state ── */
  let collected = [];          // { type, value, label, url, addedAt }
  let collectorTab = 'all';
  let collectorQuery = '';
  let collectorSort = 'added';
  let sources = [];            // cached sources for cross-ref

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

    // Bind history popup regardless of whether we have current data
    bindHistory();

    if (!linkData || !linkData.links) {
      $('#empty-state').textContent = 'No link data found.';
      return;
    }

    // Normalize field names from extraction format
    normalizeLinkData(linkData.links);

    // Detect cached mode
    isCachedMode = params.get('mode') === 'cached' || !!linkData.cached;
    cachedAt = linkData.cachedAt || 0;

    // Clean up storage after loading
    if (storeKey) {
      try { browser.storage.local.remove(storeKey); } catch {}
    }

    await loadCollected();
    await loadSources();
    renderHeader();
    if (isCachedMode) showCacheBanner();
    renderStats();
    renderLinks();
    bindTabs();
    bindActions();
    bindCollector();
    initChat();
  }

  function initChat() {
    const links = linkData.links || linkData;
    const parts = [];
    if (links.external?.length) parts.push(`External links (${links.external.length}):\n` + links.external.slice(0, 50).map(l => `- ${l.url || l.href}`).join("\n"));
    if (links.internal?.length) parts.push(`Internal links (${links.internal.length}):\n` + links.internal.slice(0, 30).map(l => `- ${l.url || l.href || l.path}`).join("\n"));
    if (links.social?.length) parts.push(`Social links: ${links.social.map(l => l.url || l.href).join(", ")}`);
    if (links.emails?.length) parts.push(`Emails: ${links.emails.join(", ")}`);
    if (links.phones?.length) parts.push(`Phones: ${links.phones.join(", ")}`);
    ArgusChat.init({
      container: document.getElementById("argus-chat-container"),
      contextType: "Link Map",
      contextData: parts.join("\n\n") || "No links found.",
      pageUrl: linkData.pageUrl,
      pageTitle: linkData.pageTitle
    });
  }

  /* ── Normalize extraction data ── */

  function normalizeLinkData(links) {
    // External links: add domain field from URL
    (links.external || []).forEach((link) => {
      if (!link.domain && link.url) {
        try { link.domain = new URL(link.url).hostname.replace(/^www\./, ''); } catch {}
      }
    });

    // Emails: can be plain strings OR { email, text, href } objects
    if (links.emails) {
      links.emails = links.emails.map((item) => {
        if (typeof item === 'string') return { address: item };
        if (!item.address && item.email) item.address = item.email;
        return item;
      }).filter(item => item.address);
    }

    // Phones: can be plain strings OR { phone, text, href } objects
    if (links.phones) {
      links.phones = links.phones.map((item) => {
        if (typeof item === 'string') return { number: item };
        if (!item.number && item.phone) item.number = item.phone;
        return item;
      }).filter(item => item.number);
    }

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

  /* ── Search matcher ── */

  function buildMatcher(raw) {
    if (!raw) return null;

    // Regex mode: /pattern/flags
    if (regexMode) {
      try {
        const re = new RegExp(raw, 'i');
        return (hay) => re.test(hay);
      } catch {
        return () => false;
      }
    }

    // Inline /regex/ literal
    const reMatch = raw.match(/^\/(.+)\/([gimsuy]*)$/);
    if (reMatch) {
      try {
        const re = new RegExp(reMatch[1], reMatch[2] || 'i');
        return (hay) => re.test(hay);
      } catch {
        return () => false;
      }
    }

    // OR logic: term1 | term2 | term3
    if (raw.includes('|')) {
      const terms = raw.split('|').map(t => t.trim().toLowerCase()).filter(Boolean);
      return (hay) => {
        const h = hay.toLowerCase();
        return terms.some(t => h.includes(t));
      };
    }

    // "exact phrase"
    const exactMatch = raw.match(/^"(.+)"$/);
    if (exactMatch) {
      const phrase = exactMatch[1].toLowerCase();
      return (hay) => hay.toLowerCase().includes(phrase);
    }

    // Plain substring (case-insensitive)
    const lower = raw.toLowerCase();
    return (hay) => hay.toLowerCase().includes(lower);
  }

  function updateSearchCount(count) {
    const el = $('#search-count');
    if (!el) return;
    if (!searchQuery) { el.textContent = ''; return; }
    el.textContent = count + ' match' + (count !== 1 ? 'es' : '');
  }

  /* ── Render links ── */

  function renderLinks() {
    const container = $('#link-list');
    container.innerHTML = '';
    const links = linkData.links;

    const q = searchQuery;
    const matcher = buildMatcher(q);
    const matchLink = (item) => {
      if (!matcher) return true;
      const hay = [item.url, item.href, item.text, item.domain, item.platform,
                    item.address, item.email, item.number, item.phone, item.extension]
        .filter(Boolean).join(' ');
      return matcher(hay);
    };

    const buildItems = (cat) => {
      let items = (links[cat] || []).filter(matchLink);
      if (diffResult && diffView === 'changes') {
        // In changes view, show added + removed only
        const d = diffResult[cat];
        if (d) items = [...d.added, ...d.removed].filter(matchLink);
      }
      return items;
    };

    const sections = {
      external: { label: 'External Links', items: buildItems('external') },
      internal: { label: 'Internal Links', items: buildItems('internal') },
      social: { label: 'Social Links', items: buildItems('social') },
      emails: { label: 'Emails', items: buildItems('emails') },
      phones: { label: 'Phones', items: buildItems('phones') },
      files: { label: 'Files', items: buildItems('files') },
    };

    const keys = activeFilter === 'all' ? Object.keys(sections) : [activeFilter];

    let hasContent = false;
    let totalMatches = 0;

    keys.forEach((key) => {
      const section = sections[key];
      if (!section || section.items.length === 0) return;
      hasContent = true;
      totalMatches += section.items.length;

      const sectionEl = document.createElement('div');
      sectionEl.className = 'category-section';

      const header = document.createElement('div');
      header.className = 'category-header';
      header.appendChild(document.createTextNode(section.label));
      const countSpan = document.createElement('span');
      countSpan.className = 'category-count';
      countSpan.textContent = '(' + section.items.length + ')';
      header.appendChild(countSpan);
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
      container.textContent = "";
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "empty-state";
      const emptyP = document.createElement("p");
      emptyP.textContent = "No links found for this filter.";
      emptyDiv.appendChild(emptyP);
      container.appendChild(emptyDiv);
    }
    updateSearchCount(totalMatches);
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
      const chevronSpan = document.createElement('span');
      chevronSpan.className = 'domain-chevron';
      chevronSpan.textContent = '\u25BC';
      header.appendChild(chevronSpan);
      const nameSpan = document.createElement('span');
      nameSpan.className = 'domain-name';
      nameSpan.textContent = domain;
      header.appendChild(nameSpan);
      const domainCountSpan = document.createElement('span');
      domainCountSpan.className = 'domain-count';
      domainCountSpan.textContent = grouped[domain].length;
      header.appendChild(domainCountSpan);
      header.addEventListener('click', () => group.classList.toggle('collapsed'));
      group.appendChild(header);

      const linksContainer = document.createElement('div');
      linksContainer.className = 'domain-links';
      grouped[domain].forEach((link) => {
        linksContainer.appendChild(createLinkItem(link.url, link.text, getDiffClass('external', link)));
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
      wrapper.appendChild(createLinkItem(link.url, link.text, getDiffClass('internal', link)));
    });
    parent.appendChild(wrapper);
  }

  /* ── Social links with platform badge ── */

  function renderSocialLinks(parent, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'domain-links';
    items.forEach((link) => {
      const item = createLinkItem(link.url, link.text, getDiffClass('social', link));
      if (link.platform) {
        const badge = document.createElement('span');
        badge.className = 'platform-badge';
        badge.textContent = link.platform;
        item.prepend(badge);
      }
      // Replace collect button to use 'social' type
      const oldCol = item.querySelector('.collect-btn');
      if (oldCol) {
        const newCol = document.createElement('button');
        newCol.className = 'collect-btn';
        newCol.textContent = '+ Collect';
        newCol.title = 'Add to collector';
        const surl = link.url, stext = link.text, splatform = link.platform;
        const isColl = collected.some(c => c.type === 'social' && c.value === surl);
        if (isColl) { newCol.textContent = '\u2713'; newCol.classList.add('collected'); }
        newCol.addEventListener('click', (e) => {
          e.stopPropagation();
          if (collectItem('social', surl, splatform || stext, surl)) {
            newCol.textContent = '\u2713';
            newCol.classList.add('collected');
          }
        });
        oldCol.replaceWith(newCol);
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
      const dc = getDiffClass('emails', item);
      const row = document.createElement('div');
      row.className = 'contact-item' + (dc ? ' ' + dc : '');
      if (dc === 'diff-added') { const dl = document.createElement('span'); dl.className = 'diff-label added'; dl.textContent = 'NEW'; row.appendChild(dl); }
      else if (dc === 'diff-removed') { const dl = document.createElement('span'); dl.className = 'diff-label removed'; dl.textContent = 'GONE'; row.appendChild(dl); }
      const val = document.createElement('a');
      val.className = 'link-url';
      val.href = 'mailto:' + encodeURIComponent(item.address);
      val.textContent = item.address;
      row.appendChild(val);

      // + Contact button
      const contactBtn = document.createElement('button');
      contactBtn.className = 'inline-action-btn';
      contactBtn.textContent = '+ Contact';
      contactBtn.title = 'Add to email contacts';
      contactBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await addAsContact(item.address);
        contactBtn.textContent = '\u2713';
        contactBtn.classList.add('done');
      });
      row.appendChild(contactBtn);

      // + Collect button
      const colBtn = document.createElement('button');
      colBtn.className = 'collect-btn';
      colBtn.textContent = '+ Collect';
      colBtn.title = 'Add to collector';
      const isColl = collected.some(c => c.type === 'email' && c.value === item.address);
      if (isColl) { colBtn.textContent = '\u2713'; colBtn.classList.add('collected'); }
      colBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (collectItem('email', item.address, '', 'mailto:' + item.address)) {
          colBtn.textContent = '\u2713';
          colBtn.classList.add('collected');
        }
      });
      row.appendChild(colBtn);

      // + Source button (as person source)
      const srcBtn = document.createElement('button');
      srcBtn.className = 'inline-action-btn';
      srcBtn.textContent = '+ Source';
      srcBtn.title = 'Add as source';
      srcBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await addAsEmailSource(item.address);
        srcBtn.textContent = '\u2713';
        srcBtn.classList.add('done');
      });
      row.appendChild(srcBtn);

      wrapper.appendChild(row);
    });
    parent.appendChild(wrapper);
  }

  /* ── Phones ── */

  function renderPhones(parent, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'domain-links';
    items.forEach((item) => {
      const dc = getDiffClass('phones', item);
      const row = document.createElement('div');
      row.className = 'contact-item' + (dc ? ' ' + dc : '');
      if (dc === 'diff-added') { const dl = document.createElement('span'); dl.className = 'diff-label added'; dl.textContent = 'NEW'; row.appendChild(dl); }
      else if (dc === 'diff-removed') { const dl = document.createElement('span'); dl.className = 'diff-label removed'; dl.textContent = 'GONE'; row.appendChild(dl); }
      const val = document.createElement('span');
      val.className = 'contact-value';
      val.textContent = item.number;
      row.appendChild(val);

      // + Collect button
      const colBtn = document.createElement('button');
      colBtn.className = 'collect-btn';
      colBtn.textContent = '+ Collect';
      colBtn.title = 'Add to collector';
      const isColl = collected.some(c => c.type === 'phone' && c.value === item.number);
      if (isColl) { colBtn.textContent = '\u2713'; colBtn.classList.add('collected'); }
      colBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (collectItem('phone', item.number, '', 'tel:' + item.number)) {
          colBtn.textContent = '\u2713';
          colBtn.classList.add('collected');
        }
      });
      row.appendChild(colBtn);

      wrapper.appendChild(row);
    });
    parent.appendChild(wrapper);
  }

  /* ── File links with extension badge ── */

  function renderFileLinks(parent, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'domain-links';
    items.forEach((link) => {
      const item = createLinkItem(link.url, link.text, getDiffClass('files', link));
      if (link.extension) {
        const badge = document.createElement('span');
        badge.className = 'ext-badge';
        badge.textContent = link.extension;
        item.prepend(badge);
      }

      // Replace collect button to use 'file' type
      const oldCol = item.querySelector('.collect-btn');
      if (oldCol) {
        const newCol = document.createElement('button');
        newCol.className = 'collect-btn';
        newCol.textContent = '+ Collect';
        newCol.title = 'Add to collector';
        const furl = link.url, ftext = link.text, fext = link.extension;
        const isColl = collected.some(c => c.type === 'file' && c.value === furl);
        if (isColl) { newCol.textContent = '\u2713'; newCol.classList.add('collected'); }
        newCol.addEventListener('click', (e) => {
          e.stopPropagation();
          if (collectItem('file', furl, fext ? fext.toUpperCase() : ftext, furl)) {
            newCol.textContent = '\u2713';
            newCol.classList.add('collected');
          }
        });
        oldCol.replaceWith(newCol);
      }

      // Download button
      const dlBtn = document.createElement('a');
      dlBtn.className = 'inline-action-btn inline-action-always';
      dlBtn.href = link.url;
      dlBtn.download = '';
      dlBtn.textContent = '\u2B07 Save';
      dlBtn.title = 'Download file';
      dlBtn.addEventListener('click', (e) => e.stopPropagation());
      // Insert before the + Source button
      const srcBtn = item.querySelector('.inline-action-btn');
      if (srcBtn) item.insertBefore(dlBtn, srcBtn);
      else item.appendChild(dlBtn);

      wrapper.appendChild(item);
    });
    parent.appendChild(wrapper);
  }

  /* ── Smart labels for common link patterns ── */

  // Smart labels — match on URL path segments or exact anchor text, not loose substrings
  const SMART_LABELS_URL = [
    { re: /\/contact\b/i,                  label: 'Contact',   cls: 'smart-info' },
    { re: /\/about\/?$/i,                  label: 'About',     cls: 'smart-info' },
    { re: /\/about-us\/?$/i,               label: 'About',     cls: 'smart-info' },
    { re: /\/privac/i,                     label: 'Privacy',   cls: 'smart-warn' },
    { re: /\/(terms|tos|legal)\b/i,        label: 'Legal',     cls: 'smart-warn' },
    { re: /\/(login|signin|sign-in)\b/i,   label: 'Login',     cls: 'smart-auth' },
    { re: /\/(signup|sign-up|register)\b/i,label: 'Signup',    cls: 'smart-auth' },
    { re: /\/(careers?|jobs?)\/?$/i,       label: 'Jobs',      cls: 'smart-info' },
    { re: /\/(faq|help|support)\b/i,       label: 'Support',   cls: 'smart-info' },
    { re: /\/(feed|rss|atom)\b/i,          label: 'Feed',      cls: 'smart-feed' },
    { re: /\/api\//i,                      label: 'API',       cls: 'smart-feed' },
    { re: /\/developers?\/?$/i,            label: 'API',       cls: 'smart-feed' },
    { re: /\/(admin|dashboard)\b/i,        label: 'Admin',     cls: 'smart-auth' },
    { re: /\.onion\b/i,                    label: 'Onion',     cls: 'smart-warn' },
    { re: /\/unsubscribe\b/i,             label: 'Unsub',     cls: 'smart-warn' },
  ];

  const SMART_LABELS_TEXT = [
    { re: /^contact\s*us$/i,              label: 'Contact',   cls: 'smart-info' },
    { re: /^about\s*us$/i,               label: 'About',     cls: 'smart-info' },
    { re: /^privacy\s*policy$/i,          label: 'Privacy',   cls: 'smart-warn' },
    { re: /^terms\s*(of\s*|&\s*)?/i,     label: 'Legal',     cls: 'smart-warn' },
    { re: /^(log\s*in|sign\s*in)$/i,     label: 'Login',     cls: 'smart-auth' },
    { re: /^(sign\s*up|register)$/i,     label: 'Signup',    cls: 'smart-auth' },
    { re: /^subscribe$/i,                label: 'Subscribe', cls: 'smart-info' },
    { re: /^(careers?|jobs?)$/i,          label: 'Jobs',      cls: 'smart-info' },
    { re: /^(faq|help|support)$/i,       label: 'Support',   cls: 'smart-info' },
    { re: /^unsubscribe$/i,              label: 'Unsub',     cls: 'smart-warn' },
    { re: /^opt[\s-]*out$/i,             label: 'Unsub',     cls: 'smart-warn' },
  ];

  function getSmartLabel(url, text) {
    // Check URL path
    if (url) {
      for (const s of SMART_LABELS_URL) {
        if (s.re.test(url)) return s;
      }
    }
    // Check anchor text (trimmed, exact-ish match)
    const t = (text || '').trim();
    if (t && t.length < 40) {
      for (const s of SMART_LABELS_TEXT) {
        if (s.re.test(t)) return s;
      }
    }
    return null;
  }

  /* ── Shared link item builder ── */

  function createLinkItem(url, text, diffCls) {
    const item = document.createElement('div');
    item.className = 'link-item' + (diffCls ? ' ' + diffCls : '');

    // Diff label
    if (diffCls === 'diff-added') {
      const dl = document.createElement('span');
      dl.className = 'diff-label added';
      dl.textContent = 'NEW';
      item.appendChild(dl);
    } else if (diffCls === 'diff-removed') {
      const dl = document.createElement('span');
      dl.className = 'diff-label removed';
      dl.textContent = 'GONE';
      item.appendChild(dl);
    }

    // Smart label badge
    const smart = getSmartLabel(url, text);
    if (smart) {
      const badge = document.createElement('span');
      badge.className = 'smart-badge ' + smart.cls;
      badge.textContent = smart.label;
      item.appendChild(badge);
    }

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

    // + Collect button
    const colBtn = document.createElement('button');
    colBtn.className = 'collect-btn';
    colBtn.textContent = '+ Collect';
    colBtn.title = 'Add to collector';
    const isCollected = collected.some(c => c.value === url);
    if (isCollected) { colBtn.textContent = '\u2713'; colBtn.classList.add('collected'); }
    colBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (collectItem('link', url, text, url)) {
        colBtn.textContent = '\u2713';
        colBtn.classList.add('collected');
      }
    });
    item.appendChild(colBtn);

    // + Source button
    const srcBtn = document.createElement('button');
    srcBtn.className = 'inline-action-btn';
    srcBtn.textContent = '+ Source';
    srcBtn.title = 'Add as source';
    srcBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await addAsSource(url, text);
      srcBtn.textContent = '\u2713';
      srcBtn.classList.add('done');
    });
    item.appendChild(srcBtn);

    return item;
  }

  /* ── Inline actions ── */

  async function addAsSource(url, text) {
    let name = text || url;
    let type = 'webservice';
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      name = text || host;
    } catch {}

    const source = {
      id: 'src-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: name,
      type: type,
      aliases: [],
      addresses: [{ type: 'website', value: url, label: '' }],
      tags: ['link-map'],
      location: '',
      notes: 'Added from Link Map',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      await api.runtime.sendMessage({ action: 'saveSource', source });
    } catch (err) {
      console.warn('Failed to save source:', err);
    }
  }

  async function addAsEmailSource(address) {
    const source = {
      id: 'src-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: address.split('@')[0],
      type: 'person',
      aliases: [],
      addresses: [{ type: 'email', value: address, label: '' }],
      tags: ['link-map'],
      location: '',
      notes: 'Email found via Link Map',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      await api.runtime.sendMessage({ action: 'saveSource', source });
    } catch (err) {
      console.warn('Failed to save source:', err);
    }
  }

  async function addAsContact(email) {
    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      const res = await api.storage.local.get('argusEmailContacts');
      const contacts = res.argusEmailContacts || [];
      if (contacts.some(c => c.email === email)) return;
      contacts.push({ email, name: '', addedAt: Date.now() });
      await api.storage.local.set({ argusEmailContacts: contacts });
    } catch (err) {
      console.warn('Failed to save contact:', err);
    }
  }

  /* ── Actions ── */

  function bindActions() {
    $('#export-csv').addEventListener('click', exportCSV);
    $('#add-to-project').addEventListener('click', toggleProjectPicker);
    const xrefBtn = $('#xref-sources-btn');
    if (xrefBtn) xrefBtn.addEventListener('click', crossRefSources);

    const searchInput = $('#link-search');
    const modeBtn = $('#search-mode-toggle');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim();
        renderLinks();
      });
    }
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        regexMode = !regexMode;
        modeBtn.classList.toggle('active', regexMode);
        renderLinks();
      });
    }

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
      const emptyEl = document.createElement("div");
      emptyEl.className = "project-picker-empty";
      emptyEl.textContent = "No projects found";
      picker.appendChild(emptyEl);
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

  /* ── Get currently visible (filtered + searched) sections ── */

  function getVisibleSections() {
    const links = linkData.links;
    const matcher = buildMatcher(searchQuery);
    const matchLink = (item) => {
      if (!matcher) return true;
      const hay = [item.url, item.href, item.text, item.domain, item.platform,
                    item.address, item.email, item.number, item.phone, item.extension]
        .filter(Boolean).join(' ');
      return matcher(hay);
    };

    const all = {
      external: (links.external || []).filter(matchLink),
      internal: (links.internal || []).filter(matchLink),
      social: (links.social || []).filter(matchLink),
      emails: (links.emails || []).filter(matchLink),
      phones: (links.phones || []).filter(matchLink),
      files: (links.files || []).filter(matchLink),
    };

    if (activeFilter === 'all') return all;
    const filtered = {};
    filtered[activeFilter] = all[activeFilter] || [];
    return filtered;
  }

  function collectAllURLs() {
    const sections = getVisibleSections();
    const urls = [];
    (sections.external || []).forEach((l) => { if (l.url) urls.push(l.url); });
    (sections.internal || []).forEach((l) => { if (l.url) urls.push(l.url); });
    (sections.social || []).forEach((l) => { if (l.url) urls.push(l.url); });
    (sections.files || []).forEach((l) => { if (l.url) urls.push(l.url); });
    (sections.emails || []).forEach((l) => urls.push('mailto:' + (l.address || l.email)));
    return urls;
  }

  /* ── CSV Export ── */

  function exportCSV() {
    const sections = getVisibleSections();
    const rows = [['Category', 'URL / Value', 'Text', 'Domain / Platform', 'Extension']];

    (sections.external || []).forEach((l) => {
      rows.push(['external', l.url, l.text || '', l.domain || '', '']);
    });
    (sections.internal || []).forEach((l) => {
      rows.push(['internal', l.url, l.text || '', '', '']);
    });
    (sections.social || []).forEach((l) => {
      rows.push(['social', l.url, l.text || '', l.platform || '', '']);
    });
    (sections.emails || []).forEach((l) => {
      rows.push(['email', l.address || l.email, '', '', '']);
    });
    (sections.phones || []).forEach((l) => {
      rows.push(['phone', l.number || l.phone, '', '', '']);
    });
    (sections.files || []).forEach((l) => {
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

  /* ── Cache & Diff ── */

  function showCacheBanner() {
    const banner = $('#cacheBanner');
    if (!banner) return;
    banner.classList.remove('hidden');
    const dateEl = $('#cacheDate');
    if (dateEl && cachedAt) {
      const d = new Date(cachedAt);
      dateEl.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    $('#cacheRefresh').addEventListener('click', refreshAndCompare);

    // Diff view toggle
    $$('.diff-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.diff-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        diffView = btn.dataset.diffview;
        renderLinks();
      });
    });
  }

  async function refreshAndCompare() {
    const btn = $('#cacheRefresh');
    if (btn) { btn.disabled = true; btn.textContent = 'Scanning...'; }

    // Save old data for comparison
    oldLinkData = JSON.parse(JSON.stringify(linkData.links));

    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      // Find the original page tab by URL
      const pageUrl = linkData.pageUrl;
      let tabId = null;
      if (pageUrl) {
        const tabs = await api.tabs.query({ url: pageUrl });
        if (tabs.length) {
          tabId = tabs[0].id;
        } else {
          // Open the page in a new tab and wait for it to load
          const newTab = await api.tabs.create({ url: pageUrl, active: false });
          tabId = newTab.id;
          await new Promise(resolve => {
            const listener = (tid, info) => {
              if (tid === tabId && info.status === 'complete') {
                api.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            };
            api.tabs.onUpdated.addListener(listener);
          });
        }
      }
      if (!tabId) throw new Error('Could not find or open the original page');

      const resp = await api.runtime.sendMessage({ action: 'extractLinks', tabId });
      if (!resp?.success) throw new Error(resp?.error || 'Extraction failed');

      // Update with fresh data
      linkData.links = resp.links;
      linkData.stats = resp.stats;
      normalizeLinkData(linkData.links);

      // Compute diff
      diffResult = computeDiff(oldLinkData, linkData.links);
      showDiffBanner();

      // Re-render
      renderStats();
      renderLinks();

      // Update cache banner
      if (btn) { btn.textContent = '\u2713 Compared'; btn.disabled = true; }
    } catch (err) {
      console.warn('Refresh failed:', err);
      if (btn) { btn.disabled = false; btn.textContent = 'Retry'; }
    }
  }

  function computeDiff(oldLinks, newLinks) {
    const diff = {};
    const categories = ['external', 'internal', 'social', 'emails', 'phones', 'files'];

    categories.forEach(cat => {
      const oldItems = oldLinks[cat] || [];
      const newItems = newLinks[cat] || [];
      const getKey = (item) => {
        if (cat === 'emails') return item.address || item.email || '';
        if (cat === 'phones') return item.number || item.phone || '';
        return item.url || item.href || '';
      };

      const oldSet = new Set(oldItems.map(getKey));
      const newSet = new Set(newItems.map(getKey));

      diff[cat] = {
        added: newItems.filter(i => !oldSet.has(getKey(i))),
        removed: oldItems.filter(i => !newSet.has(getKey(i))),
        unchanged: newItems.filter(i => oldSet.has(getKey(i))),
      };
    });

    return diff;
  }

  function showDiffBanner() {
    const banner = $('#diffBanner');
    const summary = $('#diffSummary');
    if (!banner || !summary || !diffResult) return;

    let totalAdded = 0, totalRemoved = 0, totalUnchanged = 0;
    Object.values(diffResult).forEach(d => {
      totalAdded += d.added.length;
      totalRemoved += d.removed.length;
      totalUnchanged += d.unchanged.length;
    });

    summary.innerHTML = '';
    if (totalAdded) {
      const s = document.createElement('span');
      s.className = 'diff-stat added';
      s.textContent = '+' + totalAdded + ' new';
      summary.appendChild(s);
    }
    if (totalRemoved) {
      const s = document.createElement('span');
      s.className = 'diff-stat removed';
      s.textContent = '-' + totalRemoved + ' removed';
      summary.appendChild(s);
    }
    const u = document.createElement('span');
    u.className = 'diff-stat unchanged';
    u.textContent = totalUnchanged + ' unchanged';
    summary.appendChild(u);

    if (!totalAdded && !totalRemoved) {
      const noChange = document.createElement('span');
      noChange.style.cssText = 'color: var(--success); font-weight: 600; margin-left: 8px;';
      noChange.textContent = '— No changes detected';
      summary.appendChild(noChange);
    }

    banner.classList.remove('hidden');
  }

  function getDiffClass(cat, item) {
    if (!diffResult || !diffResult[cat]) return '';
    const getKey = (i) => {
      if (cat === 'emails') return i.address || i.email || '';
      if (cat === 'phones') return i.number || i.phone || '';
      return i.url || i.href || '';
    };
    const key = getKey(item);
    if (diffResult[cat].added.some(i => getKey(i) === key)) return 'diff-added';
    if (diffResult[cat].removed.some(i => getKey(i) === key)) return 'diff-removed';
    return '';
  }

  function getItemsForRender(cat, items) {
    if (!diffResult || diffView !== 'changes') return items;
    // In changes-only view, show only added and removed
    const d = diffResult[cat];
    if (!d) return items;
    const merged = [...d.added, ...d.removed];
    return merged;
  }

  /* ── Collector ── */

  function collectItem(type, value, label, url) {
    const key = type + ':' + value;
    if (collected.some(c => (c.type + ':' + c.value) === key)) return false;
    collected.push({ type, value, label: label || '', url: url || '', addedAt: Date.now() });
    saveCollected();
    updateCollectorBadge();
    renderCollector();
    return true;
  }

  function removeCollected(idx) {
    collected.splice(idx, 1);
    saveCollected();
    updateCollectorBadge();
    renderCollector();
  }

  function clearCollected() {
    collected = [];
    saveCollected();
    updateCollectorBadge();
    renderCollector();
  }

  function saveCollected() {
    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      api.storage.local.set({ argusCollector: collected });
    } catch {}
  }

  async function loadCollected() {
    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      const res = await api.storage.local.get('argusCollector');
      collected = res.argusCollector || [];
    } catch {
      collected = [];
    }
    updateCollectorBadge();
  }

  function updateCollectorBadge() {
    const badge = $('#collectorBadge');
    if (badge) badge.textContent = collected.length || '';
    const countEl = $('#collectorCount');
    if (countEl) countEl.textContent = collected.length + ' item' + (collected.length !== 1 ? 's' : '');
  }

  function getFilteredCollected() {
    let items = collected;
    if (collectorTab !== 'all') {
      const typeMap = { emails: 'email', phones: 'phone', social: 'social', files: 'file', links: 'link' };
      const t = typeMap[collectorTab] || collectorTab;
      items = items.filter(c => c.type === t);
    }
    if (collectorQuery) {
      const q = collectorQuery.toLowerCase();
      items = items.filter(c => {
        const hay = [c.value, c.label, c.url, c.type].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    if (collectorSort === 'alpha') {
      items = [...items].sort((a, b) => (a.value || '').localeCompare(b.value || ''));
    } else if (collectorSort === 'type') {
      items = [...items].sort((a, b) => a.type.localeCompare(b.type) || (a.value || '').localeCompare(b.value || ''));
    }
    // 'added' is default order (newest first already by array order)
    return items;
  }

  function renderCollector() {
    const list = $('#collectorList');
    if (!list) return;
    list.innerHTML = '';

    const items = getFilteredCollected();

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'collector-empty';
      empty.textContent = collected.length === 0
        ? 'Click + Collect on any item to add it here.'
        : 'No items match this filter.';
      list.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const realIdx = collected.indexOf(item);
      const row = document.createElement('div');
      row.className = 'collector-item';

      const typeBadge = document.createElement('span');
      typeBadge.className = 'collector-item-type ct-' + item.type;
      typeBadge.textContent = item.type;
      row.appendChild(typeBadge);

      const info = document.createElement('div');
      info.className = 'collector-item-info';
      const val = document.createElement('div');
      val.className = 'collector-item-value';
      val.textContent = item.value;
      val.title = item.value;
      info.appendChild(val);

      if (item.label && item.label !== item.value) {
        const sub = document.createElement('div');
        sub.className = 'collector-item-sub';
        sub.textContent = item.label;
        sub.title = item.label;
        info.appendChild(sub);
      }

      // Cross-reference match indicator
      const xref = findSourceMatch(item);
      if (xref) {
        const xrefEl = document.createElement('div');
        xrefEl.className = 'collector-item-xref';
        xrefEl.textContent = '\u2713 Source: ' + xref;
        info.appendChild(xrefEl);
      }

      row.appendChild(info);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'collector-item-remove';
      removeBtn.textContent = '\u00D7';
      removeBtn.title = 'Remove';
      removeBtn.addEventListener('click', () => removeCollected(realIdx));
      row.appendChild(removeBtn);

      list.appendChild(row);
    });
  }

  function getDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
  }

  function findSourceMatch(item) {
    if (!sources.length) return null;
    const val = (item.value || '').toLowerCase();
    const url = (item.url || '').toLowerCase();
    const domain = getDomain(url);

    for (const src of sources) {
      const addrs = src.addresses || [];
      // Check source name / aliases against the item value/url
      const srcName = (src.name || '').toLowerCase();
      const aliases = (src.aliases || []).map(a => a.toLowerCase());

      for (const addr of addrs) {
        const av = (addr.value || '').toLowerCase();
        const avDomain = getDomain(av);

        // Exact value match
        if (av && val && av === val) return src.name;

        // Email match
        if (item.type === 'email' && addr.type === 'email' && av === val) return src.name;

        // URL: exact match
        if (av && url && av === url) return src.name;

        // URL: domain match — source domain matches item domain
        if (avDomain && domain && avDomain === domain) return src.name;

        // URL: one contains the other (handles path differences)
        if (av && url && (av.startsWith(url) || url.startsWith(av))) return src.name;
      }

      // Source name matches the domain
      if (domain && (srcName === domain || aliases.includes(domain))) return src.name;
    }
    return null;
  }

  /** Match a URL string against all sources, return source name or null */
  function findSourceForUrl(url) {
    if (!sources.length || !url) return null;
    return findSourceMatch({ type: 'link', value: url, url: url });
  }

  async function loadSources() {
    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      const resp = await api.runtime.sendMessage({ action: 'getSources' });
      sources = resp?.sources || [];
    } catch {
      sources = [];
    }
  }

  async function crossRefSources() {
    await loadSources();

    if (!sources.length) {
      showXrefToast('No sources saved yet. Add sources in Settings to cross-reference.', 0);
      return;
    }

    // Scan all link items in the main list
    let matchCount = 0;
    const items = $$('#link-list .link-item');
    items.forEach(el => {
      // Remove any previous source badge
      const old = el.querySelector('.source-badge');
      if (old) old.remove();

      const anchor = el.querySelector('.link-url');
      const url = anchor?.href || '';
      const srcName = findSourceForUrl(url);
      if (srcName) {
        matchCount++;
        const badge = document.createElement('span');
        badge.className = 'source-badge';
        badge.textContent = '\u2713 ' + srcName;
        badge.title = 'Matches saved source: ' + srcName;
        // Insert after the anchor
        if (anchor.nextSibling) {
          el.insertBefore(badge, anchor.nextSibling);
        } else {
          el.appendChild(badge);
        }
        el.classList.add('source-match');
      } else {
        el.classList.remove('source-match');
      }
    });

    // Also scan contact items (emails, phones)
    $$('#link-list .contact-item').forEach(el => {
      const old = el.querySelector('.source-badge');
      if (old) old.remove();
      el.classList.remove('source-match');

      // Email: has a mailto: link; Phone: has .contact-value
      const emailEl = el.querySelector('a.link-url[href^="mailto:"]');
      const phoneEl = el.querySelector('.contact-value');
      let val = '', type = 'link';
      if (emailEl) {
        val = emailEl.textContent || '';
        type = 'email';
      } else if (phoneEl) {
        val = phoneEl.textContent || '';
        type = 'phone';
      }
      if (!val) return;
      const srcName = findSourceMatch({ type, value: val, url: '' });
      if (srcName) {
        matchCount++;
        const badge = document.createElement('span');
        badge.className = 'source-badge';
        badge.textContent = '\u2713 ' + srcName;
        badge.title = 'Matches saved source: ' + srcName;
        el.appendChild(badge);
        el.classList.add('source-match');
      }
    });

    showXrefToast(
      matchCount > 0
        ? `Found ${matchCount} link${matchCount === 1 ? '' : 's'} matching your sources.`
        : 'No matches found against your sources.',
      matchCount
    );

    // Also refresh collector view
    renderCollector();
  }

  function showXrefToast(msg, count) {
    let toast = $('#xref-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'xref-toast';
      toast.className = 'xref-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'xref-toast' + (count > 0 ? ' has-matches' : ' no-matches') + ' visible';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), 4000);
  }

  function exportCollected() {
    const items = getFilteredCollected();
    if (!items.length) return;
    const rows = [['Type', 'Value', 'Label', 'URL']];
    items.forEach(c => rows.push([c.type, c.value, c.label, c.url]));
    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collected-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function bindCollector() {
    const tabBtn = $('#collectorTab');
    const panel = $('#collectorPanel');
    const closeBtn = $('#collectorClose');
    const clearBtn = $('#collectorClear');
    const searchInput = $('#collectorSearch');
    const sortSelect = $('#collectorSort');
    const exportBtn = $('#collectorExport');
    const xrefBtn = $('#collectorXref');

    if (tabBtn) {
      tabBtn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) renderCollector();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
    if (clearBtn) clearBtn.addEventListener('click', clearCollected);
    if (exportBtn) exportBtn.addEventListener('click', exportCollected);
    if (xrefBtn) xrefBtn.addEventListener('click', crossRefSources);

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        collectorQuery = searchInput.value.trim();
        renderCollector();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        collectorSort = sortSelect.value;
        renderCollector();
      });
    }

    // Collector tab buttons
    $$('.collector-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.collector-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        collectorTab = btn.dataset.coltab;
        renderCollector();
      });
    });

    // Drag to move
    const handle = $('#collectorDragHandle');
    if (handle && panel) {
      let dragging = false, ox = 0, oy = 0;
      handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        ox = e.clientX - rect.left;
        oy = e.clientY - rect.top;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        panel.style.left = (e.clientX - ox) + 'px';
        panel.style.top = (e.clientY - oy) + 'px';
        panel.style.right = 'auto';
      });
      document.addEventListener('mouseup', () => { dragging = false; });
    }
  }

  /* ── History popup ── */

  let historyEntries = [];
  let historyFilter = '';

  function bindHistory() {
    const btn = $('#history-btn');
    const panel = $('#historyOverlay');
    const closeBtn = $('#historyClose');
    const searchInput = $('#historySearch');
    const edgeTab = $('#historyTab');

    if (btn) btn.addEventListener('click', openHistory);
    if (edgeTab) edgeTab.addEventListener('click', openHistory);
    if (closeBtn) closeBtn.addEventListener('click', closeHistory);
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        historyFilter = searchInput.value.trim().toLowerCase();
        renderHistoryList();
      });
    }

    // ── Draggable ──
    if (panel) {
      const header = panel.querySelector('.fp-header');
      if (header) {
        let dragging = false, startX, startY, startLeft, startTop;
        header.addEventListener('mousedown', (e) => {
          if (e.target.closest('button, input')) return;
          dragging = true;
          const rect = panel.getBoundingClientRect();
          startX = e.clientX; startY = e.clientY;
          startLeft = rect.left; startTop = rect.top;
          header.style.cursor = 'grabbing';
          e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          panel.style.left = (startLeft + e.clientX - startX) + 'px';
          panel.style.top = (startTop + e.clientY - startY) + 'px';
          panel.style.right = 'auto';
          panel.style.transform = 'none';
        });
        document.addEventListener('mouseup', () => {
          if (!dragging) return;
          dragging = false;
          header.style.cursor = 'grab';
          const rect = panel.getBoundingClientRect();
          PanelState.save('linkmap', 'history', { left: rect.left, top: rect.top });
        });
      }

      // ── Resizable ──
      const handle = document.createElement('div');
      handle.className = 'fp-resize';
      panel.appendChild(handle);
      let resizing = false, rStartX, rStartY, rStartW, rStartH;
      handle.addEventListener('mousedown', (e) => {
        resizing = true;
        rStartX = e.clientX; rStartY = e.clientY;
        rStartW = panel.offsetWidth; rStartH = panel.offsetHeight;
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        panel.style.width = Math.max(220, rStartW + (e.clientX - rStartX)) + 'px';
        panel.style.height = Math.max(200, rStartH + (e.clientY - rStartY)) + 'px';
      });
      document.addEventListener('mouseup', () => {
        if (!resizing) return;
        resizing = false;
        PanelState.save('linkmap', 'history', { width: panel.offsetWidth, height: panel.offsetHeight });
      });

      // ── Restore saved state ──
      PanelState.apply(panel, 'linkmap', 'history', { skipVisibility: true });
    }
  }

  async function openHistory() {
    const panel = $('#historyOverlay');
    // Toggle panel
    if (!panel.classList.contains('hidden')) {
      closeHistory();
      return;
    }
    panel.classList.remove('hidden');
    PanelState.save('linkmap', 'history', { visible: true });

    const list = $('#historyList');
    list.innerHTML = '<div class="lm-history-empty">Loading...</div>';

    try {
      const resp = await browser.runtime.sendMessage({ action: 'getLinkMapHistory' });
      historyEntries = resp?.entries || [];
    } catch {
      historyEntries = [];
    }

    if (historyEntries.length === 0) {
      list.innerHTML = '<div class="lm-history-empty">No link map scans found.</div>';
      const ct = $('#historyCount');
      if (ct) ct.textContent = '0';
      return;
    }

    const ct = $('#historyCount');
    if (ct) ct.textContent = historyEntries.length;
    renderHistoryList();
  }

  function closeHistory() {
    $('#historyOverlay').classList.add('hidden');
    PanelState.save('linkmap', 'history', { visible: false });
  }

  function renderHistoryList() {
    const list = $('#historyList');
    list.innerHTML = '';

    let items = historyEntries;
    if (historyFilter) {
      items = items.filter(e => {
        const hay = [e.pageTitle, e.pageUrl].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(historyFilter);
      });
    }

    if (items.length === 0) {
      list.innerHTML = '<div class="lm-history-empty">No matches.</div>';
      return;
    }

    const currentUrl = linkData?.pageUrl || '';

    items.forEach(entry => {
      const el = document.createElement('div');
      el.className = 'lm-history-item';
      if (entry.pageUrl === currentUrl) el.classList.add('active');

      const dt = new Date(entry.timestamp);
      const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

      el.innerHTML =
        '<div class="lm-history-item-info">' +
          '<div class="lm-history-item-title">' + escapeHTML(entry.pageTitle || 'Untitled') + '</div>' +
          '<div class="lm-history-item-url">' + escapeHTML(entry.pageUrl || '') + '</div>' +
        '</div>' +
        '<div class="lm-history-item-meta">' +
          '<span class="lm-history-item-date">' + dateStr + ' ' + timeStr + '</span>' +
          '<span class="lm-history-item-stats">' + (entry.totalLinks || 0) + ' links &middot; ' + (entry.uniqueDomains || 0) + ' domains</span>' +
        '</div>';

      el.addEventListener('click', () => loadHistoryEntry(entry));
      list.appendChild(el);
    });
  }

  async function loadHistoryEntry(entry) {
    // Fetch the full history record by ID to get linkMapData
    try {
      const resp = await browser.runtime.sendMessage({ action: 'getHistoryItem', id: entry.id });
      if (!resp?.success || !resp.entry?.linkMapData) {
        showXrefToast('Could not load link map data for this entry.', 0);
        return;
      }

      const rec = resp.entry;

      // Swap data in-place — preserve search/filter state
      linkData = {
        pageUrl: rec.pageUrl,
        pageTitle: rec.pageTitle,
        links: rec.linkMapData.links,
        stats: rec.linkMapData.stats,
        cached: true,
        cachedAt: rec.timestamp
      };

      // Normalize and re-render without touching search inputs
      normalizeLinkData(linkData.links);
      isCachedMode = true;
      cachedAt = rec.timestamp;
      diffResult = null;
      diffView = 'current';
      oldLinkData = null;

      renderHeader();
      showCacheBanner();
      renderStats();
      renderLinks();

      // Hide diff banner if visible
      const diffBanner = $('#diffBanner');
      if (diffBanner) diffBanner.classList.add('hidden');

      closeHistory();
    } catch (err) {
      showXrefToast('Failed to load entry: ' + (err.message || err), 0);
    }
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
