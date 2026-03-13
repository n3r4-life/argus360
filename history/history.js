const elements = {
  historyList: document.getElementById("history-list"),
  searchInput: document.getElementById("search-input"),
  clearAll: document.getElementById("clear-all"),
  detailOverlay: document.getElementById("detail-overlay"),
  detailTitle: document.getElementById("detail-title"),
  detailUrl: document.getElementById("detail-url"),
  detailMeta: document.getElementById("detail-meta"),
  detailThinking: document.getElementById("detail-thinking"),
  detailThinkingContent: document.getElementById("detail-thinking-content"),
  detailContent: document.getElementById("detail-content"),
  detailClose: document.getElementById("detail-close"),
  detailCopy: document.getElementById("detail-copy"),
  detailExportMd: document.getElementById("detail-export-md"),
  detailExportHtml: document.getElementById("detail-export-html"),
  detailDelete: document.getElementById("detail-delete"),
};

let currentItem = null;
let searchTimeout = null;
let projectMap = new Map(); // historyId → [{ name, color }]
let allProjects = []; // full project objects for feed tab
let feedActiveProject = null; // null = "All", or projectId
let feedLoaded = false;

document.addEventListener("DOMContentLoaded", async () => {
  await loadProjectMap();
  loadFeed();
  attachListeners();

  // Live data refresh — auto-update when background data changes
  let _refreshDebounce = null;
  browser.runtime.onMessage.addListener((message) => {
    if (message.type !== "argusDataChanged") return;
    if (message.store !== "history" && message.store !== "projects" && message.store !== "monitors") return;
    if (_refreshDebounce) clearTimeout(_refreshDebounce);
    _refreshDebounce = setTimeout(async () => {
      _refreshDebounce = null;
      if (message.store === "projects" || message.store === "history") await loadProjectMap();
      const activeTab = document.querySelector(".history-tab.active");
      if (activeTab && activeTab.dataset.tab === "feed") {
        loadFeed();
      } else if (activeTab && activeTab.dataset.tab === "monitors") {
        allMonitorChanges = null;
        monitorChangesLoaded = false;
        loadMonitorChanges();
      } else {
        loadHistory();
      }
    }, 500);
  });
});

async function loadProjectMap() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (!resp || !resp.success) return;
    allProjects = resp.projects || [];
    projectMap.clear();
    for (const proj of allProjects) {
      if (!proj.items) continue;
      for (const item of proj.items) {
        if (!item.refId) continue;
        if (!projectMap.has(item.refId)) projectMap.set(item.refId, []);
        projectMap.get(item.refId).push({ name: proj.name, color: proj.color || "#a0a0b0" });
      }
    }
  } catch { /* ignore */ }
}

