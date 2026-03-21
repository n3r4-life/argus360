// ──────────────────────────────────────────────
// Argus — Sources Page
// Graduated from options console (Round 2)
// ──────────────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────────
// Sources Tab
// ──────────────────────────────────────────────

const SOURCE_ADDR_TYPES = {
  x:         { label: "X / Twitter",  icon: "𝕏",  prefix: "https://x.com/",              example: "@elonmusk" },
  bluesky:   { label: "Bluesky",      icon: "🦋", prefix: "https://bsky.app/profile/",    example: "alice.bsky.social" },
  mastodon:  { label: "Mastodon",     icon: "🐘", prefix: null,                            example: "@user@infosec.exchange" },
  youtube:   { label: "YouTube",      icon: "▶",  prefix: "https://youtube.com/@",         example: "@ChannelName" },
  rumble:    { label: "Rumble",       icon: "🟢", prefix: "https://rumble.com/c/",          example: "ChannelName" },
  facebook:  { label: "Facebook",     icon: "f",  prefix: "https://facebook.com/",         example: "john.doe or page-name" },
  linkedin:  { label: "LinkedIn",     icon: "in", prefix: "https://linkedin.com/in/",      example: "jane-doe-12345" },
  telegram:  { label: "Telegram",     icon: "✈",  prefix: "https://t.me/",                 example: "@username or channel" },
  reddit:    { label: "Reddit",       icon: "🔴", prefix: "https://reddit.com/u/",         example: "u/spez" },
  github:    { label: "GitHub",       icon: "⌨",  prefix: "https://github.com/",           example: "octocat" },
  threads:   { label: "Threads",      icon: "@",  prefix: "https://threads.net/@",         example: "@username" },
  tiktok:    { label: "TikTok",       icon: "♪",  prefix: "https://tiktok.com/@",          example: "@username" },
  substack:  { label: "Substack",     icon: "📰", prefix: null,                            example: "https://name.substack.com" },
  email:     { label: "Email",        icon: "✉",  prefix: "mailto:",                       example: "user@example.com" },
  phone:     { label: "Phone",        icon: "📞", prefix: "tel:",                           example: "+1 555 867 5309 (with country code)" },
  signal:    { label: "Signal",       icon: "🔒", prefix: null,                            example: "+1 555 867 5309 (phone number)" },
  discord:   { label: "Discord",      icon: "🎮", prefix: null,                            example: "username or invite.gg/server" },
  whatsapp:  { label: "WhatsApp",     icon: "💬", prefix: "https://wa.me/",                example: "+15558675309 (no dashes)" },
  rss:       { label: "RSS Feed",     icon: "📡", prefix: null,                            example: "https://example.com/feed.xml" },
  ip:        { label: "IP Address",   icon: "🌐", prefix: null,                            example: "192.168.1.1 or 2001:db8::1" },
  website:   { label: "Website",      icon: "🔗", prefix: null,                            example: "https://example.com" },
  pastebin:  { label: "Pastebin",     icon: "📋", prefix: null,                            example: "https://pastebin.com/u/username" },
  gdoc:      { label: "Google Doc",   icon: "📄", prefix: null,                            example: "https://docs.google.com/d/..." },
  custom:    { label: "Other",        icon: "📌", prefix: null,                            example: "Any URL, handle, or address" },
};

const srcState = { initialized: false, sources: [], editingId: null, regexMode: false };

