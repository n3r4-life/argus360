// bookmarks.js — extracted from options-features.js
// ──────────────────────────────────────────────
const bmState = {
  initialized: false,
  filter: { tag: null, category: null, query: "", folderId: null },
  editingId: null,
  selectionMode: false,
  selected: new Map(),
  folders: [],
  allBookmarks: [],
};

const bmEl = {};

function initBookmarks() {
  bmState.initialized = true;

  bmEl.search = document.getElementById("bm-search");
  bmEl.categoryList = document.getElementById("bm-category-list");
  bmEl.tagCloud = document.getElementById("bm-tag-cloud");
  bmEl.activeFilters = document.getElementById("bm-active-filters");
  bmEl.count = document.getElementById("bm-count");
  bmEl.list = document.getElementById("bm-list");
  bmEl.empty = document.getElementById("bm-empty");
  bmEl.exportBtn = document.getElementById("bm-export");
  bmEl.selectToggle = document.getElementById("bm-select-toggle");
  bmEl.analyzeSelected = document.getElementById("bm-analyze-selected");
  bmEl.editModal = document.getElementById("bm-edit-modal");
  bmEl.modalClose = document.getElementById("bm-modal-close");
  bmEl.editFolder = document.getElementById("bm-edit-folder");
  bmEl.editTags = document.getElementById("bm-edit-tags");
  bmEl.editCategory = document.getElementById("bm-edit-category");
  bmEl.editNotes = document.getElementById("bm-edit-notes");
  bmEl.editSave = document.getElementById("bm-edit-save");
  bmEl.editCancel = document.getElementById("bm-edit-cancel");

  let searchTimeout;
  bmEl.search.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      bmState.filter.query = bmEl.search.value.trim();
      bmLoadBookmarks();
    }, 300);
  });

  bmEl.exportBtn.addEventListener("click", bmExportBookmarks);
  bmEl.syncGithubBtn = document.getElementById("bm-sync-github");
  bmEl.syncGithubBtn.addEventListener("click", bmSyncToGitHub);
  bmEl.selectToggle.addEventListener("click", bmToggleSelection);
  bmEl.analyzeSelected.addEventListener("click", bmAnalyzeSelected);
  bmEl.modalClose.addEventListener("click", bmCloseModal);
  bmEl.editCancel.addEventListener("click", bmCloseModal);
  bmEl.editSave.addEventListener("click", bmSaveEdit);
  bmEl.editModal.addEventListener("click", (e) => {
    if (e.target === bmEl.editModal) bmCloseModal();
  });

  bmEl.folderTree = document.getElementById("bm-folder-tree");
  bmEl.newFolderBtn = document.getElementById("bm-new-folder");

  bmEl.newFolderBtn.addEventListener("click", bmCreateFolder);

  const customizeTagLink = document.getElementById("bm-customize-tagging");
  if (customizeTagLink) {
    customizeTagLink.addEventListener("click", (e) => {
      e.preventDefault();
      const promptsUrl = browser.runtime.getURL("prompts/prompts.html");
      window.open(promptsUrl, "_blank");
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById("bm-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => bmLoadBookmarks());
  }

  bmLoadBookmarks();
}

async function bmLoadBookmarks() {
  const [response, folderResp] = await Promise.all([
    browser.runtime.sendMessage({
      action: "getBookmarks",
      tag: bmState.filter.tag,
      category: bmState.filter.category,
      query: bmState.filter.query
    }),
    browser.runtime.sendMessage({ action: "getBookmarkFolders" })
  ]);
  if (!response || !response.success) return;

  bmState.folders = folderResp?.success ? folderResp.folders : [];
  bmState.allBookmarks = response.bookmarks;

  // Filter by folder if selected
  let visible = response.bookmarks;
  if (bmState.filter.folderId !== null) {
    // Collect folder + all descendant folder ids
    const folderIds = bmCollectDescendantFolderIds(bmState.filter.folderId);
    visible = visible.filter(b => folderIds.has(b.folderId || ""));
  }

  bmRenderFolderTree(response.bookmarks);
  bmRenderSidebar(response.tags, response.categories);
  bmRenderActiveFilters();
  bmRenderBookmarks(visible, visible.length);
}

function bmCollectDescendantFolderIds(folderId) {
  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of bmState.folders) {
      if (ids.has(f.parentId) && !ids.has(f.id)) { ids.add(f.id); changed = true; }
    }
  }
  return ids;
}