// ── Project Feed ──
async function loadFeed(query) {
  feedLoaded = true;
  const feedItems = document.getElementById("feed-items");
  const bar = document.getElementById("feed-project-bar");

  // Fetch projects + monitor changes in parallel
  const [projResp, histResp, monResp] = await Promise.all([
    browser.runtime.sendMessage({ action: "getProjects" }),
    browser.runtime.sendMessage({ action: "getHistory", page: 0, perPage: 500 }),
    browser.runtime.sendMessage({ action: "getAllMonitorChanges" }),
  ]);

  allProjects = (projResp?.success && projResp.projects) ? projResp.projects : [];
  const historyItems = (histResp?.success && histResp.history) ? histResp.history : [];
  const monitorChanges = (monResp?.success && monResp.changes) ? monResp.changes : [];

  // Build URL → project lookup for matching monitor changes to projects
  const urlToProjects = new Map();
  for (const proj of allProjects) {
    for (const item of (proj.items || [])) {
      if (!item.url) continue;
      if (!urlToProjects.has(item.url)) urlToProjects.set(item.url, []);
      urlToProjects.get(item.url).push(proj);
    }
  }

  // Build unified feed entries
  let entries = [];

  // Project items (analyses, links, notes, bookmarks)
  for (const proj of allProjects) {
    for (const item of (proj.items || [])) {
      entries.push({
        kind: item.analysisContent ? "analysis" : (item.type || "url"),
        title: item.title || item.url || "Untitled",
        url: item.url || "",
        summary: item.analysisContent ? (item.analysisContent.substring(0, 280).replace(/[#*_`]/g, "")) : (item.summary || item.notes || ""),
        preset: item.analysisPreset || "",
        date: item.addedAt || proj.createdAt || 0,
        projectId: proj.id,
        projectName: proj.name,
        projectColor: proj.color || "#a0a0b0",
        refId: item.refId,
        _item: item,
        _proj: proj,
      });
    }
  }

  // Monitor changes matched to projects
  for (const change of monitorChanges) {
    const matchedProjs = urlToProjects.get(change.monitorUrl) || [];
    if (matchedProjs.length) {
      for (const proj of matchedProjs) {
        entries.push({
          kind: "monitor",
          title: change.monitorTitle || "Monitor Change",
          url: change.monitorUrl || "",
          summary: (change.aiSummary || change.newTextSnippet || "").substring(0, 280),
          preset: "",
          date: change.detectedAt || 0,
          projectId: proj.id,
          projectName: proj.name,
          projectColor: proj.color || "#a0a0b0",
          _change: change,
        });
      }
    } else {
      entries.push({
        kind: "monitor",
        title: change.monitorTitle || "Monitor Change",
        url: change.monitorUrl || "",
        summary: (change.aiSummary || change.newTextSnippet || "").substring(0, 280),
        preset: "",
        date: change.detectedAt || 0,
        projectId: null,
        projectName: null,
        projectColor: null,
        _change: change,
      });
    }
  }

  // History items not in any project
  const projRefIds = new Set();
  for (const proj of allProjects) {
    for (const item of (proj.items || [])) {
      if (item.refId) projRefIds.add(item.refId);
    }
  }
  for (const h of historyItems) {
    if (projRefIds.has(h.id)) continue; // already included via project
    entries.push({
      kind: "analysis",
      title: h.pageTitle || "Untitled",
      url: h.pageUrl || "",
      summary: (h.content || "").substring(0, 280).replace(/[#*_`]/g, ""),
      preset: h.presetLabel || h.preset || "",
      date: h.timestamp || 0,
      projectId: null,
      projectName: null,
      projectColor: null,
      _historyItem: h,
    });
  }

  // Search filter
  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(e =>
      (e.title || "").toLowerCase().includes(q) ||
      (e.url || "").toLowerCase().includes(q) ||
      (e.summary || "").toLowerCase().includes(q) ||
      (e.projectName || "").toLowerCase().includes(q)
    );
  }

  // Sort by date descending
  entries.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Render project filter pills
  bar.replaceChildren();
  const allPill = document.createElement("button");
  allPill.className = "feed-project-pill" + (feedActiveProject === null ? " active" : "");
  allPill.textContent = `All (${entries.length})`;
  allPill.addEventListener("click", () => { feedActiveProject = null; loadFeed(query); });
  bar.appendChild(allPill);

  for (const proj of allProjects) {
    const count = entries.filter(e => e.projectId === proj.id).length;
    if (!count) continue;
    const pill = document.createElement("button");
    pill.className = "feed-project-pill" + (feedActiveProject === proj.id ? " active" : "");
    const dot = document.createElement("span");
    dot.className = "pill-dot";
    dot.style.background = proj.color || "#a0a0b0";
    pill.appendChild(dot);
    pill.appendChild(document.createTextNode(`${proj.name} (${count})`));
    pill.addEventListener("click", () => { feedActiveProject = proj.id; loadFeed(query); });
    bar.appendChild(pill);
  }

  // Unassigned pill
  const unassignedCount = entries.filter(e => e.projectId === null).length;
  if (unassignedCount) {
    const pill = document.createElement("button");
    pill.className = "feed-project-pill" + (feedActiveProject === "__none__" ? " active" : "");
    pill.textContent = `Unassigned (${unassignedCount})`;
    pill.addEventListener("click", () => { feedActiveProject = "__none__"; loadFeed(query); });
    bar.appendChild(pill);
  }

  // Filter by selected project
  let visible = entries;
  if (feedActiveProject === "__none__") {
    visible = entries.filter(e => e.projectId === null);
  } else if (feedActiveProject !== null) {
    visible = entries.filter(e => e.projectId === feedActiveProject);
  }

  // Render entries
  feedItems.replaceChildren();
  if (!visible.length) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-text";
    emptyDiv.textContent = "No items yet.";
    feedItems.appendChild(emptyDiv);
    return;
  }

  // Group by project when showing "All"
  if (feedActiveProject === null && allProjects.length) {
    const grouped = new Map();
    for (const e of visible) {
      const key = e.projectId || "__none__";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(e);
    }

    // Projects first, then unassigned
    for (const proj of allProjects) {
      const items = grouped.get(proj.id);
      if (!items || !items.length) continue;
      renderFeedGroup(feedItems, proj.name, proj.color || "#a0a0b0", items);
    }
    const unassigned = grouped.get("__none__");
    if (unassigned && unassigned.length) {
      renderFeedGroup(feedItems, "Unassigned", "#6a6a80", unassigned);
    }
  } else {
    for (const entry of visible) {
      feedItems.appendChild(buildFeedCard(entry));
    }
  }
}

function renderFeedGroup(container, name, color, items) {
  const header = document.createElement("div");
  header.className = "feed-group-header";
  const dot = document.createElement("span");
  dot.className = "feed-group-dot";
  dot.style.background = color;
  header.appendChild(dot);
  header.appendChild(document.createTextNode(name));
  const countSpan = document.createElement("span");
  countSpan.className = "feed-group-count";
  countSpan.textContent = `(${items.length})`;
  header.appendChild(countSpan);
  container.appendChild(header);

  for (const entry of items) {
    container.appendChild(buildFeedCard(entry));
  }
}

function buildFeedCard(entry) {
  const div = document.createElement("div");
  const isLink = entry.kind === "url" || entry.kind === "bookmark" || entry.kind === "feed";
  const isNote = entry.kind === "note";
  div.className = "history-item" + (isLink ? " feed-link" : "") + (isNote ? " feed-note" : "");

  div.addEventListener("click", () => {
    if (entry._historyItem) {
      openDetail(entry._historyItem);
    } else if (entry._change) {
      openMonitorChangeDetail(entry._change);
    } else if (entry._item && entry._item.analysisContent) {
      // Open analysis content inline
      currentItem = {
        id: entry._item.refId || entry._item.id,
        content: entry._item.analysisContent,
        pageTitle: entry.title,
        pageUrl: entry.url,
        presetLabel: entry.preset,
      };
      openDetail(currentItem);
    } else if (entry.url) {
      window.open(entry.url, "_blank");
    }
  });

  const info = document.createElement("div");
  info.className = "history-item-info";

  const titleDiv = document.createElement("div");
  titleDiv.className = "history-item-title";
  titleDiv.textContent = entry.title;

  const metaDiv = document.createElement("div");
  metaDiv.className = "history-item-meta";

  if (entry.date) {
    const date = new Date(entry.date);
    const timeSpan = document.createElement("span");
    timeSpan.textContent = date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    metaDiv.appendChild(timeSpan);
  }

  // Type badge
  const badge = document.createElement("span");
  badge.className = "history-badge";
  if (entry.kind === "analysis") {
    badge.textContent = entry.preset || "Analysis";
  } else if (entry.kind === "monitor") {
    badge.className += " monitor";
    badge.textContent = "Monitor";
  } else if (entry.kind === "note") {
    badge.className += " note";
    badge.textContent = "Note";
  } else if (entry.kind === "bookmark") {
    badge.className += " bookmark";
    badge.textContent = "Bookmark";
  } else {
    badge.className += " link";
    badge.textContent = "Link";
  }
  metaDiv.appendChild(badge);

  // Project tag (when not filtered to a specific project)
  if (entry.projectName && feedActiveProject === null) {
    const projTag = document.createElement("span");
    projTag.className = "history-project-tag";
    const projDot = document.createElement("span");
    projDot.className = "history-project-dot";
    projDot.style.background = entry.projectColor;
    projTag.appendChild(projDot);
    projTag.appendChild(document.createTextNode(entry.projectName));
    metaDiv.appendChild(projTag);
  }

  info.appendChild(titleDiv);
  info.appendChild(metaDiv);

  // Summary / preview (abbreviated for links)
  if (entry.summary) {
    const previewDiv = document.createElement("div");
    previewDiv.className = isLink ? "history-item-preview" : "history-item-preview";
    previewDiv.textContent = isLink ? entry.summary.substring(0, 100) : entry.summary.substring(0, 280);
    info.appendChild(previewDiv);
  } else if (entry.url && isLink) {
    const urlDiv = document.createElement("div");
    urlDiv.className = "history-item-preview";
    urlDiv.textContent = entry.url;
    info.appendChild(urlDiv);
  }

  div.appendChild(info);
  return div;
}

function attachListeners() {
  elements.searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = elements.searchInput.value.trim();
      const activeTab = document.querySelector(".history-tab.active");
      if (activeTab && activeTab.dataset.tab === "feed") {
        loadFeed(query);
      } else if (activeTab && activeTab.dataset.tab === "monitors") {
        loadMonitorChanges(query);
      } else if (query) {
        searchHistory(query);
      } else {
        loadHistory();
      }
    }, 300);
  });

  elements.clearAll.addEventListener("click", async () => {
    if (!confirm("Clear all reports? This cannot be undone.")) return;
    await browser.runtime.sendMessage({ action: "clearHistory" });
    loadHistory();
  });

  elements.detailClose.addEventListener("click", closeDetail);
  elements.detailOverlay.addEventListener("click", (e) => {
    if (e.target === elements.detailOverlay) closeDetail();
  });

  IntelligenceViewer.initExportButtons({
    copyBtn: elements.detailCopy,
    mdBtn: elements.detailExportMd,
    htmlBtn: elements.detailExportHtml,
    txtBtn: document.getElementById("detail-export-txt"),
    printBtn: document.getElementById("detail-print"),
    getMarkdown: () => currentItem ? currentItem.content : "",
    getTitle: () => currentItem ? (currentItem.pageTitle || "analysis") : "analysis",
  });

  elements.detailDelete.addEventListener("click", async () => {
    if (!currentItem) return;
    await browser.runtime.sendMessage({ action: "deleteHistoryItem", id: currentItem.id });
    closeDetail();
    loadHistory();
  });

  const projBtn = document.getElementById("detail-add-project");
  projBtn.addEventListener("click", async () => {
    if (!currentItem) return;
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
        await browser.runtime.sendMessage({
          action: "addProjectItem",
          projectId: proj.id,
          item: {
            type: "analysis",
            refId: currentItem.id,
            url: currentItem.pageUrl || "",
            title: currentItem.pageTitle || "Analysis",
            summary: (currentItem.content || "").slice(0, 500),
            analysisContent: currentItem.content || "",
            analysisPreset: currentItem.presetLabel || currentItem.preset || "",
            tags: [currentItem.presetLabel || "analysis"]
          }
        });
        picker.remove();
        projBtn.textContent = "Added!";
        setTimeout(() => { projBtn.textContent = "+ Project"; }, 1500);
      });
      picker.appendChild(opt);
    }
    projBtn.appendChild(picker);
    setTimeout(() => document.addEventListener("click", function dismiss(e) {
      if (!picker.contains(e.target) && e.target !== projBtn) { picker.remove(); document.removeEventListener("click", dismiss); }
    }), 0);
  });

  // ── Share buttons ──
  function getShareSnippet() {
    if (!currentItem) return "";
    const lines = (currentItem.content || "").split("\n")
      .map(l => l.replace(/^#{1,6}\s+/g, "").replace(/\*\*|__/g, "").replace(/[*_`>\[\]()!]/g, "").replace(/^[-•]\s+/g, "").trim())
      .filter(l => l.length > 30 && !/^(summary|source|url|article|publication|http)/i.test(l));
    const snippet = lines.slice(0, 2).join(" ").trim().replace(/—/g, "-");
    return snippet.length > 180 ? snippet.slice(0, 177) + "..." : snippet;
  }

  function getShareAttrib() {
    if (!currentItem) return "Argus";
    const name = IntelligenceViewer.providerLabel(currentItem.provider);
    return name ? `Argus w/ ${name}` : "Argus";
  }

  document.getElementById("detail-share-x").addEventListener("click", () => {
    if (!currentItem) return;
    const url = currentItem.pageUrl || "";
    const title = currentItem.pageTitle || "this page";
    const attrib = getShareAttrib();
    const text = url
      ? `${title}\n\n${getShareSnippet()}\n\n- ${attrib}\n${url}`
      : `${title}\n\n${getShareSnippet()}\n\n- ${attrib}`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank");
  });

  document.getElementById("detail-share-reddit").addEventListener("click", () => {
    if (!currentItem) return;
    const url = currentItem.pageUrl || "";
    const attrib = getShareAttrib();
    const title = `${currentItem.pageTitle || "Analysis"} - ${attrib}`;
    if (url) {
      window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, "_blank");
    } else {
      window.open(`https://www.reddit.com/submit?selftext=true&title=${encodeURIComponent(title)}&text=${encodeURIComponent(getShareSnippet() + "\n\n- " + attrib)}`, "_blank");
    }
  });

  document.getElementById("detail-share-linkedin").addEventListener("click", () => {
    if (!currentItem) return;
    const url = currentItem.pageUrl;
    if (url) window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank");
  });

  document.getElementById("detail-share-email").addEventListener("click", () => {
    if (!currentItem) return;
    const url = currentItem.pageUrl || "";
    const attrib = getShareAttrib();
    const subject = `${currentItem.pageTitle || "Analysis"} - ${attrib}`;
    const body = url
      ? `${getShareSnippet()}\n\nSource: ${url}\n\n- ${attrib}`
      : `${getShareSnippet()}\n\n- ${attrib}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  });
}

async function loadHistory() {
  const resp = await browser.runtime.sendMessage({ action: "getHistory", page: 0, perPage: 200 });
  if (!resp || !resp.success) {
    const errDiv = document.createElement("div");
    errDiv.className = "empty-text";
    errDiv.textContent = "Failed to load reports.";
    elements.historyList.replaceChildren(errDiv);
    return;
  }
  renderHistory(resp.history, resp.total);
}

async function searchHistory(query) {
  const resp = await browser.runtime.sendMessage({ action: "searchHistory", query });
  if (!resp || !resp.success) return;
  renderHistory(resp.history, resp.total);
}

function renderHistory(items, total) {
  if (!items.length) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-text";
    emptyDiv.textContent = "No reports yet.";
    elements.historyList.replaceChildren(emptyDiv);
    return;
  }

  elements.historyList.replaceChildren();

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.addEventListener("click", () => openDetail(item));

    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const preview = (item.content || "").substring(0, 280).replace(/[#*_`]/g, "");

    const info = document.createElement("div");
    info.className = "history-item-info";

    const titleDiv = document.createElement("div");
    titleDiv.className = "history-item-title";
    titleDiv.textContent = item.pageTitle || "Untitled";

    const metaDiv = document.createElement("div");
    metaDiv.className = "history-item-meta";
    const timeSpan = document.createElement("span");
    timeSpan.textContent = timeStr;
    const provSpan = document.createElement("span");
    provSpan.textContent = IntelligenceViewer.providerLabel(item.provider);
    const modelSpan = document.createElement("span");
    modelSpan.textContent = item.model || "";
    metaDiv.appendChild(timeSpan);
    metaDiv.appendChild(provSpan);
    metaDiv.appendChild(modelSpan);

    const badge = document.createElement("span");
    badge.className = "history-badge";
    badge.textContent = item.presetLabel || item.preset || "Analysis";
    metaDiv.appendChild(badge);
    if (item.isSelection) {
      const selBadge = document.createElement("span");
      selBadge.className = "history-badge selection";
      selBadge.textContent = "Selection";
      metaDiv.appendChild(selBadge);
    }
    if (item.autoAnalyzed) {
      const autoBadge = document.createElement("span");
      autoBadge.className = "history-badge auto";
      autoBadge.textContent = "Auto";
      metaDiv.appendChild(autoBadge);
    }

    const previewDiv = document.createElement("div");
    previewDiv.className = "history-item-preview";
    previewDiv.textContent = preview;

    info.appendChild(titleDiv);
    info.appendChild(metaDiv);

    // Project association tags
    const projects = projectMap.get(item.id);
    if (projects && projects.length) {
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "history-project-tags";
      for (const proj of projects) {
        const tag = document.createElement("span");
        tag.className = "history-project-tag";
        const dot = document.createElement("span");
        dot.className = "history-project-dot";
        dot.style.background = proj.color;
        tag.appendChild(dot);
        tag.appendChild(document.createTextNode(proj.name));
        tagsDiv.appendChild(tag);
      }
      info.appendChild(tagsDiv);
    }

    info.appendChild(previewDiv);
    div.appendChild(info);

    elements.historyList.appendChild(div);
  });

  if (total > items.length) {
    const more = document.createElement("div");
    more.className = "loading-text";
    more.textContent = `Showing ${items.length} of ${total} entries`;
    elements.historyList.appendChild(more);
  }
}

