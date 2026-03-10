const elements = {
  searchInput: document.getElementById("search-input"),
  categoryList: document.getElementById("category-list"),
  tagCloud: document.getElementById("tag-cloud"),
  activeFilters: document.getElementById("active-filters"),
  bookmarkCount: document.getElementById("bookmark-count"),
  bookmarkList: document.getElementById("bookmark-list"),
  emptyState: document.getElementById("empty-state"),
  exportBookmarks: document.getElementById("export-bookmarks"),
  selectToggle: document.getElementById("select-toggle"),
  analyzeSelected: document.getElementById("analyze-selected"),
  editModal: document.getElementById("edit-modal"),
  modalClose: document.getElementById("modal-close"),
  editTags: document.getElementById("edit-tags"),
  editCategory: document.getElementById("edit-category"),
  editNotes: document.getElementById("edit-notes"),
  editSave: document.getElementById("edit-save"),
  editCancel: document.getElementById("edit-cancel"),
};

let currentFilter = { tag: null, category: null, query: "" };
let editingBookmarkId = null;
let selectionMode = false;
let selectedBookmarks = new Map(); // id -> bookmark data

document.addEventListener("DOMContentLoaded", () => {
  loadBookmarks();

  let searchTimeout;
  elements.searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentFilter.query = elements.searchInput.value.trim();
      loadBookmarks();
    }, 300);
  });

  elements.exportBookmarks.addEventListener("click", exportBookmarks);
  elements.selectToggle.addEventListener("click", toggleSelectionMode);
  elements.analyzeSelected.addEventListener("click", analyzeSelectedBookmarks);

  // Modal
  elements.modalClose.addEventListener("click", closeModal);
  elements.editCancel.addEventListener("click", closeModal);
  elements.editSave.addEventListener("click", saveEdit);
  elements.editModal.addEventListener("click", (e) => {
    if (e.target === elements.editModal) closeModal();
  });
});

async function loadBookmarks() {
  const response = await browser.runtime.sendMessage({
    action: "getBookmarks",
    tag: currentFilter.tag,
    category: currentFilter.category,
    query: currentFilter.query
  });

  if (!response || !response.success) return;

  renderSidebar(response.tags, response.categories);
  renderActiveFilters();
  renderBookmarks(response.bookmarks, response.total);
}

function renderSidebar(tags, categories) {
  // Categories
  elements.categoryList.replaceChildren();
  const allItem = document.createElement("div");
  allItem.className = "filter-item" + (!currentFilter.category ? " active" : "");
  allItem.textContent = "All";
  allItem.addEventListener("click", () => {
    currentFilter.category = null;
    loadBookmarks();
  });
  elements.categoryList.appendChild(allItem);

  categories.forEach(({ category, count }) => {
    const item = document.createElement("div");
    item.className = "filter-item" + (currentFilter.category === category ? " active" : "");

    const name = document.createElement("span");
    name.textContent = category.charAt(0).toUpperCase() + category.slice(1);

    const badge = document.createElement("span");
    badge.className = "filter-count";
    badge.textContent = count;

    item.appendChild(name);
    item.appendChild(badge);
    item.addEventListener("click", () => {
      currentFilter.category = currentFilter.category === category ? null : category;
      loadBookmarks();
    });
    elements.categoryList.appendChild(item);
  });

  // Tags
  elements.tagCloud.replaceChildren();
  tags.slice(0, 30).forEach(({ tag, count }) => {
    const pill = document.createElement("span");
    pill.className = "tag-pill" + (currentFilter.tag === tag ? " active" : "");
    pill.textContent = `${tag} (${count})`;
    pill.addEventListener("click", () => {
      currentFilter.tag = currentFilter.tag === tag ? null : tag;
      loadBookmarks();
    });
    elements.tagCloud.appendChild(pill);
  });
}

function renderActiveFilters() {
  elements.activeFilters.replaceChildren();
  let hasFilter = false;

  if (currentFilter.category) {
    hasFilter = true;
    const chip = createFilterChip("Category: " + currentFilter.category, () => {
      currentFilter.category = null;
      loadBookmarks();
    });
    elements.activeFilters.appendChild(chip);
  }

  if (currentFilter.tag) {
    hasFilter = true;
    const chip = createFilterChip("Tag: " + currentFilter.tag, () => {
      currentFilter.tag = null;
      loadBookmarks();
    });
    elements.activeFilters.appendChild(chip);
  }

  if (currentFilter.query) {
    hasFilter = true;
    const chip = createFilterChip("Search: " + currentFilter.query, () => {
      currentFilter.query = "";
      elements.searchInput.value = "";
      loadBookmarks();
    });
    elements.activeFilters.appendChild(chip);
  }

  elements.activeFilters.classList.toggle("hidden", !hasFilter);
}

function createFilterChip(text, onRemove) {
  const chip = document.createElement("span");
  chip.className = "active-filter";
  chip.textContent = text;
  const x = document.createElement("span");
  x.className = "active-filter-remove";
  x.textContent = "\u00d7";
  x.addEventListener("click", (e) => {
    e.stopPropagation();
    onRemove();
  });
  chip.appendChild(x);
  return chip;
}

