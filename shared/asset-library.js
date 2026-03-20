/**
 * AssetLibrary — shared cross-page collection panel.
 *
 * Usage (on any page):
 *   <link rel="stylesheet" href="../shared/asset-library.css">
 *   <script src="../shared/panel-state.js"></script>
 *   <script src="../shared/floating-panel.js"></script>
 *   <script src="../shared/asset-library.js"></script>
 *
 *   AssetLibrary.init({ pageId: 'satellite' });
 *
 * Storage: browser.storage.local key "assetLibrary" → array of items.
 * Each item: { id, type, title, description, thumbnail, metadata, sourcePage, created }
 *
 * Types: "image", "location", "source", "entity", "snippet"
 *
 * API:
 *   AssetLibrary.add(item)          — add item to collection
 *   AssetLibrary.remove(id)         — remove by id
 *   AssetLibrary.list([type])       — get all (or filtered by type)
 *   AssetLibrary.get(id)            — get single item
 *   AssetLibrary.clear()            — remove all
 *   AssetLibrary.onSelect(callback) — register per-page handler for when user selects an item
 *   AssetLibrary.getContext()       — returns text summary for AI chat context
 */
const AssetLibrary = (() => {
  'use strict';

  const STORAGE_KEY = 'assetLibrary';
  let _items = [];
  let _panel = null;
  let _pageId = 'default';
  let _onSelect = null;
  let _activeTab = 'all';
  let _initialized = false;
  let _pinnedTabs = []; // tabs to always show even if empty

  // ── Storage ──

  async function _load() {
    try {
      const data = await browser.storage.local.get(STORAGE_KEY);
      _items = data[STORAGE_KEY] || [];
    } catch (e) {
      _items = [];
    }
  }

  async function _save() {
    try {
      await browser.storage.local.set({ [STORAGE_KEY]: _items });
    } catch (e) {
      console.warn('[AssetLibrary] save error:', e);
    }
  }

  // ── Public API ──

  async function add(item) {
    await _load();
    const asset = {
      id: item.id || _uid(),
      type: item.type || 'source',
      title: item.title || 'Untitled',
      description: item.description || '',
      thumbnail: item.thumbnail || null,
      metadata: item.metadata || {},
      sourcePage: item.sourcePage || _pageId,
      created: item.created || Date.now(),
    };
    _items.unshift(asset);
    await _save();
    _render();
    return asset;
  }

  async function remove(id) {
    await _load();
    _items = _items.filter(i => i.id !== id);
    await _save();
    _render();
  }

  async function list(type) {
    await _load();
    return type ? _items.filter(i => i.type === type) : [..._items];
  }

  async function get(id) {
    await _load();
    return _items.find(i => i.id === id) || null;
  }

  async function clear() {
    _items = [];
    await _save();
    _render();
  }

  function onSelect(callback) {
    _onSelect = callback;
  }

  function getContext() {
    if (!_items.length) return 'Asset Library: empty';
    const counts = {};
    _items.forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; });
    const lines = [`Asset Library: ${_items.length} items`];
    for (const [type, count] of Object.entries(counts)) {
      lines.push(`  ${type}: ${count}`);
    }
    // List recent 10 items
    _items.slice(0, 10).forEach(i => {
      lines.push(`  - [${i.type}] ${i.title}${i.description ? ' — ' + i.description : ''}`);
    });
    return lines.join('\n');
  }

  // ── Helpers ──

  function _uid() {
    return 'al_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function _badgeClass(type) {
    return 'asset-lib-badge asset-lib-badge-' + (type || 'source');
  }

  function _typeIcon(type) {
    switch (type) {
      case 'image':    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      case 'satellite': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
      case 'location': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      case 'source':   return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      case 'entity':   return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
      case 'snippet':  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
      case 'person':   return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      case 'organization': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';
      case 'document': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
      case 'vessel':   return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20l2-2h16l2 2"/><path d="M4 18l-2-6h20l-2 6"/><path d="M12 4v8"/><path d="M8 8h8"/></svg>';
      case 'link':     return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
      default:         return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
    }
  }

  // ── Panel UI ──

  function _createPanel() {
    // Edge tab toggle (left side)
    const toggle = document.createElement('button');
    toggle.className = 'edge-tab edge-tab-right asset-lib-toggle';
    toggle.title = 'Asset Library';
    toggle.style.top = '330px';
    toggle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    document.body.appendChild(toggle);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'fp asset-lib-panel hidden';
    panel.id = 'assetLibPanel';
    panel.dataset.panelId = 'asset-lib';
    panel.innerHTML = `
      <div class="fp-header">
        <span class="fp-title">Asset Library</span>
        <span class="fp-count" id="alTotalCount">0</span>
        <span id="alHeaderActions" style="display:flex;gap:3px;"></span>
        <button class="fp-close" id="alClose">&times;</button>
      </div>
      <div class="asset-lib-tabs" id="alTabs"></div>
      <!-- category filter reserved for future use -->
      <div class="asset-lib-panes" id="alPanes"></div>
      <div class="asset-lib-footer">
        <select id="alProjectSelect" class="al-project-select" title="Active project"></select>
        <button class="pill-chip" id="alClearAll">Clear All</button>
      </div>
    `;
    document.body.appendChild(panel);

    // Events
    toggle.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      const isVisible = !panel.classList.contains('hidden');
      _saveVisibility(isVisible);
      if (isVisible) {
        _load().then(() => _render());
      }
    });

    panel.querySelector('#alClose').addEventListener('click', () => {
      panel.classList.add('hidden');
      _saveVisibility(false);
    });

    // Tab switching is handled dynamically in _render()
    // Restore saved tab
    (async () => {
      try {
        const { _assetLibActiveTab } = await browser.storage.local.get('_assetLibActiveTab');
        if (_assetLibActiveTab) _activeTab = _assetLibActiveTab;
      } catch {}
    })();

    // Clear all
    panel.querySelector('#alClearAll').addEventListener('click', () => {
      if (_items.length === 0) return;
      clear();
    });

    // Project dropdown — shows active project context, switchable
    const projSelect = panel.querySelector('#alProjectSelect');
    (async () => {
      try {
        const [projResp, defaultResp] = await Promise.all([
          browser.runtime.sendMessage({ action: 'getProjects' }),
          browser.runtime.sendMessage({ action: 'getDefaultProject' }),
        ]);
        const projects = projResp?.projects || [];
        const defaultId = defaultResp?.defaultProjectId || null;

        projSelect.innerHTML = '<option value="">No project</option>';
        projects.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name || p.id;
          if (p.id === defaultId) opt.selected = true;
          projSelect.appendChild(opt);
        });
      } catch { /* no projects available */ }
    })();

    projSelect.addEventListener('change', async () => {
      try {
        await browser.runtime.sendMessage({
          action: 'setDefaultProject',
          projectId: projSelect.value || null,
        });
      } catch { /* silent */ }
    });

    // Make draggable/resizable via shared lib — use fixed pageId so state is shared across all pages
    if (typeof FloatingPanel !== 'undefined') {
      FloatingPanel.init(panel, 'shared', { skipVisibility: true });
    }

    // Restore visibility from shared state
    (async () => {
      if (typeof PanelState !== 'undefined') {
        const state = await PanelState.load('shared', 'asset-lib');
        if (state && typeof state.visible === 'boolean') {
          panel.classList.toggle('hidden', !state.visible);
        }
      }
    })();

    _panel = panel;
  }

  function _saveVisibility(visible) {
    if (typeof PanelState !== 'undefined') {
      PanelState.save('shared', 'asset-lib', { visible });
    }
  }

  function _renderItems(container, items) {
    if (!items.length) {
      container.innerHTML = '<div class="asset-lib-empty">No items in collection yet.<br>Add items from any page.</div>';
      return;
    }

    container.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'asset-lib-item';
      el.dataset.id = item.id;

      // Thumbnail or icon
      let thumbHtml;
      if (item.thumbnail) {
        thumbHtml = `<img class="asset-lib-thumb" src="${item.thumbnail}" alt="">`;
      } else {
        thumbHtml = `<div class="asset-lib-thumb-icon">${_typeIcon(item.type)}</div>`;
      }

      const desc = item.description || item.sourcePage || '';
      const date = new Date(item.created).toLocaleDateString();
      const providerLabel = item.metadata?.provider || item.sourcePage || '';

      el.innerHTML = `
        ${thumbHtml}
        <div class="asset-lib-meta">
          <span class="asset-lib-title">${_esc(item.title)}</span>
          <span class="asset-lib-desc">${_esc(desc)} · ${date}</span>
          ${providerLabel ? '<span class="asset-lib-provider">via ' + _esc(providerLabel) + '</span>' : ''}
        </div>
        <span class="${_badgeClass(item.type)}">${item.type}</span>
        <div class="asset-lib-item-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:2px;">
          ${item.metadata?.pageUrl ? '<a class="pill-chip al-source-btn" href="' + _esc(item.metadata.pageUrl) + '" target="_blank" rel="noopener" style="font-size:8px;padding:1px 6px;text-align:center;">View ↗</a>' : '<span></span>'}
          <button class="pill-chip al-to-source-btn" style="font-size:8px;padding:1px 6px;">+ Source</button>
          <button class="pill-chip al-to-kg-btn" style="font-size:8px;padding:1px 6px;">+ KG</button>
          <button class="pill-chip al-remove-btn" style="font-size:8px;padding:1px 6px;color:#e94560;">Remove</button>
        </div>
      `;

      // +S — Save as Source
      el.querySelector('.al-to-source-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        browser.runtime.sendMessage({
          action: 'saveSource',
          source: {
            name: item.title,
            type: item.type || 'other',
            notes: item.description || '',
            tags: item.metadata?.category ? [item.metadata.category] : [],
            addresses: item.metadata?.pageUrl ? [{ type: 'url', value: item.metadata.pageUrl }] : [],
            metadata: item.metadata || {},
          }
        }).then(() => {
          btn.textContent = 'Saved!';
          setTimeout(() => { btn.textContent = '+ Source'; }, 2000);
        }).catch(err => { console.warn('[AssetLib] save source error:', err); });
      });

      // + KG
      el.querySelector('.al-to-kg-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        browser.runtime.sendMessage({
          action: 'extractAndUpsert',
          text: item.title,
          pageUrl: item.metadata?.pageUrl || ('asset:' + item.id),
          pageTitle: (item.metadata?.provider || 'Asset') + ' — ' + item.title
        }).then(() => {
          btn.textContent = 'Added!';
          setTimeout(() => { btn.textContent = '+ KG'; }, 2000);
        }).catch(err => { console.warn('[AssetLib] KG add error:', err); });
      });

      // View button is an <a> tag — no JS handler needed

      // Remove button
      el.querySelector('.al-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        remove(item.id);
      });

      // Click item to select (visual highlight)
      el.addEventListener('click', () => {
        container.querySelectorAll('.asset-lib-item').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
      });

      container.appendChild(el);
    });
  }

  // Tab display labels
  const TYPE_LABELS = {
    image: 'Images', satellite: 'Satellite', location: 'Locations', source: 'Sources',
    entity: 'Entities', person: 'People', organization: 'Orgs', document: 'Docs',
    vessel: 'Vessels', link: 'Links', aircraft: 'Aircraft', address: 'Addresses',
    feed: 'Feeds', snippet: 'Snippets', ip: 'IPs'
  };
  const CATEGORY_LABELS = {
    screening: 'Screening', legal: 'Legal', litigation: 'Litigation', patent: 'Patent',
    entity: 'Entity', finance: 'Financial', tracking: 'Tracking', satellite: 'Satellite',
    events: 'Events'
  };

  var _activeCategory = 'all'; // category filter state

  function _render() {
    if (!_panel) return;

    const total = _items.length;
    _panel.querySelector('#alTotalCount').textContent = total;

    // Discover types that have items
    const typeCounts = {};
    const categoryCounts = {};
    _items.forEach(item => {
      const t = item.type || 'other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
      const c = item.metadata?.category || 'other';
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    });

    // Build type tabs dynamically
    const tabsContainer = _panel.querySelector('#alTabs');
    tabsContainer.innerHTML = '';
    // "All" tab always present
    const allTab = document.createElement('button');
    allTab.className = 'asset-lib-tab' + (_activeTab === 'all' ? ' active' : '');
    allTab.dataset.alTab = 'all';
    allTab.textContent = 'All';
    if (total) { const s = document.createElement('span'); s.className = 'al-count'; s.textContent = '(' + total + ')'; allTab.appendChild(s); }
    tabsContainer.appendChild(allTab);

    // Merge pinned tabs (always visible) with types that have items
    const allTypes = new Set([..._pinnedTabs, ...Object.keys(typeCounts)]);
    const sortedTypes = Array.from(allTypes).sort();
    sortedTypes.forEach(type => {
      const tab = document.createElement('button');
      tab.className = 'asset-lib-tab' + (_activeTab === type ? ' active' : '');
      tab.dataset.alTab = type;
      tab.textContent = TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
      const count = typeCounts[type] || 0;
      if (count) { const s = document.createElement('span'); s.className = 'al-count'; s.textContent = '(' + count + ')'; tab.appendChild(s); }
      tabsContainer.appendChild(tab);
    });

    // Wire tab clicks
    tabsContainer.querySelectorAll('.asset-lib-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        _activeTab = tab.dataset.alTab;
        _renderContent();
        tabsContainer.querySelectorAll('.asset-lib-tab').forEach(t => t.classList.toggle('active', t.dataset.alTab === _activeTab));
        try { browser.storage.local.set({ _assetLibActiveTab: _activeTab }); } catch {}
      });
    });

    _renderContent();
  }

  function _renderContent() {
    const panesContainer = _panel.querySelector('#alPanes');
    let filtered = _activeTab === 'all' ? _items : _items.filter(i => i.type === _activeTab);
    _renderItems(panesContainer, filtered);
  }

  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Init ──

  function init(opts = {}) {
    if (_initialized) return;
    _initialized = true;
    _pageId = opts.pageId || 'default';

    _pinnedTabs = opts.tabs || [];
    _createPanel();
    _load().then(() => _render());

    // Listen for storage changes from other pages
    browser.storage.onChanged.addListener((changes) => {
      if (changes[STORAGE_KEY]) {
        _items = changes[STORAGE_KEY].newValue || [];
        _render();
      }
    });

    // Auto-load asset if navigated here from "Go to page" button
    (async () => {
      try {
        const { _assetLibraryAutoLoad } = await browser.storage.local.get('_assetLibraryAutoLoad');
        if (_assetLibraryAutoLoad) {
          await browser.storage.local.remove('_assetLibraryAutoLoad');
          // Wait for page to settle, then trigger onSelect
          setTimeout(async () => {
            await _load();
            const item = _items.find(i => i.id === _assetLibraryAutoLoad);
            if (item && _onSelect) {
              _onSelect(item);
              // Open the panel and highlight the item
              if (_panel) {
                _panel.classList.remove('hidden');
                _saveVisibility(true);
              }
            }
          }, 1500);
        }
      } catch { /* silent */ }
    })();
  }

  /**
   * Mark an asset as "in use" on the current page (baby blue highlight).
   * Pass null to clear all in-use highlights.
   */
  function markInUse(id) {
    if (!_panel) return;
    _panel.querySelectorAll('.asset-lib-item').forEach(el => {
      el.classList.toggle('in-use', id != null && el.dataset.id === id);
    });
  }

  /** Switch to a specific tab programmatically */
  function switchTab(tabName) {
    if (!_panel) return;
    _activeTab = tabName;
    _panel.querySelectorAll('.asset-lib-tab').forEach(t => t.classList.toggle('active', t.dataset.alTab === tabName));
    _panel.querySelectorAll('.asset-lib-pane').forEach(p => p.classList.toggle('active', p.dataset.alPane === tabName));
    try { browser.storage.local.set({ _assetLibActiveTab: tabName }); } catch {}
  }

  /** Add a pill button to the panel header (for page-specific actions) */
  function addHeaderButton(label, title, onClick) {
    if (!_panel) return;
    const slot = _panel.querySelector('#alHeaderActions');
    if (!slot) return;
    const btn = document.createElement('button');
    btn.className = 'pill-chip';
    btn.textContent = label;
    btn.title = title;
    btn.style.cssText = 'font-size:8px;padding:2px 6px;';
    btn.addEventListener('click', onClick);
    slot.appendChild(btn);
    return btn;
  }

  return { init, add, remove, list, get, clear, onSelect, getContext, markInUse, switchTab, addHeaderButton };
})();