function openDetail(item) {
  currentItem = item;
  elements.detailTitle.textContent = item.pageTitle || "Untitled";
  elements.detailUrl.textContent = item.pageUrl || "";
  elements.detailUrl.href = item.pageUrl || "#";

  elements.detailMeta.textContent = IntelligenceViewer.formatMeta({
    timestamp: item.timestamp,
    provider: item.provider,
    model: item.model,
    presetLabel: item.presetLabel || item.preset,
    usage: item.usage,
  });

  IntelligenceViewer.updateThinking(elements.detailThinking, elements.detailThinkingContent, item.thinking);
  IntelligenceViewer.renderMarkdown(item.content, elements.detailContent);

  elements.detailOverlay.classList.remove("hidden");
}

function closeDetail() {
  elements.detailOverlay.classList.add("hidden");
  currentItem = null;
}

// ── Monitor changes clear button ──
const clearMonitorBtn = document.getElementById("clear-monitor-changes");
clearMonitorBtn.addEventListener("click", async () => {
  if (!confirm("Clear all monitor change history? This cannot be undone.")) return;
  await browser.runtime.sendMessage({ action: "clearAllMonitorChanges" });
  allMonitorChanges = null;
  monitorChangesLoaded = false;
  loadMonitorChanges();
});

// ── Tab switching ──
const feedList = document.getElementById("feed-list");
const monitorList = document.getElementById("monitor-changes-list");
let monitorChangesLoaded = false;
let historyLoaded = false;

