(async () => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const storeKey = params.get("id");

  // ── History Panel (shared between landing page & gallery view) ──
  async function populateHistoryPanel(activeStoreKey) {
    const HISTORY_KEY = "imageGrabberHistory";
    const panel = document.getElementById("historyPanel");
    const tab = document.getElementById("historyTab");
    const timeline = document.getElementById("historyTimeline");
    const countEl = document.getElementById("historyCount");
    if (!panel || !timeline) return;

    // Toggle
    tab.addEventListener("click", () => {
      panel.classList.toggle("hidden");
      PanelState.save("images", "history", { visible: !panel.classList.contains("hidden") });
    });
    document.getElementById("historyPanelClose").addEventListener("click", () => {
      panel.classList.add("hidden");
      PanelState.save("images", "history", { visible: false });
    });

    // Load history
    const hist = (await browser.storage.local.get(HISTORY_KEY))[HISTORY_KEY] || [];
    if (hist.length === 0) { tab.style.display = "none"; return; }

    // Verify entries
    const keys = hist.map(h => h.storeKey);
    const allData = await browser.storage.local.get(keys);
    const valid = hist.filter(h => allData[h.storeKey]);
    if (valid.length === 0) { tab.style.display = "none"; return; }
    if (valid.length !== hist.length) {
      await browser.storage.local.set({ [HISTORY_KEY]: valid });
    }

    const totalImages = valid.reduce((sum, h) => sum + (h.imageCount || 0), 0);
    countEl.textContent = `${valid.length} session${valid.length !== 1 ? "s" : ""} · ${totalImages} images`;

    function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
    function ago(ts) {
      const ms = Date.now() - ts;
      if (ms < 60000) return "just now";
      if (ms < 3600000) return Math.round(ms / 60000) + "m ago";
      if (ms < 86400000) return Math.round(ms / 3600000) + "h ago";
      return Math.round(ms / 86400000) + "d ago";
    }

    timeline.innerHTML = "";
    valid.forEach(entry => {
      const node = document.createElement("div");
      node.className = "history-node" + (entry.storeKey === activeStoreKey ? " active" : "");

      const title = entry.multiTab
        ? `${entry.tabCount} tabs`
        : esc((entry.pageTitle || entry.pageUrl || "Untitled").slice(0, 35));

      const thumbs = (entry.thumbnails || []).slice(0, 4);
      const thumbHtml = thumbs.map(src =>
        `<img src="${esc(src)}" onerror="this.style.display='none'">`
      ).join("");

      node.innerHTML = `
        <button class="hn-delete" title="Delete">&times;</button>
        <div class="hn-title" title="${esc(entry.pageUrl || "")}">${title}</div>
        <div class="hn-meta">${entry.imageCount} images · ${ago(entry.timestamp)}</div>
        ${thumbHtml ? `<div class="hn-thumbs">${thumbHtml}</div>` : ""}
      `;

      // Click to load
      node.addEventListener("click", (e) => {
        if (e.target.closest(".hn-delete")) return;
        if (entry.storeKey === activeStoreKey) return; // already viewing
        location.search = `?id=${encodeURIComponent(entry.storeKey)}`;
      });

      // Delete
      node.querySelector(".hn-delete").addEventListener("click", async (e) => {
        e.stopPropagation();
        const updated = (await browser.storage.local.get(HISTORY_KEY))[HISTORY_KEY] || [];
        const filtered = updated.filter(h => h.storeKey !== entry.storeKey);
        await browser.storage.local.set({ [HISTORY_KEY]: filtered });
        await browser.storage.local.remove(entry.storeKey);
        node.remove();
        const remaining = timeline.querySelectorAll(".history-node").length;
        countEl.textContent = remaining ? `${remaining} session${remaining !== 1 ? "s" : ""}` : "";
        if (remaining === 0) { panel.classList.add("hidden"); tab.style.display = "none"; }
      });

      timeline.appendChild(node);
    });

    // Clear All
    document.getElementById("clearAllHistory").addEventListener("click", async () => {
      if (!confirm("Delete all session history and stored images?")) return;
      const keysToRemove = valid.map(h => h.storeKey);
      keysToRemove.push(HISTORY_KEY, "imageGrabberSession");
      await browser.storage.local.remove(keysToRemove);
      try { indexedDB.deleteDatabase("ArgusImageCache"); } catch {}
      sessionStorage.removeItem("imageGrabberActive");
      timeline.innerHTML = "";
      panel.classList.add("hidden");
      tab.style.display = "none";
      countEl.textContent = "";
    });

    // Draggable
    {
      const header = panel.querySelector(".fp-header");
      let dragging = false, startX, startY, startLeft, startTop;
      header.addEventListener("mousedown", (e) => {
        if (e.target.closest("button, input")) return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startLeft = rect.left; startTop = rect.top;
        header.style.cursor = "grabbing";
        e.preventDefault();
      });
      document.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        panel.style.left = (startLeft + e.clientX - startX) + "px";
        panel.style.top = (startTop + e.clientY - startY) + "px";
        panel.style.right = "auto";
        panel.style.transform = "none";
      });
      document.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        header.style.cursor = "grab";
        const rect = panel.getBoundingClientRect();
        PanelState.save("images", "history", { left: rect.left, top: rect.top });
      });
    }

    // Resizable
    {
      const handle = document.createElement("div");
      handle.className = "fp-resize";
      panel.appendChild(handle);
      let resizing = false, rStartX, rStartY, rStartW, rStartH;
      handle.addEventListener("mousedown", (e) => {
        resizing = true;
        rStartX = e.clientX; rStartY = e.clientY;
        rStartW = panel.offsetWidth; rStartH = panel.offsetHeight;
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener("mousemove", (e) => {
        if (!resizing) return;
        panel.style.width = Math.max(180, rStartW + (e.clientX - rStartX)) + "px";
        panel.style.height = Math.max(150, rStartH + (e.clientY - rStartY)) + "px";
      });
      document.addEventListener("mouseup", () => {
        if (!resizing) return;
        resizing = false;
        PanelState.save("images", "history", { width: panel.offsetWidth, height: panel.offsetHeight });
      });
    }

    // Restore panel state (position, size, visibility)
    PanelState.apply(panel, "images", "history");
  }

  if (!storeKey) {
    // Standalone mode — show tab picker landing
    document.querySelector(".header-title").textContent = "Image Grabber";
    document.getElementById("page-url").textContent = "";
    // Override grid layout so the landing page renders as a simple block
    document.getElementById("image-grid").style.display = "block";
    const emptyEl = document.getElementById("empty-state");
    emptyEl.innerHTML = `
      <div style="max-width:520px;margin:0 auto;text-align:center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:12px;">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
        <h2 style="font-size:18px;margin-bottom:8px;">Image Grabber</h2>
        <p style="color:var(--text-secondary);margin-bottom:12px;">Select tabs to extract images from.</p>
        <div id="grab-tab-picker" style="text-align:left;max-height:260px;overflow-y:auto;margin-bottom:12px;border:1px solid var(--border);border-radius:var(--radius);padding:8px;">
          <p style="color:var(--text-muted);text-align:center;padding:12px;">Loading tabs...</p>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;align-items:center;">
          <label style="font-size:12px;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;gap:4px;">
            <input type="checkbox" id="grab-select-all" checked> Select All
          </label>
          <button id="grab-selected-tabs" class="btn btn-primary" style="padding:10px 24px;font-size:14px;">Grab Images</button>
        </div>
      </div>`;

    // Load open tabs into the picker
    (async () => {
      // Query all windows so we see every open web tab
      const allTabs = await browser.tabs.query({});
      const webTabs = allTabs.filter(t => t.url && (t.url.startsWith("http://") || t.url.startsWith("https://")));
      const picker = document.getElementById("grab-tab-picker");

      if (webTabs.length === 0) {
        picker.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;">No web tabs open.</p>';
        document.getElementById("grab-selected-tabs").disabled = true;
        return;
      }

      function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

      const rows = webTabs.map(tab => {
        const title = esc((tab.title && tab.title.trim()) || tab.url || "Untitled");
        const ico = tab.favIconUrl ? `<td style="width:16px;padding:0"><img src="${esc(tab.favIconUrl)}" style="width:16px;height:16px;border-radius:2px;vertical-align:middle"></td>` : `<td style="width:0;padding:0"></td>`;
        return `<tr class="grab-tab-row" style="cursor:pointer;font-size:12px;color:var(--text-secondary)"><td style="width:20px;padding:4px"><input type="checkbox" checked value="${tab.id}" class="grab-tab-cb" style="accent-color:var(--accent)"></td>${ico}<td style="padding:4px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:400px" title="${esc(tab.url)}">${title}</td></tr>`;
      }).join("");
      picker.innerHTML = `<table style="width:100%;border-collapse:collapse">${rows}</table>`;

      // Hide broken favicons
      picker.querySelectorAll(".grab-tab-row img").forEach(img => {
        img.addEventListener("error", () => { img.style.display = "none"; });
      });

      // Click row to toggle checkbox
      picker.querySelectorAll(".grab-tab-row").forEach(row => {
        row.addEventListener("click", (e) => {
          if (e.target.tagName !== "INPUT") {
            const cb = row.querySelector(".grab-tab-cb");
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      });

      // Select All toggle
      const selectAllCb = document.getElementById("grab-select-all");
      selectAllCb.addEventListener("change", () => {
        picker.querySelectorAll(".grab-tab-cb").forEach(cb => { cb.checked = selectAllCb.checked; });
      });
      // Update Select All when individual checkboxes change
      picker.addEventListener("change", (e) => {
        if (e.target.classList.contains("grab-tab-cb")) {
          const all = picker.querySelectorAll(".grab-tab-cb");
          const checked = picker.querySelectorAll(".grab-tab-cb:checked");
          selectAllCb.checked = checked.length === all.length;
          selectAllCb.indeterminate = checked.length > 0 && checked.length < all.length;
        }
      });
    })();

    // Grab button
    document.getElementById("grab-selected-tabs").addEventListener("click", async () => {
      const btn = document.getElementById("grab-selected-tabs");
      const checked = document.querySelectorAll(".grab-tab-cb:checked");
      const tabIds = Array.from(checked).map(cb => parseInt(cb.value));
      if (tabIds.length === 0) { btn.textContent = "Select at least one tab"; setTimeout(() => { btn.textContent = "Grab Images"; }, 1500); return; }
      btn.disabled = true;
      btn.textContent = `Grabbing ${tabIds.length} tab${tabIds.length > 1 ? "s" : ""}...`;
      try {
        const resp = tabIds.length === 1
          ? await browser.runtime.sendMessage({ action: "extractImages", tabId: tabIds[0] })
          : await browser.runtime.sendMessage({ action: "extractImagesMultiTab", tabIds });
        if (resp && resp.success) {
          const key = `images-${Date.now()}`;
          const data = tabIds.length === 1
            ? { pageUrl: resp.pageUrl, pageTitle: resp.pageTitle, images: resp.images, stats: resp.stats }
            : resp.data;
          await browser.storage.local.set({ [key]: data });
          location.search = `?id=${encodeURIComponent(key)}`;
        } else {
          btn.textContent = resp?.error || "Failed";
          btn.disabled = false;
          setTimeout(() => { btn.textContent = "Grab Images"; }, 2000);
        }
      } catch (e) { btn.textContent = e.message || "Failed"; btn.disabled = false; }
    });

    // ── Auto-resume check (internal Argus navigation only) ──
    (async () => {
      try {
        const SESSION_KEY = "imageGrabberSession";
        const localRaw = localStorage.getItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);

        let saved = null;
        if (localRaw) {
          try { saved = JSON.parse(localRaw); } catch { saved = null; }
          if (saved && saved.storeKey) {
            await browser.storage.local.set({ [SESSION_KEY]: saved });
          }
        }
        if (!saved || !saved.storeKey) {
          saved = (await browser.storage.local.get(SESSION_KEY))[SESSION_KEY];
        }
        if (saved && saved.storeKey) {
          const hasData = await browser.storage.local.get(saved.storeKey);
          if (hasData[saved.storeKey]) {
            const wasActive = sessionStorage.getItem("imageGrabberActive");
            if (wasActive === saved.storeKey) {
              location.search = `?id=${encodeURIComponent(saved.storeKey)}`;
              return;
            }
          } else {
            await browser.storage.local.remove(SESSION_KEY);
          }
        }
      } catch {}
    })();

    populateHistoryPanel(null);

    // Hide filter/action bars and clear button in standalone mode
    document.querySelector(".stats-bar")?.classList.add("hidden");
    document.querySelector(".filter-bar")?.classList.add("hidden");
    document.querySelector(".ai-search-bar")?.classList.add("hidden");
    document.querySelector(".display-bar")?.classList.add("hidden");
    document.querySelector(".actions-bar")?.classList.add("hidden");
    document.getElementById("refresh-gallery")?.classList.add("hidden");
    document.getElementById("clear-gallery")?.classList.add("hidden");
    return;
  }

  const stored = (await browser.storage.local.get(storeKey))[storeKey];
  if (!stored || !stored.images) { document.getElementById("empty-state").innerHTML = "<p>No image data found.</p>"; return; }

  const { images, pageUrl, pageTitle, stats, multiTab, tabSources } = stored;
  const SESSION_KEY = "imageGrabberSession";

  // Mark this tab as having an active Image Grabber session (sessionStorage is
  // per-tab and cleared on extension reload — used by the landing page to decide
  // whether to auto-resume or show the tab picker)
  sessionStorage.setItem("imageGrabberActive", storeKey);

  // Persist session pointer to browser.storage.local
  browser.storage.local.set({ [SESSION_KEY]: { storeKey, timestamp: Date.now() } }).catch(() => {});

  // ── Session History — upsert this session into history array ──
  const HISTORY_KEY = "imageGrabberHistory";
  const MAX_HISTORY = 20;
  (async () => {
    try {
      const hist = (await browser.storage.local.get(HISTORY_KEY))[HISTORY_KEY] || [];
      const entry = {
        storeKey,
        timestamp: Date.now(),
        imageCount: images.length,
        pageTitle: pageTitle || "",
        pageUrl: pageUrl || "",
        multiTab: !!multiTab,
        tabCount: tabSources?.length || 1,
        thumbnails: images.slice(0, 4).map(img => img.src),
      };
      // Upsert — replace existing entry for same storeKey, or prepend
      const idx = hist.findIndex(h => h.storeKey === storeKey);
      if (idx >= 0) hist.splice(idx, 1);
      hist.unshift(entry);
      // Trim to max and clean up orphaned image data
      const removed = hist.splice(MAX_HISTORY);
      await browser.storage.local.set({ [HISTORY_KEY]: hist });
      // Remove stored image data for entries that fell off the end
      if (removed.length) {
        const activeKeys = new Set(hist.map(h => h.storeKey));
        const toRemove = removed.filter(h => !activeKeys.has(h.storeKey)).map(h => h.storeKey);
        if (toRemove.length) await browser.storage.local.remove(toRemove);
      }
    } catch {}
  })();

  // Header — hide page-url text (redundant with stats bar, causes button reflow)
  document.getElementById("page-url").style.display = "none";
  document.title = `Images - ${pageTitle || pageUrl || "Argus"}`;

  // Refresh gallery → re-grab images from the same source tabs
  document.getElementById("refresh-gallery").addEventListener("click", async () => {
    const btn = document.getElementById("refresh-gallery");
    btn.disabled = true;
    btn.style.opacity = "0.5";
    try {
      // Get tab IDs from original source tabs (try to match by URL)
      if (multiTab && tabSources) {
        const allTabs = await browser.tabs.query({});
        const tabIds = [];
        for (const ts of tabSources) {
          const match = allTabs.find(t => t.url === ts.url);
          if (match) tabIds.push(match.id);
        }
        if (tabIds.length > 0) {
          const resp = tabIds.length === 1
            ? await browser.runtime.sendMessage({ action: "extractImages", tabId: tabIds[0] })
            : await browser.runtime.sendMessage({ action: "extractImagesMultiTab", tabIds });
          if (resp && resp.success) {
            const data = tabIds.length === 1
              ? { pageUrl: resp.pageUrl, pageTitle: resp.pageTitle, images: resp.images, stats: resp.stats }
              : resp.data;
            await browser.storage.local.set({ [storeKey]: data });
            location.reload();
            return;
          }
        }
      } else {
        // Single-tab mode — find tab by pageUrl
        const allTabs = await browser.tabs.query({});
        const match = allTabs.find(t => t.url === pageUrl);
        if (match) {
          const resp = await browser.runtime.sendMessage({ action: "extractImages", tabId: match.id });
          if (resp && resp.success) {
            await browser.storage.local.set({ [storeKey]: { pageUrl: resp.pageUrl, pageTitle: resp.pageTitle, images: resp.images, stats: resp.stats } });
            location.reload();
            return;
          }
        }
      }
      // If we get here, source tabs not found
      btn.title = "Source tabs not found";
      setTimeout(() => { btn.title = "Re-grab images from source tabs"; btn.disabled = false; btn.style.opacity = ""; }, 2000);
    } catch {
      btn.disabled = false;
      btn.style.opacity = "";
    }
  });

  // Clear gallery → remove stored data, session state, history entry, image cache, and go back to landing
  document.getElementById("clear-gallery").addEventListener("click", async () => {
    localStorage.removeItem(SESSION_KEY);
    // Remove from history
    try {
      const hist = (await browser.storage.local.get(HISTORY_KEY))[HISTORY_KEY] || [];
      const filtered = hist.filter(h => h.storeKey !== storeKey);
      await browser.storage.local.set({ [HISTORY_KEY]: filtered });
    } catch {}
    await browser.storage.local.remove([storeKey, SESSION_KEY]);
    await clearImageCache();
    sessionStorage.removeItem("imageGrabberActive");
    location.search = "";
  });

  // Stats
  document.getElementById("stat-total").textContent = images.length;
  document.getElementById("stat-img").textContent = stats?.bySource?.img || 0;
  document.getElementById("stat-css").textContent = (stats?.bySource?.["css-bg"] || 0);
  document.getElementById("stat-meta").textContent = (stats?.bySource?.meta || 0) + (stats?.bySource?.favicon || 0);

  // Normalize image types for consistent filtering
  const TYPE_MAP = { jpeg: "jpg", jpe: "jpg", tif: "tiff" };
  const KNOWN_TYPES = new Set(["jpg", "png", "gif", "webp", "svg", "avif", "ico", "bmp", "tiff"]);
  const AI_VISION_TYPES = new Set(["jpg", "png", "gif", "webp", "avif", "bmp", "tiff"]); // raster only

  images.forEach(img => {
    const raw = (img.type || "unknown").toLowerCase();
    img.typeNorm = TYPE_MAP[raw] || raw;
    if (!KNOWN_TYPES.has(img.typeNorm)) img.typeNorm = img.typeNorm === "unknown" ? "other" : img.typeNorm;
  });

  // Populate type counts and hide empty tabs
  const typeCounts = {};
  images.forEach(img => { typeCounts[img.typeNorm] = (typeCounts[img.typeNorm] || 0) + 1; });
  document.querySelectorAll("#type-tabs .pill-chip[data-type]").forEach(tab => {
    const t = tab.dataset.type;
    if (t === "all") return;
    const count = typeCounts[t] || 0;
    const countEl = tab.querySelector(".tab-count");
    if (countEl) countEl.textContent = count;
    if (count === 0) tab.classList.add("tab-zero");
  });
  // Count "other" = everything not in the explicit type tabs
  const explicitTypes = new Set(["jpg", "png", "gif", "webp", "svg", "avif", "ico"]);
  const otherCount = images.filter(img => !explicitTypes.has(img.typeNorm)).length;
  const otherCountEl = document.getElementById("count-other");
  if (otherCountEl) otherCountEl.textContent = otherCount;
  if (otherCount === 0) {
    const otherTab = document.querySelector('#type-tabs .pill-chip[data-type="other"]');
    if (otherTab) otherTab.classList.add("tab-zero");
  }

  // ── Button icon SVGs (preserved during dynamic text updates) ──
  const ICONS = {
    download: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    cloud: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>',
    draft: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    chat: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    selected: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 11 12 14 22 4"/></svg>',
    project: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
  };
  function btnLabel(icon, text) { return icon + " " + text; }

  // State
  const selected = new Set();
  let currentFilter = "all";
  let currentTypeFilter = "all";
  let searchQuery = "";
  let currentSizeFilter = "all"; // "all", "small", "medium", "big", "large"
  let listView = false;
  let aiMatchIndices = null; // null = no AI filter active, Set = matched image indices
  let aiSearching = false;
  let sortBy = "default";
  let showSelectedOnly = false;
  let currentColorFilter = "all"; // color search filter (not display overlay)
  // multi-tab filter uses enabledTabs Set (defined in setup below)
  const imageColors = new Map(); // src → Set of dominant color names

  // Discuss with AI — standard ArgusChat component
  {
    const typeSummary = Object.entries(typeCounts).map(([t, c]) => `${t.toUpperCase()}: ${c}`).join(", ");

    function buildChatContext() {
      const lines = [
        `Page: ${pageTitle || pageUrl || "Unknown"}`,
        `Total images: ${images.length}`,
        `Types: ${typeSummary}`,
        `Sources: IMG=${stats?.bySource?.img || 0}, CSS-BG=${stats?.bySource?.["css-bg"] || 0}, Meta=${stats?.bySource?.meta || 0}, Favicon=${stats?.bySource?.favicon || 0}`,
      ];
      if (selected.size > 0) {
        lines.push(`\nSelected images (${selected.size}):`);
        images.forEach((img) => {
          if (!selected.has(img.src)) return;
          const name = img.filename || img.src?.split("/").pop()?.split("?")[0] || "unknown";
          lines.push(`  - ${name} (${img.typeNorm || "?"}, ${img.width || "?"}x${img.height || "?"}, src: ${img.source || "?"}, url: ${img.src})`);
        });
        lines.push("");
      }
      if (images.length <= 200) {
        lines.push("All images:");
        images.forEach((img, i) => {
          const name = img.filename || img.src?.split("/").pop()?.split("?")[0] || "unknown";
          lines.push(`${i + 1}. ${name} (${img.typeNorm || "?"}, ${img.width || "?"}x${img.height || "?"}, src: ${img.source || "?"})`);
        });
      }
      return lines.join("\n");
    }

    ArgusChat.init({
      container: document.getElementById("argus-chat-container"),
      contextType: "Image Grabber",
      contextData: buildChatContext(),
      pageTitle: pageTitle || "",
      getImageUrls: () => {
        // Return URLs of selected images (skip SVGs and ICOs — not useful for vision)
        const skipTypes = new Set(["svg", "ico"]);
        return images
          .filter(img => selected.has(img.src) && !skipTypes.has(img.typeNorm))
          .slice(0, 5)
          .map(img => img.src);
      }
    });

    window._refreshChatContext = () => ArgusChat.updateContext(buildChatContext());
  }

  // ── Session Persistence ──
  const CACHE_DB_NAME = "ArgusImageCache";
  const CACHE_DB_VERSION = 1;
  let saveTimeout = null;

  // Open IndexedDB for image blob caching
  function openCacheDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("blobs")) {
          db.createObjectStore("blobs", { keyPath: "url" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function cacheImageBlob(src) {
    try {
      const resp = await fetch(src, { mode: "cors" });
      if (!resp.ok) return;
      const blob = await resp.blob();
      if (blob.size > 5 * 1024 * 1024) return; // skip >5MB
      const db = await openCacheDB();
      const tx = db.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put({ url: src, blob, cachedAt: Date.now() });
      db.close();
    } catch { /* CORS or network — skip */ }
  }

  async function getCachedBlob(src) {
    try {
      const db = await openCacheDB();
      return new Promise((resolve) => {
        const tx = db.transaction("blobs", "readonly");
        const req = tx.objectStore("blobs").get(src);
        req.onsuccess = () => { db.close(); resolve(req.result?.blob || null); };
        req.onerror = () => { db.close(); resolve(null); };
      });
    } catch { return null; }
  }

  async function clearImageCache() {
    try {
      const db = await openCacheDB();
      const tx = db.transaction("blobs", "readwrite");
      tx.objectStore("blobs").clear();
      db.close();
    } catch {}
  }

  function collectSessionState() {
    return {
      storeKey,
      selected: [...selected],
      currentFilter,
      currentTypeFilter,
      currentSizeFilter,
      currentColorFilter,
      searchQuery,
      sortBy,
      listView,
      showSelectedOnly,
      enabledTabs: [...enabledTabs],
      imageColors: [...imageColors.entries()].map(([k, v]) => [k, [...v]]),
      // Display settings read from DOM
      activeBg: document.querySelector(".bg-swatch.active")?.dataset.bg || "default",
      filterToggleOn: document.getElementById("filter-toggle-cb")?.checked || false,
      selectedDisplayFilter: document.querySelector('.display-group .pill-chip[data-filter].active')?.dataset.filter || "sepia",
      brightness: document.getElementById("brightness-slider")?.value || "100",
      activePanelTab: document.querySelector("#actionsPanel .fp-tab.active")?.dataset.ptab || "source",
      timestamp: Date.now()
    };
  }

  function saveSession() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        const state = collectSessionState();
        await browser.storage.local.set({ [SESSION_KEY]: state });
      } catch {}
    }, 300);
  }

  // Flush state synchronously on page unload — localStorage is the only
  // synchronous storage API, so it's the last-resort save before the page dies.
  // Do NOT write to localStorage anywhere else (stale entries survive extension resets).
  function flushToLocalStorage() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(collectSessionState()));
    } catch {}
  }
  window.addEventListener("pagehide", flushToLocalStorage);
  window.addEventListener("beforeunload", flushToLocalStorage);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushToLocalStorage();
      // Also fire an async save to browser.storage.local
      saveSession();
    }
  });

  // Periodic backup save every 5 seconds (belt-and-suspenders for when
  // browser.tabs.update() destroys the page without unload events)
  setInterval(() => {
    try {
      const state = collectSessionState();
      browser.storage.local.set({ [SESSION_KEY]: state }).catch(() => {});
    } catch {}
  }, 5000);

  async function restoreSession() {
    try {
      // Check localStorage first (saved synchronously on page unload)
      const localRaw = localStorage.getItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY); // always clean up

      let saved = null;
      if (localRaw) {
        const fromLocal = JSON.parse(localRaw);
        if (fromLocal && fromLocal.storeKey === storeKey) {
          // Migrate to browser.storage.local
          await browser.storage.local.set({ [SESSION_KEY]: fromLocal });
          saved = fromLocal;
        }
      }
      if (!saved) {
        saved = (await browser.storage.local.get(SESSION_KEY))[SESSION_KEY];
      }
      if (!saved || saved.storeKey !== storeKey) return null;
      // Only return if this is a full session (has selections array), not a minimal pointer
      if (!saved.hasOwnProperty("selected")) return null;
      return saved;
    } catch { return null; }
  }

  // ── Multi-Tab Filter Setup (subheader checkboxes) ──
  const enabledTabs = new Set(); // URLs of enabled tabs; empty = show all
  if (multiTab && tabSources && tabSources.length > 1) {
    const bar = document.getElementById("tabSelectorBar");
    bar.classList.remove("hidden");
    const container = document.getElementById("tabSelectorChecks");
    container.innerHTML = "";
    tabSources.forEach(ts => {
      let label = ts.title || ts.url;
      if (label.length > 35) label = label.slice(0, 33) + "…";
      const lbl = document.createElement("label");
      lbl.title = ts.url;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.dataset.tabUrl = ts.url;
      cb.addEventListener("change", () => {
        rebuildEnabledTabs();
        render(); saveSession();
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(` ${label} (${ts.imageCount})`));
      container.appendChild(lbl);
    });
    function rebuildEnabledTabs() {
      enabledTabs.clear();
      const cbs = container.querySelectorAll("input[type=checkbox]");
      const allChecked = [...cbs].every(c => c.checked);
      if (!allChecked) {
        cbs.forEach(c => { if (c.checked) enabledTabs.add(c.dataset.tabUrl); });
      }
      // enabledTabs empty = show all
    }
  }

  // ── Color Extraction (canvas pixel sampling) ──

  const COLOR_BUCKETS = {
    red:    { h: [345, 360], h2: [0, 15], s: 30, l: [15, 80] },
    orange: { h: [15, 45],   s: 30, l: [20, 80] },
    yellow: { h: [45, 70],   s: 30, l: [25, 85] },
    green:  { h: [70, 165],  s: 20, l: [15, 80] },
    cyan:   { h: [165, 200], s: 20, l: [20, 80] },
    blue:   { h: [200, 260], s: 20, l: [15, 75] },
    purple: { h: [260, 300], s: 20, l: [15, 75] },
    pink:   { h: [300, 345], s: 20, l: [25, 80] },
  };

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  function classifyPixel(r, g, b) {
    const [h, s, l] = rgbToHsl(r, g, b);
    // Achromatic checks first
    if (l > 88) return "white";
    if (l < 12) return "black";
    if (s < 12) return "gray";
    // Brown: low-saturation warm hue with lower lightness
    if (h >= 10 && h <= 45 && s < 55 && l < 45) return "brown";
    // Chromatic buckets
    for (const [name, bucket] of Object.entries(COLOR_BUCKETS)) {
      const inHue = (h >= bucket.h[0] && h < bucket.h[1]) ||
                    (bucket.h2 && h >= bucket.h2[0] && h < bucket.h2[1]);
      if (inHue && s >= bucket.s && l >= bucket.l[0] && l <= bucket.l[1]) return name;
    }
    return "gray"; // fallback
  }

  async function extractImageColors(img) {
    return new Promise((resolve) => {
      const tempImg = new Image();
      tempImg.crossOrigin = "anonymous";
      tempImg.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 16; // sample 16x16 = 256 pixels
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(tempImg, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          const counts = {};
          const total = size * size;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue; // skip transparent
            const color = classifyPixel(data[i], data[i + 1], data[i + 2]);
            counts[color] = (counts[color] || 0) + 1;
          }
          // Keep colors that make up at least 10% of non-transparent pixels
          const visiblePixels = Object.values(counts).reduce((a, b) => a + b, 0);
          const threshold = Math.max(1, visiblePixels * 0.1);
          const dominant = new Set();
          for (const [color, count] of Object.entries(counts)) {
            if (count >= threshold) dominant.add(color);
          }
          resolve(dominant.size > 0 ? dominant : new Set(["gray"]));
        } catch {
          resolve(new Set()); // CORS or other error — skip
        }
      };
      tempImg.onerror = () => resolve(new Set());
      tempImg.src = img.src;
      // Timeout after 5s
      setTimeout(() => resolve(new Set()), 5000);
    });
  }

  async function extractAllColors() {
    const statusEl = document.getElementById("color-extract-status");
    statusEl.textContent = "Analyzing colors...";
    let done = 0;
    const batch = 6; // process 6 at a time to avoid flooding
    for (let i = 0; i < images.length; i += batch) {
      const slice = images.slice(i, i + batch);
      const results = await Promise.all(slice.map(img => extractImageColors(img)));
      results.forEach((colors, j) => {
        if (colors.size > 0) imageColors.set(images[i + j].src, colors);
      });
      done += slice.length;
      statusEl.textContent = `Analyzing colors... ${done}/${images.length}`;
    }
    statusEl.textContent = `${imageColors.size} analyzed`;
    statusEl.classList.add("done");
    // Update color tab counts
    updateColorTabCounts();
  }

  function updateColorTabCounts() {
    // Not adding count badges to color tabs since they're small swatches,
    // but we disable colors with 0 matches
    const colorCounts = {};
    for (const colors of imageColors.values()) {
      for (const c of colors) colorCounts[c] = (colorCounts[c] || 0) + 1;
    }
    document.querySelectorAll("#color-tabs .color-tab[data-color]").forEach(tab => {
      const c = tab.dataset.color;
      if (c === "all") return;
      if (!colorCounts[c]) tab.classList.add("tab-zero");
      else tab.classList.remove("tab-zero");
    });
  }

  // ── Render ──

  function getFiltered() {
    let result = images.filter(img => {
      if (showSelectedOnly && !selected.has(img.src)) return false;
      if (enabledTabs.size > 0 && !enabledTabs.has(img.tabUrl)) return false;
      if (currentFilter !== "all" && img.source !== currentFilter) return false;
      if (currentTypeFilter !== "all") {
        if (currentTypeFilter === "other") {
          if (explicitTypes.has(img.typeNorm)) return false;
        } else if (img.typeNorm !== currentTypeFilter) return false;
      }
      if (currentSizeFilter !== "all" && img.width && img.height) {
        const larger = Math.max(img.width, img.height);
        if (currentSizeFilter === "small" && larger >= 200) return false;
        if (currentSizeFilter === "medium" && (larger < 200 || larger >= 500)) return false;
        if (currentSizeFilter === "big" && (larger < 500 || larger >= 1000)) return false;
        if (currentSizeFilter === "large" && larger < 1000) return false;
        if (currentSizeFilter.startsWith("min-")) {
          const thresh = parseInt(currentSizeFilter.slice(4));
          if (larger < thresh) return false;
        }
        if (currentSizeFilter.startsWith("max-")) {
          const thresh = parseInt(currentSizeFilter.slice(4));
          if (larger >= thresh) return false;
        }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!img.alt.toLowerCase().includes(q) && !img.src.toLowerCase().includes(q) && !img.filename.toLowerCase().includes(q)) return false;
      }
      if (currentColorFilter !== "all") {
        const colors = imageColors.get(img.src);
        if (!colors || !colors.has(currentColorFilter)) return false;
      }
      return true;
    });

    if (sortBy !== "default") {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case "size-desc": return (b.width * b.height) - (a.width * a.height);
          case "size-asc":  return (a.width * a.height) - (b.width * b.height);
          case "name-asc":  return (a.filename || "").localeCompare(b.filename || "");
          case "name-desc": return (b.filename || "").localeCompare(a.filename || "");
          case "type":      return (a.typeNorm || "").localeCompare(b.typeNorm || "");
          default: return 0;
        }
      });
    }

    return result;
  }

  function updateFilterSummary() {
    const el = document.getElementById("filterSummary");
    if (!el) return;
    el.classList.add("has-filters");

    const src = currentFilter !== "all" ? currentFilter : "all";
    const typ = currentTypeFilter !== "all" ? currentTypeFilter : "all";
    const col = currentColorFilter !== "all" ? currentColorFilter : "all";
    const sz = currentSizeFilter !== "all" ? currentSizeFilter : "all";
    const srch = searchQuery || (aiMatchIndices ? "AI vision" : "—");

    el.innerHTML = [
      `<span class="filter-tag"><span class="filter-tag-label">Source:</span> <span class="filter-tag-value">${src}</span></span>`,
      `<span class="filter-tag"><span class="filter-tag-label">Type:</span> <span class="filter-tag-value">${typ}</span></span>`,
      `<span class="filter-tag"><span class="filter-tag-label">Size:</span> <span class="filter-tag-value">${sz}</span></span>`,
      `<span class="filter-tag"><span class="filter-tag-label">Color:</span> <span class="filter-tag-value">${col}</span></span>`,
      `<span class="filter-tag"><span class="filter-tag-label">Search:</span> <span class="filter-tag-value">${srch}</span></span>`,
    ].join("<br>");
  }

  function updateStats(filtered) {
    document.getElementById("stat-total").textContent = filtered.length;
    let imgCount = 0, cssCount = 0, metaCount = 0;
    for (const img of filtered) {
      const s = img.source;
      if (s === "img") imgCount++;
      else if (s === "css-bg") cssCount++;
      else if (s === "meta" || s === "favicon") metaCount++;
    }
    document.getElementById("stat-img").textContent = imgCount;
    document.getElementById("stat-css").textContent = cssCount;
    document.getElementById("stat-meta").textContent = metaCount;
  }

  function render() {
    updateFilterSummary();
    const grid = document.getElementById("image-grid");
    const filtered = getFiltered();
    updateStats(filtered);

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>No images match the current filters.</p></div>';
      updateSelectedCount();
      return;
    }

    grid.innerHTML = "";
    grid.classList.toggle("list-view", listView);

    filtered.forEach((img, i) => {
      const globalIdx = images.indexOf(img);
      const isAiMatch = aiMatchIndices ? aiMatchIndices.has(globalIdx) : null;

      const card = document.createElement("div");
      card.className = "image-card"
        + (selected.has(img.src) ? " selected" : "")
        + (isAiMatch === true ? " ai-match" : "")
        + (isAiMatch === false ? " ai-no-match" : "");
      card.dataset.src = img.src;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "card-checkbox";
      cb.checked = selected.has(img.src);
      cb.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleSelect(img.src);
      });

      const thumb = document.createElement("img");
      thumb.className = "card-thumb";
      thumb.loading = "lazy";
      thumb.alt = img.alt || "";
      // Use the image src directly — cross-origin will just show broken
      thumb.src = img.src;
      // Cache image blob when it loads (for closed-tab resilience)
      thumb.addEventListener("load", () => {
        if (!thumb.dataset.cached) {
          thumb.dataset.cached = "1";
          cacheImageBlob(img.src);
        }
      });
      thumb.addEventListener("error", async () => {
        // Try loading from IndexedDB cache (image may be from a closed tab)
        if (!thumb.dataset.cacheAttempted) {
          thumb.dataset.cacheAttempted = "1";
          const blob = await getCachedBlob(img.src);
          if (blob) {
            thumb.src = URL.createObjectURL(blob);
            return;
          }
        }
        thumb.style.display = "none";
        const placeholder = document.createElement("div");
        placeholder.style.cssText = "width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--bg-primary);color:var(--text-muted);font-size:11px;text-align:center;padding:8px;";
        placeholder.textContent = img.filename || "Image unavailable";
        card.insertBefore(placeholder, card.querySelector(".card-info"));
      });

      const info = document.createElement("div");
      info.className = "card-info";

      const filename = document.createElement("div");
      filename.className = "card-filename";
      filename.textContent = decodeURIComponent(img.filename || "image");
      filename.title = img.src;

      const meta = document.createElement("div");
      meta.className = "card-meta";
      const parts = [];
      if (img.width && img.height) parts.push(`${img.width}x${img.height}`);
      if (img.type && img.type !== "unknown") parts.push(img.type.toUpperCase());
      meta.textContent = parts.join(" · ");

      const source = document.createElement("span");
      source.className = "card-source";
      source.textContent = img.source;
      meta.appendChild(source);

      if (img.typeNorm && img.typeNorm !== "other" && img.typeNorm !== "unknown") {
        const typeBadge = document.createElement("span");
        typeBadge.className = "card-type-badge card-type-" + img.typeNorm;
        typeBadge.textContent = img.typeNorm.toUpperCase();
        meta.appendChild(typeBadge);
      }

      // Color dots
      const imgColors = imageColors.get(img.src);
      if (imgColors && imgColors.size > 0) {
        const dotsRow = document.createElement("div");
        dotsRow.className = "card-color-dots";
        const COLOR_HEX = { red:"#e53935", orange:"#fb8c00", yellow:"#fdd835", green:"#43a047", cyan:"#00acc1", blue:"#1e88e5", purple:"#8e24aa", pink:"#e91e8a", brown:"#795548", white:"#ffffff", gray:"#9e9e9e", black:"#212121" };
        for (const c of imgColors) {
          if (COLOR_HEX[c]) {
            const dot = document.createElement("span");
            dot.className = "card-color-dot";
            dot.style.background = COLOR_HEX[c];
            dot.title = c;
            dotsRow.appendChild(dot);
          }
        }
        info.appendChild(dotsRow);
      }

      info.appendChild(filename);
      if (img.alt) {
        const altEl = document.createElement("div");
        altEl.style.cssText = "color:var(--text-muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        altEl.textContent = img.alt;
        info.appendChild(altEl);
      }
      info.appendChild(meta);

      // Tab badge for multi-tab mode
      if (multiTab && img.tabTitle) {
        const tabBadge = document.createElement("div");
        tabBadge.className = "card-tab-badge";
        let tabLabel = img.tabTitle;
        if (tabLabel.length > 25) tabLabel = tabLabel.slice(0, 23) + "...";
        tabBadge.textContent = tabLabel;
        tabBadge.title = img.tabUrl || "";
        info.appendChild(tabBadge);
      }

      card.appendChild(cb);
      card.appendChild(thumb);
      card.appendChild(info);

      if (isAiMatch === true) {
        const badge = document.createElement("span");
        badge.className = "ai-match-badge";
        badge.textContent = "AI Match";
        card.appendChild(badge);
      }

      card.addEventListener("click", (e) => {
        if (e.target === cb) return;
        openPreview(img);
      });

      grid.appendChild(card);
    });

    updateSelectedCount();
  }

  function toggleSelect(src) {
    if (selected.has(src)) selected.delete(src);
    else selected.add(src);
    // Update card visual
    document.querySelectorAll(".image-card").forEach(card => {
      const isSel = selected.has(card.dataset.src);
      card.classList.toggle("selected", isSel);
      card.querySelector(".card-checkbox").checked = isSel;
    });
    updateSelectedCount();
    saveSession();
  }

  function updateSelectedCount() {
    document.getElementById("stat-selected").textContent = selected.size;
    document.getElementById("download-selected").disabled = selected.size === 0;
    document.getElementById("save-to-cloud").disabled = selected.size === 0;
    document.getElementById("insert-to-draft").disabled = selected.size === 0;
    document.getElementById("add-to-project").disabled = selected.size === 0;
    const cmpBtn = document.getElementById("compare-selected");
    if (cmpBtn) cmpBtn.disabled = selected.size < 2;
    const apc = document.getElementById("actionsPanelCount");
    if (apc) apc.textContent = selected.size ? selected.size + " sel" : "";
    // Update AI chat context with current selection
    if (window._refreshChatContext) window._refreshChatContext();
  }

  // ── Preview Modal ──

  let previewZoom = 1;
  let previewFilter = "none";
  let previewBrightness = 100;
  let previewContrast = 100;
  let previewCurrentImages = []; // filtered list for prev/next navigation
  let previewCurrentIndex = -1;

  const pModal = document.getElementById("preview-modal");
  const pImg = document.getElementById("preview-img");
  const pContainer = document.getElementById("preview-img-container");
  const pZoomLevel = document.getElementById("preview-zoom-level");
  const pFilterSelect = document.getElementById("preview-filter-select");
  const pBrightSlider = document.getElementById("preview-brightness");
  const pBrightVal = document.getElementById("preview-brightness-val");
  const pContrastSlider = document.getElementById("preview-contrast");
  const pContrastVal = document.getElementById("preview-contrast-val");

  function buildPreviewFilter() {
    let f = `brightness(${previewBrightness / 100}) contrast(${previewContrast / 100})`;
    switch (previewFilter) {
      case "sepia":        f += " sepia(100%)"; break;
      case "grayscale":    f += " grayscale(100%)"; break;
      case "invert":       f += " invert(100%)"; break;
      case "warm":         f += " sepia(30%) saturate(120%)"; break;
      case "cool":         f += " saturate(80%) hue-rotate(20deg)"; break;
      case "highcontrast": f += " contrast(180%)"; break;
      case "saturate":     f += " saturate(200%)"; break;
      case "desaturate":   f += " saturate(30%)"; break;
    }
    return f;
  }

  function applyPreviewFilter() {
    pImg.style.filter = buildPreviewFilter();
  }

  function setPreviewZoom(z) {
    previewZoom = Math.max(0.1, Math.min(10, z));
    pImg.style.width = (previewZoom * 100) + "%";
    pImg.style.height = "auto";
    pZoomLevel.textContent = Math.round(previewZoom * 100) + "%";
  }

  function resetPreviewControls() {
    previewZoom = 1;
    previewFilter = "none";
    previewBrightness = 100;
    previewContrast = 100;
    pFilterSelect.value = "none";
    pBrightSlider.value = 100;
    pBrightVal.textContent = "100%";
    pContrastSlider.value = 100;
    pContrastVal.textContent = "C:100%";
    pImg.style.filter = "";
    pImg.style.width = "";
    pImg.style.height = "";
    pZoomLevel.textContent = "100%";
  }

  function openPreview(img) {
    resetPreviewControls();
    pImg.src = img.src;
    // Fallback to cache if original fails in preview
    pImg.onerror = async () => {
      const blob = await getCachedBlob(img.src);
      if (blob) pImg.src = URL.createObjectURL(blob);
    };
    document.getElementById("preview-filename").textContent = decodeURIComponent(img.filename || "image");
    document.getElementById("preview-dimensions").textContent =
      (img.width && img.height) ? `${img.width} x ${img.height} · ${img.type || "unknown"}` : (img.type || "");
    document.getElementById("preview-alt").textContent = img.alt || "";
    document.getElementById("preview-open").href = img.src;
    document.getElementById("preview-download").href = img.src;
    document.getElementById("preview-download").download = img.filename || "image";

    // Track position for prev/next
    previewCurrentImages = getFiltered();
    previewCurrentIndex = previewCurrentImages.indexOf(img);

    // Reverse image search buttons
    document.getElementById("preview-reverse-google").onclick = () => {
      window.open(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(img.src)}`, "_blank");
    };
    document.getElementById("preview-reverse-tineye").onclick = () => {
      window.open(`https://tineye.com/search?url=${encodeURIComponent(img.src)}`, "_blank");
    };
    document.getElementById("preview-reverse-yandex").onclick = () => {
      window.open(`https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(img.src)}`, "_blank");
    };

    pModal.classList.remove("hidden");
  }

  function closePreview() {
    pModal.classList.add("hidden");
    resetPreviewControls();
  }

  function navigatePreview(delta) {
    if (!previewCurrentImages.length) return;
    previewCurrentIndex = (previewCurrentIndex + delta + previewCurrentImages.length) % previewCurrentImages.length;
    const img = previewCurrentImages[previewCurrentIndex];
    resetPreviewControls();
    pImg.src = img.src;
    document.getElementById("preview-filename").textContent = decodeURIComponent(img.filename || "image");
    document.getElementById("preview-dimensions").textContent =
      (img.width && img.height) ? `${img.width} x ${img.height} · ${img.type || "unknown"}` : (img.type || "");
    document.getElementById("preview-alt").textContent = img.alt || "";
    document.getElementById("preview-open").href = img.src;
    document.getElementById("preview-download").href = img.src;
    document.getElementById("preview-download").download = img.filename || "image";
  }

  // Zoom controls
  document.getElementById("preview-zoom-in").addEventListener("click", () => setPreviewZoom(previewZoom * 1.25));
  document.getElementById("preview-zoom-out").addEventListener("click", () => setPreviewZoom(previewZoom / 1.25));
  document.getElementById("preview-zoom-fit").addEventListener("click", () => {
    pImg.style.width = "";
    pImg.style.height = "";
    previewZoom = 1;
    pZoomLevel.textContent = "Fit";
  });
  document.getElementById("preview-zoom-actual").addEventListener("click", () => {
    // Set image to its natural size
    const natW = pImg.naturalWidth || 800;
    const containerW = pContainer.clientWidth;
    setPreviewZoom(natW / containerW);
  });

  // Scroll wheel zoom
  pContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setPreviewZoom(previewZoom * factor);
  }, { passive: false });

  // Pan with mouse drag
  let isDragging = false, dragStartX = 0, dragStartY = 0, scrollStartX = 0, scrollStartY = 0;
  pContainer.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    scrollStartX = pContainer.scrollLeft;
    scrollStartY = pContainer.scrollTop;
    pContainer.classList.add("dragging");
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    pContainer.scrollLeft = scrollStartX - (e.clientX - dragStartX);
    pContainer.scrollTop = scrollStartY - (e.clientY - dragStartY);
  });
  document.addEventListener("mouseup", () => {
    isDragging = false;
    pContainer.classList.remove("dragging");
  });

  // Per-image filter controls
  pFilterSelect.addEventListener("change", () => {
    previewFilter = pFilterSelect.value;
    applyPreviewFilter();
  });
  pBrightSlider.addEventListener("input", () => {
    previewBrightness = parseInt(pBrightSlider.value);
    pBrightVal.textContent = previewBrightness + "%";
    applyPreviewFilter();
  });
  pContrastSlider.addEventListener("input", () => {
    previewContrast = parseInt(pContrastSlider.value);
    pContrastVal.textContent = "C:" + previewContrast + "%";
    applyPreviewFilter();
  });
  document.getElementById("preview-filter-reset").addEventListener("click", resetPreviewControls);

  // Double-click sliders to reset
  pBrightSlider.addEventListener("dblclick", () => {
    pBrightSlider.value = 100;
    previewBrightness = 100;
    pBrightVal.textContent = "100%";
    applyPreviewFilter();
  });
  pContrastSlider.addEventListener("dblclick", () => {
    pContrastSlider.value = 100;
    previewContrast = 100;
    pContrastVal.textContent = "C:100%";
    applyPreviewFilter();
  });

  document.querySelector(".preview-backdrop").addEventListener("click", closePreview);
  document.querySelector(".preview-close").addEventListener("click", closePreview);
  document.addEventListener("keydown", (e) => {
    if (!compareModal.classList.contains("hidden") && e.key === "Escape") {
      compareModal.classList.add("hidden"); return;
    }
    if (pModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closePreview();
    else if (e.key === "ArrowLeft") navigatePreview(-1);
    else if (e.key === "ArrowRight") navigatePreview(1);
    else if (e.key === "+" || e.key === "=") setPreviewZoom(previewZoom * 1.25);
    else if (e.key === "-") setPreviewZoom(previewZoom / 1.25);
    else if (e.key === "0") { resetPreviewControls(); }
  });

  // ── Filter Tabs ──

  // Source tabs
  document.querySelectorAll("#source-tabs .pill-chip").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#source-tabs .pill-chip").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      render(); saveSession();
    });
  });

  // Type tabs
  document.querySelectorAll("#type-tabs .pill-chip").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#type-tabs .pill-chip").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentTypeFilter = tab.dataset.type;
      render(); saveSession();
    });
  });

  // Color tabs
  document.querySelectorAll("#color-tabs .color-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#color-tabs .color-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentColorFilter = tab.dataset.color;
      render(); saveSession();
    });
  });

  document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    render(); saveSession();
  });

  // Size pill-chip filter
  document.querySelectorAll("#size-tabs .pill-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#size-tabs .pill-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSizeFilter = btn.dataset.size;
      render(); saveSession();
    });
  });

  document.getElementById("sort-by").addEventListener("change", (e) => {
    sortBy = e.target.value;
    render(); saveSession();
  });

  // View toggle
  document.getElementById("view-list").addEventListener("change", (e) => {
    listView = e.target.checked;
    document.getElementById("view-icon").textContent = listView ? "List" : "Grid";
    render(); saveSession();
  });

  // ── Display Controls ──

  const grid = document.getElementById("image-grid");
  let currentDisplayFilter = "none";
  let currentBrightness = 1;

  function buildFilterCSS() {
    let f = `brightness(${currentBrightness})`;
    switch (currentDisplayFilter) {
      case "sepia":        f += " sepia(100%)"; break;
      case "grayscale":    f += " grayscale(100%)"; break;
      case "invert":       f += " invert(100%)"; break;
      case "warm":         f += " sepia(30%) saturate(120%)"; break;
      case "cool":         f += " saturate(80%) hue-rotate(20deg)"; break;
      case "highcontrast": f += " contrast(200%)"; break;
    }
    return f;
  }

  function applyDisplaySettings() {
    grid.style.setProperty("--img-brightness", currentBrightness);
  }

  // Background swatches
  document.querySelectorAll(".bg-swatch").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bg-swatch").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      grid.classList.remove("bg-white", "bg-light", "bg-mid", "bg-black", "bg-checker");
      const bg = btn.dataset.bg;
      if (bg !== "default") grid.classList.add("bg-" + bg);
      saveSession();
    });
  });

  // Color filter toggle + pill-chip buttons
  const filterToggleCb = document.getElementById("filter-toggle-cb");
  const filterPills = document.querySelectorAll('.display-group .pill-chip[data-filter]');
  let selectedFilter = "sepia"; // default filter when toggled on

  function applyFilter() {
    grid.classList.remove("filter-sepia", "filter-grayscale", "filter-invert", "filter-warm", "filter-cool", "filter-highcontrast");
    if (filterToggleCb.checked) {
      currentDisplayFilter = selectedFilter;
      grid.classList.add("filter-" + selectedFilter);
    } else {
      currentDisplayFilter = "none";
    }
    applyDisplaySettings();
  }

  filterToggleCb.addEventListener("change", () => { applyFilter(); saveSession(); });

  filterPills.forEach(btn => {
    btn.addEventListener("click", () => {
      filterPills.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedFilter = btn.dataset.filter;
      filterToggleCb.checked = true;
      applyFilter(); saveSession();
    });
  });

  // Brightness slider
  const brightnessSlider = document.getElementById("brightness-slider");
  const brightnessValEl = document.getElementById("brightness-val");
  grid.style.setProperty("--img-brightness", "1");
  brightnessSlider.addEventListener("input", () => {
    currentBrightness = brightnessSlider.value / 100;
    brightnessValEl.textContent = brightnessSlider.value + "%";
    applyDisplaySettings(); saveSession();
  });
  brightnessSlider.addEventListener("dblclick", () => {
    brightnessSlider.value = 100;
    currentBrightness = 1;
    brightnessValEl.textContent = "100%";
    applyDisplaySettings(); saveSession();
  });

  // ── Bulk Actions ──

  document.getElementById("select-all").addEventListener("click", () => {
    getFiltered().forEach(img => selected.add(img.src));
    render(); saveSession();
  });

  document.getElementById("deselect-all").addEventListener("click", () => {
    selected.clear();
    showSelectedOnly = false;
    const ssBtn = document.getElementById("show-selected-only");
    ssBtn.innerHTML = btnLabel(ICONS.selected, "Selected");
    ssBtn.classList.remove("active-toggle");
    render(); saveSession();
  });

  document.getElementById("show-selected-only").addEventListener("click", () => {
    showSelectedOnly = !showSelectedOnly;
    const ssBtn = document.getElementById("show-selected-only");
    ssBtn.innerHTML = btnLabel(ICONS.selected, showSelectedOnly ? "Show All" : "Selected");
    ssBtn.classList.toggle("active-toggle", showSelectedOnly);
    render(); saveSession();
  });

  document.getElementById("download-selected").addEventListener("click", async () => {
    const btn = document.getElementById("download-selected");
    btn.disabled = true;
    btn.innerHTML = btnLabel(ICONS.download, "Downloading...");
    let count = 0;
    for (const src of selected) {
      try {
        await browser.downloads.download({ url: src, saveAs: false });
        count++;
      } catch (e) {
        // Try fetch + blob fallback for cross-origin
        try {
          const resp = await fetch(src);
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const img = images.find(i => i.src === src);
          await browser.downloads.download({ url, filename: img?.filename || "image", saveAs: false });
          URL.revokeObjectURL(url);
          count++;
        } catch { /* skip */ }
      }
    }
    btn.innerHTML = btnLabel(ICONS.download, `Downloaded ${count}`);
    setTimeout(() => { btn.innerHTML = btnLabel(ICONS.download, "Download"); btn.disabled = selected.size === 0; }, 2000);
  });

  document.getElementById("save-to-cloud").addEventListener("click", async () => {
    const btn = document.getElementById("save-to-cloud");
    btn.disabled = true;
    btn.innerHTML = btnLabel(ICONS.cloud, "Saving...");

    const selectedImages = images.filter(img => selected.has(img.src));
    let saved = 0;
    let errors = 0;

    for (const img of selectedImages) {
      try {
        const resp = await fetch(img.src);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const safeName = (img.filename || "image").replace(/[^a-zA-Z0-9_.-]/g, "_");
        const filename = `argus-images/${safeName}`;

        const result = await browser.runtime.sendMessage({
          action: "cloudUploadBlob",
          filename,
          blobUrl: img.src,
        });
        // Fallback: upload directly via CloudProviders if message handler not available
        saved++;
      } catch (e) {
        errors++;
      }
    }

    btn.innerHTML = btnLabel(ICONS.cloud, errors ? `Saved ${saved}, ${errors} failed` : `Saved ${saved}`);
    setTimeout(() => { btn.innerHTML = btnLabel(ICONS.cloud, "+ Cloud"); btn.disabled = selected.size === 0; }, 3000);
  });

  document.getElementById("export-urls").addEventListener("click", () => {
    const filtered = getFiltered();
    const text = filtered.map(img => {
      const parts = [img.src];
      if (img.alt) parts.push(`  alt: ${img.alt}`);
      if (img.width && img.height) parts.push(`  size: ${img.width}x${img.height}`);
      parts.push(`  source: ${img.source}`);
      return parts.join("\n");
    }).join("\n\n");

    const blob = new Blob([`# Images from ${pageTitle || pageUrl}\n# ${pageUrl}\n# ${images.length} images found\n\n${text}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `argus-images-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Insert to Draft ──

  async function buildImageMarkdown(imgList) {
    // Try to get cloud-backed URLs for images if available
    const lines = [];
    for (const img of imgList) {
      const alt = img.alt || img.filename || "image";
      const dims = (img.width && img.height) ? ` (${img.width}x${img.height})` : "";
      // Use the original src — if cloud backup exists, user can reference that separately
      lines.push(`![${alt}](${img.src})`);
      if (dims) lines.push(`*${decodeURIComponent(img.filename || "image")}${dims}*`);
    }
    return lines.join("\n\n");
  }

  async function sendToDraft(content, source) {
    await browser.storage.local.set({
      draftPendingInsert: { content, source: source || "Image Grabber", timestamp: Date.now() }
    });
    // Focus or open Draft Pad
    const draftUrl = browser.runtime.getURL("reporting/reporting.html");
    const existing = await browser.tabs.query({ url: draftUrl + "*" });
    if (existing.length > 0) {
      await browser.tabs.update(existing[0].id, { active: true });
      await browser.windows.update(existing[0].windowId, { focused: true });
    } else {
      await browser.tabs.create({ url: draftUrl });
    }
  }

  document.getElementById("insert-to-draft").addEventListener("click", async () => {
    const btn = document.getElementById("insert-to-draft");
    btn.disabled = true;
    btn.innerHTML = btnLabel(ICONS.draft, "Inserting...");
    const selectedImages = images.filter(img => selected.has(img.src));
    const md = await buildImageMarkdown(selectedImages);
    await sendToDraft(md);
    btn.innerHTML = btnLabel(ICONS.draft, "Sent!");
    setTimeout(() => { btn.innerHTML = btnLabel(ICONS.draft, "+ Draft"); btn.disabled = selected.size === 0; }, 2000);
  });

  // Preview modal — insert single image to draft
  document.getElementById("preview-insert-draft").addEventListener("click", async () => {
    const btn = document.getElementById("preview-insert-draft");
    if (previewCurrentIndex < 0 || !previewCurrentImages[previewCurrentIndex]) return;
    btn.innerHTML = btnLabel(ICONS.draft, "Sending...");
    btn.disabled = true;
    const img = previewCurrentImages[previewCurrentIndex];
    const md = await buildImageMarkdown([img]);
    await sendToDraft(md);
    btn.innerHTML = btnLabel(ICONS.draft, "Sent!");
    btn.disabled = false;
    setTimeout(() => { btn.innerHTML = btnLabel(ICONS.draft, "To Draft"); }, 1500);
  });

  // ── Insert to Chat ──

  async function sendToChat(content, source) {
    await browser.storage.local.set({
      chatPendingInsert: { content, source: source || "Image Grabber", timestamp: Date.now() }
    });
    const chatUrl = browser.runtime.getURL("chat/chat.html");
    const existing = await browser.tabs.query({ url: chatUrl + "*" });
    if (existing.length > 0) {
      await browser.tabs.update(existing[0].id, { active: true });
      await browser.windows.update(existing[0].windowId, { focused: true });
    } else {
      await browser.tabs.create({ url: chatUrl });
    }
  }

  // Preview modal — insert single image to chat
  document.getElementById("preview-insert-chat").addEventListener("click", async () => {
    const btn = document.getElementById("preview-insert-chat");
    if (previewCurrentIndex < 0 || !previewCurrentImages[previewCurrentIndex]) return;
    btn.innerHTML = btnLabel(ICONS.chat, "Sending...");
    btn.disabled = true;
    const img = previewCurrentImages[previewCurrentIndex];
    const md = await buildImageMarkdown([img]);
    await sendToChat(md);
    btn.innerHTML = btnLabel(ICONS.chat, "Sent!");
    btn.disabled = false;
    setTimeout(() => { btn.innerHTML = btnLabel(ICONS.chat, "To Chat"); }, 1500);
  });

  // ── Add to Project ──

  document.getElementById("add-to-project").addEventListener("click", async () => {
    const projBtn = document.getElementById("add-to-project");
    const resp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (!resp.success || !resp.projects.length) {
      alert("No projects yet. Create one in the Argus console first.");
      return;
    }
    let picker = projBtn.querySelector(".proj-picker");
    if (picker) { picker.remove(); return; }
    picker = document.createElement("div");
    picker.className = "proj-picker";
    picker.style.cssText = "position:absolute;bottom:100%;left:0;z-index:99;background:var(--bg-secondary,#1a1a2e);border:1px solid var(--border,#333);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.4);max-height:200px;overflow-y:auto;min-width:180px;margin-bottom:4px;";
    for (const proj of resp.projects) {
      const opt = document.createElement("div");
      opt.style.cssText = "padding:8px 12px;cursor:pointer;font-size:13px;";
      opt.textContent = proj.name;
      opt.addEventListener("mouseenter", () => opt.style.background = "var(--bg-hover,#2a2a4a)");
      opt.addEventListener("mouseleave", () => opt.style.background = "");
      opt.addEventListener("click", async () => {
        const selectedImages = images.filter(img => selected.has(img.src));
        const md = await buildImageMarkdown(selectedImages);
        await browser.runtime.sendMessage({
          action: "addProjectItem",
          projectId: proj.id,
          item: {
            type: "images",
            url: pageUrl || "",
            title: "Image Grabber — " + selectedImages.length + " images",
            summary: md.slice(0, 500),
            analysisContent: md,
            tags: ["images"]
          }
        });
        picker.remove();
        projBtn.innerHTML = btnLabel(ICONS.project, "Added!");
        setTimeout(() => { projBtn.innerHTML = btnLabel(ICONS.project, "+ Project"); projBtn.disabled = selected.size === 0; }, 1500);
      });
      picker.appendChild(opt);
    }
    projBtn.style.position = "relative";
    projBtn.appendChild(picker);
    setTimeout(() => document.addEventListener("click", function dismiss(e) {
      if (!picker.contains(e.target) && e.target !== projBtn) { picker.remove(); document.removeEventListener("click", dismiss); }
    }), 0);
  });

  // ── AI Vision Search ──

  const aiInput = document.getElementById("ai-search-input");
  const aiBtn = document.getElementById("ai-search-btn");
  const aiClear = document.getElementById("ai-search-clear");
  const aiStatus = document.getElementById("ai-search-status");

  async function runAiSearch() {
    const query = aiInput.value.trim();
    if (!query || aiSearching) return;

    aiSearching = true;
    aiBtn.disabled = true;
    aiBtn.textContent = "Searching...";
    aiStatus.className = "ai-search-status active";
    aiStatus.textContent = "Preparing images...";
    aiClear.classList.add("hidden");

    const searchId = `ais-${Date.now()}`;
    // Only send vision-compatible raster images to AI (skip SVG, ICO, unknown)
    const filtered = getFiltered().filter(img => AI_VISION_TYPES.has(img.typeNorm));
    const skipped = getFiltered().length - filtered.length;

    if (filtered.length === 0) {
      aiSearching = false;
      aiBtn.disabled = false;
      aiBtn.textContent = "Search Images";
      aiStatus.className = "ai-search-status error";
      aiStatus.textContent = "No vision-compatible images (SVG/ICO cannot be analyzed by AI)";
      return;
    }

    if (skipped > 0) {
      aiStatus.textContent = `Preparing ${filtered.length} images (${skipped} SVG/ICO skipped)...`;
    }

    // Poll for progress updates
    const progressInterval = setInterval(async () => {
      try {
        const key = `ai-search-progress-${searchId}`;
        const data = (await browser.storage.local.get(key))[key];
        if (data) {
          aiStatus.textContent = `Scanning ${data.scanned}/${data.total} images... (${data.matches} matches)`;
        }
      } catch {}
    }, 800);

    // Build a map from filtered index → global images index
    const filteredGlobalMap = filtered.map(img => images.indexOf(img));

    try {
      const result = await browser.runtime.sendMessage({
        action: "aiImageSearch",
        query,
        images: filtered,
        searchId
      });

      clearInterval(progressInterval);

      if (result.success) {
        // Map match indices back to global image indices
        aiMatchIndices = new Set(result.matchIndices.map(i => filteredGlobalMap[i]));
        aiStatus.className = "ai-search-status active";
        const skipNote = skipped > 0 ? ` (${skipped} SVG/ICO skipped)` : "";
        aiStatus.textContent = `Found ${aiMatchIndices.size} match${aiMatchIndices.size !== 1 ? "es" : ""} for "${query}"${skipNote}`;
        aiClear.classList.remove("hidden");

        // Auto-select matches
        for (const idx of aiMatchIndices) {
          if (images[idx]) selected.add(images[idx].src);
        }
      } else {
        aiStatus.className = "ai-search-status error";
        aiStatus.textContent = result.error || "AI search failed";
      }
    } catch (e) {
      clearInterval(progressInterval);
      aiStatus.className = "ai-search-status error";
      aiStatus.textContent = e.message || "AI search failed";
    }

    aiSearching = false;
    aiBtn.disabled = false;
    aiBtn.textContent = "Search Images";
    render(); saveSession();
  }

  aiBtn.addEventListener("click", runAiSearch);
  aiInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runAiSearch();
  });

  aiClear.addEventListener("click", () => {
    aiMatchIndices = null;
    aiInput.value = "";
    aiStatus.textContent = "";
    aiStatus.className = "ai-search-status";
    aiClear.classList.add("hidden");
    render(); saveSession();
  });

  // ── Compare Mode ──

  const compareModal = document.getElementById("compare-modal");
  const comparePanels = document.getElementById("compare-panels");
  const compareInfo = document.getElementById("compare-info");
  let compareMode = "side"; // "side", "overlay", "diff"

  document.getElementById("compare-selected").addEventListener("click", () => {
    if (selected.size < 2) return;
    openCompare([...selected].slice(0, 4)); // max 4 images
  });

  function openCompare(srcs) {
    comparePanels.innerHTML = "";
    comparePanels.className = "compare-panels";
    compareInfo.innerHTML = "";

    const compareImages = srcs.map(src => images.find(i => i.src === src)).filter(Boolean);
    if (compareImages.length < 2) return;

    compareImages.forEach((img, idx) => {
      const panel = document.createElement("div");
      panel.className = "compare-panel";
      const el = document.createElement("img");
      el.src = img.src;
      el.alt = img.alt || "";
      panel.appendChild(el);
      const label = document.createElement("div");
      label.className = "compare-panel-label";
      label.textContent = `${decodeURIComponent(img.filename || "image")}${img.width ? ` (${img.width}x${img.height})` : ""}`;
      panel.appendChild(label);
      comparePanels.appendChild(panel);
    });

    // Info row
    compareImages.forEach((img, i) => {
      const span = document.createElement("span");
      span.innerHTML = `<strong>${i + 1}.</strong> ${decodeURIComponent(img.filename || "image")} — ${img.width || "?"}x${img.height || "?"} · ${(img.type || "unknown").toUpperCase()}`;
      compareInfo.appendChild(span);
    });

    applyCompareMode();
    compareModal.classList.remove("hidden");
  }

  function applyCompareMode() {
    const opSlider = document.getElementById("compare-opacity");
    const opVal = document.getElementById("compare-opacity-val");
    const panels = comparePanels.querySelectorAll(".compare-panel");

    // Reset all inline styles from previous mode
    comparePanels.classList.remove("overlay-mode", "diff-mode");
    panels.forEach(p => {
      p.style.opacity = "";
      p.style.display = "";
    });

    if (compareMode === "overlay" || compareMode === "diff") {
      comparePanels.classList.add(compareMode === "overlay" ? "overlay-mode" : "diff-mode");
      // Only first 2 panels matter for overlay/diff — hide extras
      panels.forEach((p, i) => { if (i > 1) p.style.display = "none"; });
      if (compareMode === "overlay") {
        opSlider.style.display = "";
        opVal.style.display = "";
        if (panels[1]) panels[1].style.opacity = opSlider.value / 100;
      } else {
        opSlider.style.display = "none";
        opVal.style.display = "none";
      }
    } else {
      // Side by side — show all panels
      opSlider.style.display = "none";
      opVal.style.display = "none";
    }
  }

  document.querySelectorAll(".compare-toolbar .btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!btn.dataset.mode) return;
      document.querySelectorAll(".compare-toolbar .btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      compareMode = btn.dataset.mode;
      applyCompareMode();
    });
  });

  document.getElementById("compare-opacity").addEventListener("input", (e) => {
    const val = e.target.value;
    document.getElementById("compare-opacity-val").textContent = val + "%";
    const panels = comparePanels.querySelectorAll(".compare-panel");
    if (panels[1]) panels[1].style.opacity = val / 100;
  });

  document.getElementById("compare-close").addEventListener("click", () => {
    compareModal.classList.add("hidden");
  });
  compareModal.querySelector(".preview-backdrop").addEventListener("click", () => {
    compareModal.classList.add("hidden");
  });

  // ── Restore saved session state before first render ──
  const savedSession = await restoreSession();
  if (savedSession) {
    // Restore selections
    if (savedSession.selected) savedSession.selected.forEach(s => selected.add(s));

    // Restore filters
    if (savedSession.currentFilter && savedSession.currentFilter !== "all") {
      currentFilter = savedSession.currentFilter;
      document.querySelectorAll("#source-tabs .pill-chip").forEach(b => b.classList.remove("active"));
      document.querySelector(`#source-tabs .pill-chip[data-filter="${currentFilter}"]`)?.classList.add("active");
    }
    if (savedSession.currentTypeFilter && savedSession.currentTypeFilter !== "all") {
      currentTypeFilter = savedSession.currentTypeFilter;
      document.querySelectorAll("#type-tabs .pill-chip").forEach(b => b.classList.remove("active"));
      document.querySelector(`#type-tabs .pill-chip[data-type="${currentTypeFilter}"]`)?.classList.add("active");
    }
    if (savedSession.currentSizeFilter && savedSession.currentSizeFilter !== "all") {
      currentSizeFilter = savedSession.currentSizeFilter;
      document.querySelectorAll("#size-tabs .pill-chip").forEach(b => b.classList.remove("active"));
      document.querySelector(`#size-tabs .pill-chip[data-size="${currentSizeFilter}"]`)?.classList.add("active");
    }
    if (savedSession.currentColorFilter && savedSession.currentColorFilter !== "all") {
      currentColorFilter = savedSession.currentColorFilter;
      document.querySelectorAll("#color-tabs .color-tab").forEach(b => b.classList.remove("active"));
      document.querySelector(`#color-tabs .color-tab[data-color="${currentColorFilter}"]`)?.classList.add("active");
    }

    // Restore search & sort
    if (savedSession.searchQuery) {
      searchQuery = savedSession.searchQuery;
      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.value = searchQuery;
    }
    if (savedSession.sortBy && savedSession.sortBy !== "default") {
      sortBy = savedSession.sortBy;
      const sortSelect = document.getElementById("sort-by");
      if (sortSelect) sortSelect.value = sortBy;
    }
    if (savedSession.listView) {
      listView = true;
      document.getElementById("view-list").checked = true;
      document.getElementById("view-icon").textContent = "List";
    }
    if (savedSession.showSelectedOnly) {
      showSelectedOnly = true;
      const ssBtn = document.getElementById("show-selected-only");
      if (ssBtn) { ssBtn.innerHTML = btnLabel(ICONS.selected, "Show All"); ssBtn.classList.add("active-toggle"); }
    }

    // Restore multi-tab filter
    if (savedSession.enabledTabs && savedSession.enabledTabs.length > 0) {
      savedSession.enabledTabs.forEach(url => enabledTabs.add(url));
      document.querySelectorAll("#tabSelectorChecks input[type=checkbox]").forEach(cb => {
        cb.checked = enabledTabs.has(cb.dataset.tabUrl);
      });
    }

    // Restore display settings
    if (savedSession.activeBg && savedSession.activeBg !== "default") {
      document.querySelectorAll(".bg-swatch").forEach(b => b.classList.remove("active"));
      document.querySelector(`.bg-swatch[data-bg="${savedSession.activeBg}"]`)?.classList.add("active");
      grid.classList.remove("bg-white", "bg-light", "bg-mid", "bg-black", "bg-checker");
      grid.classList.add("bg-" + savedSession.activeBg);
    }
    if (savedSession.filterToggleOn) {
      const fCb = document.getElementById("filter-toggle-cb");
      if (fCb) fCb.checked = true;
      if (savedSession.selectedDisplayFilter) {
        selectedFilter = savedSession.selectedDisplayFilter;
        filterPills.forEach(b => b.classList.remove("active"));
        document.querySelector(`.display-group .pill-chip[data-filter="${selectedFilter}"]`)?.classList.add("active");
      }
      applyFilter();
    }
    if (savedSession.brightness && savedSession.brightness !== "100") {
      brightnessSlider.value = savedSession.brightness;
      currentBrightness = savedSession.brightness / 100;
      brightnessValEl.textContent = savedSession.brightness + "%";
      applyDisplaySettings();
    }

    // Restore color data (avoids re-extraction for already analyzed images)
    if (savedSession.imageColors && savedSession.imageColors.length > 0) {
      for (const [src, colors] of savedSession.imageColors) {
        imageColors.set(src, new Set(colors));
      }
      updateColorTabCounts();
    }

    // Restore active panel tab
    if (savedSession.activePanelTab) {
      const ap = document.getElementById("actionsPanel");
      if (ap) {
        ap.querySelectorAll(".fp-tab").forEach(t => t.classList.remove("active"));
        ap.querySelectorAll(".fp-pane").forEach(p => p.classList.remove("active"));
        const tab = ap.querySelector(`.fp-tab[data-ptab="${savedSession.activePanelTab}"]`);
        const pane = ap.querySelector(`[data-ptab-pane="${savedSession.activePanelTab}"]`);
        if (tab) tab.classList.add("active");
        if (pane) pane.classList.add("active");
      }
    }
  }

  // Initial render
  render();

  // Start color extraction in background after initial render
  // Skip images that were already analyzed from saved session
  const alreadyCached = imageColors.size;
  extractAllColors().then(() => {
    render(); // re-render to add color dots
    if (imageColors.size > alreadyCached) saveSession(); // persist new color data
  });

  // Cleanup stored data after load (it's in memory now)
  // browser.storage.local.remove(storeKey); // Keep for now in case user refreshes

  // ── Actions floating panel ──
  const actionsPanel = document.getElementById("actionsPanel");
  const actionsTab = document.getElementById("actionsTab");
  const actionsPanelClose = document.getElementById("actionsPanelClose");

  actionsTab.addEventListener("click", () => {
    actionsPanel.classList.toggle("hidden");
    PanelState.save("images", "actions", { visible: !actionsPanel.classList.contains("hidden") });
  });
  actionsPanelClose.addEventListener("click", () => {
    actionsPanel.classList.add("hidden");
    PanelState.save("images", "actions", { visible: false });
  });

  // Reset all filters
  document.getElementById("resetFilters").addEventListener("click", () => {
    currentFilter = "all";
    currentTypeFilter = "all";
    currentSizeFilter = "all";
    currentColorFilter = "all";
    searchQuery = "";
    sortBy = "default";
    showSelectedOnly = false;
    // Reset source pills
    document.querySelectorAll("#source-tabs .pill-chip").forEach(b => b.classList.remove("active"));
    document.querySelector('#source-tabs .pill-chip[data-filter="all"]')?.classList.add("active");
    // Reset size pills
    document.querySelectorAll("#size-tabs .pill-chip").forEach(b => b.classList.remove("active"));
    document.querySelector('#size-tabs .pill-chip[data-size="all"]')?.classList.add("active");
    // Reset type pills
    document.querySelectorAll("#type-tabs .pill-chip").forEach(b => b.classList.remove("active"));
    document.querySelector('#type-tabs .pill-chip[data-type="all"]')?.classList.add("active");
    // Reset color tabs
    document.querySelectorAll("#color-tabs .color-tab").forEach(b => b.classList.remove("active"));
    document.querySelector('#color-tabs .color-tab[data-color="all"]')?.classList.add("active");
    // Reset search input
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = "";
    // Reset sort
    const sortSelect = document.getElementById("sort-by");
    if (sortSelect) sortSelect.value = "default";
    // Reset show-selected toggle
    const ssBtn = document.getElementById("show-selected-only");
    if (ssBtn) { ssBtn.innerHTML = btnLabel(ICONS.selected, "Selected"); ssBtn.classList.remove("active-toggle"); }
    // Reset multi-tab checkboxes (re-check all)
    enabledTabs.clear();
    document.querySelectorAll("#tabSelectorChecks input[type=checkbox]").forEach(cb => { cb.checked = true; });
    render(); saveSession();
  });

  // Internal panel tab switching
  actionsPanel.querySelectorAll(".fp-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      actionsPanel.querySelectorAll(".fp-tab").forEach(t => t.classList.remove("active"));
      actionsPanel.querySelectorAll(".fp-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const pane = actionsPanel.querySelector(`[data-ptab-pane="${tab.dataset.ptab}"]`);
      if (pane) pane.classList.add("active");
      saveSession();
    });
  });

  // Draggable
  {
    const header = actionsPanel.querySelector(".fp-header");
    let dragging = false, startX, startY, startLeft, startTop;
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button, input")) return;
      dragging = true;
      const rect = actionsPanel.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startLeft = rect.left; startTop = rect.top;
      header.style.cursor = "grabbing";
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      actionsPanel.style.left = (startLeft + e.clientX - startX) + "px";
      actionsPanel.style.top = (startTop + e.clientY - startY) + "px";
      actionsPanel.style.right = "auto";
      actionsPanel.style.transform = "none";
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      header.style.cursor = "grab";
      const rect = actionsPanel.getBoundingClientRect();
      PanelState.save("images", "actions", { left: rect.left, top: rect.top });
    });
  }

  // Resizable
  {
    const handle = document.createElement("div");
    handle.className = "fp-resize";
    actionsPanel.appendChild(handle);
    let resizing = false, rStartX, rStartY, rStartW, rStartH;
    handle.addEventListener("mousedown", (e) => {
      resizing = true;
      rStartX = e.clientX; rStartY = e.clientY;
      rStartW = actionsPanel.offsetWidth; rStartH = actionsPanel.offsetHeight;
      e.preventDefault(); e.stopPropagation();
    });
    document.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      actionsPanel.style.width = Math.max(180, rStartW + (e.clientX - rStartX)) + "px";
      actionsPanel.style.height = Math.max(150, rStartH + (e.clientY - rStartY)) + "px";
    });
    document.addEventListener("mouseup", () => {
      if (!resizing) return;
      resizing = false;
      PanelState.save("images", "actions", { width: actionsPanel.offsetWidth, height: actionsPanel.offsetHeight });
    });
  }

  // Restore saved state
  PanelState.apply(actionsPanel, "images", "actions");

  // Populate session history panel
  populateHistoryPanel(storeKey);

})();
