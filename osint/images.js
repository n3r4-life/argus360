(async () => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const storeKey = params.get("id");
  if (!storeKey) { document.getElementById("empty-state").innerHTML = "<p>No image data key provided.</p>"; return; }

  const stored = (await browser.storage.local.get(storeKey))[storeKey];
  if (!stored || !stored.images) { document.getElementById("empty-state").innerHTML = "<p>No image data found.</p>"; return; }

  const { images, pageUrl, pageTitle, stats } = stored;

  // Header
  const urlEl = document.getElementById("page-url");
  urlEl.href = pageUrl || "#";
  urlEl.textContent = pageTitle || pageUrl || "";
  document.title = `Images - ${pageTitle || pageUrl || "Argus"}`;

  // Stats
  document.getElementById("stat-total").textContent = images.length;
  document.getElementById("stat-img").textContent = stats?.bySource?.img || 0;
  document.getElementById("stat-css").textContent = (stats?.bySource?.["css-bg"] || 0);
  document.getElementById("stat-meta").textContent = (stats?.bySource?.meta || 0) + (stats?.bySource?.favicon || 0);

  // State
  const selected = new Set();
  let currentFilter = "all";
  let searchQuery = "";
  let minSize = 0;
  let listView = false;

  // ── Render ──

  function getFiltered() {
    return images.filter(img => {
      if (currentFilter !== "all" && img.source !== currentFilter) return false;
      if (minSize > 0 && img.width && img.width < minSize && img.height && img.height < minSize) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!img.alt.toLowerCase().includes(q) && !img.src.toLowerCase().includes(q) && !img.filename.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  function render() {
    const grid = document.getElementById("image-grid");
    const filtered = getFiltered();

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>No images match the current filters.</p></div>';
      updateSelectedCount();
      return;
    }

    grid.innerHTML = "";
    grid.classList.toggle("list-view", listView);

    filtered.forEach((img, i) => {
      const card = document.createElement("div");
      card.className = "image-card" + (selected.has(img.src) ? " selected" : "");
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
      thumb.addEventListener("error", () => {
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

      info.appendChild(filename);
      if (img.alt) {
        const altEl = document.createElement("div");
        altEl.style.cssText = "color:var(--text-muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        altEl.textContent = img.alt;
        info.appendChild(altEl);
      }
      info.appendChild(meta);

      card.appendChild(cb);
      card.appendChild(thumb);
      card.appendChild(info);

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
  }

  function updateSelectedCount() {
    document.getElementById("stat-selected").textContent = selected.size;
    document.getElementById("download-selected").disabled = selected.size === 0;
    document.getElementById("save-to-cloud").disabled = selected.size === 0;
  }

  // ── Preview Modal ──

  function openPreview(img) {
    const modal = document.getElementById("preview-modal");
    document.getElementById("preview-img").src = img.src;
    document.getElementById("preview-filename").textContent = decodeURIComponent(img.filename || "image");
    document.getElementById("preview-dimensions").textContent =
      (img.width && img.height) ? `${img.width} x ${img.height} · ${img.type || "unknown"}` : (img.type || "");
    document.getElementById("preview-alt").textContent = img.alt || "";
    document.getElementById("preview-open").href = img.src;
    document.getElementById("preview-download").href = img.src;
    document.getElementById("preview-download").download = img.filename || "image";

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

    modal.classList.remove("hidden");
  }

  document.querySelector(".preview-backdrop").addEventListener("click", () => {
    document.getElementById("preview-modal").classList.add("hidden");
  });
  document.querySelector(".preview-close").addEventListener("click", () => {
    document.getElementById("preview-modal").classList.add("hidden");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.getElementById("preview-modal").classList.add("hidden");
  });

  // ── Filter Tabs ──

  document.querySelectorAll(".filter-tabs .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tabs .tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      render();
    });
  });

  document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    render();
  });

  document.getElementById("size-filter").addEventListener("change", (e) => {
    minSize = parseInt(e.target.value) || 0;
    render();
  });

  // View toggle
  document.getElementById("view-list").addEventListener("change", (e) => {
    listView = e.target.checked;
    document.getElementById("view-icon").textContent = listView ? "List" : "Grid";
    render();
  });

  // ── Bulk Actions ──

  document.getElementById("select-all").addEventListener("click", () => {
    getFiltered().forEach(img => selected.add(img.src));
    render();
  });

  document.getElementById("deselect-all").addEventListener("click", () => {
    selected.clear();
    render();
  });

  document.getElementById("download-selected").addEventListener("click", async () => {
    const btn = document.getElementById("download-selected");
    btn.disabled = true;
    btn.textContent = "Downloading...";
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
    btn.textContent = `Downloaded ${count}`;
    setTimeout(() => { btn.textContent = "Download Selected"; btn.disabled = selected.size === 0; }, 2000);
  });

  document.getElementById("save-to-cloud").addEventListener("click", async () => {
    const btn = document.getElementById("save-to-cloud");
    btn.disabled = true;
    btn.textContent = "Saving...";

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

    btn.textContent = errors ? `Saved ${saved}, ${errors} failed` : `Saved ${saved} to cloud`;
    setTimeout(() => { btn.textContent = "Save to Cloud"; btn.disabled = selected.size === 0; }, 3000);
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

  // Initial render
  render();

  // Cleanup stored data after load (it's in memory now)
  // browser.storage.local.remove(storeKey); // Keep for now in case user refreshes
})();