document.querySelectorAll(".history-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".history-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    feedList.style.display = "none";
    elements.historyList.style.display = "none";
    monitorList.style.display = "none";
    elements.clearAll.style.display = "none";
    clearMonitorBtn.style.display = "none";
    if (which === "feed") {
      feedList.style.display = "";
      elements.searchInput.placeholder = "Search project feed...";
      if (!feedLoaded) loadFeed();
    } else if (which === "analysis") {
      elements.historyList.style.display = "";
      elements.searchInput.placeholder = "Search reports...";
      elements.clearAll.style.display = "";
      if (!historyLoaded) { historyLoaded = true; loadHistory(); }
    } else {
      monitorList.style.display = "";
      elements.searchInput.placeholder = "Search monitor changes...";
      clearMonitorBtn.style.display = "";
      if (!monitorChangesLoaded) { monitorChangesLoaded = true; loadMonitorChanges(); }
    }
  });
});

let allMonitorChanges = null;

async function loadMonitorChanges(query) {
  if (!allMonitorChanges) {
    const resp = await browser.runtime.sendMessage({ action: "getAllMonitorChanges" });
    if (!resp || !resp.success) {
      monitorList.replaceChildren();
      const errDiv = document.createElement("div");
      errDiv.className = "empty-text";
      errDiv.textContent = "Failed to load monitor changes.";
      monitorList.appendChild(errDiv);
      return;
    }
    allMonitorChanges = resp.changes;
  }
  let filtered = allMonitorChanges;
  if (query) {
    const q = query.toLowerCase();
    filtered = allMonitorChanges.filter(c =>
      (c.monitorTitle || "").toLowerCase().includes(q) ||
      (c.monitorUrl || "").toLowerCase().includes(q) ||
      (c.aiSummary || "").toLowerCase().includes(q) ||
      (c.newTextSnippet || "").toLowerCase().includes(q)
    );
  }
  renderMonitorChanges(filtered);
}

