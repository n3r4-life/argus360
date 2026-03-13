// ── Argus Workbench ──
// Project-aware deep-dive workspace. Three panels: project tree, work surface, AI analysis.
// Same chat capability as the Chat page, but wired into all of Argus's data.

(async () => {
  "use strict";

  // ── Elements ──
  const projectSelect = document.getElementById("wb-project");
  const treeBody = document.getElementById("wb-tree-body");
  const surfaceBody = document.getElementById("wb-surface-body");
  const surfaceEmpty = document.getElementById("wb-surface-empty");
  const surfaceTitle = document.getElementById("wb-surface-title");
  const surfaceStats = document.getElementById("wb-surface-stats");
  const selectAllBtn = document.getElementById("wb-select-all");
  const clearSurfaceBtn = document.getElementById("wb-clear-surface");
  const providerSelect = document.getElementById("wb-provider");
  const promptInput = document.getElementById("wb-prompt");
  const analyzeBtn = document.getElementById("wb-analyze");
  const saveResultBtn = document.getElementById("wb-save-result");
  const aiStatus = document.getElementById("wb-ai-status");
  const aiResult = document.getElementById("wb-ai-result");
  const resultActions = document.getElementById("wb-result-actions");
  const copyResultBtn = document.getElementById("wb-copy-result");
  const exportResultBtn = document.getElementById("wb-export-result");
  const emailResultBtn = document.getElementById("wb-email-result");

  // ── State ──
  let currentProjectId = null;
  let projectData = null; // full data from handleWorkbenchGetData
  let surfaceItems = new Map(); // id -> item data
  let allTreeItems = []; // flat list of all tree items with unified shape
  let lastResultContent = "";
  let isStreaming = false;

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
    surfaceTitle.textContent = resp.project.name;
    buildTree();
    renderSurface();
  }

  // ── Build tree from project data ──
  function buildTree() {
    treeBody.replaceChildren();
    allTreeItems = [];

    const groups = [
      { key: "analyses", label: "Analyses", icon: "\uD83D\uDCCA", items: (projectData.items || []).filter(i => i.type === "analysis") },
      { key: "urls", label: "Links", icon: "\uD83D\uDD17", items: (projectData.items || []).filter(i => i.type === "url" || i.type === "link") },
      { key: "entities", label: "Entities", icon: "\uD83E\uDDE0", items: (projectData.entities || []).map(e => ({ _treeId: `entity-${e.id}`, _type: "entity", title: e.displayName, summary: `[${e.type}] ${e.mentionCount || 1} mentions`, content: `Entity: ${e.displayName}\nType: ${e.type}\nAliases: ${(e.aliases || []).join(", ")}\nMentions: ${e.mentionCount || 1}`, ...e })) },
      { key: "feeds", label: "Feeds", icon: "\uD83D\uDCE1", items: (projectData.feeds || []).flatMap(f => (f.entries || []).map(e => ({ _treeId: `feed-${e.id}`, _type: "feed", title: e.title || f.title, summary: e.summary || "", url: e.link || e.url, content: e.summary || e.content || "" }))) },
      { key: "monitors", label: "Monitors", icon: "\uD83D\uDC41\uFE0F", items: (projectData.monitors || []).map(m => ({ _treeId: `monitor-${m.id}`, _type: "monitor", title: m.name || m.url, summary: `${m.changeCount || 0} changes`, url: m.url, content: `Monitor: ${m.url}\nChanges: ${m.changeCount || 0}\nInterval: ${m.intervalMinutes || "?"}min` })) },
      { key: "bookmarks", label: "Bookmarks", icon: "\uD83D\uDD16", items: (projectData.bookmarks || []).map(b => ({ _treeId: `bm-${b.id}`, _type: "bookmark", title: b.title || b.url, summary: b.summary || b.tags?.join(", ") || "", url: b.url, content: `Bookmark: ${b.title}\nURL: ${b.url}\nTags: ${(b.tags || []).join(", ")}\nSummary: ${b.summary || ""}` })) },
    ];

    for (const group of groups) {
      if (!group.items.length) continue;

      const grp = document.createElement("div");
      grp.className = "wb-group";

      const header = document.createElement("div");
      header.className = "wb-group-header";

      const arrow = document.createElement("span");
      arrow.className = "wb-group-arrow";
      arrow.textContent = "\u25BC";

      const label = document.createTextNode(` ${group.icon} ${group.label} `);
      const count = document.createElement("span");
      count.className = "wb-group-count";
      count.textContent = group.items.length;

      header.appendChild(arrow);
      header.appendChild(label);
      header.appendChild(count);
      grp.appendChild(header);

      const itemsContainer = document.createElement("div");

      for (const item of group.items) {
        const treeId = item._treeId || item.id || `${group.key}-${Math.random().toString(36).slice(2, 6)}`;
        const type = item._type || item.type || group.key;
        const unified = { treeId, type, title: item.title || item.displayName || "Untitled", summary: item.summary || "", url: item.url || "", content: item.content || item.analysisContent || "", raw: item };
        allTreeItems.push(unified);

        const row = document.createElement("div");
        row.className = "wb-tree-item";
        row.dataset.treeId = treeId;

        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "wb-tree-item-check";
        check.checked = surfaceItems.has(treeId);

        const icon = document.createElement("span");
        icon.className = "wb-tree-item-icon";
        icon.textContent = group.icon;

        const nameSpan = document.createElement("span");
        nameSpan.className = "wb-tree-item-label";
        nameSpan.textContent = unified.title;
        nameSpan.title = unified.title;

        const typeBadge = document.createElement("span");
        typeBadge.className = "wb-tree-item-type";
        typeBadge.textContent = type;

        row.appendChild(check);
        row.appendChild(icon);
        row.appendChild(nameSpan);
        row.appendChild(typeBadge);

        // Click row or checkbox to toggle
        row.addEventListener("click", (e) => {
          if (e.target === check) return; // checkbox handles itself
          check.checked = !check.checked;
          toggleSurfaceItem(treeId, unified, check.checked);
        });
        check.addEventListener("change", () => {
          toggleSurfaceItem(treeId, unified, check.checked);
        });

        itemsContainer.appendChild(row);
      }

      grp.appendChild(itemsContainer);

      // Collapse/expand
      header.addEventListener("click", () => {
        const collapsed = itemsContainer.style.display === "none";
        itemsContainer.style.display = collapsed ? "" : "none";
        arrow.classList.toggle("collapsed", !collapsed);
      });

      treeBody.appendChild(grp);
    }

    if (!allTreeItems.length) {
      treeBody.innerHTML = '<div class="wb-tree-empty">No data in this project yet.</div>';
    }
  }

  // ── Surface management ──
  function toggleSurfaceItem(treeId, item, add) {
    if (add) {
      surfaceItems.set(treeId, item);
    } else {
      surfaceItems.delete(treeId);
    }
    renderSurface();
    updateTreeHighlights();
  }

  function renderSurface() {
    surfaceBody.replaceChildren();

    if (!surfaceItems.size) {
      surfaceBody.appendChild(surfaceEmpty.cloneNode(true));
      surfaceStats.textContent = "";
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
        // Uncheck in tree
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
      summary.textContent = (item.summary || item.content || "").substring(0, 150).replace(/[#*_`]/g, "");

      const charCount = (item.content || item.summary || "").length;
      totalChars += charCount;

      const meta = document.createElement("div");
      meta.className = "wb-card-meta";
      meta.textContent = `${charCount.toLocaleString()} chars` + (item.url ? ` · ${new URL(item.url).hostname}` : "");

      card.appendChild(header);
      card.appendChild(typeBadge);
      card.appendChild(summary);
      card.appendChild(meta);
      surfaceBody.appendChild(card);
    }

    surfaceStats.textContent = `${surfaceItems.size} items · ~${(totalChars / 1000).toFixed(1)}k chars`;
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

  clearSurfaceBtn.addEventListener("click", () => {
    surfaceItems.clear();
    treeBody.querySelectorAll(".wb-tree-item-check").forEach(c => c.checked = false);
    renderSurface();
    updateTreeHighlights();
  });

  // ── Analyze Selection ──
  analyzeBtn.addEventListener("click", async () => {
    if (!surfaceItems.size || isStreaming) return;

    isStreaming = true;
    analyzeBtn.disabled = true;
    aiStatus.textContent = "Preparing analysis...";
    aiResult.innerHTML = "";
    aiResult.classList.add("streaming");
    resultActions.style.display = "none";
    saveResultBtn.style.display = "none";

    const selected = [...surfaceItems.values()].map(item => ({
      type: item.type,
      title: item.title,
      url: item.url,
      summary: item.summary,
      content: item.content,
      analysisContent: item.raw?.analysisContent || ""
    }));

    const resp = await browser.runtime.sendMessage({
      action: "workbenchAnalyze",
      projectId: currentProjectId,
      selectedItems: selected,
      prompt: promptInput.value.trim(),
      provider: providerSelect.value || ""
    });

    if (!resp?.success) {
      aiResult.textContent = resp?.error || "Failed to start analysis.";
      aiResult.classList.remove("streaming");
      aiStatus.textContent = "";
      isStreaming = false;
      analyzeBtn.disabled = false;
      return;
    }

    await pollStream(resp.streamId);

    isStreaming = false;
    analyzeBtn.disabled = false;
  });

  async function pollStream(streamId) {
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
          aiResult.classList.remove("streaming");
          if (!state) aiResult.textContent = "Stream timed out.";
          aiStatus.textContent = "";
          resolve();
          return;
        }

        if (state.status === "streaming" || state.status === "done") {
          if (typeof marked !== "undefined" && state.content) {
            aiResult.innerHTML = DOMPurify.sanitize(marked.parse(state.content));
          } else {
            aiResult.textContent = state.content || "";
          }

          if (state.status === "streaming") {
            aiStatus.textContent = `Streaming... (${(state.content || "").length} chars)`;
          }
        }

        if (state.status === "done") {
          clearInterval(timer);
          aiResult.classList.remove("streaming");
          lastResultContent = state.content || "";
          aiStatus.textContent = state.usage
            ? `${state.model || ""} · ${state.usage.totalTokens || "?"} tokens`
            : "Done";
          resultActions.style.display = "flex";
          saveResultBtn.style.display = "";
          browser.storage.local.remove(streamId);
          resolve();
        }

        if (state.status === "error") {
          clearInterval(timer);
          aiResult.classList.remove("streaming");
          aiResult.textContent = state.error || "Unknown error.";
          aiStatus.textContent = "";
          browser.storage.local.remove(streamId);
          resolve();
        }
      }, POLL_MS);
    });
  }

  // ── Save result back to project ──
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

    // Reload project to show the new item in tree
    await loadProject(currentProjectId);
  });

  // ── Copy / Export / Email ──
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