function bmRenderFolderTree(allBookmarks) {
  bmEl.folderTree.replaceChildren();

  // Count bookmarks per folder
  const folderCounts = {};
  for (const bm of allBookmarks) {
    const fid = bm.folderId || "";
    folderCounts[fid] = (folderCounts[fid] || 0) + 1;
  }

  // "All Bookmarks" root item
  const allItem = document.createElement("div");
  allItem.className = "bm-folder-item" + (bmState.filter.folderId === null ? " active" : "");
  allItem.innerHTML = `<span class="bm-folder-icon">\u{1F4C1}</span> All Bookmarks <span class="bm-folder-count">${allBookmarks.length}</span>`;
  allItem.addEventListener("click", () => { bmState.filter.folderId = null; bmLoadBookmarks(); });
  bmEl.folderTree.appendChild(allItem);

  // "Unsorted" item (bookmarks with no folder)
  const unsortedCount = folderCounts[""] || 0;
  if (unsortedCount > 0 && bmState.folders.length > 0) {
    const unsorted = document.createElement("div");
    unsorted.className = "bm-folder-item" + (bmState.filter.folderId === "" ? " active" : "");
    unsorted.innerHTML = `<span class="bm-folder-icon">\u{1F4C4}</span> Unsorted <span class="bm-folder-count">${unsortedCount}</span>`;
    unsorted.addEventListener("click", () => { bmState.filter.folderId = ""; bmLoadBookmarks(); });
    bmEl.folderTree.appendChild(unsorted);
  }

  // Build tree recursively
  function renderFolder(folder, container, depth) {
    const folderId = folder.id;
    const count = bmCollectDescendantBookmarkCount(folderId, folderCounts);
    const item = document.createElement("div");
    item.className = "bm-folder-item" + (bmState.filter.folderId === folderId ? " active" : "");
    item.style.paddingLeft = (8 + depth * 16) + "px";
    item.setAttribute("data-folder-id", folderId);
    // Drag target for moving bookmarks
    item.addEventListener("dragover", (e) => { e.preventDefault(); item.style.background = "var(--bg-hover)"; });
    item.addEventListener("dragleave", () => { item.style.background = ""; });
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.style.background = "";
      const bmId = e.dataTransfer.getData("text/bookmark-id");
      if (bmId) bmMoveBookmarkToFolder(bmId, folderId);
    });

    const icon = document.createElement("span");
    icon.className = "bm-folder-icon";
    icon.textContent = folder.projectId ? "\u{1F4C2}" : "\u{1F4C1}";
    item.appendChild(icon);
    item.appendChild(document.createTextNode(" " + folder.name));

    const countSpan = document.createElement("span");
    countSpan.className = "bm-folder-count";
    countSpan.textContent = count;

    const actions = document.createElement("span");
    actions.className = "bm-folder-actions";
    const renameBtn = document.createElement("button");
    renameBtn.textContent = "\u270E";
    renameBtn.title = "Rename";
    renameBtn.addEventListener("click", (e) => { e.stopPropagation(); bmRenameFolder(folder); });
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "\u2715";
    deleteBtn.title = "Delete";
    deleteBtn.addEventListener("click", (e) => { e.stopPropagation(); bmDeleteFolder(folder.id); });
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(actions);
    item.appendChild(countSpan);
    item.addEventListener("click", () => { bmState.filter.folderId = folderId; bmLoadBookmarks(); });
    container.appendChild(item);

    // Render children
    const children = bmState.folders.filter(f => f.parentId === folderId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    for (const child of children) renderFolder(child, container, depth + 1);
  }

  const rootFolders = bmState.folders.filter(f => !f.parentId || f.parentId === "").sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  for (const folder of rootFolders) renderFolder(folder, bmEl.folderTree, 0);
}

function bmCollectDescendantBookmarkCount(folderId, folderCounts) {
  const ids = bmCollectDescendantFolderIds(folderId);
  let total = 0;
  for (const id of ids) total += (folderCounts[id] || 0);
  return total;
}

