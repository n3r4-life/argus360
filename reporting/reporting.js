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
  const projectSelect = document.getElementById("rp-project");
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

  // ── State ──
  let currentDraftId = null;
  let drafts = [];
  let allSnippets = { analyses: [], entities: [], bookmarks: [], notes: [] };
  let snippets = { analyses: [], entities: [], bookmarks: [], notes: [] };
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

  // ── Projects dropdown ──
  async function loadProjects() {
    const resp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (!resp?.projects) return;
    projects = resp.projects;
    for (const p of projects) {
      // Attach-to-project dropdown (header)
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      projectSelect.appendChild(opt);
      // Asset Library project filter
      const opt2 = document.createElement("option");
      opt2.value = p.id;
      opt2.textContent = p.name || p.id;
      assetProjectSelect.appendChild(opt2);
    }
  }

  // Re-filter assets when the Asset Library project selector changes
  assetProjectSelect.addEventListener("change", () => {
    filterSnippetsByProject();
    renderSnippets(snippetSearch.value.trim());
  });

  // ── Assets ──
  async function loadSnippets() {
    try {
      const [histResp, kgResp, bkResp] = await Promise.all([
        browser.runtime.sendMessage({ action: "getHistory", page: 0, perPage: 100 }),
        browser.runtime.sendMessage({ action: "getKGStats" }).catch(() => null),
        browser.runtime.sendMessage({ action: "getBookmarks" })
      ]);

      // Analysis outputs
      if (histResp?.history) {
        allSnippets.analyses = histResp.history.map(h => ({
          id: h.id,
          title: h.title || h.pageUrl || "Analysis",
          preview: (h.content || "").slice(0, 200),
          content: h.content || "",
          url: h.pageUrl,
          date: h.timestamp,
          preset: h.preset
        }));
      }

      // KG entities
      if (kgResp && kgResp.nodeCount > 0) {
        const graphResp = await browser.runtime.sendMessage({ action: "getKGGraph" }).catch(() => null);
        if (graphResp?.nodes) {
          allSnippets.entities = graphResp.nodes.slice(0, 200).map(n => ({
            id: n.id,
            title: n.label || n.id,
            preview: `${n.type || "entity"} — ${n.mentions || 0} mentions`,
            content: `**${n.label}** (${n.type || "entity"})`,
            type: n.type,
            sourceUrl: n.sourceUrl || ""
          }));
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
      }
    } catch (e) {
      console.warn("[DraftPad] Failed to load assets:", e);
    }

    filterSnippetsByProject();
    renderSnippets();
  }

  function filterSnippetsByProject() {
    const projId = assetProjectSelect.value;
    if (!projId) {
      // No project selected — show all assets
      snippets = { analyses: [...allSnippets.analyses], entities: [...allSnippets.entities], bookmarks: [...allSnippets.bookmarks], notes: [] };
    } else {
      // Get URLs from the selected project's items
      const proj = projects.find(p => p.id === projId);
      const projUrls = new Set((proj?.items || []).map(i => i.url).filter(Boolean));

      // Filter analyses: match by pageUrl
      snippets.analyses = allSnippets.analyses.filter(a => a.url && projUrls.has(a.url));

      // Filter bookmarks: match by url
      snippets.bookmarks = allSnippets.bookmarks.filter(b => b.url && projUrls.has(b.url));

      // Filter entities: match by sourceUrl
      snippets.entities = allSnippets.entities.filter(e => e.sourceUrl && projUrls.has(e.sourceUrl));

      snippets.notes = [];
    }

    const total = snippets.analyses.length + snippets.entities.length + snippets.bookmarks.length;
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
  snippetsTab.addEventListener("click", () => snippetsPanel.classList.toggle("hidden"));
  snippetsClose.addEventListener("click", () => snippetsPanel.classList.add("hidden"));
  draftsTab.addEventListener("click", () => draftsPanel.classList.toggle("hidden"));
  draftsClose.addEventListener("click", () => draftsPanel.classList.add("hidden"));

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
    });

    document.addEventListener("mouseup", () => {
      if (dragging) {
        dragging = false;
        header.style.cursor = "grab";
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

    document.addEventListener("mouseup", () => { resizing = false; });
  }

  makeDraggable(snippetsPanel);
  makeDraggable(draftsPanel);
  makeResizable(snippetsPanel);
  makeResizable(draftsPanel);

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
    if (resp.draft.projectId) projectSelect.value = resp.draft.projectId;
    updatePreview();
    updateWordCount();
    draftInfoEl.textContent = `Draft: ${resp.draft.title || "Untitled"}`;
    renderDrafts();
    editor.focus();
  }

  async function saveDraft() {
    const content = editor.value;
    const projectId = projectSelect.value || null;

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
  const composePanel = document.getElementById("composePanel");
  const composeClose = document.getElementById("composeClose");
  const composePlatform = document.getElementById("compose-platform");
  const composeLimit = document.getElementById("compose-limit");
  const composeGenerate = document.getElementById("compose-generate");
  const composeOutput = document.getElementById("compose-output");
  const composeChars = document.getElementById("compose-chars");

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

  await checkPendingInsert();

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