function renderBookmarks(bookmarks, total) {
  elements.bookmarkCount.textContent = `${total} bookmark${total !== 1 ? "s" : ""}`;
  elements.bookmarkList.replaceChildren();
  elements.emptyState.classList.toggle("hidden", bookmarks.length > 0);

  bookmarks.forEach(bm => {
    const card = document.createElement("div");
    card.className = "bookmark-card" + (selectedBookmarks.has(bm.id) ? " selected" : "");

    // Checkbox for selection mode
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bookmark-checkbox" + (selectionMode ? "" : " hidden");
    checkbox.checked = selectedBookmarks.has(bm.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedBookmarks.set(bm.id, bm);
        card.classList.add("selected");
      } else {
        selectedBookmarks.delete(bm.id);
        card.classList.remove("selected");
      }
      updateSelectionCount();
    });

    // Header row
    const header = document.createElement("div");
    header.className = "bookmark-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "bookmark-header-left";
    headerLeft.appendChild(checkbox);

    const title = document.createElement("a");
    title.className = "bookmark-title";
    title.href = bm.url;
    title.target = "_blank";
    title.textContent = bm.title;
    headerLeft.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "bookmark-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "bookmark-action-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditModal(bm));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "bookmark-action-btn delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteBookmark(bm.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(headerLeft);
    header.appendChild(actions);
    card.appendChild(header);

    // URL
    const url = document.createElement("div");
    url.className = "bookmark-url";
    url.textContent = bm.url;
    card.appendChild(url);

    // Summary
    if (bm.summary) {
      const summary = document.createElement("div");
      summary.className = "bookmark-summary";
      summary.textContent = bm.summary;
      card.appendChild(summary);
    }

    // Tags
    if (bm.tags && bm.tags.length) {
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "bookmark-tags";
      bm.tags.forEach(tag => {
        const tagEl = document.createElement("span");
        tagEl.className = "bookmark-tag";
        tagEl.textContent = tag;
        tagEl.addEventListener("click", () => {
          currentFilter.tag = tag;
          loadBookmarks();
        });
        tagsDiv.appendChild(tagEl);
      });
      card.appendChild(tagsDiv);
    }

    // Notes
    if (bm.notes) {
      const notes = document.createElement("div");
      notes.className = "bookmark-notes";
      notes.textContent = bm.notes;
      card.appendChild(notes);
    }

    // Meta
    const meta = document.createElement("div");
    meta.className = "bookmark-meta";
    const date = document.createElement("span");
    date.textContent = new Date(bm.savedAt).toLocaleDateString();
    meta.appendChild(date);
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

    elements.bookmarkList.appendChild(card);
  });
}

function openEditModal(bookmark) {
  editingBookmarkId = bookmark.id;
  elements.editTags.value = (bookmark.tags || []).join(", ");
  elements.editCategory.value = bookmark.category || "";
  elements.editNotes.value = bookmark.notes || "";
  elements.editModal.classList.remove("hidden");
}

function closeModal() {
  elements.editModal.classList.add("hidden");
  editingBookmarkId = null;
}

async function saveEdit() {
  if (!editingBookmarkId) return;

  const tags = elements.editTags.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  const category = elements.editCategory.value.trim().toLowerCase() || "other";
  const notes = elements.editNotes.value.trim();

  await browser.runtime.sendMessage({
    action: "updateBookmark",
    id: editingBookmarkId,
    tags,
    category,
    notes
  });

  closeModal();
  loadBookmarks();
}

async function deleteBookmark(id) {
  await browser.runtime.sendMessage({ action: "deleteBookmark", id });
  loadBookmarks();
}

async function exportBookmarks() {
  const response = await browser.runtime.sendMessage({ action: "exportBookmarks" });
  if (!response || !response.success) return;

  const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "argus-bookmarks.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// Selection mode & Analyze Bookmarks
// ──────────────────────────────────────────────
function toggleSelectionMode() {
  selectionMode = !selectionMode;
  elements.selectToggle.textContent = selectionMode ? "Cancel" : "Select";
  elements.selectToggle.classList.toggle("active-toggle", selectionMode);

  if (!selectionMode) {
    selectedBookmarks.clear();
    elements.analyzeSelected.classList.add("hidden");
  }

  document.querySelectorAll(".bookmark-checkbox").forEach(cb => {
    cb.classList.toggle("hidden", !selectionMode);
    if (!selectionMode) cb.checked = false;
  });
  document.querySelectorAll(".bookmark-card").forEach(card => {
    card.classList.remove("selected");
  });
  updateSelectionCount();
}

function updateSelectionCount() {
  const count = selectedBookmarks.size;
  if (count > 0) {
    elements.analyzeSelected.textContent = `Analyze ${count} Bookmark${count > 1 ? "s" : ""}`;
    elements.analyzeSelected.classList.remove("hidden");
  } else {
    elements.analyzeSelected.classList.add("hidden");
  }
}

async function analyzeSelectedBookmarks() {
  if (selectedBookmarks.size === 0) return;

  elements.analyzeSelected.disabled = true;
  elements.analyzeSelected.textContent = "Starting analysis...";

  const bookmarks = Array.from(selectedBookmarks.values());

  const response = await browser.runtime.sendMessage({
    action: "analyzeBookmarks",
    bookmarks: bookmarks.map(bm => ({
      id: bm.id,
      title: bm.title,
      url: bm.url,
      summary: bm.summary || "",
      text: bm.text || bm.summary || ""
    }))
  });

  if (response && response.success) {
    // Results tab opened by background — reset UI
    selectedBookmarks.clear();
    selectionMode = false;
    elements.selectToggle.textContent = "Select";
    elements.selectToggle.classList.remove("active-toggle");
    elements.analyzeSelected.classList.add("hidden");
    loadBookmarks();
  } else {
    elements.analyzeSelected.disabled = false;
    elements.analyzeSelected.textContent = `Analyze ${selectedBookmarks.size} Bookmarks`;
    alert(response?.error || "Failed to analyze bookmarks.");
  }
}
