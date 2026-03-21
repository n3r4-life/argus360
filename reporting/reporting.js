// ── Argus Draft Pad ──
// Lightweight markdown editor with asset library for assembling reports.

(async () => {
  "use strict";

  // ── Elements ──
  const editor = document.getElementById("rpEditor");
  const preview = document.getElementById("rpPreview");
  const editorWrap = document.querySelector(".rp-editor-wrap");
  const wordCount = document.getElementById("rpWordCount");
  const statusEl = document.getElementById("rpStatus");
  const draftInfoEl = document.getElementById("rpDraftInfo");
  const togglePreview = document.getElementById("rp-toggle-preview");
  const copyAll = document.getElementById("rp-copy-all");
  const saveBtn = document.getElementById("rp-save");
  const exportBtn = document.getElementById("rp-export");
  const emailBtn = document.getElementById("rp-email");
  const projectSelect = document.getElementById("rp-project"); // removed from UI, kept for draft compat
  const templateSelect = document.getElementById("rp-template");

  // Asset Library panel
  const snippetsPanel = document.getElementById("snippetsPanel");
  const snippetsTab = document.getElementById("snippetsTab");
  const snippetsClose = document.getElementById("snippetsClose");
  const snippetSearch = document.getElementById("snippetSearch");
  const snippetsList = document.getElementById("snippetsList");
  const snippetCount = document.getElementById("snippetCount");
  const snipTabs = document.querySelectorAll(".rp-snip-tab");
  const assetProjectSelect = document.getElementById("asset-project");

  // Drafts panel
  const draftsPanel = document.getElementById("draftsPanel");
  const draftsTab = document.getElementById("draftsTab");
  const draftsClose = document.getElementById("draftsClose");
  const draftSearch = document.getElementById("draftSearch");
  const draftsList = document.getElementById("draftsList");
  const draftCountEl = document.getElementById("draftCount");

  // Compose panel
  const composePanel = document.getElementById("composePanel");
  const composeClose = document.getElementById("composeClose");
  const composePlatform = document.getElementById("compose-platform");
  const composeLimit = document.getElementById("compose-limit");
  const composeGenerate = document.getElementById("compose-generate");
  const composeOutput = document.getElementById("compose-output");
  const composeChars = document.getElementById("compose-chars");

  // ── State ──
  let currentDraftId = null;
  let drafts = [];
  let allSnippets = { analyses: [], entities: [], bookmarks: [], monitors: [], feeds: [], techstack: [], snapshots: [], timeline: [] };
  let snippets = { analyses: [], entities: [], bookmarks: [], monitors: [], feeds: [], techstack: [], snapshots: [], timeline: [] };
  let projects = [];
  let activeSnipTab = "analyses";
  let previewMode = false; // false=editor, true=split
  let autoSaveTimer = null;

  // ── Init ──
  await loadProjects();
  await loadDrafts();
  await loadSnippets();

  // Check URL for a draft to resume
  const params = new URLSearchParams(location.search);
  const resumeId = params.get("draft");
  if (resumeId) await loadDraft(resumeId);

  // Check storage for a draft to open (e.g. from Projects tab)
  try {
    const { draftOpenId } = await browser.storage.local.get({ draftOpenId: null });
    if (draftOpenId) {
      await browser.storage.local.remove("draftOpenId");
      if (!resumeId) await loadDraft(draftOpenId);
    }
  } catch (e) { /* ignore */ }

  // Check for pending content from other pages (e.g. "Send to Draft" from Results)
  await checkPendingInsert();

  // ── Projects dropdown ──
  async function loadProjects() {
    const [resp, defResp] = await Promise.all([
      browser.runtime.sendMessage({ action: "getProjects" }),
      browser.runtime.sendMessage({ action: "getDefaultProject" })
    ]);
    if (!resp?.projects) return;
    projects = resp.projects;
    const defaultId = defResp?.defaultProjectId || null;
    for (const p of projects) {
      const label = p.name || p.id;
      const suffix = p.id === defaultId ? " (default)" : "";
      // Attach-to-project dropdown (header)
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = label + suffix;
      if (projectSelect) projectSelect.appendChild(opt);
      // Asset Library project filter
      const opt2 = document.createElement("option");
      opt2.value = p.id;
      opt2.textContent = label + suffix;
      assetProjectSelect.appendChild(opt2);
    }
    if (defaultId && projectSelect && !projectSelect.value) projectSelect.value = defaultId;
  }

  // Re-filter assets when the Asset Library project selector changes
  assetProjectSelect.addEventListener("change", () => {
    filterSnippetsByProject();
    renderSnippets(snippetSearch.value.trim());
  });

  // ── Assets ──
  async function loadSnippets() {
    try {
      const [histResp, kgResp, bkResp, monResp, feedResp] = await Promise.all([
        browser.runtime.sendMessage({ action: "getHistory", page: 0, perPage: 100 }),
        browser.runtime.sendMessage({ action: "getKGStats" }).catch(() => null),
        browser.runtime.sendMessage({ action: "getBookmarks" }),
        browser.runtime.sendMessage({ action: "getMonitors" }).catch(() => null),
        browser.runtime.sendMessage({ action: "getFeeds" }).catch(() => null)
      ]);

      // Analysis outputs — strip any leftover JSON blocks from content
      if (histResp?.history) {
        allSnippets.analyses = histResp.history.map(h => {
          let text = h.content || "";
          // Strip embedded JSON/structured blocks that weren't cleaned at save time
          text = text.replace(/```(?:json|argus[_-]?structured)?\s*\n?\{[\s\S]*?\}\s*\n?```/gi, "").trim();
          return {
            id: h.id,
            title: h.presetLabel || h.title || h.pageUrl || "Analysis",
            preview: text.slice(0, 200),
            content: text,
            url: h.pageUrl,
            date: h.timestamp,
            preset: h.preset
          };
        });
      }

      // KG entities — rich content with aliases, sources, attributes
      if (kgResp && kgResp.nodeCount > 0) {
        const graphResp = await browser.runtime.sendMessage({ action: "getKGGraph" }).catch(() => null);
        if (graphResp?.nodes) {
          allSnippets.entities = graphResp.nodes.slice(0, 200).map(n => {
            const lines = [`**${n.displayName || n.label || n.id}** (${n.type || "entity"})`];
            if (n.aliases && n.aliases.length > 1) {
              lines.push(`Aliases: ${n.aliases.filter(a => a !== n.displayName).join(", ")}`);
            }
            lines.push(`Mentions: ${n.mentionCount || 1}`);
            if (n.firstSeen) lines.push(`First seen: ${new Date(n.firstSeen).toLocaleDateString()}`);
            if (n.attributes && Object.keys(n.attributes).length) {
              for (const [k, v] of Object.entries(n.attributes)) {
                if (v) lines.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
              }
            }
            if (n.sourcePages && n.sourcePages.length) {
              lines.push("", "Sources:");
              for (const sp of n.sourcePages.slice(0, 5)) {
                lines.push(`- [${sp.title || sp.url}](${sp.url})`);
              }
            }
            return {
              id: n.id,
              title: n.displayName || n.label || n.id,
              preview: `${n.type || "entity"} — ${n.mentionCount || 1} mentions`,
              content: lines.join("\n"),
              type: n.type,
              sourceUrl: (n.sourcePages && n.sourcePages[0]?.url) || ""
            };
          });
        }
      }

      // Bookmarks
      if (bkResp?.bookmarks) {
        allSnippets.bookmarks = bkResp.bookmarks.map(b => ({
          id: b.id,
          title: b.title || b.url,
          preview: b.url,
          content: `[${b.title || b.url}](${b.url})`,
          url: b.url,
          date: b.date
        }));

        // TechStack — extracted from bookmarks that have techStack data
        allSnippets.techstack = bkResp.bookmarks
          .filter(b => b.techStack && Object.keys(b.techStack).length)
          .map(b => {
            const techs = [];
            const ts = b.techStack;
            if (ts.generator) techs.push(`Generator: ${ts.generator}`);
            if (ts.server) techs.push(`Server: ${ts.server}`);
            if (ts.poweredBy) techs.push(`Powered By: ${ts.poweredBy}`);
            if (ts.frameworks?.length) techs.push(`Frameworks: ${ts.frameworks.join(", ")}`);
            if (ts.cdn?.length) techs.push(`CDN: ${ts.cdn.join(", ")}`);
            if (ts.analytics?.length) techs.push(`Analytics: ${ts.analytics.join(", ")}`);
            if (ts.payments) techs.push(`Payments: ${ts.payments}`);
            const report = techs.join("\n");
            return {
              id: b.id + "-tech",
              title: b.title || b.url,
              preview: techs.slice(0, 2).join(" · "),
              content: `## TechStack: ${b.title || b.url}\n${b.url}\n\n${report}`,
              url: b.url,
              date: b.savedAt
            };
          });
      }

      // Monitors — load changes for each active monitor
      if (monResp?.monitors?.length) {
        const changesArr = await Promise.all(
          monResp.monitors.slice(0, 50).map(m =>
            browser.runtime.sendMessage({ action: "getMonitorHistory", monitorId: m.id })
              .then(r => ({ monitor: m, changes: r?.history || [] }))
              .catch(() => ({ monitor: m, changes: [] }))
          )
        );
        allSnippets.monitors = [];
        for (const { monitor, changes } of changesArr) {
          // The monitor itself as an asset
          allSnippets.monitors.push({
            id: monitor.id,
            title: monitor.title || monitor.url,
            preview: `${monitor.changeCount || 0} changes · every ${monitor.intervalMinutes || 60}m`,
            content: `## Monitor: ${monitor.title || monitor.url}\n${monitor.url}\nChanges detected: ${monitor.changeCount || 0}\nLast checked: ${monitor.lastChecked || "never"}\n${monitor.lastChangeSummary ? "\nLast change: " + monitor.lastChangeSummary : ""}`,
            url: monitor.url,
            date: monitor.lastChecked
          });
          // Individual change entries
          for (const c of changes.slice(0, 10)) {
            const body = c.aiSummary || c.newTextSnippet || "";
            allSnippets.monitors.push({
              id: c.id,
              title: `Change: ${monitor.title || monitor.url}`,
              preview: body.slice(0, 120),
              content: `## Monitor Change: ${monitor.title || monitor.url}\n${monitor.url}\nDetected: ${c.detectedAt || ""}\n\n${c.aiSummary ? "### AI Summary\n" + c.aiSummary + "\n" : ""}${c.newTextSnippet ? "### Content\n" + c.newTextSnippet : ""}`,
              url: monitor.url,
              date: c.detectedAt
            });
          }
        }

        // Snapshots — raw HTML timeline from monitors
        const snapArr = await Promise.all(
          monResp.monitors.slice(0, 50).map(m =>
            browser.runtime.sendMessage({ action: "getMonitorSnapshots", monitorId: m.id })
              .then(r => ({ monitor: m, snapshots: r?.snapshots || [] }))
              .catch(() => ({ monitor: m, snapshots: [] }))
          )
        );
        allSnippets.snapshots = [];
        for (const { monitor, snapshots } of snapArr) {
          for (const s of snapshots) {
            const isInitial = s.isInitial ? " (initial)" : "";
            allSnippets.snapshots.push({
              id: s.id,
              title: `${monitor.title || monitor.url}${isInitial}`,
              preview: `Captured ${new Date(s.capturedAt).toLocaleString()} · ${(s.text || "").length} chars`,
              content: `## Snapshot: ${monitor.title || monitor.url}\n${monitor.url}\nCaptured: ${s.capturedAt}${isInitial}\n\n${(s.text || "").slice(0, 5000)}`,
              url: monitor.url,
              date: s.capturedAt
            });
          }
        }
      }

      // Feed entries
      if (feedResp?.feeds?.length) {
        const entryArr = await Promise.all(
          feedResp.feeds.slice(0, 30).map(f =>
            browser.runtime.sendMessage({ action: "getFeedEntries", feedId: f.id, limit: 50 })
              .then(r => ({ feed: f, entries: r?.entries || [] }))
              .catch(() => ({ feed: f, entries: [] }))
          )
        );
        allSnippets.feeds = [];
        for (const { feed, entries } of entryArr) {
          for (const e of entries) {
            const body = e.content || e.description || "";
            allSnippets.feeds.push({
              id: e.id,
              title: e.title || "Feed Entry",
              preview: `${feed.title || feed.url} · ${(body).slice(0, 100)}`,
              content: `## ${e.title || "Feed Entry"}\nSource: ${feed.title || feed.url}\nLink: ${e.link || ""}\nPublished: ${e.pubDate || ""}\n${e.author ? "Author: " + e.author + "\n" : ""}\n${body}`,
              url: e.link || feed.url,
              date: e.pubDate
            });
          }
        }
      }

      // Page Tracker timeline
      const trackerResp = await browser.runtime.sendMessage({ action: "getTrackerPages" }).catch(() => null);
      if (trackerResp?.pages?.length) {
        allSnippets.timeline = trackerResp.pages.map(p => {
          const actionTags = (p.actions || []).map(a => a.type).filter(Boolean);
          const uniqueActions = [...new Set(actionTags)];
          const actionSummary = uniqueActions.length ? uniqueActions.join(", ") : "visited";
          const lines = [`## ${p.title || p.url}`, p.url];
          lines.push(`Visits: ${p.visits || 1}`);
          lines.push(`First visit: ${p.firstVisit ? new Date(p.firstVisit).toLocaleString() : "unknown"}`);
          lines.push(`Last visit: ${p.lastVisit ? new Date(p.lastVisit).toLocaleString() : "unknown"}`);
          if (uniqueActions.length) lines.push(`Actions: ${uniqueActions.join(", ")}`);
          // Include recent action details
          const recent = (p.actions || []).slice(-5).reverse();
          if (recent.length) {
            lines.push("", "### Recent Activity");
            for (const a of recent) {
              const when = a.timestamp ? new Date(a.timestamp).toLocaleString() : "";
              const detail = a.detail ? ` — ${typeof a.detail === "string" ? a.detail : JSON.stringify(a.detail)}` : "";
              lines.push(`- **${a.type}** ${when}${detail}`);
            }
          }
          return {
            id: p.id,
            title: p.title || p.url,
            preview: `${p.visits || 1} visits · ${actionSummary}`,
            content: lines.join("\n"),
            url: p.url,
            date: p.lastVisit
          };
        });
      }
    } catch (e) {
      console.warn("[DraftPad] Failed to load assets:", e);
    }

    filterSnippetsByProject();
    renderSnippets();
  }

  function filterSnippetsByProject() {
    const projId = assetProjectSelect.value;
    const cats = ["analyses", "entities", "bookmarks", "monitors", "feeds", "techstack", "snapshots", "timeline"];
    if (!projId) {
      // No project selected — show all assets
      for (const c of cats) snippets[c] = [...(allSnippets[c] || [])];
    } else {
      // Get URLs from the selected project's items
      const proj = projects.find(p => p.id === projId);
      const projUrls = new Set((proj?.items || []).map(i => i.url).filter(Boolean));

      // Filter all categories by url match
      snippets.analyses = allSnippets.analyses.filter(a => a.url && projUrls.has(a.url));
      snippets.bookmarks = allSnippets.bookmarks.filter(b => b.url && projUrls.has(b.url));
      snippets.entities = allSnippets.entities.filter(e => e.sourceUrl && projUrls.has(e.sourceUrl));
      snippets.monitors = allSnippets.monitors.filter(m => m.url && projUrls.has(m.url));
      snippets.feeds = allSnippets.feeds.filter(f => f.url && projUrls.has(f.url));
      snippets.techstack = allSnippets.techstack.filter(t => t.url && projUrls.has(t.url));
      snippets.snapshots = allSnippets.snapshots.filter(s => s.url && projUrls.has(s.url));
      snippets.timeline = allSnippets.timeline.filter(t => t.url && projUrls.has(t.url));
    }

    const total = cats.reduce((sum, c) => sum + (snippets[c]?.length || 0), 0);
    snippetCount.textContent = total || "";
  }

  function renderSnippets(filter) {
    snippetsList.replaceChildren();
    let list = snippets[activeSnipTab] || [];
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(s =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.preview || "").toLowerCase().includes(q)
      );
    }

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "rp-snippets-empty";
      empty.textContent = filter ? "No matching assets." : `No ${activeSnipTab} yet.`;
      snippetsList.appendChild(empty);
      return;
    }

    for (const snip of list) {
      const item = document.createElement("div");
      item.className = "rp-snippet-item";

      const info = document.createElement("div");
      info.className = "rp-snippet-info";

      const title = document.createElement("div");
      title.className = "rp-snippet-title";
      title.textContent = snip.title;

      const prev = document.createElement("div");
      prev.className = "rp-snippet-preview";
      prev.textContent = snip.preview || "";

      info.appendChild(title);
      info.appendChild(prev);

      if (snip.date) {
        const meta = document.createElement("div");
        meta.className = "rp-snippet-meta";
        meta.textContent = new Date(snip.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        info.appendChild(meta);
      }

      const insertBtn = document.createElement("button");
      insertBtn.className = "rp-snippet-insert";
      insertBtn.textContent = "Insert";
      insertBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        insertAtCursor(snip.content);
        flash("Inserted");
      });

      item.appendChild(info);
      item.appendChild(insertBtn);

      // Click item to copy
      item.addEventListener("click", () => {
        navigator.clipboard.writeText(snip.content);
        flash("Copied to clipboard");
      });

      snippetsList.appendChild(item);
    }
  }

  // Snippet tab switching
  snipTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      snipTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeSnipTab = tab.dataset.sniptab;
      renderSnippets(snippetSearch.value.trim());
    });
  });

  // Snippet search
  let snipSearchTimer;
  snippetSearch.addEventListener("input", () => {
    clearTimeout(snipSearchTimer);
    snipSearchTimer = setTimeout(() => renderSnippets(snippetSearch.value.trim()), 200);
  });

  // Panel toggles
  snippetsTab.addEventListener("click", () => {
    snippetsPanel.classList.toggle("hidden");
    PanelState.save("reporting", "snippets", { visible: !snippetsPanel.classList.contains("hidden") });
  });
  snippetsClose.addEventListener("click", () => {
    snippetsPanel.classList.add("hidden");
    PanelState.save("reporting", "snippets", { visible: false });
  });
  draftsTab.addEventListener("click", () => {
    draftsPanel.classList.toggle("hidden");
    PanelState.save("reporting", "drafts", { visible: !draftsPanel.classList.contains("hidden") });
  });
  draftsClose.addEventListener("click", () => {
    draftsPanel.classList.add("hidden");
    PanelState.save("reporting", "drafts", { visible: false });
  });

  // ── Draggable + Resizable floating panels ──
  function makeDraggable(panel) {
    const header = panel.querySelector(".rp-snippets-header");
    if (!header) return;
    let dragging = false, startX, startY, startLeft, startTop;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button, input")) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      header.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = (startLeft + dx) + "px";
      panel.style.top = (startTop + dy) + "px";
      panel.style.right = "auto";
      panel.style.transform = "none";
    });

    document.addEventListener("mouseup", () => {
      if (dragging) {
        dragging = false;
        header.style.cursor = "grab";
        const pid = panel.dataset.panelId;
        if (pid) {
          const rect = panel.getBoundingClientRect();
          PanelState.save("reporting", pid, { left: rect.left, top: rect.top });
        }
      }
    });
  }

  function makeResizable(panel) {
    const handle = document.createElement("div");
    handle.className = "rp-resize-handle";
    panel.appendChild(handle);

    let resizing = false, startX, startY, startW, startH;
    handle.addEventListener("mousedown", (e) => {
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = panel.offsetWidth;
      startH = panel.offsetHeight;
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      panel.style.width = Math.max(220, startW + (e.clientX - startX)) + "px";
      panel.style.height = Math.max(200, startH + (e.clientY - startY)) + "px";
    });

    document.addEventListener("mouseup", () => {
      if (resizing) {
        resizing = false;
        const pid = panel.dataset.panelId;
        if (pid) {
          PanelState.save("reporting", pid, { width: panel.offsetWidth, height: panel.offsetHeight });
        }
      }
    });
  }

  makeDraggable(snippetsPanel);
  makeDraggable(draftsPanel);
  makeDraggable(composePanel);
  makeResizable(snippetsPanel);
  makeResizable(draftsPanel);
  makeResizable(composePanel);

  // Restore saved panel positions
  PanelState.apply(snippetsPanel, "reporting", "snippets");
  PanelState.apply(draftsPanel, "reporting", "drafts");
  PanelState.apply(composePanel, "reporting", "compose");

  // ── Drafts ──
  async function loadDrafts() {
    const resp = await browser.runtime.sendMessage({ action: "draftGetAll" });
    drafts = resp?.drafts || [];
    draftCountEl.textContent = drafts.length || "";
    renderDrafts();
  }

  function renderDrafts(filter) {
    draftsList.replaceChildren();
    let list = drafts;
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(d => (d.title || "").toLowerCase().includes(q));
    }
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "rp-snippets-empty";
      empty.textContent = filter ? "No matching drafts." : "No saved drafts.";
      draftsList.appendChild(empty);
      return;
    }
    for (const draft of list) {
      const item = document.createElement("div");
      item.className = "rp-draft-item" + (draft.id === currentDraftId ? " active" : "");
      item.addEventListener("click", () => loadDraft(draft.id));

      const info = document.createElement("div");
      info.className = "rp-draft-item-info";
      const title = document.createElement("div");
      title.className = "rp-draft-item-title";
      title.textContent = draft.title || "Untitled Draft";
      const meta = document.createElement("div");
      meta.className = "rp-draft-item-meta";
      const d = new Date(draft.updatedAt);
      const words = (draft.content || "").trim().split(/\s+/).filter(Boolean).length;
      meta.textContent = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
        " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) +
        ` · ${words} words`;
      info.appendChild(title);
      info.appendChild(meta);
      item.appendChild(info);

      const del = document.createElement("button");
      del.className = "rp-draft-item-delete";
      del.textContent = "\u00D7";
      del.title = "Delete";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        await browser.runtime.sendMessage({ action: "draftDelete", draftId: draft.id });
        if (draft.id === currentDraftId) {
          currentDraftId = null;
          editor.value = "";
          updatePreview();
          updateWordCount();
          draftInfoEl.textContent = "";
        }
        await loadDrafts();
      });
      item.appendChild(del);
      draftsList.appendChild(item);
    }
  }

  async function loadDraft(id) {
    const resp = await browser.runtime.sendMessage({ action: "draftGet", draftId: id });
    if (!resp?.draft) return;
    currentDraftId = id;
    editor.value = resp.draft.content || "";
    if (resp.draft.projectId && projectSelect) projectSelect.value = resp.draft.projectId;
    updatePreview();
    updateWordCount();
    draftInfoEl.textContent = `Draft: ${resp.draft.title || "Untitled"}`;
    renderDrafts();
    editor.focus();
  }

  async function saveDraft() {
    const content = editor.value;
    const projectId = projectSelect?.value || null;

    // Auto-title from first heading or first line
    let title = "Untitled Draft";
    const headingMatch = content.match(/^#+\s+(.+)/m);
    if (headingMatch) {
      title = headingMatch[1].trim().slice(0, 80);
    } else {
      const firstLine = content.split("\n").find(l => l.trim());
      if (firstLine) title = firstLine.trim().slice(0, 80);
    }

    const draft = {
      id: currentDraftId || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      content,
      projectId,
      template: templateSelect.value || null,
      createdAt: currentDraftId ? undefined : Date.now(),
      updatedAt: Date.now()
    };

    await browser.runtime.sendMessage({ action: "draftSave", draft });
    currentDraftId = draft.id;
    draftInfoEl.textContent = `Draft: ${title}`;
    flash("Saved");
    await loadDrafts();
  }

  // Draft search
  let draftSearchTimer;
  draftSearch.addEventListener("input", () => {
    clearTimeout(draftSearchTimer);
    draftSearchTimer = setTimeout(() => renderDrafts(draftSearch.value.trim()), 200);
  });

  // ── Editor helpers ──
  function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = editor.value.slice(0, start);
    const after = editor.value.slice(end);
    editor.value = before + text + after;
    editor.selectionStart = editor.selectionEnd = start + text.length;
    editor.focus();
    updatePreview();
    updateWordCount();
    scheduleAutoSave();
  }

  function wrapSelection(wrapper) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end);
    const replacement = wrapper + selected + wrapper;
    editor.value = editor.value.slice(0, start) + replacement + editor.value.slice(end);
    editor.selectionStart = start + wrapper.length;
    editor.selectionEnd = end + wrapper.length;
    editor.focus();
    updatePreview();
    scheduleAutoSave();
  }

  function prefixLine(prefix) {
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    editor.value = editor.value.slice(0, lineStart) + prefix + editor.value.slice(lineStart);
    editor.selectionStart = editor.selectionEnd = start + prefix.length;
    editor.focus();
    updatePreview();
    scheduleAutoSave();
  }

  function updatePreview() {
    if (!previewMode) return;
    if (typeof marked !== "undefined") {
      preview.innerHTML = DOMPurify.sanitize(marked.parse(editor.value || ""));
    }
  }

  function updateWordCount() {
    const text = editor.value.trim();
    const count = text ? text.split(/\s+/).length : 0;
    wordCount.textContent = `${count} word${count !== 1 ? "s" : ""}`;
  }

  function flash(msg) {
    statusEl.textContent = msg;
    setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ""; }, 2000);
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (editor.value.trim()) saveDraft();
    }, 5000);
  }

  // ── Toolbar actions ──
  document.querySelectorAll("[data-insert]").forEach(btn => {
    btn.addEventListener("click", () => wrapSelection(btn.dataset.insert));
  });
  document.querySelectorAll("[data-prefix]").forEach(btn => {
    btn.addEventListener("click", () => prefixLine(btn.dataset.prefix));
  });

  document.getElementById("rp-insert-hr").addEventListener("click", () => insertAtCursor("\n---\n"));
  document.getElementById("rp-insert-link").addEventListener("click", () => {
    const url = prompt("URL:");
    if (url) insertAtCursor(`[link text](${url})`);
  });
  document.getElementById("rp-insert-citation").addEventListener("click", () => {
    const num = (editor.value.match(/\[\d+\]/g) || []).length + 1;
    insertAtCursor(`[${num}]`);
  });

  // ── AI Writing Tools ──
  const aiResultPanel = document.getElementById("rpAiResult");
  const aiResultTitle = document.getElementById("rpAiResultTitle");
  const aiResultMeta = document.getElementById("rpAiResultMeta");
  const aiResultBody = document.getElementById("rpAiResultBody");
  const aiApplyBtn = document.getElementById("rpAiApply");
  const aiInsertBtn = document.getElementById("rpAiInsert");
  const aiCopyBtn = document.getElementById("rpAiCopy");
  const aiCloseBtn = document.getElementById("rpAiClose");
  const aiHint = document.getElementById("rpAiHint");

  // Tool labels for the result header
  const AI_TOOL_LABELS = {
    spellcheck: "Spellcheck", grammar: "Grammar Fix", rewrite: "Clarity Rewrite",
    simplify: "Simplified", expand: "Expanded", tone_formal: "Formal Tone",
    tone_casual: "Casual Tone", verify: "Fact Check", lint: "Writing Lint",
    citations: "Citation Suggestions", tldr: "TL;DR", headlines: "Headlines",
    outline: "Outline", translate: "Translation"
  };

  // Tools whose output replaces the source text (vs. informational/analysis tools)
  const AI_REPLACE_TOOLS = new Set(["spellcheck", "grammar", "rewrite", "simplify", "expand", "tone_formal", "tone_casual", "translate"]);

  let aiLastResult = null;    // { tool, result, selStart, selEnd }
  let aiRunning = false;

  // Update hint based on selection
  editor.addEventListener("select", updateAiHint);
  editor.addEventListener("click", updateAiHint);
  editor.addEventListener("keyup", updateAiHint);
  function updateAiHint() {
    if (aiRunning) return;
    const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    if (sel.length > 0) {
      const words = sel.trim().split(/\s+/).length;
      aiHint.textContent = `${words} word${words !== 1 ? "s" : ""} selected`;
    } else {
      aiHint.textContent = "Select text or run on full draft";
    }
  }

  // Wire up all AI tool buttons
  document.querySelectorAll(".rp-ai-tool").forEach(btn => {
    btn.addEventListener("click", () => runAiTool(btn.dataset.tool, btn));
  });

  async function runAiTool(tool, btn) {
    if (aiRunning) return;

    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;
    const selection = editor.value.slice(selStart, selEnd);
    const content = selection.length > 0 ? selection : editor.value;

    if (!content.trim()) {
      flash("Nothing to analyze — write something first.");
      return;
    }

    // For translate, ask for target language
    let extra = null;
    if (tool === "translate") {
      extra = prompt("Translate to which language?");
      if (!extra) return;
      extra = "Target language: " + extra;
    }

    // Show loading state
    aiRunning = true;
    document.querySelectorAll(".rp-ai-tool").forEach(b => b.disabled = true);
    btn.classList.add("active");
    aiHint.textContent = "Running...";

    // Show result panel with spinner
    aiResultPanel.classList.remove("hidden");
    aiResultTitle.textContent = AI_TOOL_LABELS[tool] || tool;
    aiResultMeta.textContent = "";
    aiResultBody.innerHTML = `<div class="rp-ai-loading"><div class="rp-ai-spinner"></div>Analyzing${selection.length > 0 ? " selection" : " full draft"}...</div>`;

    // Hide Apply for analysis-only tools, show for replacement tools
    const isReplace = AI_REPLACE_TOOLS.has(tool);
    aiApplyBtn.style.display = isReplace ? "" : "none";

    try {
      const resp = await browser.runtime.sendMessage({
        action: "draftAiTool",
        tool,
        content,
        extra
      });

      if (!resp || !resp.success) {
        aiResultBody.innerHTML = `<div style="color:var(--error);">${resp?.error || "AI tool failed."}</div>`;
        return;
      }

      aiLastResult = { tool, result: resp.result, selStart, selEnd, hadSelection: selection.length > 0 };
      aiResultMeta.textContent = `${resp.provider} / ${resp.model}`;

      // Render result as markdown
      if (typeof marked !== "undefined") {
        aiResultBody.innerHTML = DOMPurify.sanitize(marked.parse(resp.result));
      } else {
        aiResultBody.textContent = resp.result;
      }
    } catch (err) {
      aiResultBody.innerHTML = `<div style="color:var(--error);">Error: ${err.message}</div>`;
    } finally {
      aiRunning = false;
      document.querySelectorAll(".rp-ai-tool").forEach(b => b.disabled = false);
      btn.classList.remove("active");
      updateAiHint();
    }
  }

  // Apply — replace editor content (or selection) with AI result
  aiApplyBtn.addEventListener("click", () => {
    if (!aiLastResult) return;
    const { result, selStart, selEnd, hadSelection } = aiLastResult;
    if (hadSelection) {
      // Replace just the selection
      editor.value = editor.value.slice(0, selStart) + result + editor.value.slice(selEnd);
      editor.selectionStart = selStart;
      editor.selectionEnd = selStart + result.length;
    } else {
      // Replace entire content
      editor.value = result;
      editor.selectionStart = editor.selectionEnd = 0;
    }
    editor.focus();
    updatePreview();
    updateWordCount();
    scheduleAutoSave();
    aiResultPanel.classList.add("hidden");
    flash("Applied");
  });

  // Insert — insert at current cursor without replacing
  aiInsertBtn.addEventListener("click", () => {
    if (!aiLastResult) return;
    insertAtCursor("\n\n" + aiLastResult.result + "\n");
    aiResultPanel.classList.add("hidden");
    flash("Inserted");
  });

  // Copy
  aiCopyBtn.addEventListener("click", () => {
    if (!aiLastResult) return;
    navigator.clipboard.writeText(aiLastResult.result);
    aiCopyBtn.textContent = "Copied!";
    setTimeout(() => { aiCopyBtn.textContent = "Copy"; }, 1500);
  });

  // Close
  aiCloseBtn.addEventListener("click", () => {
    aiResultPanel.classList.add("hidden");
    aiLastResult = null;
  });

  // Preview toggle
  togglePreview.addEventListener("click", () => {
    previewMode = !previewMode;
    togglePreview.classList.toggle("active", previewMode);
    if (previewMode) {
      editorWrap.classList.add("split");
      preview.classList.remove("hidden");
      updatePreview();
    } else {
      editorWrap.classList.remove("split");
      preview.classList.add("hidden");
    }
  });

  // Copy all
  copyAll.addEventListener("click", () => {
    navigator.clipboard.writeText(editor.value);
    flash("Copied to clipboard");
  });

  // Save
  saveBtn.addEventListener("click", saveDraft);

  // Export
  exportBtn.addEventListener("click", () => {
    const content = editor.value;
    if (!content.trim()) return;
    const title = currentDraftId ? (drafts.find(d => d.id === currentDraftId)?.title || "draft") : "draft";

    // Show export options
    const choice = prompt("Export format:\n1 = Markdown (.md)\n2 = HTML (.html)\n3 = Plain text (.txt)", "1");
    if (!choice) return;

    let blob, filename;
    if (choice === "2") {
      const html = typeof marked !== "undefined"
        ? `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333;}code{background:#f4f4f4;padding:2px 6px;border-radius:3px;}pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto;}blockquote{border-left:3px solid #e94560;padding:4px 12px;margin:8px 0;color:#666;}</style></head><body>${DOMPurify.sanitize(marked.parse(content))}</body></html>`
        : content;
      blob = new Blob([html], { type: "text/html" });
      filename = `${title}.html`;
    } else if (choice === "3") {
      blob = new Blob([content], { type: "text/plain" });
      filename = `${title}.txt`;
    } else {
      blob = new Blob([content], { type: "text/markdown" });
      filename = `${title}.md`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${filename}`);
  });

  // ── Share buttons ──
  function getDraftTitle() {
    return currentDraftId ? (drafts.find(d => d.id === currentDraftId)?.title || "Draft") : "Draft";
  }

  // Email
  emailBtn.addEventListener("click", () => {
    const content = editor.value;
    if (!content.trim()) return;
    EmailShare.compose({
      subject: `${getDraftTitle()} - Argus Report`,
      body: content.slice(0, 3000) + (content.length > 3000 ? "\n..." : "") + "\n\n\u2014 Shared via Argus"
    });
  });

  // Text It (SMS via XMPP)
  const textItBtn = document.getElementById("rp-textit");
  if (textItBtn) {
    TextIt.isConfigured().then(ok => { if (ok) textItBtn.classList.remove("hidden"); });
    textItBtn.addEventListener("click", () => {
      const content = editor.value.trim();
      if (!content) return;
      TextIt.open(content);
    });
  }

  // Paste (Gist / Pastebin / PrivateBin)
  document.getElementById("rp-paste").addEventListener("click", async () => {
    const content = editor.value;
    if (!content.trim()) return;
    const choice = prompt("Paste to:\n1 = GitHub Gist\n2 = Pastebin\n3 = PrivateBin", "1");
    if (!choice) return;
    const providers = { "1": "gist", "2": "pastebin", "3": "privatebin" };
    const key = providers[choice];
    if (!key) return;
    flash("Creating paste...");
    const resp = await browser.runtime.sendMessage({
      action: "pasteCreate",
      providerKey: key,
      title: getDraftTitle(),
      content,
      format: "markdown"
    });
    if (resp?.success && resp.url) {
      flash("Pasted!");
      navigator.clipboard.writeText(resp.url);
      if (confirm(`Paste created!\n${resp.url}\n\nURL copied to clipboard. Open in new tab?`)) {
        window.open(resp.url, "_blank");
      }
    } else {
      flash("Paste failed: " + (resp?.error || "Unknown error"));
    }
  });

  // X (Twitter) — opens compose with truncated content
  document.getElementById("rp-x").addEventListener("click", () => {
    const content = editor.value.trim();
    if (!content) return;
    // X has 280 char limit; take first meaningful chunk
    const text = content.slice(0, 260) + (content.length > 260 ? "..." : "");
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "width=600,height=400");
  });

  // LinkedIn — opens share dialog
  document.getElementById("rp-linkedin").addEventListener("click", () => {
    const content = editor.value.trim();
    if (!content) return;
    // LinkedIn share URL (text pre-fill via clipboard since LinkedIn doesn't support text param well)
    navigator.clipboard.writeText(content.slice(0, 3000));
    flash("Content copied — paste into LinkedIn");
    const url = "https://www.linkedin.com/feed/?shareActive=true";
    window.open(url, "_blank", "width=700,height=600");
  });

  // Blogger — opens new post compose
  document.getElementById("rp-blogger").addEventListener("click", () => {
    const content = editor.value.trim();
    if (!content) return;
    const title = getDraftTitle();
    // Render markdown to HTML for Blogger
    let body = content;
    if (typeof marked !== "undefined") {
      body = DOMPurify.sanitize(marked.parse(content));
    }
    const url = `https://www.blogger.com/blog/post/edit/preview?content=${encodeURIComponent(body)}&title=${encodeURIComponent(title)}`;
    // Blogger doesn't support direct content injection well via URL, so copy + open
    navigator.clipboard.writeText(body);
    flash("HTML copied — paste into Blogger");
    window.open("https://www.blogger.com/blog/post/edit/new", "_blank");
  });

  // ── Editor events ──
  editor.addEventListener("input", () => {
    updatePreview();
    updateWordCount();
    scheduleAutoSave();
  });

  // Tab key inserts spaces
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      insertAtCursor("  ");
    }
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveDraft();
    }
    // Ctrl+B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.preventDefault();
      wrapSelection("**");
    }
    // Ctrl+I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === "i") {
      e.preventDefault();
      wrapSelection("*");
    }
  });

  // ── Templates ──
  const TEMPLATES = {
    "osint-brief": `# OSINT Brief\n\n## Subject\n\n\n## Key Findings\n\n1. \n2. \n3. \n\n## Sources\n\n- \n\n## Analysis\n\n\n## Confidence Assessment\n\n\n## Recommendations\n\n\n---\n*Prepared with Argus*\n`,
    "legal-summary": `# Legal Summary\n\n## Matter\n\n\n## Parties Involved\n\n- \n\n## Key Facts\n\n1. \n2. \n\n## Legal Issues\n\n\n## Relevant Authorities\n\n\n## Conclusion\n\n\n---\n*Prepared with Argus*\n`,
    "tech-memo": `# Technical Memo\n\n## Subject\n\n\n## Background\n\n\n## Findings\n\n### Infrastructure\n\n\n### Technologies Detected\n\n\n### Vulnerabilities / Observations\n\n\n## Recommendations\n\n1. \n2. \n\n---\n*Prepared with Argus*\n`,
    "incident-report": `# Incident Report\n\n## Incident ID\n\n\n## Date / Time\n\n\n## Summary\n\n\n## Timeline\n\n| Time | Event |\n|------|-------|\n|      |       |\n\n## Impact\n\n\n## Root Cause\n\n\n## Actions Taken\n\n1. \n2. \n\n## Lessons Learned\n\n\n---\n*Prepared with Argus*\n`
  };

  templateSelect.addEventListener("change", () => {
    const key = templateSelect.value;
    if (!key || !TEMPLATES[key]) return;
    if (editor.value.trim() && !confirm("Replace current content with template?")) {
      templateSelect.value = "";
      return;
    }
    editor.value = TEMPLATES[key];
    updatePreview();
    updateWordCount();
    currentDraftId = null;
    draftInfoEl.textContent = "";
  });

  // ── Quick Post (AI summarize) ──

  const PLATFORM_LIMITS = {
    "x": 280, "reddit-title": 300, "linkedin": 700, "mastodon": 500, "bluesky": 300, "custom": 280
  };

  composePlatform.addEventListener("change", () => {
    const limit = PLATFORM_LIMITS[composePlatform.value] || 280;
    composeLimit.value = limit;
    updateComposeChars();
  });

  composeOutput.addEventListener("input", updateComposeChars);

  function updateComposeChars() {
    const len = composeOutput.value.length;
    const limit = parseInt(composeLimit.value) || 280;
    composeChars.textContent = `${len} / ${limit}`;
    composeChars.classList.toggle("over", len > limit);
  }

  document.getElementById("rp-quick-post").addEventListener("click", () => {
    composePanel.classList.toggle("hidden");
  });
  composeClose.addEventListener("click", () => composePanel.classList.add("hidden"));

  composeGenerate.addEventListener("click", async () => {
    const content = editor.value.trim();
    if (!content) { flash("Nothing to summarize"); return; }
    const limit = parseInt(composeLimit.value) || 280;
    const platform = composePlatform.options[composePlatform.selectedIndex].text.split(" (")[0];

    composeOutput.value = "";
    composeGenerate.disabled = true;
    composeGenerate.textContent = "Generating...";
    flash("Summarizing draft...");

    const resp = await browser.runtime.sendMessage({
      action: "draftSummarize",
      content,
      charLimit: limit,
      platform
    });

    composeGenerate.disabled = false;
    composeGenerate.textContent = "Summarize";

    if (resp?.success) {
      composeOutput.value = resp.summary;
      updateComposeChars();
      flash(`Summary generated (${resp.provider}/${resp.model})`);
    } else {
      flash("Failed: " + (resp?.error || "Unknown error"));
    }
  });

  // Compose panel actions
  document.getElementById("compose-copy").addEventListener("click", () => {
    navigator.clipboard.writeText(composeOutput.value);
    flash("Copied");
  });
  document.getElementById("compose-post-x").addEventListener("click", () => {
    const text = composeOutput.value.trim();
    if (!text) return;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "width=600,height=400");
  });
  document.getElementById("compose-post-linkedin").addEventListener("click", () => {
    const text = composeOutput.value.trim();
    if (!text) return;
    navigator.clipboard.writeText(text);
    flash("Copied — paste into LinkedIn");
    window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank", "width=700,height=600");
  });
  document.getElementById("compose-post-reddit").addEventListener("click", () => {
    const text = composeOutput.value.trim();
    if (!text) return;
    navigator.clipboard.writeText(text);
    flash("Copied — paste into Reddit");
    window.open("https://www.reddit.com/submit?type=self", "_blank", "width=700,height=600");
  });

  // ── Run Script (automation on draft) ──
  document.getElementById("rp-run-script").addEventListener("click", async () => {
    const content = editor.value.trim();
    if (!content) { flash("Nothing to run script on"); return; }

    // Fetch available automations
    const resp = await browser.runtime.sendMessage({ action: "getAutomations" });
    const automations = resp?.automations || [];
    if (!automations.length) { flash("No automations configured"); return; }

    // Build picker
    const names = automations.map((a, i) => `${i + 1} = ${a.name || a.id}`).join("\n");
    const choice = prompt(`Run automation on draft:\n${names}`, "1");
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= automations.length) { flash("Invalid selection"); return; }

    const auto = automations[idx];
    flash(`Running "${auto.name}"...`);

    // Run the automation — pass draft content as context
    const result = await browser.runtime.sendMessage({
      action: "draftSummarize",
      content,
      charLimit: 10000,
      platform: `automation: ${auto.name}. Follow these instructions: ${auto.prompt || auto.description || "Process this text."}`
    });

    if (result?.success && result.summary) {
      // Insert the result at cursor or replace selection
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      if (start !== end) {
        // Replace selection
        editor.value = editor.value.slice(0, start) + result.summary + editor.value.slice(end);
      } else {
        // Append after a separator
        editor.value += "\n\n---\n\n" + result.summary;
      }
      updatePreview();
      updateWordCount();
      scheduleAutoSave();
      flash(`"${auto.name}" complete`);
    } else {
      flash("Script failed: " + (result?.error || "Unknown error"));
    }
  });

  // ── Receive "Send to Draft" from other pages ──
  async function checkPendingInsert() {
    const { draftPendingInsert } = await browser.storage.local.get("draftPendingInsert");
    if (draftPendingInsert && draftPendingInsert.content) {
      // Only consume if recent (within 30 seconds)
      if (Date.now() - draftPendingInsert.timestamp < 30000) {
        const sep = editor.value.trim() ? "\n\n---\n\n" : "";
        editor.value += sep + draftPendingInsert.content;
        updatePreview();
        updateWordCount();
        scheduleAutoSave();
        editor.scrollTop = editor.scrollHeight;
        flash("Content inserted from " + (draftPendingInsert.source || "AI"));
      }
      // Clear it so it doesn't re-insert
      await browser.storage.local.remove("draftPendingInsert");
    }
  }

  // Listen for live pushes while the page is open
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.draftPendingInsert && changes.draftPendingInsert.newValue) {
      checkPendingInsert();
    }
    if (area === "local" && changes.draftOpenId && changes.draftOpenId.newValue) {
      const id = changes.draftOpenId.newValue;
      browser.storage.local.remove("draftOpenId");
      loadDraft(id);
    }
  });

  // ── Initial state ──
  updateWordCount();
  editor.focus();

})();
