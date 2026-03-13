// ── Argus Workbench ──
// Project-aware conversational workspace with floating panels.
// Center: chat interface. Left panel: project tree. Right panel: selected items.

(async () => {
  "use strict";

  // ── Elements ──
  const projectSelect = document.getElementById("wb-project");
  const providerSelect = document.getElementById("wb-provider");
  const messagesEl = document.getElementById("wb-messages");
  const chatEmpty = document.getElementById("wb-chat-empty");
  const inputEl = document.getElementById("wb-input");
  const sendBtn = document.getElementById("wb-send");
  const statusEl = document.getElementById("wb-status");
  const saveResultBtn = document.getElementById("wb-save-result");
  const copyResultBtn = document.getElementById("wb-copy-result");
  const exportResultBtn = document.getElementById("wb-export-result");
  const emailResultBtn = document.getElementById("wb-email-result");

  // Panels
  const panelLeft = document.getElementById("wb-panel-left");
  const panelRight = document.getElementById("wb-panel-right");
  const tabLeft = document.getElementById("wb-tab-left");
  const tabRight = document.getElementById("wb-tab-right");
  const treeBody = document.getElementById("wb-tree-body");
  const surfaceBody = document.getElementById("wb-surface-body");
  const surfaceStats = document.getElementById("wb-surface-stats");
  const selectAllBtn = document.getElementById("wb-select-all");
  const clearItemsBtn = document.getElementById("wb-clear-items");

  // Tree toolbar
  const treeSearch = document.getElementById("wb-tree-search");
  const treeSort = document.getElementById("wb-tree-sort");

  // ── State ──
  let currentProjectId = null;
  let projectData = null;
  let surfaceItems = new Map();
  let allTreeItems = [];
  let lastResultContent = "";
  let isStreaming = false;
  let currentSort = "type";

  // ── Init: Load projects ──
  const projResp = await browser.runtime.sendMessage({ action: "getProjects" });
  const projects = projResp?.projects || [];
  for (const p of projects) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    projectSelect.appendChild(opt);
  }

  // Check URL for pre-selected project
  const params = new URLSearchParams(location.search);
  const urlProject = params.get("project");
  if (urlProject && projectSelect.querySelector(`option[value="${urlProject}"]`)) {
    projectSelect.value = urlProject;
    await loadProject(urlProject);
  }

  projectSelect.addEventListener("change", () => {
    if (projectSelect.value) loadProject(projectSelect.value);
  });

  // ── Floating panels: truly draggable by header ──
  setupFloatingPanel(panelLeft);
  setupFloatingPanel(panelRight);

  // Edge tabs just toggle visibility
  tabLeft.addEventListener("click", () => panelLeft.classList.toggle("hidden"));
  tabRight.addEventListener("click", () => panelRight.classList.toggle("hidden"));

  document.getElementById("wb-panel-left-close").addEventListener("click", () => {
    panelLeft.classList.add("hidden");
  });
  document.getElementById("wb-panel-right-close").addEventListener("click", () => {
    panelRight.classList.add("hidden");
  });

  function setupFloatingPanel(panel) {
    const header = panel.querySelector(".wb-panel-header");
    let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

    header.addEventListener("mousedown", (e) => {
      // Don't drag if clicking the close button
      if (e.target.closest(".wb-panel-close")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
      panel.classList.add("dragging");
      // Bring to front
      panel.style.zIndex = 25;
      // Clear right positioning so left works freely
      panel.style.right = "auto";
      panel.style.left = origLeft + "px";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - 60, origLeft + dx));
      const newTop = Math.max(46, Math.min(window.innerHeight - 60, origTop + dy));
      panel.style.left = newLeft + "px";
      panel.style.top = newTop + "px";
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("dragging");
      panel.style.zIndex = "";
    });
  }

  // ── Load project data ──
  async function loadProject(projectId) {
    currentProjectId = projectId;
    surfaceItems.clear();
    allTreeItems = [];

    treeBody.innerHTML = '<div class="wb-tree-empty">Loading...</div>';

    const resp = await browser.runtime.sendMessage({ action: "workbenchGetData", projectId });
    if (!resp?.success) {
      treeBody.innerHTML = `<div class="wb-tree-empty">${resp?.error || "Failed to load."}</div>`;
      return;
    }

    projectData = resp;
    buildUnifiedItems();
    renderTree();
    renderSurface();

    // Auto-open tree panel when project loads
    panelLeft.classList.remove("hidden");
  }

  // ── Build unified items list from project data ──
  function buildUnifiedItems() {
    allTreeItems = [];

    // Analyses — sub-grouped by tags
    for (const item of (projectData.items || []).filter(i => i.type === "analysis")) {
      const treeId = item.id || `analysis-${Math.random().toString(36).slice(2, 6)}`;
      const subType = (item.tags || [])[0] || "general";
      allTreeItems.push({
        treeId, type: "analysis", subType,
        title: item.title || "Untitled Analysis",
        summary: item.summary || "",
        content: item.content || item.analysisContent || "",
        url: item.url || "",
        charCount: (item.content || item.analysisContent || item.summary || "").length,
        date: item.addedAt || item.createdAt || "",
        raw: item
      });
    }

    // Links
    for (const item of (projectData.items || []).filter(i => i.type === "url" || i.type === "link")) {
      const treeId = item.id || `url-${Math.random().toString(36).slice(2, 6)}`;
      allTreeItems.push({
        treeId, type: "url", subType: "link",
        title: item.title || item.url || "Untitled",
        summary: item.summary || "",
        content: item.content || item.analysisContent || "",
        url: item.url || "",
        charCount: (item.content || item.analysisContent || item.summary || "").length,
        date: item.addedAt || item.createdAt || "",
        raw: item
      });
    }

    // Entities — sub-grouped by entity type (person, org, location, etc.)
    for (const e of (projectData.entities || [])) {
      const entityType = (e.type || "unknown").toLowerCase();
      allTreeItems.push({
        treeId: `entity-${e.id}`, type: "entity", subType: entityType,
        title: e.displayName || "Unknown",
        summary: `[${e.type}] ${e.mentionCount || 1} mentions`,
        content: `Entity: ${e.displayName}\nType: ${e.type}\nAliases: ${(e.aliases || []).join(", ")}\nMentions: ${e.mentionCount || 1}`,
        url: "",
        charCount: (e.mentionCount || 1),
        date: e.firstSeen || e.createdAt || "",
        raw: e
      });
    }

    // Feeds
    for (const f of (projectData.feeds || [])) {
      for (const entry of (f.entries || [])) {
        allTreeItems.push({
          treeId: `feed-${entry.id}`, type: "feed", subType: f.title || "feed",
          title: entry.title || f.title,
          summary: entry.summary || "",
          content: entry.summary || entry.content || "",
          url: entry.link || entry.url || "",
          charCount: (entry.summary || entry.content || "").length,
          date: entry.pubDate || entry.addedAt || "",
          raw: entry
        });
      }
    }

    // Monitors
    for (const m of (projectData.monitors || [])) {
      allTreeItems.push({
        treeId: `monitor-${m.id}`, type: "monitor", subType: "monitor",
        title: m.name || m.url,
        summary: `${m.changeCount || 0} changes`,
        content: `Monitor: ${m.url}\nChanges: ${m.changeCount || 0}\nInterval: ${m.intervalMinutes || "?"}min`,
        url: m.url || "",
        charCount: (m.changeCount || 0),
        date: m.lastChecked || m.createdAt || "",
        raw: m
      });
    }

    // Bookmarks
    for (const b of (projectData.bookmarks || [])) {
      allTreeItems.push({
        treeId: `bm-${b.id}`, type: "bookmark", subType: "bookmark",
        title: b.title || b.url,
        summary: b.summary || (b.tags || []).join(", ") || "",
        content: `Bookmark: ${b.title}\nURL: ${b.url}\nTags: ${(b.tags || []).join(", ")}\nSummary: ${b.summary || ""}`,
        url: b.url || "",
        charCount: (b.summary || "").length,
        date: b.addedAt || b.createdAt || "",
        raw: b
      });
    }
  }

  // ── Sort items ──
  function sortItems(items, sortKey) {
    const sorted = [...items];
    switch (sortKey) {
      case "alpha":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "alpha-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "size":
        sorted.sort((a, b) => b.charCount - a.charCount);
        break;
      case "date":
        sorted.sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        });
        break;
      default: // "type" — natural order
        break;
    }
    return sorted;
  }

  // ── Filter + render tree ──
  function renderTree() {
    treeBody.replaceChildren();
    const filter = (treeSearch.value || "").trim().toLowerCase();
    const sortKey = treeSort.value || "type";

    // Filter items
    let items = allTreeItems;
    if (filter) {
      items = items.filter(i =>
        i.title.toLowerCase().includes(filter) ||
        i.summary.toLowerCase().includes(filter) ||
        i.subType.toLowerCase().includes(filter) ||
        i.type.toLowerCase().includes(filter)
      );
    }

    if (!items.length) {
      treeBody.innerHTML = `<div class="wb-tree-empty">${filter ? "No matching items." : "No data in this project yet."}</div>`;
      return;
    }

    // Sort
    items = sortItems(items, sortKey);

    // Group config — which types get sub-groups
    const groupDefs = [
      { type: "analysis", label: "Analyses", icon: "\uD83D\uDCCA", useSubGroups: true, subLabel: t => t },
      { type: "url", label: "Links", icon: "\uD83D\uDD17", useSubGroups: false },
      { type: "entity", label: "Entities", icon: "\uD83E\uDDE0", useSubGroups: true, subLabel: t => entityTypeLabel(t) },
      { type: "feed", label: "Feeds", icon: "\uD83D\uDCE1", useSubGroups: true, subLabel: t => t },
      { type: "monitor", label: "Monitors", icon: "\uD83D\uDC41\uFE0F", useSubGroups: false },
      { type: "bookmark", label: "Bookmarks", icon: "\uD83D\uDD16", useSubGroups: false },
    ];

    for (const gdef of groupDefs) {
      const groupItems = items.filter(i => i.type === gdef.type);
      if (!groupItems.length) continue;

      const grp = document.createElement("div");
      grp.className = "wb-group";

      const header = createGroupHeader(gdef.icon, gdef.label, groupItems.length);
      grp.appendChild(header.el);

      const container = document.createElement("div");

      if (gdef.useSubGroups && sortKey === "type") {
        // Build sub-groups by subType
        const subMap = new Map();
        for (const item of groupItems) {
          const key = item.subType || "other";
          if (!subMap.has(key)) subMap.set(key, []);
          subMap.get(key).push(item);
        }

        // Sort sub-group keys
        const subKeys = [...subMap.keys()].sort();
        for (const subKey of subKeys) {
          const subItems = subMap.get(subKey);
          const subGrp = document.createElement("div");
          subGrp.className = "wb-subgroup";

          const subHeader = document.createElement("div");
          subHeader.className = "wb-subgroup-header";

          const subArrow = document.createElement("span");
          subArrow.className = "wb-group-arrow";
          subArrow.textContent = "\u25BC";
          subHeader.appendChild(subArrow);

          const subIcon = document.createElement("span");
          subIcon.textContent = entityTypeIcon(gdef.type, subKey);
          subHeader.appendChild(subIcon);

          const subLabel = document.createElement("span");
          subLabel.textContent = " " + (gdef.subLabel ? gdef.subLabel(subKey) : subKey);
          subHeader.appendChild(subLabel);

          const subCount = document.createElement("span");
          subCount.className = "wb-subgroup-count";
          subCount.textContent = subItems.length;
          subHeader.appendChild(subCount);

          subGrp.appendChild(subHeader);

          const subContainer = document.createElement("div");
          for (const item of subItems) {
            subContainer.appendChild(createTreeRow(item, gdef.icon));
          }
          subGrp.appendChild(subContainer);

          subHeader.addEventListener("click", () => {
            const collapsed = subContainer.style.display === "none";
            subContainer.style.display = collapsed ? "" : "none";
            subArrow.classList.toggle("collapsed", !collapsed);
          });

          container.appendChild(subGrp);
        }
      } else {
        // Flat list
        for (const item of groupItems) {
          container.appendChild(createTreeRow(item, gdef.icon));
        }
      }

      grp.appendChild(container);

      header.el.addEventListener("click", () => {
        const collapsed = container.style.display === "none";
        container.style.display = collapsed ? "" : "none";
        header.arrow.classList.toggle("collapsed", !collapsed);
      });

      treeBody.appendChild(grp);
    }

    updateTreeHighlights();
  }

  function createGroupHeader(icon, label, count) {
    const header = document.createElement("div");
    header.className = "wb-group-header";

    const arrow = document.createElement("span");
    arrow.className = "wb-group-arrow";
    arrow.textContent = "\u25BC";

    const labelNode = document.createTextNode(` ${icon} ${label} `);
    const countSpan = document.createElement("span");
    countSpan.className = "wb-group-count";
    countSpan.textContent = count;

    header.appendChild(arrow);
    header.appendChild(labelNode);
    header.appendChild(countSpan);

    return { el: header, arrow };
  }

  function createTreeRow(item, groupIcon) {
    const row = document.createElement("div");
    row.className = "wb-tree-item";
    row.dataset.treeId = item.treeId;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "wb-tree-item-check";
    check.checked = surfaceItems.has(item.treeId);

    const icon = document.createElement("span");
    icon.className = "wb-tree-item-icon";
    icon.textContent = groupIcon;

    const nameSpan = document.createElement("span");
    nameSpan.className = "wb-tree-item-label";
    nameSpan.textContent = item.title;
    nameSpan.title = item.title;

    const typeBadge = document.createElement("span");
    typeBadge.className = "wb-tree-item-type";
    typeBadge.textContent = item.subType !== item.type ? item.subType : item.type;

    row.appendChild(check);
    row.appendChild(icon);
    row.appendChild(nameSpan);
    row.appendChild(typeBadge);

    row.addEventListener("click", (e) => {
      if (e.target === check) return;
      check.checked = !check.checked;
      toggleSurfaceItem(item.treeId, item, check.checked);
    });
    check.addEventListener("change", () => {
      toggleSurfaceItem(item.treeId, item, check.checked);
    });

    return row;
  }

  // ── Entity type helpers ──
  const ENTITY_TYPE_MAP = {
    person: { icon: "\uD83D\uDC64", label: "People" },
    organization: { icon: "\uD83C\uDFE2", label: "Organizations" },
    org: { icon: "\uD83C\uDFE2", label: "Organizations" },
    location: { icon: "\uD83D\uDCCD", label: "Locations" },
    place: { icon: "\uD83D\uDCCD", label: "Locations" },
    event: { icon: "\uD83D\uDCC5", label: "Events" },
    date: { icon: "\uD83D\uDCC5", label: "Dates" },
    money: { icon: "\uD83D\uDCB0", label: "Financial" },
    financial: { icon: "\uD83D\uDCB0", label: "Financial" },
    technology: { icon: "\uD83D\uDCBB", label: "Technology" },
    product: { icon: "\uD83D\uDCE6", label: "Products" },
    weapon: { icon: "\u2694\uFE0F", label: "Weapons" },
    vehicle: { icon: "\uD83D\uDE97", label: "Vehicles" },
    document: { icon: "\uD83D\uDCC4", label: "Documents" },
    email: { icon: "\uD83D\uDCE7", label: "Emails" },
    phone: { icon: "\uD83D\uDCDE", label: "Phone Numbers" },
    url: { icon: "\uD83D\uDD17", label: "URLs" },
    ip: { icon: "\uD83C\uDF10", label: "IP Addresses" },
    hash: { icon: "#\uFE0F\u20E3", label: "Hashes" },
    credential: { icon: "\uD83D\uDD11", label: "Credentials" },
  };

  function entityTypeLabel(type) {
    return ENTITY_TYPE_MAP[type]?.label || type.charAt(0).toUpperCase() + type.slice(1);
  }

  function entityTypeIcon(groupType, subType) {
    if (groupType === "entity") return ENTITY_TYPE_MAP[subType]?.icon || "\uD83E\uDDE0";
    if (groupType === "analysis") return "\uD83D\uDCCA";
    return "";
  }

  // ── Tree search & sort event handlers ──
  let searchTimeout;
  treeSearch.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderTree, 150);
  });

  treeSort.addEventListener("change", () => {
    currentSort = treeSort.value;
    renderTree();
  });

  // ── Surface management ──
  function toggleSurfaceItem(treeId, item, add) {
    if (add) {
      surfaceItems.set(treeId, item);
    } else {
      surfaceItems.delete(treeId);
    }
    renderSurface();
    updateTreeHighlights();
    // Auto-show right panel when items are added
    if (surfaceItems.size && panelRight.classList.contains("hidden")) {
      panelRight.classList.remove("hidden");
    }
  }

  function renderSurface() {
    surfaceBody.replaceChildren();

    if (!surfaceItems.size) {
      const empty = document.createElement("div");
      empty.className = "wb-surface-empty";
      empty.textContent = "No items selected.";
      surfaceBody.appendChild(empty);
      surfaceStats.textContent = "";
      showResultButtons(false);
      return;
    }

    let totalChars = 0;
    for (const [treeId, item] of surfaceItems) {
      const card = document.createElement("div");
      card.className = "wb-card";
      card.dataset.treeId = treeId;

      const header = document.createElement("div");
      header.className = "wb-card-header";

      const iconSpan = document.createElement("span");
      iconSpan.className = "wb-card-icon";
      const icons = { analysis: "\uD83D\uDCCA", entity: "\uD83E\uDDE0", feed: "\uD83D\uDCE1", monitor: "\uD83D\uDC41\uFE0F", bookmark: "\uD83D\uDD16", url: "\uD83D\uDD17", link: "\uD83D\uDD17" };
      iconSpan.textContent = icons[item.type] || "\uD83D\uDCC4";

      const titleSpan = document.createElement("span");
      titleSpan.className = "wb-card-title";
      titleSpan.textContent = item.title;
      titleSpan.title = item.title;

      const removeBtn = document.createElement("button");
      removeBtn.className = "wb-card-remove";
      removeBtn.textContent = "\u00D7";
      removeBtn.addEventListener("click", () => {
        surfaceItems.delete(treeId);
        renderSurface();
        updateTreeHighlights();
        const treeCheck = treeBody.querySelector(`.wb-tree-item[data-tree-id="${treeId}"] .wb-tree-item-check`);
        if (treeCheck) treeCheck.checked = false;
      });

      header.appendChild(iconSpan);
      header.appendChild(titleSpan);
      header.appendChild(removeBtn);

      const typeBadge = document.createElement("span");
      typeBadge.className = `wb-card-type ${item.type}`;
      typeBadge.textContent = item.type;

      const summary = document.createElement("div");
      summary.className = "wb-card-summary";
      summary.textContent = (item.summary || item.content || "").substring(0, 120).replace(/[#*_`]/g, "");

      const charCount = (item.content || item.summary || "").length;
      totalChars += charCount;

      const meta = document.createElement("div");
      meta.className = "wb-card-meta";
      meta.textContent = `${charCount.toLocaleString()} chars`;

      card.appendChild(header);
      card.appendChild(typeBadge);
      card.appendChild(summary);
      card.appendChild(meta);
      surfaceBody.appendChild(card);
    }

    surfaceStats.textContent = `${surfaceItems.size} · ~${(totalChars / 1000).toFixed(1)}k`;
  }

  function updateTreeHighlights() {
    treeBody.querySelectorAll(".wb-tree-item").forEach(row => {
      const id = row.dataset.treeId;
      row.classList.toggle("on-surface", surfaceItems.has(id));
    });
  }

  // ── Select All / Clear ──
  selectAllBtn.addEventListener("click", () => {
    for (const item of allTreeItems) {
      surfaceItems.set(item.treeId, item);
    }
    treeBody.querySelectorAll(".wb-tree-item-check").forEach(c => c.checked = true);
    renderSurface();
    updateTreeHighlights();
  });

  clearItemsBtn.addEventListener("click", () => {
    surfaceItems.clear();
    treeBody.querySelectorAll(".wb-tree-item-check").forEach(c => c.checked = false);
    renderSurface();
    updateTreeHighlights();
  });

  // ── Chat: message rendering ──
  function appendMessage(role, content, meta) {
    // Remove empty state
    const empty = messagesEl.querySelector(".wb-chat-empty");
    if (empty) empty.remove();

    const div = document.createElement("div");
    div.className = `wb-msg ${role}`;

    const header = document.createElement("div");
    header.className = "wb-msg-header";

    const roleSpan = document.createElement("span");
    roleSpan.className = "wb-msg-role";
    roleSpan.textContent = role === "user" ? "You" : "AI";
    header.appendChild(roleSpan);

    const timeSpan = document.createElement("span");
    timeSpan.className = "wb-msg-time";
    const d = new Date();
    timeSpan.textContent = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    header.appendChild(timeSpan);

    if (meta) {
      const metaSpan = document.createElement("span");
      metaSpan.className = "wb-msg-context";
      metaSpan.textContent = meta;
      header.appendChild(metaSpan);
    }

    const body = document.createElement("div");
    body.className = "wb-msg-body";

    if (role === "assistant" && typeof marked !== "undefined" && content) {
      body.innerHTML = DOMPurify.sanitize(marked.parse(content));
    } else {
      body.textContent = content || "";
    }

    div.appendChild(header);
    div.appendChild(body);
    messagesEl.appendChild(div);
    return div;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Chat: send message ──
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isStreaming || !surfaceItems.size) {
      if (!surfaceItems.size && text) {
        statusEl.textContent = "Select items from the project tree first.";
        setTimeout(() => { statusEl.textContent = ""; }, 3000);
      }
      return;
    }

    isStreaming = true;
    sendBtn.disabled = true;
    inputEl.value = "";
    autoResize();

    // Show user message
    const itemCount = surfaceItems.size;
    appendMessage("user", text, `${itemCount} items selected`);
    scrollToBottom();

    // Create streaming assistant bubble
    const assistantDiv = appendMessage("assistant", "", null);
    assistantDiv.classList.add("streaming");
    const assistantBody = assistantDiv.querySelector(".wb-msg-body");
    scrollToBottom();

    statusEl.textContent = "Thinking...";

    const selected = [...surfaceItems.values()].map(item => ({
      type: item.type,
      title: item.title,
      url: item.url,
      summary: item.summary,
      content: item.content,
      analysisContent: item.raw?.analysisContent || ""
    }));

    try {
      const resp = await browser.runtime.sendMessage({
        action: "workbenchAnalyze",
        projectId: currentProjectId,
        selectedItems: selected,
        prompt: text,
        provider: providerSelect.value || ""
      });

      if (!resp?.success) {
        assistantBody.textContent = resp?.error || "Failed to get response.";
        assistantDiv.classList.remove("streaming");
        statusEl.textContent = "";
        isStreaming = false;
        sendBtn.disabled = false;
        return;
      }

      await pollStream(resp.streamId, assistantDiv, assistantBody);
    } catch (err) {
      assistantBody.textContent = "Error: " + err.message;
      assistantDiv.classList.remove("streaming");
      statusEl.textContent = "";
    }

    isStreaming = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  async function pollStream(streamId, msgDiv, bodyEl) {
    const POLL_MS = 80;
    const MAX_POLLS = 1200;
    let polls = 0;

    return new Promise((resolve) => {
      const timer = setInterval(async () => {
        polls++;
        const data = await browser.storage.local.get(streamId);
        const state = data[streamId];

        if (!state || polls >= MAX_POLLS) {
          clearInterval(timer);
          msgDiv.classList.remove("streaming");
          if (!state) bodyEl.textContent = "Stream timed out.";
          statusEl.textContent = "";
          resolve();
          return;
        }

        if (state.status === "streaming" || state.status === "done") {
          if (typeof marked !== "undefined" && state.content) {
            bodyEl.innerHTML = DOMPurify.sanitize(marked.parse(state.content));
          } else {
            bodyEl.textContent = state.content || "";
          }
          scrollToBottom();

          if (state.status === "streaming") {
            statusEl.textContent = `Streaming... (${(state.content || "").length} chars)`;
          }
        }

        if (state.status === "done") {
          clearInterval(timer);
          msgDiv.classList.remove("streaming");
          lastResultContent = state.content || "";
          statusEl.textContent = state.usage
            ? `${state.model || ""} · ${state.usage.totalTokens || "?"} tokens`
            : "Done";
          showResultButtons(true);
          browser.storage.local.remove(streamId);
          resolve();
        }

        if (state.status === "error") {
          clearInterval(timer);
          msgDiv.classList.remove("streaming");
          bodyEl.textContent = state.error || "Unknown error.";
          statusEl.textContent = "";
          browser.storage.local.remove(streamId);
          resolve();
        }
      }, POLL_MS);
    });
  }

  // ── Input handling ──
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendBtn.addEventListener("click", sendMessage);

  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
  }
  inputEl.addEventListener("input", autoResize);

  // ── Result buttons (header bar) ──
  function showResultButtons(show) {
    const display = show ? "" : "none";
    saveResultBtn.style.display = display;
    copyResultBtn.style.display = display;
    exportResultBtn.style.display = display;
    emailResultBtn.style.display = display;
  }

  saveResultBtn.addEventListener("click", async () => {
    if (!currentProjectId || !lastResultContent) return;
    const summary = lastResultContent.slice(0, 500).replace(/[#*_`]/g, "");
    await browser.runtime.sendMessage({
      action: "addProjectItem",
      projectId: currentProjectId,
      item: {
        type: "analysis",
        title: `Workbench: ${surfaceItems.size} items`,
        summary,
        analysisContent: lastResultContent,
        tags: ["workbench"],
        addedAt: new Date().toISOString()
      }
    });
    saveResultBtn.textContent = "Saved!";
    saveResultBtn.style.color = "var(--success)";
    setTimeout(() => {
      saveResultBtn.textContent = "+ Save to Project";
      saveResultBtn.style.color = "";
    }, 2000);
    await loadProject(currentProjectId);
  });

  copyResultBtn.addEventListener("click", () => {
    if (!lastResultContent) return;
    navigator.clipboard.writeText(lastResultContent);
    copyResultBtn.textContent = "Copied!";
    setTimeout(() => { copyResultBtn.textContent = "Copy"; }, 1500);
  });

  exportResultBtn.addEventListener("click", () => {
    if (!lastResultContent) return;
    const filename = `workbench-analysis-${new Date().toISOString().slice(0, 10)}.md`;
    if (typeof exportAsMarkdown !== "undefined") {
      exportAsMarkdown(lastResultContent, filename);
    } else {
      const blob = new Blob([lastResultContent], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }
  });

  emailResultBtn.addEventListener("click", () => {
    if (!lastResultContent) return;
    EmailShare.compose({
      subject: `Workbench Analysis - ${projectData?.project?.name || "Argus"}`,
      body: EmailShare.formatBody({
        summary: `Workbench analysis of ${surfaceItems.size} items`,
        content: lastResultContent
      })
    });
  });

})();