function renderMonitorChanges(changes) {
  monitorList.replaceChildren();

  if (!changes.length) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-text";
    emptyDiv.textContent = "No monitor changes detected yet.";
    monitorList.appendChild(emptyDiv);
    return;
  }

  changes.forEach(change => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.addEventListener("click", () => openMonitorChangeDetail(change));

    const date = new Date(change.detectedAt);
    const timeStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const info = document.createElement("div");
    info.className = "history-item-info";

    const titleDiv = document.createElement("div");
    titleDiv.className = "history-item-title";
    titleDiv.textContent = change.monitorTitle || "Unknown monitor";

    const metaDiv = document.createElement("div");
    metaDiv.className = "history-item-meta";
    const timeSpan = document.createElement("span");
    timeSpan.textContent = timeStr;
    metaDiv.appendChild(timeSpan);

    if (change.monitorUrl) {
      const urlSpan = document.createElement("span");
      urlSpan.textContent = change.monitorUrl.replace(/^https?:\/\//, "").substring(0, 50);
      urlSpan.style.opacity = "0.7";
      metaDiv.appendChild(urlSpan);
    }

    const badge = document.createElement("span");
    badge.className = "history-badge monitor";
    badge.textContent = "Monitor Change";
    metaDiv.appendChild(badge);

    const previewDiv = document.createElement("div");
    previewDiv.className = "change-summary";
    previewDiv.textContent = change.aiSummary
      ? change.aiSummary.substring(0, 280)
      : (change.newTextSnippet || "").substring(0, 280).replace(/\s+/g, " ");

    info.appendChild(titleDiv);
    info.appendChild(metaDiv);
    info.appendChild(previewDiv);
    div.appendChild(info);
    monitorList.appendChild(div);
  });
}