function initSources() {
  if (srcState.initialized) return;
  srcState.initialized = true;

  document.getElementById("src-add-new").addEventListener("click", () => showSourceEditor());
  document.getElementById("src-add-addr").addEventListener("click", () => addAddrRow());
  document.getElementById("src-cancel").addEventListener("click", hideSourceEditor);
  document.getElementById("src-save").addEventListener("click", saveSource);
  document.getElementById("src-search").addEventListener("input", debounce(filterSources, 300));
  document.getElementById("src-search-mode")?.addEventListener("click", () => {
    srcState.regexMode = !srcState.regexMode;
    const btn = document.getElementById("src-search-mode");
    const bar = document.getElementById("src-search-bar");
    const slashes = bar?.querySelectorAll(".src-search-slash") || [];
    const input = document.getElementById("src-search");
    btn.classList.toggle("active", srcState.regexMode);
    slashes.forEach(s => s.style.display = srcState.regexMode ? "" : "none");
    input.placeholder = srcState.regexMode
      ? "regex — e.g. gmail\\.com|yahoo  ^john  \\d{3}-\\d{4}"
      : "Search sources...";
    if (srcState.regexMode) input.classList.add("src-search-mono");
    else input.classList.remove("src-search-mono");
    filterSources();
  });
  document.getElementById("src-filter-type").addEventListener("change", filterSources);
  document.getElementById("src-filter-tag").addEventListener("change", filterSources);
  document.getElementById("src-filter-folder")?.addEventListener("change", () => {
    filterSources();
    const folderVal = document.getElementById("src-filter-folder").value;
    document.getElementById("src-folder-rename").disabled = !folderVal;
    document.getElementById("src-folder-delete").disabled = !folderVal;
  });

  // Folder management
  document.getElementById("src-folder-add")?.addEventListener("click", srcFolderAdd);
  document.getElementById("src-folder-rename")?.addEventListener("click", srcFolderRename);
  document.getElementById("src-folder-delete")?.addEventListener("click", srcFolderDelete);

  // Import / Export
  document.getElementById("src-import").addEventListener("click", () => document.getElementById("src-import-file").click());
  document.getElementById("src-import-file").addEventListener("change", importSources);
  document.getElementById("src-export").addEventListener("click", exportSources);

  loadSources();
}

