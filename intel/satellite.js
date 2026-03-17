(function () {
  'use strict';

  let map = null;
  let baseTileLayer = null;
  let imageLayerA = null;
  let imageLayerB = null;
  let layerA = 'trueColor';
  let layerB = 'trueColor';
  let resolutionA = 1024;
  let resolutionB = 1024;
  let defaultResolution = 1024;
  let maxCloudCoverage = 40;
  let dateWindowA = 14;
  let dateWindowB = 14;
  let brightnessFactor = 2.5;
  let dualMode = false;
  let bboxB = null; // separate bbox for location B in dual mode

  function getEvalscripts() {
    const g = brightnessFactor.toFixed(1);
    return {
      trueColor: `//VERSION=3\nfunction setup(){return{input:["B02","B03","B04"],output:{bands:3}}}\nfunction evaluatePixel(s){return[${g}*s.B04,${g}*s.B03,${g}*s.B02]}`,
      falseColor: `//VERSION=3\nfunction setup(){return{input:["B03","B04","B08"],output:{bands:3}}}\nfunction evaluatePixel(s){return[${g}*s.B08,${g}*s.B04,${g}*s.B03]}`,
      ndvi: `//VERSION=3\nfunction setup(){return{input:["B04","B08"],output:{bands:3}}}\nfunction evaluatePixel(s){var v=(s.B08-s.B04)/(s.B08+s.B04);return v<0?[1,0,0]:v<0.3?[1,0.5+v,0]:[0,0.5+v*0.5,0]}`,
      moisture: `//VERSION=3\nfunction setup(){return{input:["B8A","B11"],output:{bands:3}}}\nfunction evaluatePixel(s){var v=(s.B8A-s.B11)/(s.B8A+s.B11);return v<0?[0.8,0.2,0]:v<0.3?[1,1,0]:[0,0.3+v*0.7,1]}`,
    };
  }
  let currentLocation = '';
  let pins = [];
  let pinMarkers = [];

  // Selected scene metadata per panel (null = no specific scene selected)
  let selectedSceneA = null;
  let selectedSceneB = null;

  // Default dates — both start at yesterday (B mirrors A in single mode)
  const today = new Date();
  const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
  const defaultDate = yesterday.toISOString().slice(0, 10);
  document.getElementById('satDateA').value = defaultDate;
  document.getElementById('satDateB').value = defaultDate;

  // ── Init map ──
  function initMap() {
    if (map) return;
    map = L.map('satMap', { center: [34.05, -118.25], zoom: 12 });

    baseTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    map.on('moveend', updateMapInfo);
    updateMapInfo();
  }

  function updateMapInfo() {
    if (!map) return;
    const c = map.getCenter();
    document.getElementById('satMapCenter').textContent = `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
    document.getElementById('satMapZoom').textContent = `Zoom: ${map.getZoom()}`;
  }

  // ── Jump to location ──
  document.getElementById('satJumpBtn').addEventListener('click', () => jumpToLocation());
  document.getElementById('satSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jumpToLocation();
  });

  async function jumpToLocation() {
    const query = document.getElementById('satSearchInput').value.trim();
    if (!query) return;
    currentLocation = query;

    const btn = document.getElementById('satJumpBtn');
    btn.disabled = true;
    btn.textContent = 'Finding...';

    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'Argus/1.0' }
      });
      const results = await resp.json();
      if (results.length) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        map.setView([lat, lon], 14);
        // Auto-search scenes for both panels, auto-selects best and loads imagery
        try {
          await searchScenes('A');
          if (dualMode) await searchScenes('B');
        } catch { /* silent */ }
      } else {
        document.getElementById('satImageryStatus').textContent = 'Location not found';
      }
    } catch (e) {
      document.getElementById('satImageryStatus').textContent = 'Geocode error: ' + e.message;
    }

    btn.disabled = false;
    btn.textContent = 'Go';
  }

  // ── Layer type selection (per image) ──
  document.querySelectorAll('.sat-layer-btn-a').forEach(btn => {
    btn.addEventListener('click', async () => {
      layerA = btn.dataset.layer;
      document.querySelectorAll('.sat-layer-btn-a').forEach(b => b.classList.toggle('active', b === btn));
      if (imageLayerA && map) await reloadSingleImage('A');
    });
  });
  document.querySelectorAll('.sat-layer-btn-b').forEach(btn => {
    btn.addEventListener('click', async () => {
      layerB = btn.dataset.layer;
      document.querySelectorAll('.sat-layer-btn-b').forEach(b => b.classList.toggle('active', b === btn));
      if (imageLayerB && map) await reloadSingleImage('B');
    });
  });

  // ── Today buttons ──
  document.getElementById('satTodayA')?.addEventListener('click', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const val = yesterday.toISOString().slice(0, 10);
    document.getElementById('satDateA').value = val;
    // In single mode, B mirrors A's date
    if (!dualMode) document.getElementById('satDateB').value = val;
  });
  document.getElementById('satTodayB')?.addEventListener('click', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    document.getElementById('satDateB').value = yesterday.toISOString().slice(0, 10);
  });

  // In single mode, changing Date A also updates Date B
  document.getElementById('satDateA')?.addEventListener('change', () => {
    if (!dualMode) {
      document.getElementById('satDateB').value = document.getElementById('satDateA').value;
    }
  });

  // ── Dual mode toggle ──
  document.getElementById('satDualCheck')?.addEventListener('change', (e) => {
    dualMode = e.target.checked;
    const inputB = document.getElementById('satSearchInputB');
    const btnB = document.getElementById('satJumpBtnB');
    const basemapBRow = document.getElementById('satBasemapBRow');

    if (dualMode) {
      inputB.disabled = false;
      btnB.disabled = false;
      inputB.placeholder = document.getElementById('satSearchInput').value || 'Location B...';
      if (basemapBRow) basemapBRow.style.display = '';
    } else {
      inputB.disabled = true;
      btnB.disabled = true;
      bboxB = null;
      // Re-sync B to A (single mode = same source imagery)
      document.getElementById('satDateB').value = document.getElementById('satDateA').value;
      dateWindowB = dateWindowA;
      document.getElementById('satDateWindowB').value = dateWindowA;
      document.getElementById('satDateWindowBVal').textContent = `±${dateWindowA}d`;
      if (basemapBRow) basemapBRow.style.display = 'none';
    }
  });

  // Mirror A search text to B placeholder
  document.getElementById('satSearchInput')?.addEventListener('input', () => {
    if (!dualMode) {
      const inputB = document.getElementById('satSearchInputB');
      if (inputB) inputB.placeholder = document.getElementById('satSearchInput').value || 'Location B...';
    }
  });

  // Jump to location B
  document.getElementById('satJumpBtnB')?.addEventListener('click', () => jumpToLocationB());
  document.getElementById('satSearchInputB')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jumpToLocationB();
  });

  async function jumpToLocationB() {
    const query = document.getElementById('satSearchInputB').value.trim();
    console.log('[Satellite] jumpToLocationB called, query:', query, 'dualMode:', dualMode);
    if (!query) return;

    const btn = document.getElementById('satJumpBtnB');
    btn.disabled = true;
    btn.textContent = 'Finding...';

    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'Argus/1.0' }
      });
      const results = await resp.json();
      if (results.length) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        // Create a bbox matching the EXACT proportions of the current map viewport
        const bounds = map.getBounds();
        const halfLat = (bounds.getNorth() - bounds.getSouth()) / 2;
        const halfLon = (bounds.getEast() - bounds.getWest()) / 2;
        bboxB = [lon - halfLon, lat - halfLat, lon + halfLon, lat + halfLat];
        document.getElementById('satImageryStatus').textContent = `Location B set: ${query} — searching scenes...`;

        // Auto-search scenes for B with its new location
        await searchScenes('B');

        // Auto-slide to 50/50 so user can see both
        const slider = document.getElementById('satOpacitySlider');
        slider.value = 50;
        slider.dispatchEvent(new Event('input'));
      } else {
        document.getElementById('satImageryStatus').textContent = `Location B not found: ${query}`;
      }
    } catch (e) {
      document.getElementById('satImageryStatus').textContent = 'Geocode error: ' + e.message;
    }

    btn.disabled = false;
    btn.textContent = 'Go';
  }

  // ── Load imagery ──
  document.getElementById('satLoadImagery').addEventListener('click', async () => {
    // If scenes have been searched, re-search to refresh; otherwise fall back to direct load
    const hasScenes = document.getElementById('satSceneListA').children.length > 0;
    if (hasScenes) {
      await searchScenes('A');
      if (dualMode) await searchScenes('B');
    } else {
      await loadImagery();
    }
  });

  async function loadImagery() {
    if (!map) return;

    const btn = document.getElementById('satLoadImagery');
    const statusEl = document.getElementById('satImageryStatus');
    btn.disabled = true;
    btn.textContent = 'Loading...';
    btn.style.opacity = '1';
    statusEl.textContent = 'Fetching satellite imagery...';

    const bounds = map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ];

    const dateA = document.getElementById('satDateA').value;
    const dateB = document.getElementById('satDateB').value;

    try {
      // In dual mode, Image B uses a different location + its own date
      // In single mode, Image B mirrors A's location & date (user differentiates via filters/enhancements)
      const bboxForB = (dualMode && bboxB) ? bboxB : bbox;
      const dateForB = dualMode ? dateB : dateA;

      // Load both images in parallel with their respective layers + resolutions
      const [respA, respB] = await Promise.all([
        fetchSatImage(bbox, dateA, getEvalscripts()[layerA], resolutionA, dateWindowA),
        fetchSatImage(bboxForB, dateForB, getEvalscripts()[layerB], resolutionB, dateWindowB),
      ]);

      // Remove old overlays completely
      if (imageLayerA) { try { map.removeLayer(imageLayerA); } catch (e) {} }
      if (imageLayerB) { try { map.removeLayer(imageLayerB); } catch (e) {} }
      imageLayerA = null;
      imageLayerB = null;

      const imageBounds = L.latLngBounds(
        [bounds.getSouth(), bounds.getWest()],
        [bounds.getNorth(), bounds.getEast()]
      );

      // Get current slider position for opacity
      const slider = document.getElementById('satOpacitySlider');
      const currentVal = parseInt(slider.value);

      // Add Image A as base overlay
      if (respA?.success && respA.imageUrl) {
        imageLayerA = L.imageOverlay(respA.imageUrl, imageBounds, {
          opacity: independentMode ? parseInt(document.getElementById('satOpacityA').value) / 100 : (1 - currentVal / 100)
        }).addTo(map);
      }

      // Add Image B on top
      if (respB?.success && respB.imageUrl) {
        imageLayerB = L.imageOverlay(respB.imageUrl, imageBounds, {
          opacity: independentMode ? parseInt(document.getElementById('satOpacityB').value) / 100 : (currentVal / 100)
        }).addTo(map);
      }

      // Ensure correct z-order: A bottom, B middle, basemap on top (if visible)
      if (imageLayerA) imageLayerA.setZIndex(100);
      if (imageLayerB) imageLayerB.setZIndex(200);

      // Dim basemap if imagery loaded — keep at 15% so user isn't lost if imagery is blank
      if (baseTileLayer && (imageLayerA || imageLayerB)) {
        baseTileLayer.setOpacity(0.15);
        if (map.hasLayer(baseTileLayer)) baseTileLayer.bringToFront();
        document.getElementById('satBasemapSlider').value = 15;
        document.getElementById('satBasemapVal').textContent = '15%';
      }

      applyEnhanceFilters();

      // Enable actions
      document.getElementById('satSaveToKg').disabled = false;
      document.getElementById('satCaptureView').disabled = false;
      document.getElementById('satCaptureViewSaveAs').disabled = false;
      document.getElementById('satCollectView').disabled = false;

      const hasA = !!respA?.success;
      const hasB = !!respB?.success;
      const errA = !hasA ? (respA?.error || 'no data') : '';
      const errB = !hasB ? (respB?.error || 'no data') : '';
      let status = `A: ${hasA ? dateA : errA} (${layerA}) · B: ${hasB ? dateForB : errB} (${layerB})`;
      if (!hasA && !hasB) {
        status = `⚠ No imagery returned — try widening ±Days or click Scenes`;
        // Flash the Scenes buttons to draw attention
        ['satFindScenesA', 'satFindScenesB'].forEach(id => {
          const btn = document.getElementById(id);
          if (btn) {
            btn.classList.add('flashing');
            setTimeout(() => btn.classList.remove('flashing'), 4000);
          }
        });
      }
      statusEl.textContent = status;
      console.log('[Satellite] loadImagery result — A:', respA, 'B:', respB);

    } catch (e) {
      statusEl.textContent = 'Error: ' + e.message;
      console.error('[Satellite] loadImagery error:', e);
    }

    btn.disabled = false;
    btn.textContent = 'Refresh Imagery';
    btn.style.opacity = '';
    refreshChatContext();
  }

  // ── Image cache (avoids re-fetching identical requests) ──
  const imageCache = new Map();
  const IMAGE_CACHE_MAX = 50;

  function imageCacheKey(bbox, dateFrom, dateTo, evalscript, resolution) {
    const b = bbox.map(v => v.toFixed(4)).join(',');
    const es = evalscript.slice(0, 32);
    return `${b}|${dateFrom}|${dateTo}|${es}|${resolution}|${maxCloudCoverage}`;
  }

  async function fetchSatImage(bbox, date, evalscript, resolution, windowDays, exactFrom, exactTo) {
    // If exact date range provided (from catalog scene), use it directly
    // Otherwise compute from date ± windowDays
    let rangeStart, rangeEnd;
    if (exactFrom && exactTo) {
      rangeStart = new Date(exactFrom);
      rangeEnd = new Date(exactTo);
    } else {
      const days = windowDays || 14;
      const targetDate = new Date(date);
      rangeStart = new Date(targetDate.getTime() - days * 24 * 60 * 60 * 1000);
      rangeEnd = new Date(targetDate.getTime() + days * 24 * 60 * 60 * 1000);
    }

    const cacheKey = imageCacheKey(bbox, rangeStart.toISOString(), rangeEnd.toISOString(), evalscript, resolution);
    if (imageCache.has(cacheKey)) {
      console.log('[Satellite] cache hit:', cacheKey.slice(0, 60));
      return imageCache.get(cacheKey);
    }

    const maxDim = resolution || defaultResolution;
    const bboxWidth = bbox[2] - bbox[0];
    const bboxHeight = bbox[3] - bbox[1];
    const aspect = bboxWidth / bboxHeight;
    const width = aspect >= 1 ? maxDim : Math.round(maxDim * aspect);
    const height = aspect >= 1 ? Math.round(maxDim / aspect) : maxDim;

    const resp = await browser.runtime.sendMessage({
      action: 'sentinelGetImage',
      bbox,
      dateFrom: rangeStart.toISOString(),
      dateTo: rangeEnd.toISOString(),
      options: { width, height, maxCloudCoverage, evalscript }
    });

    // Only cache successful responses
    if (resp?.success && resp.imageUrl) {
      // Evict oldest entries if cache is full
      if (imageCache.size >= IMAGE_CACHE_MAX) {
        const oldest = imageCache.keys().next().value;
        imageCache.delete(oldest);
      }
      imageCache.set(cacheKey, resp);
    }

    return resp;
  }

  // ── Reload single image (when layer changes) ──
  async function reloadSingleImage(panel) {
    console.log('[Satellite] reloadSingleImage called, panel:', panel, 'dualMode:', dualMode, 'bboxB:', bboxB);
    if (!map) { console.log('[Satellite] no map'); return; }
    const bounds = map.getBounds();
    const mapBbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const bbox = (panel === 'B' && dualMode && bboxB) ? bboxB : mapBbox;
    console.log('[Satellite] using bbox:', bbox);
    // In single mode, B mirrors A's date; in dual mode each has its own
    const date = (panel === 'B' && !dualMode)
      ? document.getElementById('satDateA').value
      : document.getElementById(panel === 'A' ? 'satDateA' : 'satDateB').value;
    const layer = panel === 'A' ? layerA : layerB;
    const res = panel === 'A' ? resolutionA : resolutionB;

    const statusEl = document.getElementById('satImageryStatus');
    statusEl.textContent = `Reloading Image ${panel} (${layer})...`;

    try {
      const window = panel === 'A' ? dateWindowA : dateWindowB;
      const resp = await fetchSatImage(bbox, date, getEvalscripts()[layer], res, window);
      if (resp?.success && resp.imageUrl) {
        const imageBounds = L.latLngBounds(
          [bounds.getSouth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getEast()]
        );
        const slider = document.getElementById('satOpacitySlider');
        const sliderVal = parseInt(slider.value);

        if (panel === 'A') {
          if (imageLayerA) { try { map.removeLayer(imageLayerA); } catch (e) {} }
          const opacity = independentMode
            ? parseInt(document.getElementById('satOpacityA').value) / 100
            : (1 - sliderVal / 100);
          imageLayerA = L.imageOverlay(resp.imageUrl, imageBounds, { opacity }).addTo(map);
          imageLayerA.setZIndex(100);
        } else {
          if (imageLayerB) { try { map.removeLayer(imageLayerB); } catch (e) {} }
          const opacity = independentMode
            ? parseInt(document.getElementById('satOpacityB').value) / 100
            : (sliderVal / 100);
          imageLayerB = L.imageOverlay(resp.imageUrl, imageBounds, { opacity }).addTo(map);
          imageLayerB.setZIndex(200);
        }
        applyEnhanceFilters();
        statusEl.textContent = `Image ${panel} reloaded (${layer})`;
      } else {
        statusEl.textContent = `⚠ Image ${panel} failed: ${resp?.error || 'no data returned'}`;
        console.warn('[Satellite] reloadSingleImage failed:', resp);
      }
    } catch (e) {
      statusEl.textContent = `Error reloading ${panel}: ${e.message}`;
      console.error('[Satellite] reloadSingleImage error:', e);
    }
  }

  // ── Scene catalog search ──

  async function searchScenes(panel) {
    if (!map) return;
    const bounds = map.getBounds();
    const mapBbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const bbox = (panel === 'B' && dualMode && bboxB) ? bboxB : mapBbox;
    const date = document.getElementById(panel === 'A' ? 'satDateA' : 'satDateB').value;
    const window = panel === 'A' ? dateWindowA : dateWindowB;

    const targetDate = new Date(date);
    const dateFrom = new Date(targetDate.getTime() - window * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = new Date(targetDate.getTime() + window * 24 * 60 * 60 * 1000).toISOString();

    const listEl = document.getElementById(panel === 'A' ? 'satSceneListA' : 'satSceneListB');
    const infoEl = document.getElementById(panel === 'A' ? 'satSceneInfoA' : 'satSceneInfoB');
    listEl.innerHTML = '<div style="font-size:10px;color:var(--text-muted);padding:4px;">Searching...</div>';
    infoEl.textContent = '';

    try {
      const resp = await browser.runtime.sendMessage({
        action: 'sentinelCatalog',
        bbox,
        dateFrom,
        dateTo,
        options: { maxCloudCoverage, limit: 20 }
      });

      if (!resp?.success || !resp.scenes?.length) {
        listEl.innerHTML = '<div style="font-size:10px;color:var(--text-muted);padding:4px;">No scenes found — widen ±Days or adjust cloud cover</div>';
        // Pulse the ±Days slider and Scenes button to draw attention
        const windowSlider = document.getElementById(panel === 'A' ? 'satDateWindowA' : 'satDateWindowB');
        const scenesBtn = document.getElementById(panel === 'A' ? 'satFindScenesA' : 'satFindScenesB');
        if (windowSlider) { windowSlider.classList.add('pulse-hint'); setTimeout(() => windowSlider.classList.remove('pulse-hint'), 3500); }
        if (scenesBtn) { scenesBtn.classList.add('flashing'); setTimeout(() => scenesBtn.classList.remove('flashing'), 3500); }
        return;
      }

      listEl.innerHTML = '';
      resp.scenes.forEach((scene, i) => {
        const item = document.createElement('div');
        item.className = 'sat-scene-item';
        item.dataset.index = i;
        const cc = scene.cloudCover !== null ? scene.cloudCover.toFixed(0) + '%' : '?';
        item.innerHTML = `<span class="sat-scene-date">${scene.date}</span>` +
          `<span class="sat-scene-cloud">☁${cc}</span>` +
          `<span class="sat-scene-sat">${scene.satellite}</span>` +
          `<span style="flex:1"></span>` +
          `<span style="font-size:9px;color:var(--text-muted)">${scene.time}</span>`;

        item.addEventListener('click', () => selectScene(panel, scene, item));
        listEl.appendChild(item);
      });

      // Auto-select the best scene (lowest cloud cover)
      const best = resp.scenes.reduce((a, b) =>
        (a.cloudCover ?? 100) <= (b.cloudCover ?? 100) ? a : b
      );
      const bestIdx = resp.scenes.indexOf(best);
      const bestEl = listEl.children[bestIdx];
      if (bestEl) selectScene(panel, best, bestEl);

    } catch (e) {
      listEl.innerHTML = `<div style="font-size:10px;color:var(--text-muted);padding:4px;">Error: ${e.message}</div>`;
      console.error('[Satellite] searchScenes error:', e);
    }
  }

  async function selectScene(panel, scene, itemEl) {
    // Highlight selected
    const listEl = itemEl.parentElement;
    listEl.querySelectorAll('.sat-scene-item').forEach(el => el.classList.remove('active'));
    itemEl.classList.add('active');

    // Store selected scene and reset source label to Satellite
    if (panel === 'A') {
      selectedSceneA = scene;
      const srcA = document.getElementById('satSourceA');
      if (srcA) srcA.textContent = 'Satellite';
    } else {
      selectedSceneB = scene;
      const srcB = document.getElementById('satSourceB');
      if (srcB) srcB.textContent = 'Satellite';
      if (typeof AssetLibrary !== 'undefined') AssetLibrary.markInUse(null);
      const assetLink = document.getElementById('satAssetLinkB');
      if (assetLink) { assetLink.innerHTML = ''; assetLink.style.display = 'none'; }
      // Re-enable swap button
      const swapBtn = document.getElementById('satSwapBtnEnhance');
      if (swapBtn) { swapBtn.disabled = false; swapBtn.style.opacity = ''; }
    }

    // Show scene info
    const infoEl = document.getElementById(panel === 'A' ? 'satSceneInfoA' : 'satSceneInfoB');
    const cc = scene.cloudCover !== null ? scene.cloudCover.toFixed(1) + '%' : '?';
    infoEl.textContent = `${scene.satellite} · ${scene.date} ${scene.time} UTC · ☁${cc}`;

    // Load image with this exact scene's tight time window
    const statusEl = document.getElementById('satImageryStatus');
    statusEl.textContent = `Loading ${panel}: ${scene.date} ${scene.time}...`;

    const bounds = map.getBounds();
    const mapBbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const bbox = (panel === 'B' && dualMode && bboxB) ? bboxB : mapBbox;
    const layer = panel === 'A' ? layerA : layerB;
    const res = panel === 'A' ? resolutionA : resolutionB;

    try {
      // Use the scene's tight dateFrom/dateTo for exact match
      const resp = await fetchSatImage(bbox, scene.date, getEvalscripts()[layer], res,
        0, // window=0 since we provide exact dates
        scene.dateFrom, scene.dateTo // override date range
      );

      if (resp?.success && resp.imageUrl) {
        const imageBounds = L.latLngBounds(
          [bounds.getSouth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getEast()]
        );
        const slider = document.getElementById('satOpacitySlider');
        const sliderVal = parseInt(slider.value);

        if (panel === 'A') {
          if (imageLayerA) { try { map.removeLayer(imageLayerA); } catch (e) {} }
          const opacity = independentMode
            ? parseInt(document.getElementById('satOpacityA').value) / 100
            : (1 - sliderVal / 100);
          imageLayerA = L.imageOverlay(resp.imageUrl, imageBounds, { opacity }).addTo(map);
          imageLayerA.setZIndex(100);
        } else {
          if (imageLayerB) { try { map.removeLayer(imageLayerB); } catch (e) {} }
          const opacity = independentMode
            ? parseInt(document.getElementById('satOpacityB').value) / 100
            : (sliderVal / 100);
          imageLayerB = L.imageOverlay(resp.imageUrl, imageBounds, { opacity }).addTo(map);
          imageLayerB.setZIndex(200);
        }
        applyEnhanceFilters();

        // Enable action buttons
        document.getElementById('satSaveToKg').disabled = false;
        document.getElementById('satCaptureView').disabled = false;
        document.getElementById('satCaptureViewSaveAs').disabled = false;
        document.getElementById('satCollectView').disabled = false;

        statusEl.textContent = `${panel}: ${scene.satellite} · ${scene.date} ${scene.time} UTC · ☁${cc}`;
      } else {
        statusEl.textContent = `⚠ ${panel}: no imagery for scene ${scene.date} — ${resp?.error || ''}`;
      }
    } catch (e) {
      statusEl.textContent = `Error loading scene: ${e.message}`;
    }
  }

  // ── Overlay controls ──
  let independentMode = false;

  // Balance slider
  document.getElementById('satOpacitySlider')?.addEventListener('input', (e) => {
    if (independentMode) return;
    const val = parseInt(e.target.value);
    if (imageLayerA) imageLayerA.setOpacity(1 - val / 100);
    if (imageLayerB) imageLayerB.setOpacity(val / 100);
    const label = val === 0 ? 'Image A (100%)' : val === 100 ? 'Image B (100%)' : `A: ${100 - val}% · B: ${val}%`;
    document.getElementById('satOpacityValue').textContent = label;
  });

  // Independent sliders
  document.getElementById('satOpacityA')?.addEventListener('input', (e) => {
    if (!independentMode) return;
    const val = parseInt(e.target.value);
    if (imageLayerA) imageLayerA.setOpacity(val / 100);
    document.getElementById('satOpacityAVal').textContent = val + '%';
  });
  document.getElementById('satOpacityB')?.addEventListener('input', (e) => {
    if (!independentMode) return;
    const val = parseInt(e.target.value);
    if (imageLayerB) imageLayerB.setOpacity(val / 100);
    document.getElementById('satOpacityBVal').textContent = val + '%';
  });

  // Mode toggle
  document.getElementById('satOpacityMode')?.addEventListener('change', (e) => {
    independentMode = e.target.checked;
    document.getElementById('satBalanceSlider').style.display = independentMode ? 'none' : '';
    document.getElementById('satIndependentSliders').style.display = independentMode ? '' : 'none';

    if (independentMode) {
      // Switch to independent — set both to current levels
      const balVal = parseInt(document.getElementById('satOpacitySlider').value);
      document.getElementById('satOpacityA').value = 100 - balVal;
      document.getElementById('satOpacityB').value = balVal;
      document.getElementById('satOpacityAVal').textContent = (100 - balVal) + '%';
      document.getElementById('satOpacityBVal').textContent = balVal + '%';
    } else {
      // Switch to balance — map current independent values back
      const aVal = parseInt(document.getElementById('satOpacityA').value);
      const bVal = parseInt(document.getElementById('satOpacityB').value);
      // Use B's value as the slider position
      document.getElementById('satOpacitySlider').value = bVal;
      if (imageLayerA) imageLayerA.setOpacity(1 - bVal / 100);
      if (imageLayerB) imageLayerB.setOpacity(bVal / 100);
      const label = bVal === 0 ? 'Image A (100%)' : bVal === 100 ? 'Image B (100%)' : `A: ${100 - bVal}% · B: ${bVal}%`;
      document.getElementById('satOpacityValue').textContent = label;
    }
  });


  // ── Image enhancement filters ──
  const ENHANCE_FILTERS = {
    none:      'none',
    invert:    'invert(1)',
    grayscale: 'grayscale(1)',
    contrast:  'contrast(2) brightness(1.1)',
    saturate:  'saturate(3)',
    edge:      'invert(1) contrast(3) grayscale(1)',
    block:     'opacity(0)',
  };

  let enhanceA = 'none';
  let enhanceB = 'none';

  function applyEnhanceFilters() {
    setTimeout(() => {
      if (imageLayerA) {
        const el = imageLayerA._image || imageLayerA.getElement?.();
        if (el) {
          if (enhanceA === 'block') {
            el.style.filter = 'none';
            el.style.display = 'none';
          } else {
            el.style.display = '';
            el.style.filter = ENHANCE_FILTERS[enhanceA] || 'none';
          }
        }
      }
      if (imageLayerB) {
        const el = imageLayerB._image || imageLayerB.getElement?.();
        if (el) {
          if (enhanceB === 'block') {
            el.style.filter = 'none';
            el.style.display = 'none';
          } else {
            el.style.display = '';
            el.style.filter = ENHANCE_FILTERS[enhanceB] || 'none';
          }
        }
      }
    }, 100);
  }

  document.querySelectorAll('.sat-enhance-btn-a').forEach(btn => {
    btn.addEventListener('click', () => {
      enhanceA = btn.dataset.enhance;
      document.querySelectorAll('.sat-enhance-btn-a').forEach(b => b.classList.toggle('active', b === btn));
      applyEnhanceFilters();
    });
  });

  document.querySelectorAll('.sat-enhance-btn-b').forEach(btn => {
    btn.addEventListener('click', () => {
      enhanceB = btn.dataset.enhance;
      document.querySelectorAll('.sat-enhance-btn-b').forEach(b => b.classList.toggle('active', b === btn));
      applyEnhanceFilters();
    });
  });

  // Swap button — swaps EVERYTHING: images, dates, search inputs, enhance, layers, resolution
  // Slider and enhance effects stay in place — what changes is what A and B mean
  document.getElementById('satSwapBtnEnhance')?.addEventListener('click', () => {
    // Swap image layer references
    const tempLayer = imageLayerA;
    imageLayerA = imageLayerB;
    imageLayerB = tempLayer;

    // Swap dates
    const dateAEl = document.getElementById('satDateA');
    const dateBEl = document.getElementById('satDateB');
    const tempDate = dateAEl.value;
    dateAEl.value = dateBEl.value;
    dateBEl.value = tempDate;

    // Swap search inputs (dual mode)
    const searchA = document.getElementById('satSearchInput');
    const searchB = document.getElementById('satSearchInputB');
    if (searchA && searchB) {
      const tempSearch = searchA.value;
      searchA.value = searchB.value;
      searchB.value = tempSearch;
    }

    // Swap bboxB with current viewport
    if (dualMode && bboxB) {
      const bounds = map.getBounds();
      const oldViewport = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      // bboxB becomes the new viewport target, old viewport becomes new bboxB
      const tempBbox = [...bboxB];
      bboxB = oldViewport;
      // Jump map to the old B location
      const centerLat = (tempBbox[1] + tempBbox[3]) / 2;
      const centerLon = (tempBbox[0] + tempBbox[2]) / 2;
      map.setView([centerLat, centerLon], map.getZoom());
    }

    // Swap enhance states
    const tempE = enhanceA;
    enhanceA = enhanceB;
    enhanceB = tempE;

    // Swap layer/band types
    const tempL = layerA;
    layerA = layerB;
    layerB = tempL;

    // Swap resolutions
    const tempR = resolutionA;
    resolutionA = resolutionB;
    resolutionB = tempR;

    // Swap date windows
    const tempW = dateWindowA;
    dateWindowA = dateWindowB;
    dateWindowB = tempW;
    document.getElementById('satDateWindowA').value = dateWindowA;
    document.getElementById('satDateWindowB').value = dateWindowB;
    document.getElementById('satDateWindowAVal').textContent = `±${dateWindowA}d`;
    document.getElementById('satDateWindowBVal').textContent = `±${dateWindowB}d`;

    // Update all UI to reflect swapped states

    // Resolution dropdowns
    const resAEl = document.getElementById('satResA');
    const resBEl = document.getElementById('satResB');
    if (resAEl) resAEl.value = resolutionA;
    if (resBEl) resBEl.value = resolutionB;

    // Band/layer buttons
    document.querySelectorAll('.sat-layer-btn-a').forEach(b => b.classList.toggle('active', b.dataset.layer === layerA));
    document.querySelectorAll('.sat-layer-btn-b').forEach(b => b.classList.toggle('active', b.dataset.layer === layerB));

    // Enhance buttons
    document.querySelectorAll('.sat-enhance-btn-a').forEach(b => b.classList.toggle('active', b.dataset.enhance === enhanceA));
    document.querySelectorAll('.sat-enhance-btn-b').forEach(b => b.classList.toggle('active', b.dataset.enhance === enhanceB));

    // Slider stays the same position — just reapply opacities with current slider value
    const slider = document.getElementById('satOpacitySlider');
    const val = parseInt(slider.value);
    if (imageLayerA) imageLayerA.setOpacity(1 - val / 100);
    if (imageLayerB) imageLayerB.setOpacity(val / 100);

    applyEnhanceFilters();
  });

  // ── Floating panel controls ──
  function setupPanelControls() {
    // Init floating panels (drag, resize, state restore) via shared lib
    FloatingPanel.init(document.getElementById('satToolbar'), 'satellite');
    FloatingPanel.init(document.getElementById('satPinsPanel'), 'satellite');

    // Toolbar toggle
    document.getElementById('satToolbarToggle')?.addEventListener('click', () => {
      document.getElementById('satToolbar').classList.toggle('hidden');
    });
    document.getElementById('satToolbarClose')?.addEventListener('click', () => {
      document.getElementById('satToolbar').classList.add('hidden');
    });

    // Reveal toolbar with fade-in
    setTimeout(() => {
      document.getElementById('satToolbar')?.classList.replace('panel-deferred', 'panel-revealed');
    }, 300);

    // Tab switching inside Imagery Controls panel
    const toolbar = document.getElementById('satToolbar');
    toolbar?.querySelectorAll('.fp-tab[data-sat-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        toolbar.querySelectorAll('.fp-tab[data-sat-tab]').forEach(t => t.classList.remove('active'));
        toolbar.querySelectorAll('.fp-pane[data-sat-pane]').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const pane = toolbar.querySelector(`[data-sat-pane="${tab.dataset.satTab}"]`);
        if (pane) pane.classList.add('active');
      });
    });

    // Resolution dropdowns
    document.getElementById('satResA')?.addEventListener('change', (e) => {
      resolutionA = parseInt(e.target.value);
    });
    document.getElementById('satResB')?.addEventListener('change', (e) => {
      resolutionB = parseInt(e.target.value);
    });

    // Scene search buttons
    document.getElementById('satFindScenesA')?.addEventListener('click', () => searchScenes('A'));
    document.getElementById('satFindScenesB')?.addEventListener('click', () => searchScenes('B'));

    // Cloud coverage slider
    document.getElementById('satCloudSlider')?.addEventListener('input', (e) => {
      maxCloudCoverage = parseInt(e.target.value);
      document.getElementById('satCloudVal').textContent = `≤${maxCloudCoverage}%`;
    });

    // Per-image date window sliders
    document.getElementById('satDateWindowA')?.addEventListener('input', (e) => {
      dateWindowA = parseInt(e.target.value);
      document.getElementById('satDateWindowAVal').textContent = `±${dateWindowA}d`;
      // In single mode, sync B to A
      if (!dualMode) {
        dateWindowB = dateWindowA;
        document.getElementById('satDateWindowB').value = dateWindowA;
        document.getElementById('satDateWindowBVal').textContent = `±${dateWindowA}d`;
      }
    });
    document.getElementById('satDateWindowB')?.addEventListener('input', (e) => {
      dateWindowB = parseInt(e.target.value);
      document.getElementById('satDateWindowBVal').textContent = `±${dateWindowB}d`;
    });

    // Brightness slider
    document.getElementById('satBrightness')?.addEventListener('input', (e) => {
      brightnessFactor = parseInt(e.target.value) / 10;
      document.getElementById('satBrightnessVal').textContent = `${brightnessFactor.toFixed(1)}x`;
    });

    // Basemap opacity slider
    document.getElementById('satBasemapSlider')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (baseTileLayer) {
        if (val === 0) {
          // Fully remove to eliminate any glow/bleed
          if (map.hasLayer(baseTileLayer)) map.removeLayer(baseTileLayer);
        } else {
          if (!map.hasLayer(baseTileLayer)) baseTileLayer.addTo(map);
          baseTileLayer.setOpacity(val / 100);
          if (imageLayerA || imageLayerB) baseTileLayer.bringToFront();
        }
      }
      document.getElementById('satBasemapVal').textContent = val + '%';
    });

    // Basemap B slider (dual mode — shares tile layer for now, future: split view)
    document.getElementById('satBasemapSliderB')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      document.getElementById('satBasemapBVal').textContent = val + '%';
    });

    // ── Basemap visual enhancements ──
    const BASEMAP_FILTERS = {
      none:      '',
      invert:    'invert(1)',
      grayscale: 'grayscale(1)',
      contrast:  'contrast(2) brightness(1.1)',
      sepia:     'sepia(1)',
      warm:      'sepia(0.3) saturate(1.2)',
      cool:      'saturate(0.8) hue-rotate(20deg)',
    };
    let bmEnhance = 'none';
    let bmBrightness = 100;
    let bmContrast = 100;
    let bmTint = 'none';

    function applyBasemapFilter() {
      if (!baseTileLayer) return;
      const container = baseTileLayer.getContainer?.();
      if (!container) return;

      // Build composite CSS filter
      let filter = `brightness(${bmBrightness / 100}) contrast(${bmContrast / 100})`;
      const enhance = BASEMAP_FILTERS[bmEnhance];
      if (enhance) filter += ' ' + enhance;
      container.style.filter = filter;

      // Color tint via overlay pseudo-element hack — use a real overlay div
      let tintEl = container.querySelector('.sat-basemap-tint-overlay');
      if (bmTint === 'none') {
        if (tintEl) tintEl.remove();
      } else {
        if (!tintEl) {
          tintEl = document.createElement('div');
          tintEl.className = 'sat-basemap-tint-overlay';
          tintEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;mix-blend-mode:multiply;';
          container.style.position = 'relative';
          container.appendChild(tintEl);
        }
        tintEl.style.background = bmTint;
        tintEl.style.opacity = '0.35';
      }
    }

    // Enhance buttons
    document.querySelectorAll('.sat-basemap-enhance').forEach(btn => {
      btn.addEventListener('click', () => {
        bmEnhance = btn.dataset.bm;
        document.querySelectorAll('.sat-basemap-enhance').forEach(b => b.classList.toggle('active', b === btn));
        applyBasemapFilter();
      });
    });

    // Brightness slider
    document.getElementById('satBasemapBright')?.addEventListener('input', (e) => {
      bmBrightness = parseInt(e.target.value);
      document.getElementById('satBasemapBrightVal').textContent = bmBrightness + '%';
      applyBasemapFilter();
    });
    document.getElementById('satBasemapBright')?.addEventListener('dblclick', () => {
      bmBrightness = 100;
      document.getElementById('satBasemapBright').value = 100;
      document.getElementById('satBasemapBrightVal').textContent = '100%';
      applyBasemapFilter();
    });

    // Contrast slider
    document.getElementById('satBasemapContrast')?.addEventListener('input', (e) => {
      bmContrast = parseInt(e.target.value);
      document.getElementById('satBasemapContrastVal').textContent = bmContrast + '%';
      applyBasemapFilter();
    });
    document.getElementById('satBasemapContrast')?.addEventListener('dblclick', () => {
      bmContrast = 100;
      document.getElementById('satBasemapContrast').value = 100;
      document.getElementById('satBasemapContrastVal').textContent = '100%';
      applyBasemapFilter();
    });

    // Tint buttons
    document.querySelectorAll('.sat-basemap-tint').forEach(btn => {
      btn.addEventListener('click', () => {
        bmTint = btn.dataset.tint;
        document.querySelectorAll('.sat-basemap-tint').forEach(b => b.classList.toggle('active', b === btn));
        applyBasemapFilter();
      });
    });
  }

  // ── Coordinate display + click-to-pin ──

  function setupMapPinning() {
    if (!map) return;

    const coordDisplay = document.getElementById('satCoordDisplay');

    // Show coordinates on mouse move
    map.on('mousemove', (e) => {
      document.getElementById('satCoordLat').textContent = e.latlng.lat.toFixed(6);
      document.getElementById('satCoordLon').textContent = e.latlng.lng.toFixed(6);
      coordDisplay.classList.add('visible');
    });

    map.on('mouseout', () => {
      coordDisplay.classList.remove('visible');
    });

    // Click to pin
    map.on('click', (e) => {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      const dateA = document.getElementById('satDateA').value;
      const dateB = document.getElementById('satDateB').value;

      const pin = {
        id: Date.now().toString(36),
        lat,
        lon,
        label: currentLocation || `Pin ${pins.length + 1}`,
        notes: '',
        searchQuery: currentLocation,
        dateA,
        dateB,
        layerA,
        layerB,
        enhanceA,
        enhanceB,
        resolutionA,
        resolutionB,
        dateWindowA,
        dateWindowB,
        cloudCover: maxCloudCoverage,
        zoom: map.getZoom(),
        sceneA: selectedSceneA ? { ...selectedSceneA } : null,
        sceneB: selectedSceneB ? { ...selectedSceneB } : null,
        dualMode,
        ts: Date.now(),
      };

      pins.push(pin);
      addPinMarker(pin);
      renderPinList();
      savePins();

      // Show panel if first pin
      if (pins.length === 1) {
        document.getElementById('satPinsPanel').classList.remove('hidden');
      }
    });
  }

  function addPinMarker(pin) {
    if (!map) return;

    const icon = L.divIcon({
      className: 'sat-pin-icon',
      html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="var(--accent, #e94560)" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

    const marker = L.marker([pin.lat, pin.lon], { icon }).addTo(map);
    const sceneInfo = pin.sceneA
      ? `${pin.sceneA.satellite} ${pin.sceneA.date} ${pin.sceneA.time} ☁${pin.sceneA.cloudCover?.toFixed(0)}%`
      : pin.dateA;
    marker.bindPopup(`
      <strong>${pin.label}</strong><br>
      ${pin.lat.toFixed(6)}, ${pin.lon.toFixed(6)}<br>
      ${sceneInfo}<br>
      <em>${pin.layerA || pin.layer || ''}${pin.enhanceA && pin.enhanceA !== 'none' ? ' · ' + pin.enhanceA : ''}</em>
    `);
    marker._pinId = pin.id;
    pinMarkers.push(marker);
  }

  function renderPinList() {
    const list = document.getElementById('satPinsList');
    const count = document.getElementById('satPinCount');
    const toggleCount = document.getElementById('satPinsToggleCount');
    count.textContent = pins.length;
    if (toggleCount) toggleCount.textContent = pins.length || '';

    if (!pins.length) {
      list.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text-muted);text-align:center;">Click the map to pin locations.</div>';
      return;
    }

    list.innerHTML = pins.map(p => `
      <div class="sat-pin-item" data-pin-id="${p.id}">
        <div class="sat-pin-item-header">
          <input class="sat-pin-label-input" value="${escHtml(p.label)}" data-pin-id="${p.id}" placeholder="Label...">
          <span class="sat-pin-coords">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</span>
          <button class="sat-pin-remove" data-pin-id="${p.id}" title="Remove">&times;</button>
        </div>
        <input class="sat-pin-notes-input" value="${escHtml(p.notes)}" data-pin-id="${p.id}" placeholder="Notes...">
      </div>
    `).join('');

    // Wire label/notes editing
    list.querySelectorAll('.sat-pin-label-input').forEach(input => {
      input.addEventListener('input', () => {
        const pin = pins.find(p => p.id === input.dataset.pinId);
        if (pin) { pin.label = input.value; savePins(); }
      });
    });

    list.querySelectorAll('.sat-pin-notes-input').forEach(input => {
      input.addEventListener('input', () => {
        const pin = pins.find(p => p.id === input.dataset.pinId);
        if (pin) { pin.notes = input.value; savePins(); }
      });
    });

    // Wire remove buttons
    list.querySelectorAll('.sat-pin-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.pinId;
        pins = pins.filter(p => p.id !== id);
        const mi = pinMarkers.findIndex(m => m._pinId === id);
        if (mi >= 0) { map.removeLayer(pinMarkers[mi]); pinMarkers.splice(mi, 1); }
        renderPinList();
        savePins();
      });
    });
  }

  async function savePins() {
    await browser.storage.local.set({ satPins: pins });
  }

  async function loadPins() {
    const { satPins = [] } = await browser.storage.local.get({ satPins: [] });
    pins = satPins;
    for (const pin of pins) addPinMarker(pin);
    renderPinList();
  }

  // ── Pin panel toggle ──
  document.getElementById('satPinsToggle')?.addEventListener('click', () => {
    document.getElementById('satPinsPanel').classList.toggle('hidden');
  });
  document.getElementById('satPinsClose')?.addEventListener('click', () => {
    document.getElementById('satPinsPanel').classList.add('hidden');
  });

  // ── Clear all pins ──
  document.getElementById('satClearPins')?.addEventListener('click', () => {
    for (const m of pinMarkers) map?.removeLayer(m);
    pinMarkers = [];
    pins = [];
    renderPinList();
    savePins();
  });

  // ── Export pins as CSV ──
  document.getElementById('satPinsExportCsv')?.addEventListener('click', () => {
    if (!pins.length) return;
    const csv = 'Label,Latitude,Longitude,Notes,Date A,Date B,Layer,Timestamp\n' +
      pins.map(p => [
        `"${(p.label || '').replace(/"/g, '""')}"`,
        p.lat.toFixed(6),
        p.lon.toFixed(6),
        `"${(p.notes || '').replace(/"/g, '""')}"`,
        p.dateA || '',
        p.dateB || '',
        p.layer || '',
        new Date(p.ts).toISOString(),
      ].join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satellite-pins-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Export all pins to KG ──
  document.getElementById('satPinsToKg')?.addEventListener('click', async () => {
    if (!pins.length) return;
    const btn = document.getElementById('satPinsToKg');
    btn.disabled = true;
    btn.textContent = 'Adding...';
    for (const pin of pins) {
      await browser.runtime.sendMessage({
        action: 'extractAndUpsert',
        text: `Location: ${pin.label} (${pin.lat.toFixed(6)}, ${pin.lon.toFixed(6)})${pin.notes ? ' — ' + pin.notes : ''}`,
        pageUrl: `satellite:${pin.lat.toFixed(6)},${pin.lon.toFixed(6)}`,
        pageTitle: `Satellite Pin — ${pin.label}`
      });
    }
    btn.textContent = `Added ${pins.length}!`;
    setTimeout(() => { btn.textContent = 'All to KG'; btn.disabled = false; }, 2000);
  });

  // ── Capture current view as downloadable PNG ──
  async function captureImage(saveAs) {
    if (!imageLayerA) return;
    const el = imageLayerA._image || imageLayerA.getElement?.();
    if (!el || !el.src) return;

    const sceneInfo = selectedSceneA
      ? `${selectedSceneA.satellite}_${selectedSceneA.date}_${selectedSceneA.time.replace(/:/g, '')}`
      : document.getElementById('satDateA').value;
    const filename = `satellite_${(currentLocation || 'view').replace(/\s+/g, '-')}_${layerA}_${sceneInfo}.png`;

    try {
      // Route through background script for browser.downloads access
      await browser.runtime.sendMessage({
        action: 'downloadDataUrl',
        dataUrl: el.src,
        filename,
        saveAs: !!saveAs,
      });

      const btn = document.getElementById(saveAs ? 'satCaptureViewSaveAs' : 'satCaptureView');
      if (btn) {
        btn.textContent = 'Saved!';
        setTimeout(() => { btn.textContent = saveAs ? 'Save As' : 'PNG Capture'; }, 2000);
      }
    } catch (e) {
      console.error('[Satellite] PNG capture error:', e);
      document.getElementById('satImageryStatus').textContent = 'Capture failed: ' + e.message;
    }
  }

  document.getElementById('satCaptureView')?.addEventListener('click', () => captureImage(false));
  document.getElementById('satCaptureViewSaveAs')?.addEventListener('click', () => captureImage(true));

  // ── Collect pins to asset library ──
  document.getElementById('satPinsToCollection')?.addEventListener('click', async () => {
    if (!pins.length || typeof AssetLibrary === 'undefined') return;
    const btn = document.getElementById('satPinsToCollection');
    btn.disabled = true;
    btn.textContent = 'Adding...';
    for (const pin of pins) {
      const sceneDesc = pin.sceneA
        ? `${pin.sceneA.satellite} ${pin.sceneA.date} ${pin.sceneA.time} ☁${pin.sceneA.cloudCover?.toFixed(0)}%`
        : pin.dateA;
      await AssetLibrary.add({
        type: 'location',
        title: pin.label || `${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}`,
        description: `${sceneDesc} · ${pin.layerA || ''}${pin.notes ? ' · ' + pin.notes : ''}`,
        metadata: {
          lat: pin.lat, lon: pin.lon, zoom: pin.zoom || 14,
          searchQuery: pin.searchQuery,
          sceneA: pin.sceneA, sceneB: pin.sceneB,
          layerA: pin.layerA, layerB: pin.layerB,
          enhanceA: pin.enhanceA, enhanceB: pin.enhanceB,
          dateA: pin.dateA, dateB: pin.dateB,
          cloudCover: pin.cloudCover,
        },
        sourcePage: 'satellite',
      });
    }
    btn.textContent = `Collected ${pins.length}!`;
    setTimeout(() => { btn.textContent = 'Collect All'; btn.disabled = false; }, 2000);
  });

  // ── Collect current satellite view to asset library ──
  document.getElementById('satCollectView')?.addEventListener('click', async () => {
    if (!map || typeof AssetLibrary === 'undefined') return;
    const c = map.getCenter();
    const dateA = document.getElementById('satDateA').value;
    const sceneInfo = selectedSceneA
      ? `${selectedSceneA.satellite} ${selectedSceneA.date} ${selectedSceneA.time}`
      : dateA;

    // If we have an image layer, grab its data URL as thumbnail
    let thumbnail = null;
    if (imageLayerA) {
      const el = imageLayerA._image || imageLayerA.getElement?.();
      if (el && el.src) thumbnail = el.src;
    }

    await AssetLibrary.add({
      type: 'satellite',
      title: `${currentLocation || c.lat.toFixed(4) + ',' + c.lng.toFixed(4)} — ${layerA}`,
      description: `${sceneInfo} · ${layerA}${enhanceA !== 'none' ? ' · ' + enhanceA : ''}`,
      thumbnail,
      metadata: {
        lat: c.lat, lon: c.lng, zoom: map.getZoom(),
        dateA, layerA, enhanceA,
        sceneA: selectedSceneA,
      },
      sourcePage: 'satellite',
    });

    const btn = document.getElementById('satCollectView');
    btn.textContent = 'Added!';
    setTimeout(() => { btn.textContent = '+ Asset'; }, 2000);
  });

  function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ── KG Actions ──
  document.getElementById('satSaveToKg')?.addEventListener('click', async () => {
    if (!map) return;
    const c = map.getCenter();
    const dateA = document.getElementById('satDateA').value;
    const dateB = document.getElementById('satDateB').value;
    try {
      await browser.runtime.sendMessage({
        action: 'extractAndUpsert',
        text: `Satellite comparison: ${currentLocation || c.lat.toFixed(4) + ',' + c.lng.toFixed(4)} (${dateA} vs ${dateB}, ${layerA})`,
        pageUrl: `sentinel:${c.lat.toFixed(4)},${c.lng.toFixed(4)}`,
        pageTitle: `Satellite — ${currentLocation || 'Location'}`
      });
      const btn = document.getElementById('satSaveToKg');
      btn.textContent = 'Saved!';
      setTimeout(() => { btn.textContent = 'Save to KG'; }, 2000);
    } catch (e) { console.warn(e); }
  });

  // ── AI Chat ──
  function refreshChatContext() {
    if (typeof ArgusChat === 'undefined') return;
    const lines = ['Satellite Intelligence Page\n'];
    if (map) {
      const c = map.getCenter();
      lines.push(`Center: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
      lines.push(`Zoom: ${map.getZoom()}`);
    }
    if (currentLocation) lines.push(`Location: ${currentLocation}`);
    lines.push(`Date A: ${document.getElementById('satDateA').value}`);
    lines.push(`Date B: ${document.getElementById('satDateB').value}`);
    lines.push(`Layer A: ${layerA}, Layer B: ${layerB}`);
    lines.push(`Imagery: ${imageLayerA ? 'loaded' : 'none'}`);
    if (selectedSceneA) {
      lines.push(`Scene A: ${selectedSceneA.satellite} ${selectedSceneA.date} ${selectedSceneA.time} UTC, cloud: ${selectedSceneA.cloudCover?.toFixed(1)}%`);
    }
    if (selectedSceneB) {
      lines.push(`Scene B: ${selectedSceneB.satellite} ${selectedSceneB.date} ${selectedSceneB.time} UTC, cloud: ${selectedSceneB.cloudCover?.toFixed(1)}%`);
    }
    ArgusChat.updateContext(lines.join('\n'));
  }

  // ── Init ──
  async function init() {
    // Load saved defaults
    try {
      const { satDefaults = {} } = await browser.storage.local.get({ satDefaults: {} });
      defaultResolution = satDefaults.resolution || 1024;
      resolutionA = defaultResolution;
      resolutionB = defaultResolution;

      if (satDefaults.location) {
        document.getElementById('satSearchInput').value = satDefaults.location;
        initMap();
        // Jump to saved location
        try {
          const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(satDefaults.location)}&format=json&limit=1`, {
            headers: { 'User-Agent': 'Argus/1.0' }
          });
          const results = await resp.json();
          if (results.length) {
            map.setView([parseFloat(results[0].lat), parseFloat(results[0].lon)], satDefaults.zoom || 12);
          }
        } catch { /* use default LA */ }
      } else {
        initMap();
      }
    } catch {
      initMap();
    }

    setupMapPinning();
    setupPanelControls();
    try { await loadPins(); } catch (e) { console.warn('[Satellite] Pin load error:', e); }

    // Don't auto-load imagery — wait for user to search

    // Init shared asset library
    if (typeof AssetLibrary !== 'undefined') {
      AssetLibrary.init({ pageId: 'satellite' });

      // When user selects an asset from the library on this page
      AssetLibrary.onSelect(async (item) => {
        if (!map) return;
        const m = item.metadata || {};

        if (item.type === 'satellite' && m.lat) {
          // Full state restoration — jump to location, restore layer/enhance/dates, re-search scenes
          map.setView([m.lat, m.lon], m.zoom || 14);
          document.getElementById('satSearchInput').value = m.searchQuery || item.title.split(' — ')[0] || '';
          currentLocation = document.getElementById('satSearchInput').value;

          // Restore layer
          if (m.layerA) {
            layerA = m.layerA;
            document.querySelectorAll('.sat-layer-btn-a').forEach(b => b.classList.toggle('active', b.dataset.layer === layerA));
          }
          // Restore enhance
          if (m.enhanceA) {
            enhanceA = m.enhanceA;
            document.querySelectorAll('.sat-enhance-btn-a').forEach(b => b.classList.toggle('active', b.dataset.enhance === enhanceA));
          }
          // Restore date
          if (m.dateA) {
            document.getElementById('satDateA').value = m.dateA;
            if (!dualMode) document.getElementById('satDateB').value = m.dateA;
          }

          document.getElementById('satImageryStatus').textContent = `Restoring: ${item.title}...`;
          AssetLibrary.markInUse(item.id);

          // If we have the scene info, try to load that exact scene
          if (m.sceneA) {
            selectedSceneA = m.sceneA;
            const infoEl = document.getElementById('satSceneInfoA');
            const cc = m.sceneA.cloudCover !== null ? m.sceneA.cloudCover.toFixed(1) + '%' : '?';
            if (infoEl) infoEl.textContent = `${m.sceneA.satellite} · ${m.sceneA.date} ${m.sceneA.time} UTC · ☁${cc}`;
          }

          // Re-search scenes to populate the list and load imagery
          try {
            await searchScenes('A');
          } catch { /* silent */ }

        } else if (item.type === 'image' && item.thumbnail) {
          // Load the collected image as Image B overlay
          const bounds = map.getBounds();
          const imageBounds = L.latLngBounds(
            [bounds.getSouth(), bounds.getWest()],
            [bounds.getNorth(), bounds.getEast()]
          );
          if (imageLayerB) { try { map.removeLayer(imageLayerB); } catch (e) {} }
          imageLayerB = L.imageOverlay(item.thumbnail, imageBounds, { opacity: 0.5 }).addTo(map);
          imageLayerB.setZIndex(200);
          const slider = document.getElementById('satOpacitySlider');
          slider.value = 50;
          slider.dispatchEvent(new Event('input'));
          // Update source label and highlight in library
          const srcLabel = document.getElementById('satSourceB');
          if (srcLabel) srcLabel.textContent = 'Grabber';
          // Clear old satellite scene list/info for B
          document.getElementById('satSceneListB').innerHTML = '';
          document.getElementById('satSceneInfoB').textContent = '';
          selectedSceneB = null;
          AssetLibrary.markInUse(item.id);

          // Disable swap (can't swap satellite with grabber image)
          const swapBtn = document.getElementById('satSwapBtnEnhance');
          if (swapBtn) { swapBtn.disabled = true; swapBtn.style.opacity = '0.4'; }

          // Switch to Single AB mode and clear Location B input
          if (dualMode) {
            dualMode = false;
            document.getElementById('satDualCheck').checked = false;
            document.getElementById('satDualCheck').dispatchEvent(new Event('change'));
          }
          document.getElementById('satSearchInputB').value = '';

          // Show asset source link in search strip
          const assetLink = document.getElementById('satAssetLinkB');
          if (assetLink && item.metadata?.pageUrl) {
            assetLink.innerHTML = `<a href="${item.metadata.pageUrl}" target="_blank" title="${item.metadata.pageUrl}">${item.title}</a>`;
            assetLink.style.display = '';
          }
          document.getElementById('satImageryStatus').textContent = `B: collection image — ${item.title}`;

        } else if (item.type === 'location' && m.lat) {
          // Jump to location and optionally restore scene/layer state
          map.setView([m.lat, m.lon], m.zoom || 14);
          document.getElementById('satSearchInput').value = m.searchQuery || item.title;
          currentLocation = document.getElementById('satSearchInput').value;

          if (m.layerA) {
            layerA = m.layerA;
            document.querySelectorAll('.sat-layer-btn-a').forEach(b => b.classList.toggle('active', b.dataset.layer === layerA));
          }
          if (m.dateA) document.getElementById('satDateA').value = m.dateA;

          document.getElementById('satImageryStatus').textContent = `Jumped to: ${item.title}`;
          AssetLibrary.markInUse(item.id);
          try { await searchScenes('A'); } catch { /* silent */ }
        }
      });
    }

    if (typeof ArgusChat !== 'undefined') {
      ArgusChat.init({
        container: document.getElementById('argus-chat-container'),
        contextType: 'Satellite Intelligence',
        contextData: 'Satellite imagery page with Leaflet map. Copernicus/Sentinel Hub. Pan/zoom, pick dates, load imagery, compare with opacity slider.',
        pageUrl: window.location.href,
        pageTitle: 'Satellite — Argus Intelligence'
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