function openMonitorChangeDetail(change) {
  currentItem = {
    content: buildMonitorChangeMarkdown(change),
    pageTitle: change.monitorTitle || "Monitor Change",
    pageUrl: change.monitorUrl || "",
  };
  elements.detailTitle.textContent = change.monitorTitle || "Monitor Change";
  elements.detailUrl.textContent = change.monitorUrl || "";
  elements.detailUrl.href = change.monitorUrl || "#";

  const date = new Date(change.detectedAt);
  elements.detailMeta.textContent = `Detected: ${date.toLocaleString()} | Monitor ID: ${change.monitorId}`;

  IntelligenceViewer.updateThinking(elements.detailThinking, elements.detailThinkingContent, null);
  IntelligenceViewer.renderMarkdown(currentItem.content, elements.detailContent);
  elements.detailOverlay.classList.remove("hidden");
}

function buildMonitorChangeMarkdown(change) {
  let md = "";
  if (change.aiSummary) {
    md += `## AI Summary\n\n${change.aiSummary}\n\n`;
  }
  md += `## Change Details\n\n`;
  md += `- **Detected:** ${new Date(change.detectedAt).toLocaleString()}\n`;
  md += `- **URL:** ${change.monitorUrl || "N/A"}\n\n`;
  if (change.oldTextSnippet && change.newTextSnippet) {
    md += `### Previous Content\n\n\`\`\`\n${change.oldTextSnippet.substring(0, 2000)}\n\`\`\`\n\n`;
    md += `### Current Content\n\n\`\`\`\n${change.newTextSnippet.substring(0, 2000)}\n\`\`\`\n`;
  }
  return md;
}
