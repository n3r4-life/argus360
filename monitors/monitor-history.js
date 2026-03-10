const elements = {
  monitorTitle: document.getElementById("monitor-title"),
  changeList: document.getElementById("change-list"),
  changesView: document.getElementById("changes-view"),
  timelineView: document.getElementById("timeline-view"),
  timelineList: document.getElementById("timeline-list"),
  snapshotCount: document.getElementById("snapshot-count"),
  timelineRefresh: document.getElementById("timeline-refresh"),
  tabChanges: document.getElementById("tab-changes"),
  tabTimeline: document.getElementById("tab-timeline"),
  emptyState: document.getElementById("empty-state"),
};

let monitorId = null;
let monitorTitle = "";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  monitorId = params.get("id");
  monitorTitle = params.get("title") || "Monitor";
  const defaultView = params.get("view") || "changes";

  elements.monitorTitle.textContent = monitorTitle;
  document.title = `${monitorTitle} — Monitor History`;

  if (!monitorId) {
    elements.emptyState.textContent = "No monitor ID provided.";
    elements.emptyState.classList.remove("hidden");
    return;
  }

  // Clear unread badge for this monitor
  await browser.runtime.sendMessage({ action: "clearMonitorUnread", monitorId });

  // Tab switching
  elements.tabChanges.addEventListener("click", () => switchTab("changes"));
  elements.tabTimeline.addEventListener("click", () => switchTab("timeline"));
  elements.timelineRefresh.addEventListener("click", loadTimeline);

  // Load default view
  if (defaultView === "timeline") {
    switchTab("timeline");
  } else {
    switchTab("changes");
  }
});

function switchTab(tab) {
  elements.tabChanges.classList.toggle("active", tab === "changes");
  elements.tabTimeline.classList.toggle("active", tab === "timeline");
  elements.changesView.classList.toggle("hidden", tab !== "changes");
  elements.timelineView.classList.toggle("hidden", tab !== "timeline");
  elements.emptyState.classList.add("hidden");

  if (tab === "changes") {
    loadChanges();
  } else {
    loadTimeline();
  }
}

async function loadChanges() {
  const response = await browser.runtime.sendMessage({
    action: "getMonitorHistory",
    monitorId
  });

  if (!response || !response.success || !response.history.length) {
    elements.changeList.replaceChildren();
    elements.emptyState.classList.remove("hidden");
    return;
  }

  elements.emptyState.classList.add("hidden");
  renderHistory(response.history);
}

async function loadTimeline() {
  const response = await browser.runtime.sendMessage({
    action: "getMonitorSnapshots",
    monitorId
  });

  if (!response || !response.success || !response.snapshots.length) {
    elements.timelineList.replaceChildren();
    elements.snapshotCount.textContent = "No snapshots yet.";
    return;
  }

  elements.snapshotCount.textContent = `${response.snapshots.length} snapshots captured`;
  renderTimeline(response.snapshots);
}

function renderHistory(history) {
  elements.changeList.replaceChildren();

  history.forEach(change => {
    const card = document.createElement("div");
    card.className = "change-card";

    // Header
    const header = document.createElement("div");
    header.className = "change-header";

    const date = document.createElement("span");
    date.className = "change-date";
    date.textContent = new Date(change.detectedAt).toLocaleString();

    header.appendChild(date);
    card.appendChild(header);

    // AI Summary
    if (change.aiSummary) {
      const aiSection = document.createElement("div");
      aiSection.className = "change-ai-summary";

      const aiLabel = document.createElement("div");
      aiLabel.className = "change-ai-label";
      aiLabel.textContent = "AI Analysis";
      aiSection.appendChild(aiLabel);

      const aiText = document.createElement("div");
      aiText.textContent = change.aiSummary;
      aiSection.appendChild(aiText);

      card.appendChild(aiSection);
    }

    // Diff panels
    if (change.oldTextSnippet || change.newTextSnippet) {
      const diff = document.createElement("div");
      diff.className = "change-diff";

      // Old
      const oldPanel = document.createElement("div");
      const oldLabel = document.createElement("div");
      oldLabel.className = "diff-label old";
      oldLabel.textContent = "Previous";
      oldPanel.appendChild(oldLabel);

      const oldContent = document.createElement("div");
      oldContent.className = "diff-panel";
      oldContent.textContent = change.oldTextSnippet || "(empty)";
      oldPanel.appendChild(oldContent);

      // New
      const newPanel = document.createElement("div");
      const newLabel = document.createElement("div");
      newLabel.className = "diff-label new";
      newLabel.textContent = "Current";
      newPanel.appendChild(newLabel);

      const newContent = document.createElement("div");
      newContent.className = "diff-panel";
      newContent.textContent = change.newTextSnippet || "(empty)";
      newPanel.appendChild(newContent);

      diff.appendChild(oldPanel);
      diff.appendChild(newPanel);
      card.appendChild(diff);
    }

    elements.changeList.appendChild(card);
  });
}

function renderTimeline(snapshots) {
  elements.timelineList.replaceChildren();

  // Snapshots are newest-first; render as a vertical timeline
  snapshots.forEach((snap, idx) => {
    const entry = document.createElement("div");
    entry.className = `timeline-entry${snap.changed ? " timeline-changed" : ""}${snap.isInitial ? " timeline-initial" : ""}`;

    // Timeline marker
    const marker = document.createElement("div");
    marker.className = "timeline-marker";

    const dot = document.createElement("div");
    dot.className = `timeline-dot${snap.changed ? " dot-changed" : ""}${snap.isInitial ? " dot-initial" : ""}`;
    marker.appendChild(dot);

    if (idx < snapshots.length - 1) {
      const line = document.createElement("div");
      line.className = "timeline-line";
      marker.appendChild(line);
    }

    // Content
    const content = document.createElement("div");
    content.className = "timeline-content";

    const header = document.createElement("div");
    header.className = "timeline-header";

    const time = document.createElement("span");
    time.className = "timeline-time";
    time.textContent = new Date(snap.capturedAt).toLocaleString();

    const badge = document.createElement("span");
    if (snap.isInitial) {
      badge.className = "timeline-badge initial";
      badge.textContent = "Initial Capture";
    } else if (snap.changed) {
      badge.className = "timeline-badge changed";
      badge.textContent = "Content Changed";
    } else {
      badge.className = "timeline-badge unchanged";
      badge.textContent = "No Change";
    }

    header.appendChild(time);
    header.appendChild(badge);
    content.appendChild(header);

    // Collapsible snapshot text
    const preview = document.createElement("div");
    preview.className = "timeline-preview";
    preview.textContent = (snap.text || "").slice(0, 500) + (snap.text && snap.text.length > 500 ? "..." : "");
    content.appendChild(preview);

    // Expand button for full text
    if (snap.text && snap.text.length > 500) {
      const expandBtn = document.createElement("button");
      expandBtn.className = "btn btn-sm btn-secondary timeline-expand";
      expandBtn.textContent = "Show full snapshot";
      let expanded = false;
      expandBtn.addEventListener("click", () => {
        expanded = !expanded;
        if (expanded) {
          preview.textContent = snap.text;
          preview.classList.add("expanded");
          expandBtn.textContent = "Collapse";
        } else {
          preview.textContent = snap.text.slice(0, 500) + "...";
          preview.classList.remove("expanded");
          expandBtn.textContent = "Show full snapshot";
        }
      });
      content.appendChild(expandBtn);
    }

    entry.appendChild(marker);
    entry.appendChild(content);
    elements.timelineList.appendChild(entry);
  });
}
