const elements = {
  feedList: document.getElementById("feed-list"),
  entryList: document.getElementById("entry-list"),
  emptyState: document.getElementById("empty-state"),
  currentFeedTitle: document.getElementById("current-feed-title"),
  entryCount: document.getElementById("entry-count"),
  markAllRead: document.getElementById("mark-all-read"),
  refreshFeeds: document.getElementById("refresh-feeds"),
};

let activeFeedId = null;
let feeds = [];
let entries = [];

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const feedIdParam = params.get("feedId");
  if (feedIdParam) {
    activeFeedId = feedIdParam;
  }

  loadFeeds();

  elements.refreshFeeds.addEventListener("click", () => {
    loadFeeds();
  });

  elements.markAllRead.addEventListener("click", markAllRead);
});

async function loadFeeds() {
  const response = await browser.runtime.sendMessage({ action: "getFeeds" });
  if (!response || !response.success) return;

  feeds = response.feeds || [];
  renderFeedList();
  loadEntries();
}

async function loadEntries() {
  const msg = { action: "getFeedEntries" };
  if (activeFeedId) {
    msg.feedId = activeFeedId;
  }

  const response = await browser.runtime.sendMessage(msg);
  if (!response || !response.success) {
    entries = [];
    renderEntries();
    return;
  }

  entries = response.entries || [];
  renderEntries();
}

function renderFeedList() {
  elements.feedList.replaceChildren();

  // "All Feeds" item
  const allItem = document.createElement("div");
  allItem.className = "feed-item" + (!activeFeedId ? " active" : "");
  allItem.addEventListener("click", () => {
    activeFeedId = null;
    elements.currentFeedTitle.textContent = "All Feeds";
    renderFeedList();
    loadEntries();
    updateUrlParam(null);
  });

  const allName = document.createElement("span");
  allName.className = "feed-item-name";
  allName.textContent = "All Feeds";
  allItem.appendChild(allName);

  const totalUnread = feeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);
  if (totalUnread > 0) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = totalUnread;
    allItem.appendChild(badge);
  }

  elements.feedList.appendChild(allItem);

  feeds.forEach(feed => {
    const item = document.createElement("div");
    item.className = "feed-item" + (activeFeedId === feed.id ? " active" : "");
    item.addEventListener("click", () => {
      activeFeedId = feed.id;
      elements.currentFeedTitle.textContent = feed.title || feed.url;
      renderFeedList();
      loadEntries();
      updateUrlParam(feed.id);
    });

    const name = document.createElement("span");
    name.className = "feed-item-name";
    name.textContent = feed.title || feed.url;
    item.appendChild(name);

    if (feed.unreadCount > 0) {
      const badge = document.createElement("span");
      badge.className = "unread-badge";
      badge.textContent = feed.unreadCount;
      item.appendChild(badge);
    }

    elements.feedList.appendChild(item);
  });

  // Set title for active feed
  if (activeFeedId) {
    const activeFeed = feeds.find(f => f.id === activeFeedId);
    if (activeFeed) {
      elements.currentFeedTitle.textContent = activeFeed.title || activeFeed.url;
    }
  }
}