async function loadSources() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getSources" });
    srcState.sources = resp?.sources || [];
  } catch { srcState.sources = []; }
  populateTagFilter();
  filterSources();
  const countEl = document.getElementById("src-count");
  if (countEl) countEl.textContent = `${srcState.sources.length} source${srcState.sources.length !== 1 ? "s" : ""}`;

  // Highlight a specific source if navigated from KG graph
  const params = new URLSearchParams(window.location.search);
  const highlightId = params.get("highlight");
  if (highlightId) {
    // Auto-filter to the source's type so it's immediately visible
    const targetSrc = srcState.sources.find(s => s.id === highlightId);
    if (targetSrc?.type) {
      const typeFilter = document.getElementById("src-filter-type");
      if (typeFilter) {
        typeFilter.value = targetSrc.type;
        filterSources();
      }
    }
    requestAnimationFrame(() => {
      const card = document.querySelector(`.src-card[data-src-id="${CSS.escape(highlightId)}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("src-card-highlight");
        setTimeout(() => card.classList.remove("src-card-highlight"), 3000);
      }
    });
    // Clean up URL so refreshing doesn't re-highlight
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState(null, "", cleanUrl);
  }
}

function populateTagFilter() {
  const sel = document.getElementById("src-filter-tag");
  const current = sel.value;
  const tags = new Set();
  for (const s of srcState.sources) {
    for (const t of (s.tags || [])) tags.add(t);
  }
  sel.innerHTML = '<option value="">All Tags</option>';
  for (const t of [...tags].sort()) {
    sel.innerHTML += `<option value="${t}">${t}</option>`;
  }
  sel.value = current;

  // Populate folder filter + datalist (merge stored folder list + folders from sources)
  const folderSel = document.getElementById("src-filter-folder");
  const folderList = document.getElementById("src-folder-list");
  const currentFolder = folderSel?.value || "";
  const folders = new Set();
  for (const s of srcState.sources) {
    if (s.folder) folders.add(s.folder);
  }
  // Also include stored folder names (so empty folders persist)
  getSrcFolderList().then(stored => {
    for (const f of stored) folders.add(f);
    if (folderSel) {
      folderSel.innerHTML = '<option value="">All Folders</option>';
      for (const f of [...folders].sort()) {
        folderSel.innerHTML += `<option value="${f}">${f}</option>`;
      }
      folderSel.value = currentFolder;
    }
    if (folderList) {
      folderList.innerHTML = '';
      for (const f of [...folders].sort()) {
        folderList.innerHTML += `<option value="${f}">`;
      }
    }
  });
}

function srcFolderAdd() {
  const name = prompt("New folder name:");
  if (!name || !name.trim()) return;
  const folderName = name.trim();
  // Check if any source already uses this folder
  if (srcState.sources.some(s => s.folder === folderName)) {
    alert(`Folder "${folderName}" already exists.`);
    return;
  }
  // Create a placeholder by setting the folder in the filter — it'll appear once a source uses it
  // But we also store it in a dedicated list so empty folders persist
  saveSrcFolderList(folderName);
  populateTagFilter();
  document.getElementById("src-filter-folder").value = folderName;
  document.getElementById("src-filter-folder").dispatchEvent(new Event("change"));
}

async function srcFolderRename() {
  const folderSel = document.getElementById("src-filter-folder");
  const oldName = folderSel.value;
  if (!oldName) return;
  const newName = prompt(`Rename folder "${oldName}" to:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  const trimmed = newName.trim();
  // Rename on all sources that use this folder
  let count = 0;
  for (const src of srcState.sources) {
    if (src.folder === oldName) {
      src.folder = trimmed;
      await browser.runtime.sendMessage({ action: "saveSource", source: src });
      count++;
    }
  }
  // Update stored folder list
  await renameSrcFolder(oldName, trimmed);
  populateTagFilter();
  folderSel.value = trimmed;
  folderSel.dispatchEvent(new Event("change"));
  filterSources();
}

async function srcFolderDelete() {
  const folderSel = document.getElementById("src-filter-folder");
  const folderName = folderSel.value;
  if (!folderName) return;
  const sourcesInFolder = srcState.sources.filter(s => s.folder === folderName);
  const action = sourcesInFolder.length > 0
    ? prompt(`Folder "${folderName}" has ${sourcesInFolder.length} source(s).\nType DELETE to remove folder AND sources, or KEEP to ungroup them:`)
    : "empty";
  if (!action) return;
  const choice = action.trim().toUpperCase();
  if (choice === "DELETE") {
    for (const src of sourcesInFolder) {
      await browser.runtime.sendMessage({ action: "deleteSource", sourceId: src.id });
    }
  } else if (choice === "KEEP") {
    for (const src of sourcesInFolder) {
      src.folder = "";
      await browser.runtime.sendMessage({ action: "saveSource", source: src });
    }
  } else if (choice !== "EMPTY") {
    return; // cancelled or unrecognized
  }
  await removeSrcFolder(folderName);
  populateTagFilter();
  folderSel.value = "";
  folderSel.dispatchEvent(new Event("change"));
  loadSources();
}

// Persist folder names independently so empty folders survive
async function getSrcFolderList() {
  try {
    const res = await browser.storage.local.get({ argusSrcFolders: [] });
    return res.argusSrcFolders || [];
  } catch { return []; }
}
async function saveSrcFolderList(newFolder) {
  const list = await getSrcFolderList();
  if (!list.includes(newFolder)) {
    list.push(newFolder);
    await browser.storage.local.set({ argusSrcFolders: list });
  }
}
async function renameSrcFolder(oldName, newName) {
  const list = await getSrcFolderList();
  const idx = list.indexOf(oldName);
  if (idx !== -1) list[idx] = newName;
  else list.push(newName);
  await browser.storage.local.set({ argusSrcFolders: list });
}
async function removeSrcFolder(name) {
  const list = await getSrcFolderList();
  const filtered = list.filter(f => f !== name);
  await browser.storage.local.set({ argusSrcFolders: filtered });
}

function filterSources() {
  const raw = (document.getElementById("src-search")?.value || "").trim();
  const typeFilter = document.getElementById("src-filter-type")?.value || "";
  const tagFilter = document.getElementById("src-filter-tag")?.value || "";
  const folderFilter = document.getElementById("src-filter-folder")?.value || "";
  const countEl = document.getElementById("src-search-count");
  const searchBar = document.querySelector(".src-search-bar");

  let filtered = srcState.sources;
  if (typeFilter) filtered = filtered.filter(s => s.type === typeFilter);
  if (tagFilter) filtered = filtered.filter(s => (s.tags || []).includes(tagFilter));
  if (folderFilter) filtered = filtered.filter(s => (s.folder || "") === folderFilter);

  const sourceText = (s) => [
    s.name, s.type, s.folder, s.location, s.notes,
    ...(s.aliases || []),
    ...(s.tags || []),
    ...(s.addresses || []).flatMap(a => [a.label, a.value])
  ].filter(Boolean).join(" ");

  if (raw && srcState.regexMode) {
    let re;
    try {
      re = new RegExp(raw, "i");
      if (searchBar) searchBar.classList.remove("src-search-error");
    } catch {
      if (searchBar) searchBar.classList.add("src-search-error");
      if (countEl) countEl.textContent = "invalid regex";
      renderSourcesGrid(filtered);
      return;
    }
    filtered = filtered.filter(s => re.test(sourceText(s)));
  } else if (raw) {
    if (searchBar) searchBar.classList.remove("src-search-error");
    const q = raw.toLowerCase();
    filtered = filtered.filter(s => sourceText(s).toLowerCase().includes(q));
  } else {
    if (searchBar) searchBar.classList.remove("src-search-error");
  }

  if (countEl) {
    countEl.textContent = raw ? `${filtered.length} / ${srcState.sources.length}` : "";
  }
  renderSourcesGrid(filtered);
}

const SOURCE_TYPE_COLORS = {
  person:       '#e94560',
  organization: '#64b5f6',
  group:        '#ab47bc',
  handle:       '#26c6da',
  journalist:   '#ffa726',
  informant:    '#66bb6a',
  target:       '#ef5350',
  adversary:    '#f44336',
  scammer:      '#ff5722',
  asset:        '#42a5f5',
  service:      '#78909c',
  webservice:   '#7e57c2',
  device:       '#8d6e63',
  academic:     '#5c6bc0',
  medical:      '#26a69a',
  legal:        '#8d6e63',
  lead:         '#ffca28',
  alias:        '#bdbdbd',
  entity:       '#90a4ae',
};

async function renderSourcesGrid(sources) {
  const grid = document.getElementById("src-grid");
  if (!sources.length) {
    grid.innerHTML = '<div class="src-empty"><p>No sources match your filter.</p></div>';
    return;
  }

  // Fetch active feeds and monitors to cross-reference with source addresses
  let activeFeedUrls = new Set();
  let monitoredUrls = new Set();
  try {
    const [feedResp, monResp] = await Promise.all([
      browser.runtime.sendMessage({ action: "getFeeds" }).catch(() => null),
      browser.runtime.sendMessage({ action: "getMonitors" }).catch(() => null),
    ]);
    if (feedResp?.feeds) {
      for (const f of feedResp.feeds) {
        if (f.url) activeFeedUrls.add(f.url);
      }
    }
    if (monResp?.monitors) {
      for (const m of monResp.monitors) {
        if (m.url) monitoredUrls.add(m.url);
      }
    }
  } catch { /* unavailable */ }

  // Group by folder when showing all folders
  const folderFilter = document.getElementById("src-filter-folder")?.value || "";
  const hasFolders = sources.some(s => s.folder);
  let orderedSources = sources;
  if (!folderFilter && hasFolders) {
    // Sort: sources with folders first (alphabetical by folder), then ungrouped
    orderedSources = [...sources].sort((a, b) => {
      if (a.folder && !b.folder) return -1;
      if (!a.folder && b.folder) return 1;
      if (a.folder && b.folder) return a.folder.localeCompare(b.folder);
      return 0;
    });
  }

  grid.innerHTML = "";
  let currentFolder = null;
  let currentSubGrid = grid; // default: cards go directly into grid
  for (const src of orderedSources) {
    // Insert folder section with its own sub-grid when grouping
    if (!folderFilter && hasFolders) {
      const sf = src.folder || "__ungrouped__";
      if (sf !== currentFolder) {
        currentFolder = sf;
        const section = document.createElement("div");
        section.className = "src-folder-section";
        const header = document.createElement("div");
        header.className = "src-folder-header";
        if (sf === "__ungrouped__") {
          header.innerHTML = `<span class="src-folder-header-icon">📋</span> Ungrouped`;
        } else {
          header.innerHTML = `<span class="src-folder-header-icon">📁</span> ${escapeHtml(sf)}`;
        }
        section.appendChild(header);
        const subGrid = document.createElement("div");
        subGrid.className = "src-grid src-folder-grid";
        section.appendChild(subGrid);
        grid.appendChild(section);
        currentSubGrid = subGrid;
      }
    }
    const card = document.createElement("div");
    card.className = "src-card";
    card.dataset.srcId = src.id;

    const typeColor = SOURCE_TYPE_COLORS[src.type] || SOURCE_TYPE_COLORS.entity;

    // Header
    const initials = (src.name || "?").slice(0, 2).toUpperCase();
    const header = document.createElement("div");
    header.className = "src-card-header";
    header.style.background = typeColor + '18';
    header.style.borderBottom = `2px solid ${typeColor}55`;
    header.innerHTML = `
      <div class="src-card-avatar" style="background:${typeColor}22;color:${typeColor};">${initials}</div>
      <div class="src-card-info">
        <div class="src-card-name">${escapeHtml(src.name || "Unnamed")}</div>
        <div class="src-card-type" style="color:${typeColor};">${escapeHtml(src.type || "entity")}</div>
        ${src.aliases?.length ? `<div class="src-card-aliases">aka ${escapeHtml(src.aliases.join(", "))}</div>` : ""}
      </div>
    `;
    card.appendChild(header);

    // Addresses (truncate to first 5, expandable)
    if (src.addresses?.length) {
      const MAX_VISIBLE = 5;
      const addrs = document.createElement("div");
      addrs.className = "src-card-addresses";
      let hasActiveFeed = false;
      let hasMonitoredPage = false;
      const allChips = [];
      for (const addr of src.addresses) {
        const def = SOURCE_ADDR_TYPES[addr.type] || SOURCE_ADDR_TYPES.custom;
        const chip = document.createElement("a");
        chip.className = "src-addr-chip";
        const isFeed = addr.type === "rss" && activeFeedUrls.has(addr.value);
        const isPageMonitor = !isFeed && monitoredUrls.has(addr.value);
        if (isFeed || isPageMonitor) {
          chip.classList.add("src-addr-monitored");
          if (isFeed) hasActiveFeed = true;
          if (isPageMonitor) hasMonitoredPage = true;
        }
        const liveLabel = isFeed ? " (subscribed feed)" : isPageMonitor ? " (monitored page)" : "";
        chip.title = `${def.label}: ${addr.value}${liveLabel}`;
        const url = getAddrUrl(addr);
        if (url) { chip.href = url; chip.target = "_blank"; }
        const liveTag = isFeed ? '<span class="src-chip-live">FEED</span>' : isPageMonitor ? '<span class="src-chip-live">MON</span>' : "";
        chip.innerHTML = `<span class="src-chip-icon">${def.icon}</span><span class="src-chip-label">${escapeHtml(addr.label || addr.value)}</span>${liveTag}`;
        chip.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(addr.value);
        });
        allChips.push(chip);
      }
      const overflow = allChips.length > MAX_VISIBLE;
      for (let i = 0; i < allChips.length; i++) {
        if (overflow && i >= MAX_VISIBLE) allChips[i].classList.add("src-addr-hidden");
        addrs.appendChild(allChips[i]);
      }
      if (overflow) {
        const moreBtn = document.createElement("button");
        moreBtn.className = "src-addr-more";
        const hiddenCount = allChips.length - MAX_VISIBLE;
        moreBtn.textContent = `+${hiddenCount} more`;
        moreBtn.addEventListener("click", () => {
          addrs.querySelectorAll(".src-addr-hidden").forEach(el => el.classList.remove("src-addr-hidden"));
          moreBtn.remove();
        });
        addrs.appendChild(moreBtn);
      }
      if (hasActiveFeed || hasMonitoredPage) {
        const badge = document.createElement("div");
        badge.className = "src-card-feed-badge";
        const parts = [];
        if (hasActiveFeed) parts.push("Subscribed Feed");
        if (hasMonitoredPage) parts.push("Monitored Page");
        badge.textContent = parts.join(" · ");
        addrs.appendChild(badge);
      }
      card.appendChild(addrs);
    }

    // Folder badge
    if (src.folder) {
      const folderBadge = document.createElement("div");
      folderBadge.className = "src-card-folder";
      folderBadge.innerHTML = `<span class="src-folder-badge">📁 ${escapeHtml(src.folder)}</span>`;
      card.appendChild(folderBadge);
    }

    // Location + Tags
    if (src.location || src.tags?.length) {
      const meta = document.createElement("div");
      meta.className = "src-card-tags";
      if (src.location) {
        meta.innerHTML += `<span class="src-tag" style="background:var(--bg-secondary);color:var(--text-secondary);">📍 ${escapeHtml(src.location)}</span>`;
      }
      for (const t of (src.tags || [])) {
        meta.innerHTML += `<span class="src-tag">${escapeHtml(t)}</span>`;
      }
      card.appendChild(meta);
    }

    // Notes preview
    if (src.notes) {
      const notes = document.createElement("div");
      notes.className = "src-card-notes";
      notes.textContent = src.notes;
      card.appendChild(notes);
    }

    // Actions
    const actions = document.createElement("div");
    actions.className = "src-card-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => showSourceEditor(src));
    actions.appendChild(editBtn);

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-secondary";
    copyBtn.textContent = "Copy All";
    copyBtn.addEventListener("click", () => {
      const handles = (src.addresses || []).map(a => a.value).join("\n");
      navigator.clipboard.writeText(handles);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy All"; }, 1500);
    });
    actions.appendChild(copyBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-secondary";
    delBtn.textContent = "Delete";
    delBtn.style.color = "var(--error)";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete source "${src.name}"?`)) return;
      await browser.runtime.sendMessage({ action: "deleteSource", sourceId: src.id });
      loadSources();
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    currentSubGrid.appendChild(card);
  }
}

function getAddrUrl(addr) {
  const def = SOURCE_ADDR_TYPES[addr.type] || SOURCE_ADDR_TYPES.custom;
  const val = (addr.value || "").trim();
  if (!val) return null;
  // If value is already a full URL, use it directly
  if (/^https?:\/\//i.test(val)) return val;
  if (addr.type === "email") return `mailto:${val}`;
  if (addr.type === "phone") return `tel:${val}`;
  if (def.prefix) return def.prefix + val.replace(/^@/, "");
  return null;
}

function showSourceEditor(source) {
  srcState.editingId = source?.id || null;
  const editor = document.getElementById("src-editor");
  document.getElementById("src-editor-title").textContent = source ? "Edit Source" : "New Source";
  document.getElementById("src-name").value = source?.name || "";
  document.getElementById("src-type").value = source?.type || "person";
  document.getElementById("src-aliases").value = (source?.aliases || []).join(", ");
  document.getElementById("src-location").value = source?.location || "";
  document.getElementById("src-tags").value = (source?.tags || []).join(", ");
  document.getElementById("src-notes").value = source?.notes || "";
  document.getElementById("src-folder").value = source?.folder || "";

  // Populate address rows
  const list = document.getElementById("src-addr-list");
  list.innerHTML = "";
  if (source?.addresses?.length) {
    for (const addr of source.addresses) {
      addAddrRow(addr.type, addr.value, addr.label);
    }
  } else {
    addAddrRow(); // Start with one empty row
  }

  editor.classList.remove("hidden");
  editor.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("src-name").focus();
}

function hideSourceEditor() {
  document.getElementById("src-editor").classList.add("hidden");
  srcState.editingId = null;
}

function addAddrRow(type, value, label) {
  const list = document.getElementById("src-addr-list");
  const row = document.createElement("div");
  row.className = "src-addr-row";

  const sel = document.createElement("select");
  for (const [key, def] of Object.entries(SOURCE_ADDR_TYPES)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${def.icon} ${def.label}`;
    sel.appendChild(opt);
  }
  sel.value = type || "website";

  const valInput = document.createElement("input");
  valInput.type = "text";
  const selectedType = SOURCE_ADDR_TYPES[sel.value] || SOURCE_ADDR_TYPES.custom;
  valInput.placeholder = selectedType.example || "Handle, URL, email, IP, number...";
  valInput.value = value || "";

  // Update placeholder when type changes
  sel.addEventListener("change", () => {
    const def = SOURCE_ADDR_TYPES[sel.value] || SOURCE_ADDR_TYPES.custom;
    valInput.placeholder = def.example || "Handle, URL, email, IP, number...";
  });

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.placeholder = "Label (optional)";
  labelInput.value = label || "";
  labelInput.style.maxWidth = "120px";

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn btn-secondary";
  removeBtn.textContent = "×";
  removeBtn.style.color = "var(--error)";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(sel);
  row.appendChild(valInput);
  row.appendChild(labelInput);
  row.appendChild(removeBtn);
  list.appendChild(row);
}

async function saveSource() {
  const name = document.getElementById("src-name").value.trim();
  if (!name) { document.getElementById("src-name").focus(); return; }

  const aliases = document.getElementById("src-aliases").value.split(",").map(s => s.trim()).filter(Boolean);
  const tags = document.getElementById("src-tags").value.split(",").map(s => s.trim()).filter(Boolean);

  // Collect addresses
  const addresses = [];
  for (const row of document.querySelectorAll("#src-addr-list .src-addr-row")) {
    const type = row.querySelector("select").value;
    const value = row.querySelectorAll("input")[0].value.trim();
    const label = row.querySelectorAll("input")[1].value.trim();
    if (value) addresses.push({ type, value, label: label || "" });
  }

  const source = {
    id: srcState.editingId || `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type: document.getElementById("src-type").value,
    aliases,
    addresses,
    tags,
    location: document.getElementById("src-location").value.trim(),
    notes: document.getElementById("src-notes").value.trim(),
    folder: document.getElementById("src-folder").value.trim(),
  };

  // Preserve timestamps if editing
  if (srcState.editingId) {
    const existing = srcState.sources.find(s => s.id === srcState.editingId);
    if (existing) source.createdAt = existing.createdAt;
  }

  // Persist folder name so it survives even if all sources are removed from it
  if (source.folder) await saveSrcFolderList(source.folder);

  await browser.runtime.sendMessage({ action: "saveSource", source });
  hideSourceEditor();
  loadSources();
}

async function importSources(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const sources = Array.isArray(data) ? data : (data.sources || []);
    if (!sources.length) { alert("No sources found in file."); return; }
    // Ensure all have IDs
    for (const s of sources) {
      if (!s.id) s.id = `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    await browser.runtime.sendMessage({ action: "importSources", sources });
    loadSources();
  } catch (err) {
    alert("Import failed: " + err.message);
  }
  e.target.value = "";
}

async function exportSources() {
  const resp = await browser.runtime.sendMessage({ action: "exportSources" });
  const sources = resp?.sources || [];
  if (!sources.length) { alert("No sources to export."); return; }
  const blob = new Blob([JSON.stringify(sources, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `argus-sources-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Source picker — reusable dropdown for other tabs ──
// btnId:       ID of the trigger button
// dropdownId:  ID of the dropdown container
// addrTypes:   array of SOURCE_ADDR_TYPES keys to filter by (e.g. ["rss","website"])
// onSelect:    callback(addr, source) when user picks an address
function initSourcePicker(btnId, dropdownId, addrTypes, onSelect) {
  const btn = document.getElementById(btnId);
  const dropdown = document.getElementById(dropdownId);
  if (!btn || !dropdown) return;

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const wasHidden = dropdown.classList.contains("hidden");
    // Close all other open pickers first
    document.querySelectorAll(".src-picker-dropdown").forEach(d => d.classList.add("hidden"));
    if (!wasHidden) return;

    dropdown.classList.remove("hidden");
    dropdown.innerHTML = '<div class="src-picker-empty">Loading...</div>';

    let sources;
    try {
      const resp = await browser.runtime.sendMessage({ action: "getSources" });
      sources = resp?.sources || [];
    } catch { sources = []; }

    // Collect matching addresses across all sources
    const items = [];
    for (const src of sources) {
      for (const addr of (src.addresses || [])) {
        if (addrTypes.includes(addr.type)) {
          items.push({ source: src, addr });
        }
        // Also include website/custom addresses that look like URLs
        if (!addrTypes.includes(addr.type) && addrTypes.includes("website") && /^https?:\/\//i.test(addr.value)) {
          items.push({ source: src, addr });
        }
      }
    }

    // Deduplicate by value
    const seen = new Set();
    const unique = items.filter(i => {
      if (seen.has(i.addr.value)) return false;
      seen.add(i.addr.value);
      return true;
    });

    if (!unique.length) {
      dropdown.innerHTML = '<div class="src-picker-empty">No matching addresses in your sources.<br>Add RSS or website addresses on the Sources tab.</div>';
      return;
    }

    dropdown.innerHTML = "";
    for (const { source, addr } of unique) {
      const def = SOURCE_ADDR_TYPES[addr.type] || SOURCE_ADDR_TYPES.custom;
      const item = document.createElement("div");
      item.className = "src-picker-item";
      item.innerHTML = `
        <span class="src-picker-item-name">${def.icon} ${escapeHtml(source.name)}${addr.label ? " — " + escapeHtml(addr.label) : ""}</span>
        <span class="src-picker-item-addr">${escapeHtml(addr.value)}</span>
      `;
      item.addEventListener("click", () => {
        onSelect(addr, source);
        dropdown.classList.add("hidden");
      });
      dropdown.appendChild(item);
    }
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.add("hidden");
    }
  });
}

// ══════════════════════════════════════════════════════════════
// Trawl Schedule — Phase 3
// ══════════════════════════════════════════════════════════════



// ──────────────────────────────────────────────
// Init on page load
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initSources();
});
