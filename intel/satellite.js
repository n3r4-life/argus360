(function () {
  'use strict';

  let map = null;
  let imageLayerA = null;
  let imageLayerB = null;
  let layerA = 'trueColor';
  let layerB = 'trueColor';
  let resolutionA = 1024;
  let resolutionB = 1024;
  let defaultResolution = 1024;
  let dualMode = false;
  let bboxB = null; // separate bbox for location B in dual mode

  const EVALSCRIPTS = {
    trueColor: `//VERSION=3\nfunction setup(){return{input:["B02","B03","B04"],output:{bands:3}}}\nfunction evaluatePixel(s){return[2.5*s.B04,2.5*s.B03,2.5*s.B02]}`,
    falseColor: `//VERSION=3\nfunction setup(){return{input:["B03","B04","B08"],output:{bands:3}}}\nfunction evaluatePixel(s){return[2.5*s.B08,2.5*s.B04,2.5*s.B03]}`,
    ndvi: `//VERSION=3\nfunction setup(){return{input:["B04","B08"],output:{bands:3}}}\nfunction evaluatePixel(s){var v=(s.B08-s.B04)/(s.B08+s.B04);return v<0?[1,0,0]:v<0.3?[1,0.5+v,0]:[0,0.5+v*0.5,0]}`,
    moisture: `//VERSION=3\nfunction setup(){return{input:["B8A","B11"],output:{bands:3}}}\nfunction evaluatePixel(s){var v=(s.B8A-s.B11)/(s.B8A+s.B11);return v<0?[0.8,0.2,0]:v<0.3?[1,1,0]:[0,0.3+v*0.7,1]}`,
  };
  let currentLocation = '';
  let pins = [];
  let pinMarkers = [];

  // Default dates — B is yesterday (not today, avoids requesting future imagery)
  const today = new Date();
  const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
  document.getElementById('satDateB').value = yesterday.toISOString().slice(0, 10);
  document.getElementById('satDateA').value = sixMonthsAgo.toISOString().slice(0, 10);

  // ── Init map ──
  function initMap() {
    if (map) return;
    map = L.map('satMap', { center: [34.05, -118.25], zoom: 12 });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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

  // ── Dual mode toggle ──
  document.getElementById('satDualCheck')?.addEventListener('change', (e) => {
    dualMode = e.target.checked;
    const searchB = document.getElementById('satSearchBarB');
    const inputB = document.getElementById('satSearchInputB');
    const btnB = document.getElementById('satJumpBtnB');

    if (dualMode) {
      searchB.classList.remove('disabled');
      inputB.disabled = false;
      btnB.disabled = false;
      // Mirror the A search text as placeholder
      inputB.placeholder = document.getElementById('satSearchInput').value || 'Location B...';
    } else {
      searchB.classList.add('disabled');
      inputB.disabled = true;
      btnB.disabled = true;
      bboxB = null;
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
        document.getElementById('satImageryStatus').textContent = `Location B set: ${query} — loading imagery...`;

        // Auto-reload Image B with the new location
        await reloadSingleImage('B');

        // Auto-slide to 50/50 so user can see both
        const slider = document.getElementById('satOpacitySlider');
        slider.value = 50;
        slider.dispatchEvent(new Event('input'));

        document.getElementById('satImageryStatus').textContent = `A: current view · B: ${query}`;
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
  document.getElementById('satLoadImagery').addEventListener('click', () => loadImagery());

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
      // In dual mode, Image B uses a different location
      const bboxForB = (dualMode && bboxB) ? bboxB : bbox;

      // Load both images in parallel with their respective layers + resolutions
      const [respA, respB] = await Promise.all([
        fetchSatImage(bbox, dateA, EVALSCRIPTS[layerA], resolutionA),
        fetchSatImage(bboxForB, dateB, EVALSCRIPTS[layerB], resolutionB),
      ]);

      // Remove old overlays
      if (imageLayerA) map.removeLayer(imageLayerA);
      if (imageLayerB) map.removeLayer(imageLayerB);

      // Both images overlay at the same viewport bounds (for comparison)
      // In dual mode, Image B's data comes from a different location but displays here
      const imageBounds = L.latLngBounds(
        [bounds.getSouth(), bounds.getWest()],
        [bounds.getNorth(), bounds.getEast()]
      );

      // Add Image A as base overlay
      if (respA?.success && respA.imageUrl) {
        imageLayerA = L.imageOverlay(respA.imageUrl, imageBounds, { opacity: 1 }).addTo(map);
      }

      // Add Image B on top (user controls opacity to compare)
      if (respB?.success && respB.imageUrl) {
        imageLayerB = L.imageOverlay(respB.imageUrl, imageBounds, { opacity: 0 }).addTo(map);
      }

      // Enable actions
      document.getElementById('satSaveToKg').disabled = false;
      document.getElementById('satCaptureView').disabled = false;

      // Restore slider position (don't reset)
      const slider = document.getElementById('satOpacitySlider');
      const currentVal = parseInt(slider.value);
      if (imageLayerA) imageLayerA.setOpacity(1 - currentVal / 100);
      if (imageLayerB) imageLayerB.setOpacity(currentVal / 100);
      applyEnhanceFilters();

      const hasA = !!respA?.success;
      const hasB = !!respB?.success;
      statusEl.textContent = `A: ${hasA ? dateA : 'no data'} (${layerA}) · B: ${hasB ? dateB : 'no data'} (${layerB})`;

    } catch (e) {
      statusEl.textContent = 'Error: ' + e.message;
    }

    btn.disabled = false;
    btn.textContent = 'Refresh Imagery';
    btn.style.opacity = '';
    refreshChatContext();
  }

  async function fetchSatImage(bbox, date, evalscript, resolution) {
    const targetDate = new Date(date);
    const rangeStart = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const rangeEnd = new Date(targetDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const maxDim = resolution || defaultResolution;
    const bboxWidth = bbox[2] - bbox[0];
    const bboxHeight = bbox[3] - bbox[1];
    const aspect = bboxWidth / bboxHeight;
    const width = aspect >= 1 ? maxDim : Math.round(maxDim * aspect);
    const height = aspect >= 1 ? Math.round(maxDim / aspect) : maxDim;

    return browser.runtime.sendMessage({
      action: 'sentinelGetImage',
      bbox,
      dateFrom: rangeStart.toISOString(),
      dateTo: rangeEnd.toISOString(),
      options: { width, height, maxCloudCoverage: 40, evalscript }
    });
  }

  // ── Reload single image (when layer changes) ──
  async function reloadSingleImage(panel) {
    console.log('[Satellite] reloadSingleImage called, panel:', panel, 'dualMode:', dualMode, 'bboxB:', bboxB);
    if (!map) { console.log('[Satellite] no map'); return; }
    const bounds = map.getBounds();
    const mapBbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const bbox = (panel === 'B' && dualMode && bboxB) ? bboxB : mapBbox;
    console.log('[Satellite] using bbox:', bbox);
    const date = document.getElementById(panel === 'A' ? 'satDateA' : 'satDateB').value;
    const layer = panel === 'A' ? layerA : layerB;
    const res = panel === 'A' ? resolutionA : resolutionB;

    const statusEl = document.getElementById('satImageryStatus');
    statusEl.textContent = `Reloading Image ${panel} (${layer})...`;

    try {
      console.log('[Satellite] fetching image, date:', date, 'layer:', layer, 'res:', res);
      const resp = await fetchSatImage(bbox, date, EVALSCRIPTS[layer], res);
      console.log('[Satellite] image response:', resp?.success, resp?.error);
      if (resp?.success && resp.imageUrl) {
        // In dual mode, Image B renders at the SAME map position (for overlay comparison)
        // The imagery data comes from Location B's bbox, but displays at the viewport bounds
        const imageBounds = L.latLngBounds(
          [bounds.getSouth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getEast()]
        );
        if (panel === 'A') {
          if (imageLayerA) map.removeLayer(imageLayerA);
          const slider = document.getElementById('satOpacitySlider');
          const opacity = 1 - parseInt(slider.value) / 100;
          imageLayerA = L.imageOverlay(resp.imageUrl, imageBounds, { opacity }).addTo(map);
          if (imageLayerB) imageLayerB.bringToFront();
          applyEnhanceFilters();
        } else {
          if (imageLayerB) map.removeLayer(imageLayerB);
          const slider = document.getElementById('satOpacitySlider');
          const opacity = parseInt(slider.value) / 100;
          imageLayerB = L.imageOverlay(resp.imageUrl, imageBounds, { opacity }).addTo(map);
          applyEnhanceFilters();
        }
        statusEl.textContent = `Image ${panel} reloaded (${layer})`;
      }
    } catch (e) {
      statusEl.textContent = `Error reloading ${panel}: ${e.message}`;
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

  // ── On-map controls (resolution + reset) ──
  function setupMapControls() {
    if (!map || typeof L === 'undefined') return;

    const ControlPanel = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function () {
        const div = L.DomUtil.create('div', 'sat-map-controls');
        div.innerHTML = `
          <div class="sat-map-ctrl-row">
            <span class="sat-map-ctrl-label">A:</span>
            <select class="sat-map-ctrl-select" id="satResA">
              <option value="512">512px</option>
              <option value="1024" selected>1024px</option>
              <option value="2048">2048px</option>
            </select>
          </div>
          <div class="sat-map-ctrl-row">
            <span class="sat-map-ctrl-label">B:</span>
            <select class="sat-map-ctrl-select" id="satResB">
              <option value="512">512px</option>
              <option value="1024" selected>1024px</option>
              <option value="2048">2048px</option>
            </select>
          </div>
          <button class="sat-map-ctrl-btn" id="satResetZoom">Reset 100%</button>
        `;
        L.DomEvent.disableClickPropagation(div);
        return div;
      },
    });

    map.addControl(new ControlPanel());

    // Set saved resolution values
    const resAEl = document.getElementById('satResA');
    const resBEl = document.getElementById('satResB');
    if (resAEl) resAEl.value = resolutionA;
    if (resBEl) resBEl.value = resolutionB;

    resAEl?.addEventListener('change', () => {
      resolutionA = parseInt(resAEl.value);
    });
    resBEl?.addEventListener('change', () => {
      resolutionB = parseInt(resBEl.value);
    });

    document.getElementById('satResetZoom')?.addEventListener('click', () => {
      map.setZoom(12);
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
        label: `Pin ${pins.length + 1}`,
        notes: '',
        dateA,
        dateB,
        layer: layerA,
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
    marker.bindPopup(`
      <strong>${pin.label}</strong><br>
      ${pin.lat.toFixed(6)}, ${pin.lon.toFixed(6)}<br>
      ${pin.dateA} / ${pin.dateB}<br>
      <em>${pin.layer}</em>
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
    lines.push(`Layer: ${layerA}`);
    lines.push(`Imagery: ${imageLayerA ? 'loaded' : 'none'}`);
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
    setupMapControls();
    try { await loadPins(); } catch (e) { console.warn('[Satellite] Pin load error:', e); }

    // Auto-load imagery for default view (silent fail if no credentials)
    try { await loadImagery(); } catch { /* no sentinel hub credentials — that's fine */ }

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
