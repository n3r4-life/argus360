// Argus shared ribbon — matches console page-header layout
// Logo + "Argus" on LEFT, console-tab icon buttons on RIGHT
(function() {
  const SVG_NS = "http://www.w3.org/2000/svg";

  function makeSvg(paths) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    for (const [tag, attrs] of paths) {
      const el = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      svg.appendChild(el);
    }
    return svg;
  }

  function makeIcon(id, title, svgPaths) {
    const btn = document.createElement("button");
    btn.className = "ribbon-icon";
    btn.id = id;
    btn.title = title;
    btn.appendChild(makeSvg(svgPaths));
    return btn;
  }

  // ── Build ribbon (header bar) ──
  const ribbon = document.createElement("nav");
  ribbon.className = "argus-ribbon";

  // Left side: logo + brand
  const left = document.createElement("div");
  left.className = "ribbon-left";

  const logo = document.createElement("img");
  logo.className = "ribbon-logo";
  logo.src = browser.runtime.getURL("icons/icon-32.png");
  logo.alt = "Argus";
  left.appendChild(logo);

  const brand = document.createElement("a");
  brand.className = "ribbon-brand";
  brand.id = "ribbon-console";
  brand.title = "Open Argus Console";
  brand.textContent = "Argus";
  left.appendChild(brand);

  ribbon.appendChild(left);

  // Centre: live connection status pills
  const statusStrip = document.createElement("div");
  statusStrip.className = "ribbon-status";
  statusStrip.id = "ribbon-status";
  ribbon.appendChild(statusStrip);

  // Right side: console-tab icon buttons (same as console page header)
  const icons = document.createElement("nav");
  icons.className = "ribbon-icons";

  icons.appendChild(makeIcon("ribbon-bookmarks", "Bookmarks", [
    ["path", { d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-projects", "Projects", [
    ["path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-monitors", "Monitors", [
    ["path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }],
    ["circle", { cx: "12", cy: "12", r: "3" }]
  ]));
  icons.appendChild(makeIcon("ribbon-feeds", "Feeds", [
    ["path", { d: "M4 11a9 9 0 0 1 9 9" }],
    ["path", { d: "M4 4a16 16 0 0 1 16 16" }],
    ["circle", { cx: "5", cy: "19", r: "1" }]
  ]));
  icons.appendChild(makeIcon("ribbon-osint", "OSINT", [
    ["circle", { cx: "11", cy: "11", r: "8" }],
    ["line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }]
  ]));
  icons.appendChild(makeIcon("ribbon-intel", "Intelligence", [
    ["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-automate", "Automate", [
    ["circle", { cx: "12", cy: "12", r: "3" }],
    ["path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-redirects", "Redirects", [
    ["polyline", { points: "16 3 21 3 21 8" }],
    ["line", { x1: "4", y1: "20", x2: "21", y2: "3" }],
    ["polyline", { points: "21 16 21 21 16 21" }],
    ["line", { x1: "15", y1: "15", x2: "21", y2: "21" }]
  ]));
  icons.appendChild(makeIcon("ribbon-tracker", "Page Tracker", [
    ["polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" }]
  ]));
  icons.appendChild(makeIcon("ribbon-sources", "Sources", [
    ["path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: "9", cy: "7", r: "4" }],
    ["path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }],
    ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }]
  ]));

  const sep1 = document.createElement("span");
  sep1.className = "ribbon-icon-sep";
  icons.appendChild(sep1);

  icons.appendChild(makeIcon("ribbon-prompts", "Prompts", [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-providers", "Providers", [
    ["path", { d: "M12 2L2 7l10 5 10-5-10-5z" }],
    ["path", { d: "M2 17l10 5 10-5" }],
    ["path", { d: "M2 12l10 5 10-5" }]
  ]));
  icons.appendChild(makeIcon("ribbon-resources", "Resources", [
    ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
    ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }]
  ]));
  icons.appendChild(makeIcon("ribbon-settings", "Settings", [
    ["path", { d: "M12 20h9" }],
    ["path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" }]
  ]));
  icons.appendChild(makeIcon("ribbon-help", "Help", [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }],
    ["line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }]
  ]));

  // 4-square entry tab picker
  const entryPickerBtn = document.createElement("button");
  entryPickerBtn.className = "ribbon-icon";
  entryPickerBtn.id = "ribbon-entry-picker";
  entryPickerBtn.title = "Swappable tab";
  entryPickerBtn.appendChild(makeSvg([
    ["rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "14", y: "14", width: "7", height: "7", rx: "1" }]
  ]));
  icons.appendChild(entryPickerBtn);

  const entryPickerOverlay = document.createElement("div");
  entryPickerOverlay.id = "ribbon-entry-picker-overlay";
  entryPickerOverlay.className = "ribbon-entry-picker hidden";
  icons.appendChild(entryPickerOverlay);

  const sep2 = document.createElement("span");
  sep2.className = "ribbon-icon-sep";
  icons.appendChild(sep2);

  const wipeBtn = document.createElement("button");
  wipeBtn.className = "ribbon-icon ribbon-icon-danger";
  wipeBtn.id = "ribbon-wipe";
  wipeBtn.title = "Wipe all Argus data";
  wipeBtn.appendChild(makeSvg([
    ["polyline", { points: "3 6 5 6 21 6" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]
  ]));
  icons.appendChild(wipeBtn);

  ribbon.appendChild(icons);
  document.body.insertBefore(ribbon, document.body.firstChild);

  // ── AI provider sub-strip (below ribbon) ──
  const aiStrip = document.createElement("div");
  aiStrip.className = "ribbon-ai-strip";
  aiStrip.id = "ribbon-ai-strip";
  document.body.insertBefore(aiStrip, ribbon.nextSibling);

  // ── Intel provider sub-strip (below AI strip) ──
  const intelStrip = document.createElement("div");
  intelStrip.className = "ribbon-intel-strip";
  intelStrip.id = "ribbon-intel-strip";
  document.body.insertBefore(intelStrip, aiStrip.nextSibling);

  // ── App launcher tab bar (below ribbon) ──
  const appBar = document.createElement("nav");
  appBar.className = "argus-app-tabs";

  function makeAppTab(id, label, svgPaths) {
    const btn = document.createElement("button");
    btn.className = "app-tab-btn";
    btn.id = id;
    btn.setAttribute("data-tab-id", id);
    btn.appendChild(makeSvg(svgPaths));
    const span = document.createElement("span");
    span.textContent = label;
    btn.appendChild(span);
    return btn;
  }

  // Data-driven tab definitions — default order
  const APP_TAB_DEFS = {
    "app-projects": { label: "Projects", icon: [["path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }]], path: "options/options.html", hash: "projects" },
    "app-reader":   { label: "Reader",   icon: [["path", { d: "M4 11a9 9 0 0 1 9 9" }], ["path", { d: "M4 4a16 16 0 0 1 16 16" }], ["circle", { cx: "5", cy: "19", r: "1" }]], path: "feeds/feeds.html" },
    "app-reports":  { label: "Reports",  icon: [["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }], ["polyline", { points: "14 2 14 8 20 8" }], ["line", { x1: "16", y1: "13", x2: "8", y2: "13" }], ["line", { x1: "16", y1: "17", x2: "8", y2: "17" }]], path: "history/history.html" },
    "app-kg":       { label: "KG",       icon: [["circle", { cx: "6", cy: "6", r: "3" }], ["circle", { cx: "18", cy: "6", r: "3" }], ["circle", { cx: "6", cy: "18", r: "3" }], ["circle", { cx: "18", cy: "18", r: "3" }], ["line", { x1: "9", y1: "6", x2: "15", y2: "6" }], ["line", { x1: "6", y1: "9", x2: "6", y2: "15" }], ["line", { x1: "18", y1: "9", x2: "18", y2: "15" }], ["line", { x1: "9", y1: "18", x2: "15", y2: "18" }]], path: "osint/graph.html" },
    "app-workbench":{ label: "Workbench",icon: [["rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }], ["line", { x1: "8", y1: "21", x2: "16", y2: "21" }], ["line", { x1: "12", y1: "17", x2: "12", y2: "21" }]], path: "workbench/workbench.html" },
    "app-draft":    { label: "Publisher",    icon: [["path", { d: "M12 20h9" }], ["path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" }]], path: "reporting/reporting.html" },
    "app-images":   { label: "Images",   icon: [["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }], ["circle", { cx: "8.5", cy: "8.5", r: "1.5" }], ["polyline", { points: "21 15 16 10 5 21" }]], path: "osint/images.html" },
    "app-chat":     { label: "Chat",     icon: [["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }]], path: "chat/chat.html" },
    "app-terminal": { label: "Terminal", icon: [["polyline", { points: "4 17 10 11 4 5" }], ["line", { x1: "12", y1: "19", x2: "20", y2: "19" }]], path: "ssh/ssh.html" },
    "app-finance":  { label: "Finance",  icon: [["line", { x1: "12", y1: "1", x2: "12", y2: "23" }], ["path", { d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" }]], path: "finance/finance.html" },
    "app-results":  { label: "Results",  icon: [["path", { d: "M9 11l3 3L22 4" }], ["path", { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" }]], path: "results/results.html" },
    "app-link-map": { label: "Link Map", icon: [["circle", { cx: "12", cy: "5", r: "3" }], ["line", { x1: "12", y1: "8", x2: "12", y2: "12" }], ["line", { x1: "12", y1: "12", x2: "6", y2: "18" }], ["line", { x1: "12", y1: "12", x2: "18", y2: "18" }], ["circle", { cx: "6", cy: "19", r: "2" }], ["circle", { cx: "18", cy: "19", r: "2" }]], path: "osint/link-map.html" },
    "app-trawl":    { label: "Trawl Net", icon: [["path", { d: "M2 4c4 3 8 3 12 0s8-3 12 0" }], ["path", { d: "M2 12c4 3 8 3 12 0s8-3 12 0" }], ["path", { d: "M2 20c4 3 8 3 12 0s8-3 12 0" }]], path: "trawl/trawl.html" },
    "app-intel":      { label: "Intel",      icon: [["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }]], path: "intel/hub.html" },
    "app-compliance": { label: "Compliance", icon: [["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }], ["path", { d: "M9 12l2 2 4-4" }]], path: "intel/compliance.html" },
    "app-movement":   { label: "Movement",   icon: [["path", { d: "M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.7 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z" }]], path: "intel/movement.html" },
    "app-events":     { label: "Events",     icon: [["circle", { cx: "12", cy: "12", r: "10" }], ["polyline", { points: "12 6 12 12 16 14" }]], path: "intel/events.html" },
    "app-satellite":  { label: "Satellite",  icon: [["circle", { cx: "12", cy: "12", r: "10" }], ["line", { x1: "2", y1: "12", x2: "22", y2: "12" }], ["path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" }]], path: "intel/satellite.html" }
  };

  // MFT (tool) tabs — selectable in pickers, can be pinned/visible
  const ALL_TAB_IDS = ["app-projects", "app-reader", "app-reports", "app-kg", "app-workbench", "app-draft", "app-images", "app-chat", "app-terminal", "app-finance", "app-link-map", "app-trawl", "app-intel", "app-compliance", "app-movement", "app-events", "app-satellite"];
  const DEFAULT_TAB_ORDER = [...ALL_TAB_IDS];
  const DEFAULT_VISIBLE_TABS = ["app-projects", "app-reader", "app-reports", "app-kg", "app-workbench", "app-chat", "app-terminal", "app-trawl"];
  const MAX_VISIBLE_TABS = 8;
  const PINNED_TABS = ["app-projects"]; // always visible, non-negotiable

  // Active-state detection map (pathname fragment → tab id)
  const ACTIVE_MAP = {
    "/options/options": "app-projects",
    "/feeds/": "app-reader",
    "/history/": "app-reports",
    "/osint/graph": "app-kg",
    "/workbench/": "app-workbench",
    "/reporting/": "app-draft",
    "/osint/images": "app-images",
    "/chat/": "app-chat",
    "/ssh/": "app-terminal",
    "/finance/": "app-finance",
    "/results/": "app-results",
    "/osint/regex": "app-results",
    "/osint/link-map": "app-link-map",
    "/trawl/": "app-trawl",
    "/intel/hub":        "app-intel",
    "/intel/compliance": "app-compliance",
    "/intel/movement":   "app-movement",
    "/intel/events":     "app-events",
    "/intel/satellite":  "app-satellite",
  };

  // ── Quick-jump button (⋯) — shows hidden/non-visible MFT tabs ──
  const quickJumpBtn = document.createElement("button");
  quickJumpBtn.className = "app-tab-manage-btn";
  quickJumpBtn.title = "Jump to hidden tabs";
  quickJumpBtn.textContent = "⋯";

  const quickJumpOverlay = document.createElement("div");
  quickJumpOverlay.className = "app-tab-picker hidden";

  // ── Tab visibility config button (4-square) — manage which tabs are visible ──
  const tabPickerBtn = document.createElement("button");
  tabPickerBtn.className = "app-tab-manage-btn app-tab-config-btn";
  tabPickerBtn.title = "Manage visible tabs";
  tabPickerBtn.appendChild(makeSvg([
    ["rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "14", y: "14", width: "7", height: "7", rx: "1" }]
  ]));

  const tabPickerOverlay = document.createElement("div");
  tabPickerOverlay.className = "app-tab-picker hidden";

  let currentVisibleTabs = [...DEFAULT_VISIBLE_TABS]; // persisted defaults
  let sessionVisibleTabs = null; // ephemeral swap state (null = use defaults)

  function getEffectiveVisible() {
    return sessionVisibleTabs || currentVisibleTabs;
  }

  function renderAppTabs(order, visible) {
    // Remove all tab buttons but keep the manage buttons
    appBar.querySelectorAll(".app-tab-btn").forEach(b => b.remove());
    const visibleSet = new Set(visible);
    for (const id of order) {
      if (!visibleSet.has(id)) continue;
      const def = APP_TAB_DEFS[id];
      if (!def) continue;
      appBar.insertBefore(makeAppTab(id, def.label, def.icon), quickJumpBtn);
    }
  }

  function renderTabPicker() {
    const visibleSet = new Set(currentVisibleTabs);
    let html = '<div class="app-tab-picker-title">Visible Tabs</div>';
    html += '<div class="app-tab-picker-hint">Max ' + MAX_VISIBLE_TABS + ' tabs. Drag MFTs to reorder.</div>';
    for (const id of ALL_TAB_IDS) {
      const def = APP_TAB_DEFS[id];
      if (!def) continue;
      const isPinned = PINNED_TABS.includes(id);
      const isVisible = visibleSet.has(id);
      const pinnedCls = isPinned ? " app-tab-picker-pinned" : "";
      const activeCls = isVisible ? " app-tab-picker-active" : "";
      const svg = makeSvg(def.icon).outerHTML;
      html += `<button class="app-tab-picker-item${activeCls}${pinnedCls}" data-pick-id="${id}" ${isPinned ? 'disabled' : ''}>`;
      html += `${svg} <span>${def.label}</span>`;
      if (isPinned) html += '<span class="app-tab-picker-pin" title="Always visible">&#128274;</span>';
      else if (isVisible) html += '<span class="app-tab-picker-toggle">✕</span>';
      else html += '<span class="app-tab-picker-toggle">+</span>';
      html += '</button>';
    }
    tabPickerOverlay.innerHTML = html;

    tabPickerOverlay.querySelectorAll(".app-tab-picker-item:not([disabled])").forEach(item => {
      item.addEventListener("click", async () => {
        const id = item.dataset.pickId;
        const idx = currentVisibleTabs.indexOf(id);
        if (idx >= 0) {
          // Remove
          currentVisibleTabs.splice(idx, 1);
        } else if (currentVisibleTabs.length < MAX_VISIBLE_TABS) {
          // Add
          currentVisibleTabs.push(id);
        } else {
          return; // at max
        }
        await browser.storage.local.set({ appVisibleTabs: currentVisibleTabs });
        sessionVisibleTabs = null; // reset session swaps when defaults change
        renderAppTabs(currentTabOrder, currentVisibleTabs);
        highlightActiveTab();
        renderTabPicker();
      });
    });
  }

  // ── Quick-jump: render hidden tabs + swap-in on click ──
  function renderQuickJump() {
    const effective = getEffectiveVisible();
    const visibleSet = new Set(effective);
    const hiddenTabs = currentTabOrder.filter(id => !visibleSet.has(id) && ALL_TAB_IDS.includes(id));
    if (hiddenTabs.length === 0) {
      quickJumpOverlay.innerHTML = '<div class="app-tab-picker-title">All tabs visible</div>';
      return;
    }
    let html = '<div class="app-tab-picker-title">Jump to</div>';
    for (const id of hiddenTabs) {
      const def = APP_TAB_DEFS[id];
      const svg = makeSvg(def.icon).outerHTML;
      html += `<button class="app-tab-picker-item" data-jump-id="${id}">${svg} <span>${def.label}</span></button>`;
    }
    quickJumpOverlay.innerHTML = html;

    quickJumpOverlay.querySelectorAll("[data-jump-id]").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.dataset.jumpId;
        const def = APP_TAB_DEFS[id];
        if (!def) return;
        quickJumpOverlay.classList.add("hidden");

        // Swap: bump leftmost non-pinned tab, add this one at the end
        const swapped = [...effective];
        const bumpIdx = swapped.findIndex(t => !PINNED_TABS.includes(t));
        if (bumpIdx >= 0) {
          swapped.splice(bumpIdx, 1); // remove leftmost non-pinned
          swapped.push(id);           // add new tab at end
          sessionVisibleTabs = swapped;
          renderAppTabs(currentTabOrder, sessionVisibleTabs);
          highlightActiveTab();
        }

        // Navigate
        if (def.hash) nav(def.hash);
        else navigateTo(def.path);
      });
    });
  }

  function positionOverlay(overlay, e) {
    // Position from the click event coordinates — let layout settle, then fade in
    overlay.style.opacity = "0";
    overlay.style.left = "auto";
    overlay.style.right = "auto";
    requestAnimationFrame(() => {
      const x = e.clientX;
      const y = e.clientY;
      // Right-align: overlay extends leftward from click point
      const right = Math.max(0, window.innerWidth - x - 20);
      overlay.style.top = (y + 16) + "px";
      overlay.style.right = right + "px";
      overlay.style.opacity = "1";
    });
  }

  quickJumpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tabPickerOverlay.classList.add("hidden"); // close the other overlay
    const isHidden = quickJumpOverlay.classList.contains("hidden");
    quickJumpOverlay.classList.toggle("hidden");
    if (isHidden) {
      renderQuickJump();
      positionOverlay(quickJumpOverlay, e);
    }
  });

  tabPickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    quickJumpOverlay.classList.add("hidden"); // close the other overlay
    const isHidden = tabPickerOverlay.classList.contains("hidden");
    tabPickerOverlay.classList.toggle("hidden");
    if (isHidden) {
      renderTabPicker();
      positionOverlay(tabPickerOverlay, e);
    }
  });

  document.addEventListener("click", (e) => {
    if (!tabPickerOverlay.contains(e.target) && e.target !== tabPickerBtn && !tabPickerBtn.contains(e.target)) {
      tabPickerOverlay.classList.add("hidden");
    }
    if (!quickJumpOverlay.contains(e.target) && e.target !== quickJumpBtn) {
      quickJumpOverlay.classList.add("hidden");
    }
  });

  // Console tab → label mapping for dynamic entry point
  const CONSOLE_TAB_LABELS = {
    bookmarks: "Bookmarks", projects: "Projects", monitors: "Monitors",
    feeds: "Feeds", osint: "OSINT", automation: "Automate",
    archive: "Redirects", tracker: "Tracker", sources: "Sources",
    prompts: "Prompts", providers: "Providers",
    resources: "Resources", settings: "Settings"
  };

  let currentTabOrder = DEFAULT_TAB_ORDER;

  // Load saved order + visibility, or use defaults
  async function initAppTabs() {
    let order = DEFAULT_TAB_ORDER;
    let visible = DEFAULT_VISIBLE_TABS;
    try {
      const stored = await browser.storage.local.get(["appTabOrder", "appVisibleTabs", "consoleEntryTab"]);
      if (Array.isArray(stored.appTabOrder) && stored.appTabOrder.length > 0) {
        const valid = stored.appTabOrder.filter(id => APP_TAB_DEFS[id]);
        const missing = ALL_TAB_IDS.filter(id => !valid.includes(id));
        if (valid.length > 0) order = [...valid, ...missing];
      }
      if (Array.isArray(stored.appVisibleTabs) && stored.appVisibleTabs.length > 0) {
        // Ensure pinned tabs are always included
        visible = stored.appVisibleTabs.filter(id => APP_TAB_DEFS[id]);
        for (const pin of PINNED_TABS) {
          if (!visible.includes(pin)) visible.unshift(pin);
        }
        if (visible.length > MAX_VISIBLE_TABS) visible = visible.slice(0, MAX_VISIBLE_TABS);
      }
      // Apply dynamic console entry tab
      const entryTab = stored.consoleEntryTab || "projects";
      if (CONSOLE_TAB_LABELS[entryTab]) {
        APP_TAB_DEFS["app-projects"].label = CONSOLE_TAB_LABELS[entryTab];
        APP_TAB_DEFS["app-projects"].hash = entryTab;
      }
    } catch (e) { /* use defaults */ }

    currentTabOrder = order;
    currentVisibleTabs = visible;

    // Append quick-jump (⋯) + config (4-square) buttons + overlays to appBar
    appBar.appendChild(quickJumpBtn);
    appBar.appendChild(quickJumpOverlay);
    appBar.appendChild(tabPickerBtn);
    appBar.appendChild(tabPickerOverlay);

    renderAppTabs(order, visible);
    highlightActiveTab();
    setupTabDragReorder();

    // Listen for entry tab changes from the console picker
    window.addEventListener("consoleEntryChanged", (e) => {
      const tabId = e.detail?.tabId;
      if (tabId && CONSOLE_TAB_LABELS[tabId]) {
        APP_TAB_DEFS["app-projects"].label = CONSOLE_TAB_LABELS[tabId];
        APP_TAB_DEFS["app-projects"].hash = tabId;
        const btn = document.getElementById("app-projects");
        if (btn) {
          const span = btn.querySelector("span");
          if (span) span.textContent = CONSOLE_TAB_LABELS[tabId];
        }
      }
    });
  }

  function highlightActiveTab() {
    const loc = window.location.pathname;
    for (const [fragment, tabId] of Object.entries(ACTIVE_MAP)) {
      if (loc.includes(fragment)) {
        document.getElementById(tabId)?.classList.add("active");
        break;
      }
    }
  }

  // ── Drag-to-reorder app tabs (custom mouse-based, threshold to avoid eating clicks) ──
  function setupTabDragReorder() {
    const DRAG_THRESHOLD = 8; // px of movement before drag engages
    let dragState = null; // { tab, startX, startY, active }

    appBar.addEventListener("mousedown", (e) => {
      const tab = e.target.closest(".app-tab-btn");
      if (!tab || e.button !== 0) return;
      dragState = { tab, startX: e.clientX, startY: e.clientY, active: false };
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragState) return;
      if (!dragState.active) {
        const dx = Math.abs(e.clientX - dragState.startX);
        const dy = Math.abs(e.clientY - dragState.startY);
        if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
        // Threshold crossed — engage drag
        dragState.active = true;
        dragState.tab.classList.add("dragging");
      }
      // Find the tab we're hovering over
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".app-tab-btn");
      appBar.querySelectorAll(".app-tab-btn").forEach(t => t.classList.remove("drag-over"));
      if (target && target !== dragState.tab) target.classList.add("drag-over");
    });

    window.addEventListener("mouseup", (e) => {
      if (!dragState) return;
      const { tab, active } = dragState;
      if (active) {
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".app-tab-btn");
        if (target && target !== tab) {
          const tabs = [...appBar.querySelectorAll(".app-tab-btn")];
          const dragIdx = tabs.indexOf(tab);
          const dropIdx = tabs.indexOf(target);
          if (dragIdx < dropIdx) {
            target.insertAdjacentElement("afterend", tab);
          } else {
            target.insertAdjacentElement("beforebegin", tab);
          }
          // Rebuild full order: visible tabs in new order, then hidden tabs
          const visibleOrder = [...appBar.querySelectorAll(".app-tab-btn")].map(t => t.dataset.tabId);
          const hiddenTabs = currentTabOrder.filter(id => !visibleOrder.includes(id));
          const newOrder = [...visibleOrder, ...hiddenTabs];
          currentTabOrder = newOrder;
          browser.storage.local.set({ appTabOrder: newOrder });
        }
        tab.classList.remove("dragging");
        appBar.querySelectorAll(".app-tab-btn").forEach(t => t.classList.remove("drag-over"));
        // Prevent the click from firing after a drag
        tab.addEventListener("click", (ev) => { ev.stopImmediatePropagation(); ev.preventDefault(); }, { once: true, capture: true });
      }
      dragState = null;
    });
  }

  initAppTabs();
  intelStrip.insertAdjacentElement("afterend", appBar);

  // ── Single-tab navigation — all Argus pages share the current tab ──
  function navigateTo(urlPath, hash) {
    const fullUrl = browser.runtime.getURL(urlPath) + (hash ? "#" + hash : "");
    window.location.href = fullUrl;
  }

  function nav(hash) {
    const onConsole = window.location.pathname.endsWith("/options/options.html");
    if (onConsole) {
      // Same page — just switch the hash (triggers hashchange in options.js)
      window.location.hash = hash;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      navigateTo("options/options.html", hash);
    }
  }

  // Brand / logo → console home landing
  document.getElementById("ribbon-console").addEventListener("click", () => nav("home"));

  // Console-tab icon buttons → open console at that tab
  document.getElementById("ribbon-bookmarks").addEventListener("click", () => nav("bookmarks"));
  document.getElementById("ribbon-projects").addEventListener("click", () => nav("projects"));
  document.getElementById("ribbon-monitors").addEventListener("click", () => nav("monitors"));
  document.getElementById("ribbon-feeds").addEventListener("click", () => nav("feeds"));
  document.getElementById("ribbon-osint").addEventListener("click", () => nav("osint"));
  document.getElementById("ribbon-intel").addEventListener("click", () => navigateTo("intel/hub.html"));
  document.getElementById("ribbon-automate").addEventListener("click", () => nav("automation"));
  document.getElementById("ribbon-redirects").addEventListener("click", () => nav("archive"));
  document.getElementById("ribbon-tracker").addEventListener("click", () => nav("tracker"));
  document.getElementById("ribbon-sources").addEventListener("click", () => nav("sources"));
  document.getElementById("ribbon-prompts").addEventListener("click", () => nav("prompts"));
  document.getElementById("ribbon-providers").addEventListener("click", () => nav("providers"));
  document.getElementById("ribbon-resources").addEventListener("click", () => nav("resources"));
  document.getElementById("ribbon-settings").addEventListener("click", () => nav("settings"));
  document.getElementById("ribbon-help").addEventListener("click", () => {
    browser.tabs.create({ url: "https://github.com/n3r4-life/argus360#readme" });
  });

  // Wipe button
  document.getElementById("ribbon-wipe").addEventListener("click", async () => {
    if (!confirm("Wipe ALL Argus data? This permanently deletes all projects, bookmarks, monitors, feeds, history, settings, and API keys. This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? This will erase everything.")) return;
    await browser.runtime.sendMessage({ action: "wipeEverything" });
    alert("All Argus data has been wiped.");
    window.location.reload();
  });

  // ── Entry tab picker (4-square button) ──
  const ENTRY_PICKER_TABS = [
    { id: "bookmarks", label: "Bookmarks", ribbonId: "ribbon-bookmarks" },
    { id: "projects", label: "Projects", ribbonId: "ribbon-projects" },
    { id: "monitors", label: "Monitors", ribbonId: "ribbon-monitors" },
    { id: "feeds", label: "Feeds", ribbonId: "ribbon-feeds" },
    { id: "osint", label: "OSINT", ribbonId: "ribbon-osint" },
    { id: "automation", label: "Automate", ribbonId: "ribbon-automate" },
    { id: "archive", label: "Redirects", ribbonId: "ribbon-redirects" },
    { id: "tracker", label: "Page Tracker", ribbonId: "ribbon-tracker" },
    { id: "sources", label: "Sources", ribbonId: "ribbon-sources" },
    { id: "prompts", label: "Prompts", ribbonId: "ribbon-prompts" },
    { id: "providers", label: "Providers", ribbonId: "ribbon-providers" },
    { id: "resources", label: "Resources", ribbonId: "ribbon-resources" },
    { id: "settings", label: "Settings", ribbonId: "ribbon-settings" }
  ];

  async function renderEntryPicker() {
    const { consoleEntryTab } = await browser.storage.local.get({ consoleEntryTab: "projects" });
    let html = '<div class="ribbon-entry-picker-title">Swappable tab</div>';
    for (const opt of ENTRY_PICKER_TABS) {
      const ribbonBtn = document.getElementById(opt.ribbonId);
      const svg = ribbonBtn?.querySelector("svg")?.outerHTML || "";
      const active = opt.id === consoleEntryTab ? " ribbon-entry-active" : "";
      html += `<button class="ribbon-entry-item${active}" data-entry-id="${opt.id}">${svg} ${opt.label}</button>`;
    }
    entryPickerOverlay.innerHTML = html;

    entryPickerOverlay.querySelectorAll(".ribbon-entry-item").forEach(item => {
      item.addEventListener("click", async () => {
        const id = item.dataset.entryId;
        await browser.storage.local.set({ consoleEntryTab: id });
        entryPickerOverlay.classList.add("hidden");
        // Update the ribbon tab label + hash live
        if (CONSOLE_TAB_LABELS[id]) {
          APP_TAB_DEFS["app-projects"].label = CONSOLE_TAB_LABELS[id];
          APP_TAB_DEFS["app-projects"].hash = id;
          const btn = document.getElementById("app-projects");
          if (btn) {
            const span = btn.querySelector("span");
            if (span) span.textContent = CONSOLE_TAB_LABELS[id];
          }
        }
        // Also fire event for console page if we're on it
        window.dispatchEvent(new CustomEvent("consoleEntryChanged", { detail: { tabId: id } }));
      });
    });
  }

  entryPickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = entryPickerOverlay.classList.contains("hidden");
    entryPickerOverlay.classList.toggle("hidden");
    if (isHidden) renderEntryPicker();
  });

  document.addEventListener("click", (e) => {
    if (!entryPickerOverlay.contains(e.target) && e.target !== entryPickerBtn && !entryPickerBtn.contains(e.target)) {
      entryPickerOverlay.classList.add("hidden");
    }
  });

  // App tab navigation — event delegation (tabs are rendered async)
  appBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".app-tab-btn");
    if (!btn) return;
    const def = APP_TAB_DEFS[btn.dataset.tabId];
    if (!def) return;
    if (def.hash) nav(def.hash);
    else navigateTo(def.path);
  });

  // ── Ribbon badge counts ──
  // Maps ribbon icon IDs → the same data sources as console tab badges
  const badgeMap = {
    "ribbon-bookmarks": () => browser.runtime.sendMessage({ action: "getBookmarks" }).then(r => r?.total || 0),
    "ribbon-projects":  () => browser.runtime.sendMessage({ action: "getProjects" }).then(r => Array.isArray(r?.projects) ? r.projects.length : 0),
    "ribbon-monitors":  () => browser.runtime.sendMessage({ action: "getMonitors" }).then(r => Array.isArray(r?.monitors) ? r.monitors.length : 0),
    "ribbon-feeds":     () => browser.runtime.sendMessage({ action: "getFeeds" }).then(r => Array.isArray(r?.feeds) ? r.feeds.length : 0),
    "ribbon-osint":     () => browser.runtime.sendMessage({ action: "getKGStats" }).then(r => typeof r?.nodeCount === "number" ? r.nodeCount : 0).catch(() => 0),
    "ribbon-automate":  () => browser.runtime.sendMessage({ action: "getAutomations" }).then(r => Array.isArray(r?.automations) ? r.automations.length : 0).catch(() => 0),
    "ribbon-sources":   () => browser.runtime.sendMessage({ action: "getSources" }).then(r => Array.isArray(r?.sources) ? r.sources.length : 0).catch(() => 0)
  };

  const CLOUD_PILL_LABELS = { google: "GDrive", dropbox: "Dropbox", webdav: "WebDAV", s3: "S3", github: "GitHub", gist: "Gist", pastebin: "Pastebin", privatebin: "PrivateBin" };
  const AI_PILL_LABELS = { xai: "xAI", openai: "GPT", anthropic: "Claude", gemini: "Gemini", custom: "Custom" };

  let _ribbonStatusTimer = null;
  function updateRibbonStatus() {
    clearTimeout(_ribbonStatusTimer);
    _ribbonStatusTimer = setTimeout(() => { _doUpdateRibbonStatus(); _doUpdateAiStrip(); _doUpdateIntelStrip(); }, 80);
  }

  async function _doUpdateRibbonStatus() {
    const strip = document.getElementById("ribbon-status");
    if (!strip) return;

    const pills = [];

    try {
      const resp = await browser.runtime.sendMessage({ action: "cloudGetStatus" });
      for (const [key, connected] of Object.entries(resp?.providers || {})) {
        if (!connected) continue;
        const label = CLOUD_PILL_LABELS[key] || key;
        pills.push(`<button class="ribbon-status-pill" data-nav="settings" title="${label} connected — click to manage"><span class="ribbon-status-dot"></span>${label}</button>`);
      }
    } catch { /* background not ready */ }

    try {
      const xmpp = await browser.runtime.sendMessage({ action: "xmppGetStatus" });
      if (xmpp?.configured) {
        const label = xmpp.jid ? xmpp.jid.split("@")[0] : "XMPP";
        const dot = xmpp.connected ? "ribbon-status-dot" : "ribbon-status-dot amber";
        const tip = `XMPP ${xmpp.connected ? "live" : "idle"}${xmpp.jid ? " · " + xmpp.jid : ""} — click to manage`;
        pills.push(`<button class="ribbon-status-pill" data-nav="settings" title="${tip}"><span class="${dot}"></span>${label}</button>`);
      }
    } catch { /* background not ready */ }

    try {
      const pr = await browser.runtime.sendMessage({ action: "profileGetState" });
      if (pr?.profile?.username) {
        const u = pr.profile.username;
        const syncTip = pr.profile.lastSync ? `Last sync ${pr.profile.lastSync.slice(0,10)}` : "Never synced";
        pills.push(`<button class="ribbon-status-pill ribbon-user-pill" data-nav="settings" title="${u} · ${syncTip} — click to manage"><span class="ribbon-status-dot"></span>${u}</button>`);
      }
    } catch { /* background not ready */ }

    strip.innerHTML = pills.join("");
    strip.querySelectorAll("[data-nav]").forEach(btn => {
      btn.addEventListener("click", () => nav(btn.dataset.nav));
    });
  }

  const AI_STATUS_TIPS = {
    live:  "last call succeeded",
    error: "last call failed",
    idle:  "configured, not yet used"
  };

  async function _doUpdateAiStrip() {
    const strip = document.getElementById("ribbon-ai-strip");
    if (!strip) return;
    try {
      const resp = await browser.runtime.sendMessage({ action: "aiGetStatus" });
      const pills = [];
      for (const [key, info] of Object.entries(resp?.providers || {})) {
        const label = AI_PILL_LABELS[key] || key;
        const isDefault = key === resp.defaultProvider;
        const cls = isDefault ? "ribbon-ai-pill default" : "ribbon-ai-pill";
        const tip = `${label}${isDefault ? " (default)" : ""} · ${AI_STATUS_TIPS[info.status] || ""} — click to manage`;
        pills.push(`<button class="${cls}" data-nav="settings" title="${tip}"><span class="ribbon-ai-dot ${info.status}"></span>${label}</button>`);
      }
      const modelTag = resp.defaultModel
        ? `<span class="ribbon-ai-model">${resp.defaultModel}</span>`
        : "";
      strip.innerHTML = pills.length
        ? `<span class="ribbon-ai-strip-label">AI</span>` + pills.join("") + modelTag
        : "";
      strip.querySelectorAll("[data-nav]").forEach(btn => {
        btn.addEventListener("click", () => nav(btn.dataset.nav));
      });
    } catch { /* background not ready */ }
  }

  const INTEL_PILL_LABELS = {
    opensanctions: "Sanctions", secedgar: "SEC", courtlistener: "Courts",
    opensky: "OpenSky", adsbexchange: "ADS-B", marinetraffic: "Marine",
    flightaware: "FlightAware", vesselfinder: "VesselFinder",
    gdelt: "GDELT", sentinelhub: "Sentinel", opencorporates: "Corps",
    gleif: "GLEIF", blockstream: "BTC", broadcastify: "Radio",
  };

  // Group providers by domain for strip display
  const INTEL_STRIP_GROUPS = [
    { label: "Regulatory", keys: ["opensanctions", "secedgar", "courtlistener", "opencorporates", "gleif"] },
    { label: "Movement",   keys: ["opensky", "flightaware", "adsbexchange", "marinetraffic", "vesselfinder", "broadcastify"] },
    { label: "Events",     keys: ["gdelt"] },
    { label: "Satellite",  keys: ["sentinelhub"] },
    { label: "Blockchain",  keys: ["blockstream"] },
  ];

  async function _doUpdateIntelStrip() {
    const strip = document.getElementById("ribbon-intel-strip");
    if (!strip) return;
    try {
      const resp = await browser.runtime.sendMessage({ action: "intelGetStatus" });
      const allProviders = resp?.providers || {};
      const sections = [];

      for (const group of INTEL_STRIP_GROUPS) {
        const pills = [];
        for (const key of group.keys) {
          const info = allProviders[key];
          if (!info || (!info.configured && info.status !== "connected")) continue;
          const label = INTEL_PILL_LABELS[key] || key;
          const statusClass = info.status === "connected" ? "live" : info.status === "error" ? "error" : "idle";
          const tip = `${info.label || label} · ${info.status} — click to manage`;
          pills.push(`<button class="ribbon-intel-pill" data-nav="settings" title="${tip}"><span class="ribbon-intel-dot ${statusClass}"></span>${label}</button>`);
        }
        if (pills.length) {
          sections.push(pills.join(""));
        }
      }

      strip.innerHTML = sections.length
        ? `<span class="ribbon-intel-strip-label">INTEL</span>` + sections.join('<span class="ribbon-intel-sep">|</span>')
        : "";
      strip.querySelectorAll("[data-nav]").forEach(btn => {
        btn.addEventListener("click", () => nav(btn.dataset.nav));
      });
    } catch { /* background not ready */ }
  }

  async function updateRibbonBadges() {
    for (const [iconId, fetchCount] of Object.entries(badgeMap)) {
      try {
        const count = await fetchCount();
        const btn = document.getElementById(iconId);
        if (!btn) continue;
        let badge = btn.querySelector(".ribbon-badge");
        if (count > 0) {
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "ribbon-badge";
            btn.appendChild(badge);
          }
          badge.textContent = count > 999 ? "999+" : count;
        } else if (badge) {
          badge.remove();
        }
      } catch (e) { /* skip */ }
    }
  }

  updateRibbonBadges();
  updateRibbonStatus();

  // Refresh on data changes
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === "argusDataChanged") updateRibbonBadges();
    if (msg.type === "argusDataChanged" || msg.type === "argusConnectionChanged") updateRibbonStatus();
  });

  // Sync tab state when storage changes (e.g. from another page/tab)
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.consoleEntryTab) {
      const tabId = changes.consoleEntryTab.newValue || "projects";
      if (CONSOLE_TAB_LABELS[tabId]) {
        APP_TAB_DEFS["app-projects"].label = CONSOLE_TAB_LABELS[tabId];
        APP_TAB_DEFS["app-projects"].hash = tabId;
        const btn = document.getElementById("app-projects");
        if (btn) {
          const span = btn.querySelector("span");
          if (span) span.textContent = CONSOLE_TAB_LABELS[tabId];
        }
      }
    }
    if (changes.appVisibleTabs) {
      const vis = changes.appVisibleTabs.newValue;
      if (Array.isArray(vis)) {
        currentVisibleTabs = vis;
        sessionVisibleTabs = null; // reset session swaps
        renderAppTabs(currentTabOrder, getEffectiveVisible());
        highlightActiveTab();
      }
    }
    if (changes.appTabOrder) {
      const ord = changes.appTabOrder.newValue;
      if (Array.isArray(ord)) {
        currentTabOrder = ord;
        renderAppTabs(currentTabOrder, getEffectiveVisible());
        highlightActiveTab();
      }
    }
  });

  // ── Vault Lock Screen ──
  (async function checkVaultLock() {
    try {
      const status = await browser.runtime.sendMessage({ action: "vaultGetStatus" });
      if (!status || !status.enabled || status.unlocked) return;

      // Inject lock screen CSS
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = browser.runtime.getURL("shared/lock-screen.css");
      document.head.appendChild(css);

      // Build lock overlay
      const overlay = document.createElement("div");
      overlay.className = "argus-lock-overlay";
      overlay.id = "argus-lock-overlay";

      const box = document.createElement("div");
      box.className = "argus-lock-box";

      const logo = document.createElement("img");
      logo.className = "argus-lock-logo";
      logo.src = browser.runtime.getURL("icons/icon-128.png");
      logo.alt = "Argus";
      box.appendChild(logo);

      const title = document.createElement("h1");
      title.className = "argus-lock-title";
      title.textContent = "Argus is locked";
      box.appendChild(title);

      const subtitle = document.createElement("p");
      subtitle.className = "argus-lock-subtitle";
      subtitle.textContent = status.type === "password" ? "Enter your password to unlock" : "Enter your PIN to unlock";
      box.appendChild(subtitle);

      const errorEl = document.createElement("div");
      errorEl.className = "argus-lock-error";

      let getValue, focusFirst;

      if (status.type === "password") {
        // Password input
        const pw = document.createElement("input");
        pw.type = "password";
        pw.className = "argus-lock-password";
        pw.placeholder = "Password";
        pw.autocomplete = "off";
        box.appendChild(pw);

        getValue = () => pw.value;
        focusFirst = () => pw.focus();

        pw.addEventListener("keydown", (e) => {
          if (e.key === "Enter") doUnlock();
        });
      } else {
        // PIN digits
        const digits = status.type === "pin6" ? 6 : 4;
        const row = document.createElement("div");
        row.className = "argus-lock-pin-row";
        const inputs = [];
        for (let i = 0; i < digits; i++) {
          const inp = document.createElement("input");
          inp.type = "password";
          inp.inputMode = "numeric";
          inp.maxLength = 1;
          inp.className = "argus-lock-pin-digit";
          inp.autocomplete = "off";
          inp.addEventListener("input", () => {
            if (inp.value.length === 1) {
              inp.classList.add("filled");
              if (i < digits - 1) inputs[i + 1].focus();
              else doUnlock(); // Auto-submit on last digit
            }
          });
          inp.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !inp.value && i > 0) {
              inputs[i - 1].focus();
              inputs[i - 1].value = "";
              inputs[i - 1].classList.remove("filled");
            }
          });
          // Allow paste of full PIN
          inp.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, digits);
            for (let j = 0; j < pasted.length && j < digits; j++) {
              inputs[j].value = pasted[j];
              inputs[j].classList.add("filled");
            }
            if (pasted.length === digits) doUnlock();
            else if (pasted.length > 0) inputs[Math.min(pasted.length, digits - 1)].focus();
          });
          inputs.push(inp);
          row.appendChild(inp);
        }
        box.appendChild(row);

        getValue = () => inputs.map(i => i.value).join("");
        focusFirst = () => inputs[0].focus();
      }

      const btn = document.createElement("button");
      btn.className = "argus-lock-btn";
      btn.textContent = "Unlock";
      btn.addEventListener("click", doUnlock);
      box.appendChild(btn);

      box.appendChild(errorEl);

      const hint = document.createElement("p");
      hint.className = "argus-lock-hint";
      hint.textContent = "Encryption protects your API keys, credentials, and session data.";
      box.appendChild(hint);

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Focus first input
      setTimeout(focusFirst, 100);

      async function doUnlock() {
        const passcode = getValue();
        if (!passcode) return;

        btn.disabled = true;
        errorEl.textContent = "";

        try {
          const result = await browser.runtime.sendMessage({ action: "vaultUnlock", passcode });
          if (result.success) {
            overlay.classList.add("hidden");
            setTimeout(() => overlay.remove(), 300);
          } else {
            errorEl.textContent = result.error || "Incorrect passcode";
            // Shake animation
            const inputs = overlay.querySelectorAll(".argus-lock-pin-digit, .argus-lock-password");
            inputs.forEach(i => { i.classList.add("error"); setTimeout(() => i.classList.remove("error"), 500); });
            // Clear PIN inputs
            if (status.type !== "password") {
              inputs.forEach(i => { i.value = ""; i.classList.remove("filled"); });
              focusFirst();
            }
          }
        } catch (e) {
          errorEl.textContent = "Unlock failed: " + e.message;
        }
        btn.disabled = false;
      }
    } catch (_) {
      // Vault not available — proceed normally
    }
  })();
})();