function renderEntries() {
  elements.entryList.replaceChildren();
  elements.emptyState.classList.toggle("hidden", entries.length > 0);

  const count = entries.length;
  elements.entryCount.textContent = count > 0
    ? `${count} entr${count !== 1 ? "ies" : "y"}`
    : "";

  entries.forEach(entry => {
    const card = document.createElement("div");
    card.className = "entry-card" + (entry.read ? " read" : "");

    // Entry header
    const header = document.createElement("div");
    header.className = "entry-header";

    const title = document.createElement("a");
    title.className = "entry-title";
    title.href = entry.link || "#";
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = entry.title || "Untitled";
    title.addEventListener("click", () => {
      markEntryRead(entry.id, card);
    });
    header.appendChild(title);

    card.appendChild(header);

    // Meta row: source + date
    const meta = document.createElement("div");
    meta.className = "entry-meta";

    if (entry.feedTitle) {
      const source = document.createElement("span");
      source.className = "entry-source";
      source.textContent = entry.feedTitle;
      meta.appendChild(source);
    }

    if (entry.published) {
      const date = document.createElement("span");
      date.className = "entry-date";
      date.textContent = formatDate(entry.published);
      meta.appendChild(date);
    }

    card.appendChild(meta);

    // Keyword route badge
    if (entry.routedTo && entry.routedTo.length > 0) {
      card.classList.add("routed");
      const badge = document.createElement("div");
      badge.className = "entry-route-badge";
      const matchedKw = entry.routeKeywords && entry.routeKeywords.length
        ? entry.routeKeywords.join(", ")
        : "keyword match";
      badge.textContent = `Auto-routed to project — ${matchedKw}`;
      card.appendChild(badge);
    }

    // Description / snippet
    if (entry.description) {
      const desc = document.createElement("div");
      desc.className = "entry-description";
      desc.textContent = truncate(entry.description, 280);
      card.appendChild(desc);
    }

    // Actions
    const actions = document.createElement("div");
    actions.className = "entry-actions";

    const summarizeBtn = document.createElement("button");
    summarizeBtn.className = "btn btn-small btn-accent";
    summarizeBtn.textContent = "AI Summarize";
    summarizeBtn.addEventListener("click", () => {
      summarizeEntry(entry, summarizeBtn);
    });
    actions.appendChild(summarizeBtn);

    const projBtn = document.createElement("button");
    projBtn.className = "btn btn-small btn-secondary";
    projBtn.textContent = "+ Project";
    projBtn.addEventListener("click", async () => {
      const [resp, defResp] = await Promise.all([
        browser.runtime.sendMessage({ action: "getProjects" }),
        browser.runtime.sendMessage({ action: "getDefaultProject" })
      ]);
      if (!resp.success || !resp.projects.length) {
        alert("No projects yet. Create one in the Argus console first.");
        return;
      }
      const defaultId = defResp?.defaultProjectId || null;
      // Simple dropdown picker
      let picker = projBtn.parentElement.querySelector(".proj-picker");
      if (picker) { picker.remove(); return; }
      picker = document.createElement("div");
      picker.className = "proj-picker";
      picker.style.cssText = "position:absolute;z-index:99;background:var(--bg-secondary,#1a1a2e);border:1px solid var(--border,#333);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.4);max-height:200px;overflow-y:auto;min-width:180px;margin-top:4px;";
      const sorted = [...resp.projects].sort((a, b) => (b.id === defaultId ? 1 : 0) - (a.id === defaultId ? 1 : 0));
      for (const proj of sorted) {
        const opt = document.createElement("div");
        opt.style.cssText = "padding:8px 12px;cursor:pointer;font-size:13px;";
        opt.textContent = proj.name + (proj.id === defaultId ? " (default)" : "");
        opt.addEventListener("mouseenter", () => opt.style.background = "var(--bg-hover,#2a2a4a)");
        opt.addEventListener("mouseleave", () => opt.style.background = "");
        opt.addEventListener("click", async () => {
          await browser.runtime.sendMessage({
            action: "addProjectItem",
            projectId: proj.id,
            item: {
              type: "feed",
              url: entry.link || "",
              title: entry.title || "Feed Entry",
              summary: (entry.description || "").slice(0, 500),
              tags: ["feed"]
            }
          });
          picker.remove();
          projBtn.textContent = "Added!";
          setTimeout(() => { projBtn.textContent = "+ Project"; }, 1500);
        });
        picker.appendChild(opt);
      }
      projBtn.parentElement.style.position = "relative";
      projBtn.parentElement.appendChild(picker);
      setTimeout(() => document.addEventListener("click", function dismiss(e) {
        if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener("click", dismiss); }
      }), 0);
    });
    actions.appendChild(projBtn);

    if (!entry.read) {
      const readBtn = document.createElement("button");
      readBtn.className = "btn btn-small btn-secondary";
      readBtn.textContent = "Mark Read";
      readBtn.addEventListener("click", () => {
        markEntryRead(entry.id, card);
        readBtn.remove();
      });
      actions.appendChild(readBtn);
    }

    card.appendChild(actions);

    // Summary container (hidden until populated)
    const summaryContainer = document.createElement("div");
    summaryContainer.className = "entry-summary hidden";
    summaryContainer.id = `summary-${entry.id}`;
    card.appendChild(summaryContainer);

    elements.entryList.appendChild(card);
  });
}

async function summarizeEntry(entry, btn) {
  btn.disabled = true;
  btn.textContent = "Summarizing...";

  const response = await browser.runtime.sendMessage({
    action: "summarizeFeedEntry",
    entryId: entry.id,
    title: entry.title,
    link: entry.link,
    content: entry.description || entry.title,
  });

  if (response && response.success && response.summary) {
    const container = document.getElementById(`summary-${entry.id}`);
    if (container) {
      container.classList.remove("hidden");

      const label = document.createElement("div");
      label.className = "summary-label";
      label.textContent = "AI Summary";

      const text = document.createElement("div");
      text.className = "summary-text";
      text.textContent = response.summary;

      container.replaceChildren(label, text);
    }
    btn.textContent = "Summarized";
  } else {
    btn.disabled = false;
    btn.textContent = "AI Summarize";
    const errMsg = response?.error || "Failed to summarize.";
    alert(errMsg);
  }
}

async function markEntryRead(entryId, cardEl) {
  await browser.runtime.sendMessage({
    action: "markFeedEntryRead",
    entryId,
  });

  if (cardEl) {
    cardEl.classList.add("read");
  }

  // Update unread counts in sidebar
  const feedItem = feeds.find(f => {
    const entry = entries.find(e => e.id === entryId);
    return entry && entry.feedId === f.id;
  });
  if (feedItem && feedItem.unreadCount > 0) {
    feedItem.unreadCount--;
    renderFeedList();
  }
}

async function markAllRead() {
  const msg = { action: "markFeedEntryRead", all: true };
  if (activeFeedId) {
    msg.feedId = activeFeedId;
  }

  await browser.runtime.sendMessage(msg);

  entries.forEach(e => { e.read = true; });
  feeds.forEach(f => {
    if (!activeFeedId || f.id === activeFeedId) {
      f.unreadCount = 0;
    }
  });

  renderFeedList();
  renderEntries();
}

function updateUrlParam(feedId) {
  const url = new URL(window.location);
  if (feedId) {
    url.searchParams.set("feedId", feedId);
  } else {
    url.searchParams.delete("feedId");
  }
  history.replaceState(null, "", url);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function truncate(text, max) {
  if (!text) return "";
  // Strip HTML tags for clean display
  const clean = text.replace(/<[^>]*>/g, "").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd() + "...";
}
