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

document.addEventListener("DOMContentLoaded", () => {
  loadHistory();
  attachListeners();
});

function attachListeners() {
  elements.searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = elements.searchInput.value.trim();
      if (query) {
        searchHistory(query);
      } else {
        loadHistory();
      }
    }, 300);
  });

  elements.clearAll.addEventListener("click", async () => {
    if (!confirm("Clear all analysis history? This cannot be undone.")) return;
    await browser.runtime.sendMessage({ action: "clearHistory" });
    loadHistory();
  });

  elements.detailClose.addEventListener("click", closeDetail);
  elements.detailOverlay.addEventListener("click", (e) => {
    if (e.target === elements.detailOverlay) closeDetail();
  });

  elements.detailCopy.addEventListener("click", () => {
    if (!currentItem) return;
    navigator.clipboard.writeText(currentItem.content).then(() => {
      elements.detailCopy.textContent = "Copied!";
      setTimeout(() => { elements.detailCopy.textContent = "Copy Markdown"; }, 1500);
    });
  });

  elements.detailExportMd.addEventListener("click", () => {
    if (!currentItem) return;
    exportAsMarkdown(currentItem.content, (currentItem.pageTitle || "analysis") + ".md");
  });

  elements.detailExportHtml.addEventListener("click", () => {
    if (!currentItem) return;
    exportAsHTML(currentItem.content, currentItem.pageTitle || "analysis");
  });

  elements.detailDelete.addEventListener("click", async () => {
    if (!currentItem) return;
    await browser.runtime.sendMessage({ action: "deleteHistoryItem", id: currentItem.id });
    closeDetail();
    loadHistory();
  });
}

async function loadHistory() {
  const resp = await browser.runtime.sendMessage({ action: "getHistory", page: 0, perPage: 200 });
  if (!resp || !resp.success) {
    const errDiv = document.createElement("div");
    errDiv.className = "empty-text";
    errDiv.textContent = "Failed to load history.";
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
    emptyDiv.textContent = "No analysis history yet.";
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

    const preview = (item.content || "").substring(0, 120).replace(/[#*_`]/g, "");

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
    provSpan.textContent = item.provider || "";
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

  const date = new Date(item.timestamp);
  const timeStr = date.toLocaleString();
  let meta = `${timeStr} | ${item.provider || "?"} | ${item.model || "?"} | ${item.presetLabel || item.preset || "?"}`;
  if (item.usage) {
    meta += ` | Tokens: ${item.usage.prompt_tokens || "?"} in / ${item.usage.completion_tokens || "?"} out`;
  }
  elements.detailMeta.textContent = meta;

  if (item.thinking) {
    elements.detailThinking.classList.remove("hidden");
    elements.detailThinkingContent.textContent = item.thinking;
  } else {
    elements.detailThinking.classList.add("hidden");
  }

  const parsed = new DOMParser().parseFromString(marked.parse(item.content || ""), "text/html");
  elements.detailContent.replaceChildren(...parsed.body.childNodes);

  elements.detailOverlay.classList.remove("hidden");
}

function closeDetail() {
  elements.detailOverlay.classList.add("hidden");
  currentItem = null;
}

function escapeHtml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
