(async () => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const storeKey = params.get("id");
  if (!storeKey) { document.getElementById("empty-state").innerHTML = "<p>No image data key provided.</p>"; return; }

  const stored = (await browser.storage.local.get(storeKey))[storeKey];
  if (!stored || !stored.images) { document.getElementById("empty-state").innerHTML = "<p>No image data found.</p>"; return; }

  const { images, pageUrl, pageTitle, stats, multiTab, tabSources } = stored;

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

  // Normalize image types for consistent filtering
  const TYPE_MAP = { jpeg: "jpg", jpe: "jpg", tif: "tiff" };
  const KNOWN_TYPES = new Set(["jpg", "png", "gif", "webp", "svg", "avif", "ico", "bmp", "tiff"]);
  const AI_VISION_TYPES = new Set(["jpg", "png", "gif", "webp", "avif", "bmp", "tiff"]); // raster only

  images.forEach(img => {
    const raw = (img.type || "unknown").toLowerCase();
    img.typeNorm = TYPE_MAP[raw] || raw;
    if (!KNOWN_TYPES.has(img.typeNorm)) img.typeNorm = img.typeNorm === "unknown" ? "other" : img.typeNorm;
  });

  // Populate type counts and hide empty tabs
  const typeCounts = {};
  images.forEach(img => { typeCounts[img.typeNorm] = (typeCounts[img.typeNorm] || 0) + 1; });
  document.querySelectorAll("#type-tabs .tab[data-type]").forEach(tab => {
    const t = tab.dataset.type;
    if (t === "all") return;
    const count = typeCounts[t] || 0;
    const countEl = tab.querySelector(".tab-count");
    if (countEl) countEl.textContent = count;
    if (count === 0) tab.classList.add("tab-zero");
  });
  // Count "other" = everything not in the explicit type tabs
  const explicitTypes = new Set(["jpg", "png", "gif", "webp", "svg", "avif", "ico"]);
  const otherCount = images.filter(img => !explicitTypes.has(img.typeNorm)).length;
  const otherCountEl = document.getElementById("count-other");
  if (otherCountEl) otherCountEl.textContent = otherCount;
  if (otherCount === 0) {
    const otherTab = document.querySelector('#type-tabs .tab[data-type="other"]');
    if (otherTab) otherTab.classList.add("tab-zero");
  }

  // State
  const selected = new Set();
  let currentFilter = "all";
  let currentTypeFilter = "all";
  let searchQuery = "";
  let sizeMode = "none"; // "none", "min", "max"
  let sizeThreshold = 0;
  let listView = false;
  let aiMatchIndices = null; // null = no AI filter active, Set = matched image indices
  let aiSearching = false;
  let sortBy = "default";
  let showSelectedOnly = false;
  let currentColorFilter = "all"; // color search filter (not display overlay)
  let currentTabFilter = "all";  // multi-tab filter
  const imageColors = new Map(); // src → Set of dominant color names

  // ── Multi-Tab Filter Setup ──
  if (multiTab && tabSources && tabSources.length > 1) {
    const tabRow = document.getElementById("tab-filter-row");
    tabRow.classList.remove("hidden");
    const tabTabs = document.getElementById("tab-tabs");
    // Update "All Tabs" count
    tabTabs.querySelector('[data-tab="all"]').textContent = `All Tabs (${tabSources.length})`;
    tabSources.forEach(ts => {
      const btn = document.createElement("button");
      btn.className = "tab";
      btn.dataset.tab = ts.url;
      // Shorten the title for display
      let label = ts.title || ts.url;
      if (label.length > 30) label = label.slice(0, 28) + "...";
      btn.innerHTML = `${label} <span class="tab-count">${ts.imageCount}</span>`;
      btn.title = ts.url;
      tabTabs.appendChild(btn);
    });
    tabTabs.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        tabTabs.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentTabFilter = tab.dataset.tab;
        render();
      });
    });
  }

  // ── Color Extraction (canvas pixel sampling) ──

  const COLOR_BUCKETS = {
    red:    { h: [345, 360], h2: [0, 15], s: 30, l: [15, 80] },
    orange: { h: [15, 45],   s: 30, l: [20, 80] },
    yellow: { h: [45, 70],   s: 30, l: [25, 85] },
    green:  { h: [70, 165],  s: 20, l: [15, 80] },
    cyan:   { h: [165, 200], s: 20, l: [20, 80] },
    blue:   { h: [200, 260], s: 20, l: [15, 75] },
    purple: { h: [260, 300], s: 20, l: [15, 75] },
    pink:   { h: [300, 345], s: 20, l: [25, 80] },
  };

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  function classifyPixel(r, g, b) {
    const [h, s, l] = rgbToHsl(r, g, b);
    // Achromatic checks first
    if (l > 88) return "white";
    if (l < 12) return "black";
    if (s < 12) return "gray";
    // Brown: low-saturation warm hue with lower lightness
    if (h >= 10 && h <= 45 && s < 55 && l < 45) return "brown";
    // Chromatic buckets
    for (const [name, bucket] of Object.entries(COLOR_BUCKETS)) {
      const inHue = (h >= bucket.h[0] && h < bucket.h[1]) ||
                    (bucket.h2 && h >= bucket.h2[0] && h < bucket.h2[1]);
      if (inHue && s >= bucket.s && l >= bucket.l[0] && l <= bucket.l[1]) return name;
    }
    return "gray"; // fallback
  }

  async function extractImageColors(img) {
    return new Promise((resolve) => {
      const tempImg = new Image();
      tempImg.crossOrigin = "anonymous";
      tempImg.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 16; // sample 16x16 = 256 pixels
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(tempImg, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          const counts = {};
          const total = size * size;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue; // skip transparent
            const color = classifyPixel(data[i], data[i + 1], data[i + 2]);
            counts[color] = (counts[color] || 0) + 1;
          }
          // Keep colors that make up at least 10% of non-transparent pixels
          const visiblePixels = Object.values(counts).reduce((a, b) => a + b, 0);
          const threshold = Math.max(1, visiblePixels * 0.1);
          const dominant = new Set();
          for (const [color, count] of Object.entries(counts)) {
            if (count >= threshold) dominant.add(color);
          }
          resolve(dominant.size > 0 ? dominant : new Set(["gray"]));
        } catch {
          resolve(new Set()); // CORS or other error — skip
        }
      };
      tempImg.onerror = () => resolve(new Set());
      tempImg.src = img.src;
      // Timeout after 5s
      setTimeout(() => resolve(new Set()), 5000);
    });
  }

  async function extractAllColors() {
    const statusEl = document.getElementById("color-extract-status");
    statusEl.textContent = "Analyzing colors...";
    let done = 0;
    const batch = 6; // process 6 at a time to avoid flooding
    for (let i = 0; i < images.length; i += batch) {
      const slice = images.slice(i, i + batch);
      const results = await Promise.all(slice.map(img => extractImageColors(img)));
      results.forEach((colors, j) => {
        if (colors.size > 0) imageColors.set(images[i + j].src, colors);
      });
      done += slice.length;
      statusEl.textContent = `Analyzing colors... ${done}/${images.length}`;
    }
    statusEl.textContent = `${imageColors.size} analyzed`;
    statusEl.classList.add("done");
    // Update color tab counts
    updateColorTabCounts();
  }

  function updateColorTabCounts() {
    // Not adding count badges to color tabs since they're small swatches,
    // but we disable colors with 0 matches
    const colorCounts = {};
    for (const colors of imageColors.values()) {
      for (const c of colors) colorCounts[c] = (colorCounts[c] || 0) + 1;
    }
    document.querySelectorAll("#color-tabs .color-tab[data-color]").forEach(tab => {
      const c = tab.dataset.color;
      if (c === "all") return;
      if (!colorCounts[c]) tab.classList.add("tab-zero");
      else tab.classList.remove("tab-zero");
    });
  }

  // ── Render ──

  function getFiltered() {
    let result = images.filter(img => {
      if (showSelectedOnly && !selected.has(img.src)) return false;
      if (currentTabFilter !== "all" && img.tabUrl !== currentTabFilter) return false;
      if (currentFilter !== "all" && img.source !== currentFilter) return false;
      if (currentTypeFilter !== "all") {
        if (currentTypeFilter === "other") {
          if (explicitTypes.has(img.typeNorm)) return false;
        } else if (img.typeNorm !== currentTypeFilter) return false;
      }
      if (sizeThreshold > 0 && img.width && img.height) {
        const larger = Math.max(img.width, img.height);
        if (sizeMode === "min" && larger < sizeThreshold) return false;
        if (sizeMode === "max" && larger >= sizeThreshold) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!img.alt.toLowerCase().includes(q) && !img.src.toLowerCase().includes(q) && !img.filename.toLowerCase().includes(q)) return false;
      }
      if (currentColorFilter !== "all") {
        const colors = imageColors.get(img.src);
        if (!colors || !colors.has(currentColorFilter)) return false;
      }
      return true;
    });

    if (sortBy !== "default") {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case "size-desc": return (b.width * b.height) - (a.width * a.height);
          case "size-asc":  return (a.width * a.height) - (b.width * b.height);
          case "name-asc":  return (a.filename || "").localeCompare(b.filename || "");
          case "name-desc": return (b.filename || "").localeCompare(a.filename || "");
          case "type":      return (a.typeNorm || "").localeCompare(b.typeNorm || "");
          default: return 0;
        }
      });
    }

    return result;
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
      const globalIdx = images.indexOf(img);
      const isAiMatch = aiMatchIndices ? aiMatchIndices.has(globalIdx) : null;

      const card = document.createElement("div");
      card.className = "image-card"
        + (selected.has(img.src) ? " selected" : "")
        + (isAiMatch === true ? " ai-match" : "")
        + (isAiMatch === false ? " ai-no-match" : "");
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

      if (img.typeNorm && img.typeNorm !== "other" && img.typeNorm !== "unknown") {
        const typeBadge = document.createElement("span");
        typeBadge.className = "card-type-badge card-type-" + img.typeNorm;
        typeBadge.textContent = img.typeNorm.toUpperCase();
        meta.appendChild(typeBadge);
      }

      // Color dots
      const imgColors = imageColors.get(img.src);
      if (imgColors && imgColors.size > 0) {
        const dotsRow = document.createElement("div");
        dotsRow.className = "card-color-dots";
        const COLOR_HEX = { red:"#e53935", orange:"#fb8c00", yellow:"#fdd835", green:"#43a047", cyan:"#00acc1", blue:"#1e88e5", purple:"#8e24aa", pink:"#e91e8a", brown:"#795548", white:"#ffffff", gray:"#9e9e9e", black:"#212121" };
        for (const c of imgColors) {
          if (COLOR_HEX[c]) {
            const dot = document.createElement("span");
            dot.className = "card-color-dot";
            dot.style.background = COLOR_HEX[c];
            dot.title = c;
            dotsRow.appendChild(dot);
          }
        }
        info.appendChild(dotsRow);
      }

      info.appendChild(filename);
      if (img.alt) {
        const altEl = document.createElement("div");
        altEl.style.cssText = "color:var(--text-muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        altEl.textContent = img.alt;
        info.appendChild(altEl);
      }
      info.appendChild(meta);

      // Tab badge for multi-tab mode
      if (multiTab && img.tabTitle) {
        const tabBadge = document.createElement("div");
        tabBadge.className = "card-tab-badge";
        let tabLabel = img.tabTitle;
        if (tabLabel.length > 25) tabLabel = tabLabel.slice(0, 23) + "...";
        tabBadge.textContent = tabLabel;
        tabBadge.title = img.tabUrl || "";
        info.appendChild(tabBadge);
      }

      card.appendChild(cb);
      card.appendChild(thumb);
      card.appendChild(info);

      if (isAiMatch === true) {
        const badge = document.createElement("span");
        badge.className = "ai-match-badge";
        badge.textContent = "AI Match";
        card.appendChild(badge);
      }

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
    const cmpBtn = document.getElementById("compare-selected");
    if (cmpBtn) cmpBtn.disabled = selected.size < 2;
  }

  // ── Preview Modal ──

  let previewZoom = 1;
  let previewFilter = "none";
  let previewBrightness = 100;
  let previewContrast = 100;
  let previewCurrentImages = []; // filtered list for prev/next navigation
  let previewCurrentIndex = -1;

  const pModal = document.getElementById("preview-modal");
  const pImg = document.getElementById("preview-img");
  const pContainer = document.getElementById("preview-img-container");
  const pZoomLevel = document.getElementById("preview-zoom-level");
  const pFilterSelect = document.getElementById("preview-filter-select");
  const pBrightSlider = document.getElementById("preview-brightness");
  const pBrightVal = document.getElementById("preview-brightness-val");
  const pContrastSlider = document.getElementById("preview-contrast");
  const pContrastVal = document.getElementById("preview-contrast-val");

  function buildPreviewFilter() {
    let f = `brightness(${previewBrightness / 100}) contrast(${previewContrast / 100})`;
    switch (previewFilter) {
      case "sepia":        f += " sepia(100%)"; break;
      case "grayscale":    f += " grayscale(100%)"; break;
      case "invert":       f += " invert(100%)"; break;
      case "warm":         f += " sepia(30%) saturate(120%)"; break;
      case "cool":         f += " saturate(80%) hue-rotate(20deg)"; break;
      case "highcontrast": f += " contrast(180%)"; break;
      case "saturate":     f += " saturate(200%)"; break;
      case "desaturate":   f += " saturate(30%)"; break;
    }
    return f;
  }

  function applyPreviewFilter() {
    pImg.style.filter = buildPreviewFilter();
  }

  function setPreviewZoom(z) {
    previewZoom = Math.max(0.1, Math.min(10, z));
    pImg.style.width = (previewZoom * 100) + "%";
    pImg.style.height = "auto";
    pZoomLevel.textContent = Math.round(previewZoom * 100) + "%";
  }

  function resetPreviewControls() {
    previewZoom = 1;
    previewFilter = "none";
    previewBrightness = 100;
    previewContrast = 100;
    pFilterSelect.value = "none";
    pBrightSlider.value = 100;
    pBrightVal.textContent = "100%";
    pContrastSlider.value = 100;
    pContrastVal.textContent = "C:100%";
    pImg.style.filter = "";
    pImg.style.width = "";
    pImg.style.height = "";
    pZoomLevel.textContent = "100%";
  }

  function openPreview(img) {
    resetPreviewControls();
    pImg.src = img.src;
    document.getElementById("preview-filename").textContent = decodeURIComponent(img.filename || "image");
    document.getElementById("preview-dimensions").textContent =
      (img.width && img.height) ? `${img.width} x ${img.height} · ${img.type || "unknown"}` : (img.type || "");
    document.getElementById("preview-alt").textContent = img.alt || "";
    document.getElementById("preview-open").href = img.src;
    document.getElementById("preview-download").href = img.src;
    document.getElementById("preview-download").download = img.filename || "image";

    // Track position for prev/next
    previewCurrentImages = getFiltered();
    previewCurrentIndex = previewCurrentImages.indexOf(img);

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

    pModal.classList.remove("hidden");
  }

  function closePreview() {
    pModal.classList.add("hidden");
    resetPreviewControls();
  }

  function navigatePreview(delta) {
    if (!previewCurrentImages.length) return;
    previewCurrentIndex = (previewCurrentIndex + delta + previewCurrentImages.length) % previewCurrentImages.length;
    const img = previewCurrentImages[previewCurrentIndex];
    resetPreviewControls();
    pImg.src = img.src;
    document.getElementById("preview-filename").textContent = decodeURIComponent(img.filename || "image");
    document.getElementById("preview-dimensions").textContent =
      (img.width && img.height) ? `${img.width} x ${img.height} · ${img.type || "unknown"}` : (img.type || "");
    document.getElementById("preview-alt").textContent = img.alt || "";
    document.getElementById("preview-open").href = img.src;
    document.getElementById("preview-download").href = img.src;
    document.getElementById("preview-download").download = img.filename || "image";
  }

  // Zoom controls
  document.getElementById("preview-zoom-in").addEventListener("click", () => setPreviewZoom(previewZoom * 1.25));
  document.getElementById("preview-zoom-out").addEventListener("click", () => setPreviewZoom(previewZoom / 1.25));
  document.getElementById("preview-zoom-fit").addEventListener("click", () => {
    pImg.style.width = "";
    pImg.style.height = "";
    previewZoom = 1;
    pZoomLevel.textContent = "Fit";
  });
  document.getElementById("preview-zoom-actual").addEventListener("click", () => {
    // Set image to its natural size
    const natW = pImg.naturalWidth || 800;
    const containerW = pContainer.clientWidth;
    setPreviewZoom(natW / containerW);
  });

  // Scroll wheel zoom
  pContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setPreviewZoom(previewZoom * factor);
  }, { passive: false });

  // Pan with mouse drag
  let isDragging = false, dragStartX = 0, dragStartY = 0, scrollStartX = 0, scrollStartY = 0;
  pContainer.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    scrollStartX = pContainer.scrollLeft;
    scrollStartY = pContainer.scrollTop;
    pContainer.classList.add("dragging");
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    pContainer.scrollLeft = scrollStartX - (e.clientX - dragStartX);
    pContainer.scrollTop = scrollStartY - (e.clientY - dragStartY);
  });
  document.addEventListener("mouseup", () => {
    isDragging = false;
    pContainer.classList.remove("dragging");
  });

  // Per-image filter controls
  pFilterSelect.addEventListener("change", () => {
    previewFilter = pFilterSelect.value;
    applyPreviewFilter();
  });
  pBrightSlider.addEventListener("input", () => {
    previewBrightness = parseInt(pBrightSlider.value);
    pBrightVal.textContent = previewBrightness + "%";
    applyPreviewFilter();
  });
  pContrastSlider.addEventListener("input", () => {
    previewContrast = parseInt(pContrastSlider.value);
    pContrastVal.textContent = "C:" + previewContrast + "%";
    applyPreviewFilter();
  });
  document.getElementById("preview-filter-reset").addEventListener("click", resetPreviewControls);

  // Double-click sliders to reset
  pBrightSlider.addEventListener("dblclick", () => {
    pBrightSlider.value = 100;
    previewBrightness = 100;
    pBrightVal.textContent = "100%";
    applyPreviewFilter();
  });
  pContrastSlider.addEventListener("dblclick", () => {
    pContrastSlider.value = 100;
    previewContrast = 100;
    pContrastVal.textContent = "C:100%";
    applyPreviewFilter();
  });

  document.querySelector(".preview-backdrop").addEventListener("click", closePreview);
  document.querySelector(".preview-close").addEventListener("click", closePreview);
  document.addEventListener("keydown", (e) => {
    if (!compareModal.classList.contains("hidden") && e.key === "Escape") {
      compareModal.classList.add("hidden"); return;
    }
    if (pModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closePreview();
    else if (e.key === "ArrowLeft") navigatePreview(-1);
    else if (e.key === "ArrowRight") navigatePreview(1);
    else if (e.key === "+" || e.key === "=") setPreviewZoom(previewZoom * 1.25);
    else if (e.key === "-") setPreviewZoom(previewZoom / 1.25);
    else if (e.key === "0") { resetPreviewControls(); }
  });

  // ── Filter Tabs ──

  // Source tabs
  document.querySelectorAll("#source-tabs .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#source-tabs .tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      render();
    });
  });

  // Type tabs
  document.querySelectorAll("#type-tabs .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#type-tabs .tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentTypeFilter = tab.dataset.type;
      render();
    });
  });

  // Color tabs
  document.querySelectorAll("#color-tabs .color-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#color-tabs .color-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentColorFilter = tab.dataset.color;
      render();
    });
  });

  document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    render();
  });

  document.getElementById("size-filter").addEventListener("change", (e) => {
    const v = e.target.value;
    if (v === "0") {
      sizeMode = "none";
      sizeThreshold = 0;
    } else if (v.startsWith("min-")) {
      sizeMode = "min";
      sizeThreshold = parseInt(v.slice(4));
    } else if (v.startsWith("max-")) {
      sizeMode = "max";
      sizeThreshold = parseInt(v.slice(4));
    }
    render();
  });

  document.getElementById("sort-by").addEventListener("change", (e) => {
    sortBy = e.target.value;
    render();
  });

  // View toggle
  document.getElementById("view-list").addEventListener("change", (e) => {
    listView = e.target.checked;
    document.getElementById("view-icon").textContent = listView ? "List" : "Grid";
    render();
  });

  // ── Display Controls ──

  const grid = document.getElementById("image-grid");
  let currentDisplayFilter = "none";
  let currentBrightness = 1;

  function buildFilterCSS() {
    let f = `brightness(${currentBrightness})`;
    switch (currentDisplayFilter) {
      case "sepia":        f += " sepia(100%)"; break;
      case "grayscale":    f += " grayscale(100%)"; break;
      case "invert":       f += " invert(100%)"; break;
      case "warm":         f += " sepia(30%) saturate(120%)"; break;
      case "cool":         f += " saturate(80%) hue-rotate(20deg)"; break;
      case "highcontrast": f += " contrast(200%)"; break;
    }
    return f;
  }

  function applyDisplaySettings() {
    grid.style.setProperty("--img-brightness", currentBrightness);
  }

  // Background swatches
  document.querySelectorAll(".bg-swatch").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bg-swatch").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      grid.classList.remove("bg-white", "bg-light", "bg-mid", "bg-black", "bg-checker");
      const bg = btn.dataset.bg;
      if (bg !== "default") grid.classList.add("bg-" + bg);
    });
  });

  // Color filter buttons
  document.querySelectorAll(".filter-swatch").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-swatch").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      grid.classList.remove("filter-sepia", "filter-grayscale", "filter-invert", "filter-warm", "filter-cool", "filter-highcontrast");
      currentDisplayFilter = btn.dataset.filter;
      if (currentDisplayFilter !== "none") grid.classList.add("filter-" + currentDisplayFilter);
      applyDisplaySettings();
    });
  });

  // Brightness slider
  const brightnessSlider = document.getElementById("brightness-slider");
  const brightnessValEl = document.getElementById("brightness-val");
  grid.style.setProperty("--img-brightness", "1");
  brightnessSlider.addEventListener("input", () => {
    currentBrightness = brightnessSlider.value / 100;
    brightnessValEl.textContent = brightnessSlider.value + "%";
    applyDisplaySettings();
  });
  brightnessSlider.addEventListener("dblclick", () => {
    brightnessSlider.value = 100;
    currentBrightness = 1;
    brightnessValEl.textContent = "100%";
    applyDisplaySettings();
  });

  // ── Bulk Actions ──

  document.getElementById("select-all").addEventListener("click", () => {
    getFiltered().forEach(img => selected.add(img.src));
    render();
  });

  document.getElementById("deselect-all").addEventListener("click", () => {
    selected.clear();
    showSelectedOnly = false;
    const ssBtn = document.getElementById("show-selected-only");
    ssBtn.textContent = "Show Selected";
    ssBtn.classList.remove("active-toggle");
    render();
  });

  document.getElementById("show-selected-only").addEventListener("click", () => {
    showSelectedOnly = !showSelectedOnly;
    const ssBtn = document.getElementById("show-selected-only");
    ssBtn.textContent = showSelectedOnly ? "Show All" : "Show Selected";
    ssBtn.classList.toggle("active-toggle", showSelectedOnly);
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

  // ── AI Vision Search ──

  const aiInput = document.getElementById("ai-search-input");
  const aiBtn = document.getElementById("ai-search-btn");
  const aiClear = document.getElementById("ai-search-clear");
  const aiStatus = document.getElementById("ai-search-status");

  async function runAiSearch() {
    const query = aiInput.value.trim();
    if (!query || aiSearching) return;

    aiSearching = true;
    aiBtn.disabled = true;
    aiBtn.textContent = "Searching...";
    aiStatus.className = "ai-search-status active";
    aiStatus.textContent = "Preparing images...";
    aiClear.classList.add("hidden");

    const searchId = `ais-${Date.now()}`;
    // Only send vision-compatible raster images to AI (skip SVG, ICO, unknown)
    const filtered = getFiltered().filter(img => AI_VISION_TYPES.has(img.typeNorm));
    const skipped = getFiltered().length - filtered.length;

    if (filtered.length === 0) {
      aiSearching = false;
      aiBtn.disabled = false;
      aiBtn.textContent = "Search Images";
      aiStatus.className = "ai-search-status error";
      aiStatus.textContent = "No vision-compatible images (SVG/ICO cannot be analyzed by AI)";
      return;
    }

    if (skipped > 0) {
      aiStatus.textContent = `Preparing ${filtered.length} images (${skipped} SVG/ICO skipped)...`;
    }

    // Poll for progress updates
    const progressInterval = setInterval(async () => {
      try {
        const key = `ai-search-progress-${searchId}`;
        const data = (await browser.storage.local.get(key))[key];
        if (data) {
          aiStatus.textContent = `Scanning ${data.scanned}/${data.total} images... (${data.matches} matches)`;
        }
      } catch {}
    }, 800);

    // Build a map from filtered index → global images index
    const filteredGlobalMap = filtered.map(img => images.indexOf(img));

    try {
      const result = await browser.runtime.sendMessage({
        action: "aiImageSearch",
        query,
        images: filtered,
        searchId
      });

      clearInterval(progressInterval);

      if (result.success) {
        // Map match indices back to global image indices
        aiMatchIndices = new Set(result.matchIndices.map(i => filteredGlobalMap[i]));
        aiStatus.className = "ai-search-status active";
        const skipNote = skipped > 0 ? ` (${skipped} SVG/ICO skipped)` : "";
        aiStatus.textContent = `Found ${aiMatchIndices.size} match${aiMatchIndices.size !== 1 ? "es" : ""} for "${query}"${skipNote}`;
        aiClear.classList.remove("hidden");

        // Auto-select matches
        for (const idx of aiMatchIndices) {
          if (images[idx]) selected.add(images[idx].src);
        }
      } else {
        aiStatus.className = "ai-search-status error";
        aiStatus.textContent = result.error || "AI search failed";
      }
    } catch (e) {
      clearInterval(progressInterval);
      aiStatus.className = "ai-search-status error";
      aiStatus.textContent = e.message || "AI search failed";
    }

    aiSearching = false;
    aiBtn.disabled = false;
    aiBtn.textContent = "Search Images";
    render();
  }

  aiBtn.addEventListener("click", runAiSearch);
  aiInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runAiSearch();
  });

  aiClear.addEventListener("click", () => {
    aiMatchIndices = null;
    aiInput.value = "";
    aiStatus.textContent = "";
    aiStatus.className = "ai-search-status";
    aiClear.classList.add("hidden");
    render();
  });

  // ── Compare Mode ──

  const compareModal = document.getElementById("compare-modal");
  const comparePanels = document.getElementById("compare-panels");
  const compareInfo = document.getElementById("compare-info");
  let compareMode = "side"; // "side", "overlay", "diff"

  document.getElementById("compare-selected").addEventListener("click", () => {
    if (selected.size < 2) return;
    openCompare([...selected].slice(0, 4)); // max 4 images
  });

  function openCompare(srcs) {
    comparePanels.innerHTML = "";
    comparePanels.className = "compare-panels";
    compareInfo.innerHTML = "";

    const compareImages = srcs.map(src => images.find(i => i.src === src)).filter(Boolean);
    if (compareImages.length < 2) return;

    compareImages.forEach((img, idx) => {
      const panel = document.createElement("div");
      panel.className = "compare-panel";
      const el = document.createElement("img");
      el.src = img.src;
      el.alt = img.alt || "";
      panel.appendChild(el);
      const label = document.createElement("div");
      label.className = "compare-panel-label";
      label.textContent = `${decodeURIComponent(img.filename || "image")}${img.width ? ` (${img.width}x${img.height})` : ""}`;
      panel.appendChild(label);
      comparePanels.appendChild(panel);
    });

    // Info row
    compareImages.forEach((img, i) => {
      const span = document.createElement("span");
      span.innerHTML = `<strong>${i + 1}.</strong> ${decodeURIComponent(img.filename || "image")} — ${img.width || "?"}x${img.height || "?"} · ${(img.type || "unknown").toUpperCase()}`;
      compareInfo.appendChild(span);
    });

    applyCompareMode();
    compareModal.classList.remove("hidden");
  }

  function applyCompareMode() {
    const opSlider = document.getElementById("compare-opacity");
    const opVal = document.getElementById("compare-opacity-val");
    const panels = comparePanels.querySelectorAll(".compare-panel");

    // Reset all inline styles from previous mode
    comparePanels.classList.remove("overlay-mode", "diff-mode");
    panels.forEach(p => {
      p.style.opacity = "";
      p.style.display = "";
    });

    if (compareMode === "overlay" || compareMode === "diff") {
      comparePanels.classList.add(compareMode === "overlay" ? "overlay-mode" : "diff-mode");
      // Only first 2 panels matter for overlay/diff — hide extras
      panels.forEach((p, i) => { if (i > 1) p.style.display = "none"; });
      if (compareMode === "overlay") {
        opSlider.style.display = "";
        opVal.style.display = "";
        if (panels[1]) panels[1].style.opacity = opSlider.value / 100;
      } else {
        opSlider.style.display = "none";
        opVal.style.display = "none";
      }
    } else {
      // Side by side — show all panels
      opSlider.style.display = "none";
      opVal.style.display = "none";
    }
  }

  document.querySelectorAll(".compare-toolbar .btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!btn.dataset.mode) return;
      document.querySelectorAll(".compare-toolbar .btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      compareMode = btn.dataset.mode;
      applyCompareMode();
    });
  });

  document.getElementById("compare-opacity").addEventListener("input", (e) => {
    const val = e.target.value;
    document.getElementById("compare-opacity-val").textContent = val + "%";
    const panels = comparePanels.querySelectorAll(".compare-panel");
    if (panels[1]) panels[1].style.opacity = val / 100;
  });

  document.getElementById("compare-close").addEventListener("click", () => {
    compareModal.classList.add("hidden");
  });
  compareModal.querySelector(".preview-backdrop").addEventListener("click", () => {
    compareModal.classList.add("hidden");
  });

  // Initial render
  render();

  // Start color extraction in background after initial render
  extractAllColors().then(() => render()); // re-render to add color dots

  // Cleanup stored data after load (it's in memory now)
  // browser.storage.local.remove(storeKey); // Keep for now in case user refreshes
})();