async function bmCreateFolder() {
  const name = prompt("Folder name:");
  if (!name || !name.trim()) return;
  const parentId = bmState.filter.folderId && bmState.filter.folderId !== "" ? bmState.filter.folderId : "";
  const folder = {
    id: `bmf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    parentId,
    projectId: "",
    sortOrder: bmState.folders.length,
    createdAt: new Date().toISOString(),
  };
  await browser.runtime.sendMessage({ action: "saveBookmarkFolder", folder });
  bmLoadBookmarks();
}

async function bmRenameFolder(folder) {
  const name = prompt("Rename folder:", folder.name);
  if (!name || !name.trim() || name.trim() === folder.name) return;
  folder.name = name.trim();
  await browser.runtime.sendMessage({ action: "saveBookmarkFolder", folder });
  bmLoadBookmarks();
}

async function bmDeleteFolder(folderId) {
  if (!confirm("Delete this folder? Bookmarks will be moved to the parent folder.")) return;
  await browser.runtime.sendMessage({ action: "deleteBookmarkFolder", folderId });
  if (bmState.filter.folderId === folderId) bmState.filter.folderId = null;
  bmLoadBookmarks();
}

async function bmMoveBookmarkToFolder(bookmarkId, folderId) {
  await browser.runtime.sendMessage({ action: "moveBookmarkToFolder", bookmarkId, folderId });
  bmLoadBookmarks();
}

function bmRenderSidebar(tags, categories) {
  bmEl.categoryList.replaceChildren();
  const allItem = document.createElement("div");
  allItem.className = "bm-filter-item" + (!bmState.filter.category ? " active" : "");
  allItem.textContent = "All";
  allItem.addEventListener("click", () => { bmState.filter.category = null; bmLoadBookmarks(); });
  bmEl.categoryList.appendChild(allItem);

  categories.forEach(({ category, count }) => {
    const item = document.createElement("div");
    item.className = "bm-filter-item" + (bmState.filter.category === category ? " active" : "");
    const name = document.createElement("span");
    name.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    const badge = document.createElement("span");
    badge.className = "bm-filter-count";
    badge.textContent = count;
    item.appendChild(name);
    item.appendChild(badge);
    item.addEventListener("click", () => {
      bmState.filter.category = bmState.filter.category === category ? null : category;
      bmLoadBookmarks();
    });
    bmEl.categoryList.appendChild(item);
  });

  bmEl.tagCloud.replaceChildren();
  tags.slice(0, 30).forEach(({ tag, count }) => {
    const pill = document.createElement("span");
    pill.className = "bm-tag-pill" + (bmState.filter.tag === tag ? " active" : "");
    pill.textContent = `${tag} (${count})`;
    pill.addEventListener("click", () => {
      bmState.filter.tag = bmState.filter.tag === tag ? null : tag;
      bmLoadBookmarks();
    });
    bmEl.tagCloud.appendChild(pill);
  });
}

function bmRenderActiveFilters() {
  bmEl.activeFilters.replaceChildren();
  let hasFilter = false;

  if (bmState.filter.category) {
    hasFilter = true;
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Category: " + bmState.filter.category, () => {
      bmState.filter.category = null; bmLoadBookmarks();
    }));
  }
  if (bmState.filter.tag) {
    hasFilter = true;
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Tag: " + bmState.filter.tag, () => {
      bmState.filter.tag = null; bmLoadBookmarks();
    }));
  }
  if (bmState.filter.query) {
    hasFilter = true;
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Search: " + bmState.filter.query, () => {
      bmState.filter.query = ""; bmEl.search.value = ""; bmLoadBookmarks();
    }));
  }
  if (bmState.filter.folderId) {
    hasFilter = true;
    const folder = bmState.folders.find(f => f.id === bmState.filter.folderId);
    bmEl.activeFilters.appendChild(bmCreateFilterChip("Folder: " + (folder ? folder.name : "Unknown"), () => {
      bmState.filter.folderId = null; bmLoadBookmarks();
    }));
  }
  bmEl.activeFilters.classList.toggle("hidden", !hasFilter);
}

function bmCreateFilterChip(text, onRemove) {
  const chip = document.createElement("span");
  chip.className = "bm-active-filter";
  chip.textContent = text;
  const x = document.createElement("span");
  x.className = "bm-active-filter-remove";
  x.textContent = "\u00d7";
  x.addEventListener("click", (e) => { e.stopPropagation(); onRemove(); });
  chip.appendChild(x);
  return chip;
}

function bmCreateShareBar(bm) {
  // Build shareable text from bookmark analysis
  const parts = [];
  if (bm.title) parts.push(`# ${bm.title}`);
  if (bm.url) parts.push(bm.url);
  if (bm.tldr) parts.push(`\n${bm.tldr}`);
  else if (bm.summary) parts.push(`\n${bm.summary}`);
  if (bm.keyFacts && bm.keyFacts.length) parts.push(`\nKey Facts:\n${bm.keyFacts.map(f => `- ${f}`).join("\n")}`);
  if (bm.notes) parts.push(`\nNotes: ${bm.notes}`);
  const content = parts.join("\n");
  const title = bm.title || "Bookmark";

  const bar = document.createElement("div");
  bar.className = "argus-chat-actions";

  // Copy
  const copyBtn = document.createElement("button");
  copyBtn.className = "argus-chat-action-btn";
  copyBtn.title = "Copy to clipboard";
  copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(content);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`; }, 1500);
    } catch { /* */ }
  });
  bar.appendChild(copyBtn);

  // Draft
  const draftBtn = document.createElement("button");
  draftBtn.className = "argus-chat-action-btn";
  draftBtn.title = "Save as draft";
  draftBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Draft`;
  draftBtn.addEventListener("click", async () => {
    try {
      const draftId = "draft-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      await browser.runtime.sendMessage({
        action: "draftSave",
        draft: { id: draftId, title, content, updatedAt: Date.now() }
      });
      draftBtn.textContent = "Saved!";
      setTimeout(() => { draftBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Draft`; }, 1500);
    } catch { /* */ }
  });
  bar.appendChild(draftBtn);

  // Paste
  const pasteBtn = document.createElement("button");
  pasteBtn.className = "argus-chat-action-btn";
  pasteBtn.title = "Paste to Gist or PrivateBin";
  pasteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Paste`;
  pasteBtn.addEventListener("click", async () => {
    // Inline paste picker
    const existing = bar.querySelector(".argus-chat-project-picker");
    if (existing) { existing.remove(); return; }
    const picker = document.createElement("div");
    picker.className = "argus-chat-project-picker";
    for (const [key, label] of [["gist", "GitHub Gist"], ["privatebin", "PrivateBin"]]) {
      const opt = document.createElement("button");
      opt.className = "argus-chat-project-option";
      opt.textContent = label;
      opt.addEventListener("click", async () => {
        opt.textContent = "Uploading...";
        try {
          await browser.runtime.sendMessage({ action: "pasteCreate", providerKey: key, title, content, files: null });
          opt.textContent = "Done!";
        } catch { opt.textContent = "Error"; }
        setTimeout(() => picker.remove(), 1500);
      });
      picker.appendChild(opt);
    }
    bar.appendChild(picker);
    const dismiss = (e) => { if (!picker.contains(e.target) && e.target !== pasteBtn) { picker.remove(); document.removeEventListener("click", dismiss); } };
    setTimeout(() => document.addEventListener("click", dismiss), 0);
  });
  bar.appendChild(pasteBtn);

  // X
  const xBtn = document.createElement("button");
  xBtn.className = "argus-chat-action-btn";
  xBtn.title = "Share on X";
  xBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
  xBtn.addEventListener("click", () => {
    const snippet = content.slice(0, 250).replace(/\n/g, " ");
    const text = `${snippet}${content.length > 250 ? "..." : ""}\n\nvia Argus`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  });
  bar.appendChild(xBtn);

  // Reddit
  const redditBtn = document.createElement("button");
  redditBtn.className = "argus-chat-action-btn";
  redditBtn.title = "Share on Reddit";
  redditBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>`;
  redditBtn.addEventListener("click", () => {
    window.open(`https://www.reddit.com/submit?title=${encodeURIComponent(title)}&text=${encodeURIComponent(content)}`, "_blank");
  });
  bar.appendChild(redditBtn);

  // Email
  const emailBtn = document.createElement("button");
  emailBtn.className = "argus-chat-action-btn";
  emailBtn.title = "Share via email";
  emailBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
  emailBtn.addEventListener("click", () => {
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(content)}`, "_blank");
  });
  bar.appendChild(emailBtn);

  return bar;
}

function bmRenderBookmarks(bookmarks, total) {
  bmEl.count.textContent = `${total} bookmark${total !== 1 ? "s" : ""}`;
  bmEl.list.replaceChildren();
  bmEl.empty.classList.toggle("hidden", bookmarks.length > 0);

  bookmarks.forEach(bm => {
    const card = document.createElement("div");
    card.className = "bm-card" + (bmState.selected.has(bm.id) ? " selected" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bm-checkbox" + (bmState.selectionMode ? "" : " hidden");
    checkbox.checked = bmState.selected.has(bm.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) { bmState.selected.set(bm.id, bm); card.classList.add("selected"); }
      else { bmState.selected.delete(bm.id); card.classList.remove("selected"); }
      bmUpdateSelectionCount();
    });

    const header = document.createElement("div");
    header.className = "bm-card-header";
    const headerLeft = document.createElement("div");
    headerLeft.className = "bm-card-header-left";
    headerLeft.appendChild(checkbox);
    const title = document.createElement("a");
    title.className = "bm-card-title";
    title.href = bm.url;
    title.target = "_blank";
    title.textContent = bm.title;
    headerLeft.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "bm-card-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => bmOpenEditModal(bm));
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-secondary";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => bmDeleteBookmark(bm.id));
    const projBtn = document.createElement("button");
    projBtn.className = "btn btn-sm btn-secondary";
    projBtn.textContent = "+ Project";
    projBtn.addEventListener("click", async () => {
      const resp = await browser.runtime.sendMessage({ action: "getProjects" });
      if (!resp || !resp.success || resp.projects.length === 0) {
        projBtn.textContent = "No projects";
        setTimeout(() => { projBtn.textContent = "+ Project"; }, 1500);
        return;
      }
      // Simple dropdown
      let dd = projBtn.parentElement.querySelector(".bm-proj-dropdown");
      if (dd) { dd.remove(); return; }
      dd = document.createElement("div");
      dd.className = "bm-proj-dropdown";
      dd.style.cssText = "position:absolute;top:100%;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);min-width:180px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
      for (const proj of resp.projects) {
        const opt = document.createElement("button");
        opt.style.cssText = "display:flex;align-items:center;gap:6px;width:100%;padding:8px 12px;background:none;border:none;border-bottom:1px solid var(--border);color:var(--text-primary);font-size:12px;cursor:pointer;text-align:left;";
        const optDot = document.createElement("span");
        optDot.setAttribute("style", "width:8px;height:8px;border-radius:50%;background:" + (proj.color || '#e94560') + ";display:inline-block;");
        opt.appendChild(optDot);
        opt.appendChild(document.createTextNode(proj.name));
        opt.addEventListener("click", async () => {
          await browser.runtime.sendMessage({
            action: "addProjectItem",
            projectId: proj.id,
            item: { type: "bookmark", refId: bm.id, url: bm.url, title: bm.title, summary: bm.summary || "", tags: bm.tags || [] }
          });
          dd.remove();
          projBtn.textContent = "Added!";
          setTimeout(() => { projBtn.textContent = "+ Project"; }, 1500);
        });
        dd.appendChild(opt);
      }
      projBtn.parentElement.style.position = "relative";
      projBtn.parentElement.appendChild(dd);
      const dismiss = (e) => { if (!dd.contains(e.target) && e.target !== projBtn) { dd.remove(); document.removeEventListener("click", dismiss); } };
      setTimeout(() => document.addEventListener("click", dismiss), 0);
    });
    actions.appendChild(editBtn);
    actions.appendChild(projBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(headerLeft);
    header.appendChild(actions);
    card.appendChild(header);

    // Make card draggable for folder assignment
    card.draggable = true;
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/bookmark-id", bm.id);
      card.style.opacity = "0.5";
    });
    card.addEventListener("dragend", () => { card.style.opacity = ""; });

    const url = document.createElement("div");
    url.className = "bm-card-url";
    url.textContent = bm.url;
    card.appendChild(url);

    // TLDR (smart analysis)
    if (bm.tldr) {
      const tldr = document.createElement("div");
      tldr.className = "bm-card-tldr";
      tldr.textContent = bm.tldr;
      card.appendChild(tldr);
    } else if (bm.summary) {
      const summary = document.createElement("div");
      summary.className = "bm-card-summary";
      summary.textContent = bm.summary;
      card.appendChild(summary);
    }

    // Key facts
    if (bm.keyFacts && bm.keyFacts.length) {
      const factsUl = document.createElement("ul");
      factsUl.className = "bm-card-keyfacts";
      for (const fact of bm.keyFacts.slice(0, 3)) {
        const li = document.createElement("li");
        li.textContent = fact;
        factsUl.appendChild(li);
      }
      card.appendChild(factsUl);
    }

    if (bm.tags && bm.tags.length) {
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "bm-card-tags";
      bm.tags.forEach(tag => {
        const tagEl = document.createElement("span");
        tagEl.className = "bm-card-tag";
        tagEl.textContent = tag;
        tagEl.addEventListener("click", () => { bmState.filter.tag = tag; bmLoadBookmarks(); });
        tagsDiv.appendChild(tagEl);
      });
      card.appendChild(tagsDiv);
    }

    // Tech stack badges
    if (bm.techStack) {
      const techDiv = document.createElement("div");
      techDiv.className = "bm-card-techstack";
      const techs = [];
      if (bm.techStack.generator) techs.push(bm.techStack.generator);
      if (bm.techStack.frameworks) techs.push(...bm.techStack.frameworks);
      if (bm.techStack.server) techs.push(bm.techStack.server);
      if (bm.techStack.cdn) techs.push(...bm.techStack.cdn);
      if (bm.techStack.analytics) techs.push(...bm.techStack.analytics);
      if (bm.techStack.poweredBy) techs.push(bm.techStack.poweredBy);
      if (bm.techStack.payments) techs.push(bm.techStack.payments);
      for (const tech of [...new Set(techs)].slice(0, 5)) {
        const badge = document.createElement("span");
        badge.className = "bm-tech-badge";
        badge.textContent = tech;
        techDiv.appendChild(badge);
      }
      if (techs.length) card.appendChild(techDiv);
    }

    if (bm.notes) {
      const notes = document.createElement("div");
      notes.className = "bm-card-notes";
      notes.textContent = bm.notes;
      card.appendChild(notes);
    }

    const meta = document.createElement("div");
    meta.className = "bm-card-meta";
    const date = document.createElement("span");
    date.textContent = new Date(bm.savedAt).toLocaleDateString();
    meta.appendChild(date);
    if (bm.contentType && bm.contentType !== "other") {
      const ct = document.createElement("span");
      ct.className = "bm-card-content-type";
      ct.textContent = bm.contentType;
      meta.appendChild(ct);
    }
    if (bm.category) {
      const cat = document.createElement("span");
      cat.textContent = bm.category;
      meta.appendChild(cat);
    }
    if (bm.readingTime) {
      const rt = document.createElement("span");
      rt.textContent = bm.readingTime;
      meta.appendChild(rt);
    }
    if (bm.aiTagged) {
      const ai = document.createElement("span");
      ai.textContent = "AI tagged";
      ai.style.color = "var(--accent)";
      meta.appendChild(ai);
    }
    card.appendChild(meta);

    // Share / action buttons (when card has analysis content)
    if (bm.tldr || bm.summary || (bm.keyFacts && bm.keyFacts.length) || bm.notes) {
      card.appendChild(bmCreateShareBar(bm));
    }

    bmEl.list.appendChild(card);
  });
}

function bmOpenEditModal(bookmark) {
  bmState.editingId = bookmark.id;
  // Populate folder select
  bmEl.editFolder.replaceChildren();
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "\u2014 No folder \u2014";
  bmEl.editFolder.appendChild(noneOpt);
  for (const f of bmState.folders) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    bmEl.editFolder.appendChild(opt);
  }
  bmEl.editFolder.value = bookmark.folderId || "";
  bmEl.editTags.value = (bookmark.tags || []).join(", ");
  bmEl.editCategory.value = bookmark.category || "";
  bmEl.editNotes.value = bookmark.notes || "";
  bmEl.editModal.classList.remove("hidden");
}

function bmCloseModal() {
  bmEl.editModal.classList.add("hidden");
  bmState.editingId = null;
}

async function bmSaveEdit() {
  if (!bmState.editingId) return;
  const tags = bmEl.editTags.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  const category = bmEl.editCategory.value.trim().toLowerCase() || "other";
  const notes = bmEl.editNotes.value.trim();
  const folderId = bmEl.editFolder.value || "";
  await browser.runtime.sendMessage({ action: "updateBookmark", id: bmState.editingId, tags, category, notes, folderId });
  bmCloseModal();
  bmLoadBookmarks();
}

async function bmDeleteBookmark(id) {
  await browser.runtime.sendMessage({ action: "deleteBookmark", id });
  bmLoadBookmarks();
}

async function bmExportBookmarks() {
  const response = await browser.runtime.sendMessage({ action: "exportBookmarks" });
  if (!response || !response.success) return;
  const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "argus-bookmarks.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function bmSyncToGitHub() {
  bmEl.syncGithubBtn.disabled = true;
  bmEl.syncGithubBtn.textContent = "Syncing...";
  try {
    const resp = await browser.runtime.sendMessage({ action: "syncBookmarksToCloud" });
    if (resp && resp.success) {
      const parts = [];
      if (resp.github?.success) parts.push(`${resp.github.bookmarks} bookmarks to GitHub`);
      else if (resp.github?.error) parts.push(`GitHub error`);
      if (resp.snapshots?.synced > 0) parts.push(`${resp.snapshots.synced} snapshots`);
      if (resp.snapshots?.failed > 0) parts.push(`${resp.snapshots.failed} snap failed`);
      if (resp.pdfs?.synced > 0) parts.push(`${resp.pdfs.synced} PDFs`);
      if (resp.pdfs?.failed > 0) parts.push(`${resp.pdfs.failed} PDF failed`);
      if (resp.snapshots?.providers?.length) parts.push(`\u2192 ${resp.snapshots.providers.join(", ")}`);
      bmEl.syncGithubBtn.textContent = parts.length ? parts.join(" \u00b7 ") : "No providers connected";
      // Log errors to console for debugging
      if (resp.github?.error) console.warn("[CloudSync UI] GitHub:", resp.github.error);
      if (resp.snapshots?.errors?.length) console.warn("[CloudSync UI] Snapshot errors:", resp.snapshots.errors);
      if (resp.pdfs?.errors?.length) console.warn("[CloudSync UI] PDF errors:", resp.pdfs.errors);
    } else {
      bmEl.syncGithubBtn.textContent = resp?.error || "Sync failed";
    }
  } catch (e) {
    bmEl.syncGithubBtn.textContent = "Error: " + e.message;
  }
  setTimeout(() => {
    bmEl.syncGithubBtn.disabled = false;
    bmEl.syncGithubBtn.textContent = "Sync to Cloud";
  }, 6000);
}

function bmToggleSelection() {
  bmState.selectionMode = !bmState.selectionMode;
  bmEl.selectToggle.textContent = bmState.selectionMode ? "Cancel" : "Select";
  bmEl.selectToggle.classList.toggle("bm-select-active", bmState.selectionMode);
  if (!bmState.selectionMode) {
    bmState.selected.clear();
    bmEl.analyzeSelected.classList.add("hidden");
  }
  document.querySelectorAll(".bm-checkbox").forEach(cb => {
    cb.classList.toggle("hidden", !bmState.selectionMode);
    if (!bmState.selectionMode) cb.checked = false;
  });
  document.querySelectorAll(".bm-card").forEach(card => card.classList.remove("selected"));
  bmUpdateSelectionCount();
}

function bmUpdateSelectionCount() {
  const count = bmState.selected.size;
  if (count > 0) {
    bmEl.analyzeSelected.textContent = `Analyze ${count} Bookmark${count > 1 ? "s" : ""}`;
    bmEl.analyzeSelected.classList.remove("hidden");
  } else {
    bmEl.analyzeSelected.classList.add("hidden");
  }
}

async function bmAnalyzeSelected() {
  if (bmState.selected.size === 0) return;
  bmEl.analyzeSelected.disabled = true;
  bmEl.analyzeSelected.textContent = "Starting analysis...";
  const bookmarks = Array.from(bmState.selected.values());
  const response = await browser.runtime.sendMessage({
    action: "analyzeBookmarks",
    bookmarks: bookmarks.map(bm => ({ id: bm.id, title: bm.title, url: bm.url, summary: bm.summary || "", text: bm.text || bm.summary || "" }))
  });
  if (response && response.success) {
    bmState.selected.clear();
    bmState.selectionMode = false;
    bmEl.selectToggle.textContent = "Select";
    bmEl.selectToggle.classList.remove("bm-select-active");
    bmEl.analyzeSelected.classList.add("hidden");
    bmLoadBookmarks();
  } else {
    bmEl.analyzeSelected.disabled = false;
    bmEl.analyzeSelected.textContent = `Analyze ${bmState.selected.size} Bookmarks`;
  }
}

// ── Bootstrap ──
document.addEventListener("DOMContentLoaded", () => {
  initBookmarks();
});
