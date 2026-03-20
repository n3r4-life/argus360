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
  // Track whether user manually picked a basemap (disables auto-switch on theme change)
  var _userPickedBasemap = false;

  async function initMap() {
    if (map) return;
    map = L.map('satMap', { center: [34.05, -118.25], zoom: 12 });

    // Choose initial basemap based on app theme
    var _initTile = 'carto-dark';
    try {
      var themeStore = await browser.storage.local.get({ argusTheme: 'dark' });
      if (themeStore.argusTheme === 'light') _initTile = 'carto-light';
    } catch (_) {}

    var INIT_TILES = {
      'carto-dark':  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      'carto-light': 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    };

    baseTileLayer = L.tileLayer(INIT_TILES[_initTile], {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Sync the active pill button to match
    document.querySelectorAll('.sat-tile-source').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tile === _initTile);
    });

    // Auto-switch basemap when theme changes (unless user manually picked one)
    browser.storage.onChanged.addListener(function(changes, area) {
      if (area !== 'local' || !changes.argusTheme || _userPickedBasemap) return;
      var newTheme = changes.argusTheme.newValue;
      var tileId = newTheme === 'light' ? 'carto-light' : 'carto-dark';
      var activeBtn = document.querySelector('.sat-tile-source.active');
      if (activeBtn) activeBtn.click(); // reuse existing click handler? No — just simulate
      // Directly switch tile
      if (baseTileLayer && map.hasLayer(baseTileLayer)) map.removeLayer(baseTileLayer);
      baseTileLayer = L.tileLayer(INIT_TILES[tileId], {
        attribution: '&copy; OSM &copy; CARTO', subdomains: 'abcd', maxZoom: 19
      }).addTo(map);
      if (imageLayerA || imageLayerB) {
        baseTileLayer.setOpacity(parseFloat(document.getElementById('satBasemapSlider')?.value || 100) / 100);
        baseTileLayer.bringToFront();
      }
      setTimeout(applyBasemapFilter, 100);
      document.querySelectorAll('.sat-tile-source').forEach(function(b) {
        b.classList.toggle('active', b.dataset.tile === tileId);
      });
    });

    map.on('moveend', updateMapInfo);
    map.on('moveend', _onMapMoveEndWigle);
    map.on('moveend', async function() {
      if (_webcamVisible) { try { await loadWebcamOverlay(); } catch { /* silent */ } }
      if (_tempVisible)   { try { await loadTempOverlay();   } catch { /* silent */ } }
    });

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
      // Check if input is raw lat,lon coordinates
      const coordMatch = query.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
      let lat, lon, addressData = null;

      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lon = parseFloat(coordMatch[2]);
        if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) {
          document.getElementById('satImageryStatus').textContent = 'Invalid coordinates';
          btn.disabled = false; btn.textContent = 'Go'; return;
        }
        map.setView([lat, lon], 14);
        // Reverse geocode to get address from coordinates
        try {
          const revResp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`, {
            headers: { 'User-Agent': 'Argus/1.0' }
          });
          const revResult = await revResp.json();
          if (revResult?.display_name) {
            addressData = revResult.address || {};
            addressData._display = revResult.display_name;
            document.getElementById('satSearchInput').value = revResult.display_name;
            currentLocation = revResult.display_name;
          }
        } catch { /* reverse geocode failed, keep raw coords */ }
      } else {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`, {
          headers: { 'User-Agent': 'Argus/1.0' }
        });
        const results = await resp.json();
        if (results.length) {
          lat = parseFloat(results[0].lat);
          lon = parseFloat(results[0].lon);
          addressData = results[0].address || {};
          addressData._display = results[0].display_name;
          // Update input with full address from geocoder
          if (results[0].display_name) {
            document.getElementById('satSearchInput').value = results[0].display_name;
            currentLocation = results[0].display_name;
          }
          map.setView([lat, lon], 14);
        } else {
          document.getElementById('satImageryStatus').textContent = 'Location not found';
          btn.disabled = false; btn.textContent = 'Go'; return;
        }
      }

      // Store address data for use by asset library / sources
      window._satLastAddress = addressData;

      // Auto-search scenes for both panels, auto-selects best and loads imagery
      try {
        await searchScenes('A');
        if (dualMode) await searchScenes('B');
      } catch { /* silent */ }

      // Auto-refresh OpenSky if toggle is on — ghosts old positions, fetches new area
      if (_openskyVisible) {
        try { await _refreshOpenSky(); } catch { /* silent */ }
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
  // ── Autocomplete for search input ──
  var _acTimer = null;
  var _acBox = document.getElementById('satSearchSuggestions');
  var _acInput = document.getElementById('satSearchInput');
  var _acSelected = -1;

  function _acFuzzyMatch(query, name) {
    // Simple fuzzy: every char in query appears in name in order
    var q = query.toLowerCase();
    var n = name.toLowerCase();
    if (n.indexOf(q) !== -1) return 2; // substring match = best
    var qi = 0;
    for (var ni = 0; ni < n.length && qi < q.length; ni++) {
      if (n[ni] === q[qi]) qi++;
    }
    return qi === q.length ? 1 : 0; // all chars found in order = fuzzy match
  }

  function _acShowSuggestions(query) {
    if (!_acBox || !query || query.length < 2) { _acHide(); return; }
    // Check if local dictionary is available
    var results = [];
    if (window.ArgusLocationDictionary) {
      var q = query.toLowerCase();
      for (var i = 0; i < window.ArgusLocationDictionary.length && results.length < 8; i++) {
        var loc = window.ArgusLocationDictionary[i];
        var score = _acFuzzyMatch(query, loc.name);
        if (score > 0) results.push({ name: loc.name, lat: loc.lat, lon: loc.lon, score: score, src: 'local' });
      }
      // Sort: substring matches first, then fuzzy
      results.sort(function(a, b) { return b.score - a.score; });
    }

    if (results.length === 0 && query.length >= 3) {
      // Fallback to Nominatim if no local match and user typed enough
      _acNominatimSearch(query);
      return;
    }

    _acRender(results);
  }

  function _acNominatimSearch(query) {
    // Check setting — privacy mode skips this
    browser.storage.local.get({ satOfflineSearchOnly: false }).then(function(s) {
      if (s.satOfflineSearchOnly) {
        _acRender([{ name: 'No local match — online search disabled', lat: 0, lon: 0, src: 'none' }]);
        return;
      }
      fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=5', {
        headers: { 'User-Agent': 'Argus/1.0' }
      }).then(function(r) { return r.json(); }).then(function(data) {
        var results = data.map(function(d) {
          return { name: d.display_name, lat: parseFloat(d.lat), lon: parseFloat(d.lon), src: 'nominatim' };
        });
        _acRender(results);
      }).catch(function() { _acHide(); });
    });
  }

  function _acRender(results) {
    if (!_acBox || !results.length) { _acHide(); return; }
    _acSelected = -1;
    var html = '';
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r.src === 'none') {
        html += '<div style="padding:6px 10px; font-size:10px; color:var(--text-muted);">' + r.name + '</div>';
        continue;
      }
      var srcTag = r.src === 'local' ? '' : '<span style="font-size:8px; opacity:0.4; margin-left:4px;">online</span>';
      html += '<div class="sat-ac-item" data-idx="' + i + '" data-lat="' + r.lat + '" data-lon="' + r.lon + '" data-name="' + r.name.replace(/"/g, '&quot;') + '" style="padding:5px 10px; font-size:11px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);">' +
        r.name + srcTag + '</div>';
    }
    _acBox.innerHTML = html;
    _acBox.style.display = 'block';

    // Click handler on items
    _acBox.querySelectorAll('.sat-ac-item').forEach(function(item) {
      item.addEventListener('mousedown', function(e) {
        e.preventDefault(); // prevent blur from hiding before click registers
        _acInput.value = this.dataset.name;
        _acHide();
        jumpToLocation();
      });
      item.addEventListener('mouseenter', function() {
        _acBox.querySelectorAll('.sat-ac-item').forEach(function(el) { el.style.background = ''; });
        this.style.background = 'rgba(255,255,255,0.08)';
      });
      item.addEventListener('mouseleave', function() {
        this.style.background = '';
      });
    });
  }

  function _acHide() {
    if (_acBox) { _acBox.style.display = 'none'; _acBox.innerHTML = ''; }
    _acSelected = -1;
  }

  _acInput?.addEventListener('input', function() {
    if (!dualMode) {
      var inputB = document.getElementById('satSearchInputB');
      if (inputB) inputB.placeholder = _acInput.value || 'Location B...';
    }
    // Debounce autocomplete
    clearTimeout(_acTimer);
    var q = _acInput.value.trim();
    _acTimer = setTimeout(function() { _acShowSuggestions(q); }, 200);
  });

  _acInput?.addEventListener('blur', function() {
    // Delay hide so click on suggestion registers
    setTimeout(_acHide, 200);
  });

  // Keyboard navigation in suggestions
  _acInput?.addEventListener('keydown', function(e) {
    if (!_acBox || _acBox.style.display === 'none') return;
    var items = _acBox.querySelectorAll('.sat-ac-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _acSelected = Math.min(_acSelected + 1, items.length - 1);
      items.forEach(function(el, i) { el.style.background = i === _acSelected ? 'rgba(255,255,255,0.08)' : ''; });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _acSelected = Math.max(_acSelected - 1, 0);
      items.forEach(function(el, i) { el.style.background = i === _acSelected ? 'rgba(255,255,255,0.08)' : ''; });
    } else if (e.key === 'Enter' && _acSelected >= 0 && items[_acSelected]) {
      e.preventDefault();
      _acInput.value = items[_acSelected].dataset.name;
      _acHide();
      jumpToLocation();
    } else if (e.key === 'Escape') {
      _acHide();
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
        const slider = document.getElementById('satOverlayA');
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

      // Get current slider positions for opacity
      var sliderA = document.getElementById('satOverlayA');
      var sliderB = document.getElementById('satOverlayB');
      var aOpacity = sliderA ? parseInt(sliderA.value) / 100 : 1;
      var bOpacity = sliderB ? parseInt(sliderB.value) / 100 : 0.5;
      if (!independentMode) {
        // Balance mode: B mirrors A
        bOpacity = 1 - aOpacity;
      }

      // Add Image A as base overlay
      if (respA?.success && respA.imageUrl) {
        imageLayerA = L.imageOverlay(respA.imageUrl, imageBounds, {
          opacity: aOpacity
        }).addTo(map);
      }

      // Add Image B on top
      if (respB?.success && respB.imageUrl) {
        imageLayerB = L.imageOverlay(respB.imageUrl, imageBounds, {
          opacity: bOpacity
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
    if (_cartoOnlyMode || !_sentinelEnabled) return { success: false, error: 'Sentinel imagery disabled' };
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
      var cached = imageCache.get(cacheKey);
      // Only use cache if it was a real success with an image
      if (cached && cached.success && cached.imageUrl) {
        console.log('[Satellite] cache hit:', cacheKey.slice(0, 60));
        return cached;
      }
      // Stale/failed cache entry — remove and re-fetch
      imageCache.delete(cacheKey);
      console.log('[Satellite] cache miss (stale/failed entry removed):', cacheKey.slice(0, 60));
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
        var rSA = document.getElementById('satOverlayA');
        var rSB = document.getElementById('satOverlayB');
        var rAOp = rSA ? parseInt(rSA.value) / 100 : 1;
        var rBOp = independentMode ? (rSB ? parseInt(rSB.value) / 100 : 0.5) : (1 - rAOp);

        if (panel === 'A') {
          if (imageLayerA) { try { map.removeLayer(imageLayerA); } catch (e) {} }
          imageLayerA = L.imageOverlay(resp.imageUrl, imageBounds, { opacity: rAOp }).addTo(map);
          imageLayerA.setZIndex(100);
        } else {
          if (imageLayerB) { try { map.removeLayer(imageLayerB); } catch (e) {} }
          imageLayerB = L.imageOverlay(resp.imageUrl, imageBounds, { opacity: rBOp }).addTo(map);
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
    if (_cartoOnlyMode || !_sentinelEnabled) return;
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
      resetGrabberTransform();
      showGrabberControls(false);
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
        var sA = document.getElementById('satOverlayA');
        var sB = document.getElementById('satOverlayB');
        var aOp = sA ? parseInt(sA.value) / 100 : 1;
        var bOp = independentMode ? (sB ? parseInt(sB.value) / 100 : 0.5) : (1 - aOp);

        if (panel === 'A') {
          if (imageLayerA) { try { map.removeLayer(imageLayerA); } catch (e) {} }
          imageLayerA = L.imageOverlay(resp.imageUrl, imageBounds, { opacity: aOp }).addTo(map);
          imageLayerA.setZIndex(100);
        } else {
          if (imageLayerB) { try { map.removeLayer(imageLayerB); } catch (e) {} }
          imageLayerB = L.imageOverlay(resp.imageUrl, imageBounds, { opacity: bOp }).addTo(map);
          imageLayerB.setZIndex(200);
          // Auto-slide to 50/50 so user sees both images
          if (!independentMode && sA && parseInt(sA.value) === 100) {
            sA.value = 50;
            sA.dispatchEvent(new Event('input'));
          }
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
  // Old overlay handlers removed — new handlers are in the Phase 5 block below (satOverlayA, satOverlayB, satOpacityMode2)


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

    // Reapply opacities with current slider values
    var swSA = document.getElementById('satOverlayA');
    var swSB = document.getElementById('satOverlayB');
    var swAOp = swSA ? parseInt(swSA.value) / 100 : 1;
    var swBOp = independentMode ? (swSB ? parseInt(swSB.value) / 100 : 0.5) : (1 - swAOp);
    if (imageLayerA) imageLayerA.setOpacity(swAOp);
    if (imageLayerB) imageLayerB.setOpacity(swBOp);

    applyEnhanceFilters();
  });

  // ── Floating panel controls ──
  function setupPanelControls() {
    // Init floating panels (drag, resize, state restore) via shared lib
    FloatingPanel.init(document.getElementById('satToolbar'), 'satellite');
    FloatingPanel.init(document.getElementById('satPinsPanel'), 'satellite');
    FloatingPanel.init(document.getElementById('satMeasurePanel'), 'satellite');

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

    // Resolution dropdowns (old IDs kept for compat, new IDs for above-tabs)
    document.getElementById('satResA')?.addEventListener('change', (e) => {
      resolutionA = parseInt(e.target.value);
    });
    document.getElementById('satResB')?.addEventListener('change', (e) => {
      resolutionB = parseInt(e.target.value);
    });
    document.getElementById('satResA2')?.addEventListener('change', (e) => {
      resolutionA = parseInt(e.target.value);
      var old = document.getElementById('satResA');
      if (old) old.value = e.target.value;
    });
    document.getElementById('satResB2')?.addEventListener('change', (e) => {
      resolutionB = parseInt(e.target.value);
      var old = document.getElementById('satResB');
      if (old) old.value = e.target.value;
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

    // Brightness slider (old — kept for backward compat if element exists)
    document.getElementById('satBrightness')?.addEventListener('input', (e) => {
      brightnessFactor = parseInt(e.target.value) / 10;
      document.getElementById('satBrightnessVal').textContent = `${brightnessFactor.toFixed(1)}x`;
    });

    // New above-tabs brightness slider
    document.getElementById('satBrightness2')?.addEventListener('input', (e) => {
      brightnessFactor = parseInt(e.target.value) / 10;
      document.getElementById('satBrightnessVal2').textContent = brightnessFactor.toFixed(1) + 'x';
    });

    // New above-tabs overlay sliders
    var overlayBWrap = document.getElementById('satOverlayBWrap');
    var overlayBSlider = document.getElementById('satOverlayB');

    var labelA = document.getElementById('satOverlayALabel');
    var labelB = document.getElementById('satOverlayBLabel');

    function updateOverlayLabels() {
      var aVal = parseInt(document.getElementById('satOverlayA')?.value || 100);
      var bVal = parseInt(overlayBSlider?.value || 50);
      if (labelA) labelA.textContent = 'A ' + aVal + '%';
      if (labelB) labelB.textContent = 'B ' + bVal + '%';
    }

    document.getElementById('satOpacityMode2')?.addEventListener('change', function(e) {
      independentMode = e.target.checked;
      var oldToggle = document.getElementById('satOpacityMode');
      if (oldToggle) oldToggle.checked = e.target.checked;
      if (overlayBSlider) {
        overlayBSlider.style.opacity = independentMode ? '1' : '0.3';
        overlayBSlider.style.pointerEvents = independentMode ? 'auto' : 'none';
      }
      if (labelB) labelB.style.opacity = independentMode ? '0.4' : '0.2';
    });

    document.getElementById('satOverlayA')?.addEventListener('input', function(e) {
      var val = parseInt(e.target.value);
      if (independentMode) {
        if (imageLayerA) imageLayerA.setOpacity(val / 100);
      } else {
        if (imageLayerA) imageLayerA.setOpacity(val / 100);
        if (imageLayerB) imageLayerB.setOpacity(1 - val / 100);
        if (overlayBSlider) overlayBSlider.value = 100 - val;
      }
      updateOverlayLabels();
    });

    document.getElementById('satOverlayB')?.addEventListener('input', function(e) {
      if (!independentMode) return;
      var val = parseInt(e.target.value);
      if (imageLayerB) imageLayerB.setOpacity(val / 100);
      updateOverlayLabels();
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

    // ── Tile source selector ──
    var TILE_SOURCES = {
      // Free — no API key
      'carto-dark':       { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '&copy; OSM &copy; CARTO', sub: 'abcd' },
      'carto-light':      { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '&copy; OSM &copy; CARTO', sub: 'abcd' },
      'carto-voyager':    { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '&copy; OSM &copy; CARTO', sub: 'abcd' },
      'osm':              { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap contributors' },
      'esri-sat':         { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri, DigitalGlobe, Maxar' },
      'esri-topo':        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri' },
      // Stadia Maps — requires API key
      'stadia-dark':      { url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', attr: '&copy; Stadia Maps &copy; OSM', stadia: true },
      'stadia-sat':       { url: 'https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.png', attr: '&copy; Stadia Maps', stadia: true },
      'stadia-outdoors':  { url: 'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png', attr: '&copy; Stadia Maps &copy; OSM', stadia: true },
      'stadia-toner':     { url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png', attr: '&copy; Stadia Maps &copy; Stamen', stadia: true },
      'stadia-terrain':   { url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png', attr: '&copy; Stadia Maps &copy; Stamen', stadia: true },
      'stadia-watercolor': { url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}{r}.png', attr: '&copy; Stadia Maps &copy; Stamen', stadia: true }
    };

    // Cache Stadia API key on load — read directly from storage
    var _stadiaApiKey = null;
    browser.storage.local.get('argusIntelProviders').then(function(s) {
      var providers = s.argusIntelProviders || {};
      if (providers.stadiamaps && providers.stadiamaps.apiKey) {
        _stadiaApiKey = providers.stadiamaps.apiKey;
      }
    }).catch(function() {});

    document.querySelectorAll('.sat-tile-source').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        _userPickedBasemap = true;  // user manually chose — stop auto-switching on theme change
        var tileId = this.dataset.tile;
        var src = TILE_SOURCES[tileId];
        if (!src || !map) return;

        // Stadia tiles need API key
        if (src.stadia) {
          // Try to get key if not cached
          if (!_stadiaApiKey) {
            try {
              var cfg = await browser.storage.local.get('argusIntelProviders');
              var providers = cfg.argusIntelProviders || {};
              if (providers.stadiamaps && providers.stadiamaps.apiKey) {
                _stadiaApiKey = providers.stadiamaps.apiKey;
              }
            } catch(e) {}
          }
          if (!_stadiaApiKey) {
            _wigleToast('Stadia Maps requires an API key — configure in Settings → Intel Providers', 5000);
            return;
          }
        }

        // Remove current basemap
        if (baseTileLayer && map.hasLayer(baseTileLayer)) map.removeLayer(baseTileLayer);

        // Build URL — append API key for Stadia tiles
        var tileUrl = src.url;
        if (src.stadia && _stadiaApiKey) {
          tileUrl += '?api_key=' + encodeURIComponent(_stadiaApiKey);
        }

        // Create new tile layer
        var opts = { attribution: src.attr, maxZoom: 19 };
        if (src.sub) opts.subdomains = src.sub;
        baseTileLayer = L.tileLayer(tileUrl, opts).addTo(map);

        // If imagery overlays are active, keep basemap behind
        if (imageLayerA || imageLayerB) {
          baseTileLayer.setOpacity(parseFloat(document.getElementById('satBasemapSlider')?.value || 100) / 100);
          baseTileLayer.bringToFront();
        }
        // Re-apply any CSS filters
        setTimeout(applyBasemapFilter, 100);
        // Update active state
        document.querySelectorAll('.sat-tile-source').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
      });
    });

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

    // Show coordinates on mouse move (always visible in pins panel, just updates values)
    map.on('mousemove', (e) => {
      document.getElementById('satCoordLat').textContent = e.latlng.lat.toFixed(6);
      document.getElementById('satCoordLon').textContent = e.latlng.lng.toFixed(6);
    });

    // Click to pin (debounced to prevent accidental rapid pins)
    let _lastPinTime = 0;
    map.on('click', (e) => {
      // Suppress pin creation when a measurement/drawing tool or distance-to is active
      if (_measureTool || _distToActive) return;
      var now = Date.now();
      if (now - _lastPinTime < 400) return; // ignore clicks within 400ms of last pin
      _lastPinTime = now;
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
        address: window._satLastAddress || null,
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
    marker._pinId = pin.id;

    // Left-click: show info popup with edit/delete inline
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e); // prevent map click from creating new pin
      const popupContent = document.createElement('div');
      popupContent.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:160px;';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = pin.label;
      nameInput.placeholder = 'Pin name...';
      nameInput.style.cssText = 'padding:3px 6px;font-size:11px;background:var(--bg-primary,#1a1a2e);border:1px solid var(--border,#2a2a4a);border-radius:4px;color:var(--text-primary,#e8e8e8);font-family:inherit;';
      nameInput.addEventListener('input', () => {
        pin.label = nameInput.value;
        savePins();
        renderPinList();
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') marker.closePopup();
      });

      const coordsDiv = document.createElement('div');
      coordsDiv.style.cssText = 'font-size:9px;color:var(--text-muted);';
      coordsDiv.textContent = pin.lat.toFixed(6) + ', ' + pin.lon.toFixed(6);

      const sceneDiv = document.createElement('div');
      sceneDiv.style.cssText = 'font-size:9px;color:var(--text-muted);';
      sceneDiv.textContent = sceneInfo;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove Pin';
      removeBtn.style.cssText = 'padding:4px 8px;font-size:10px;background:rgba(233,69,96,0.15);border:1px solid rgba(233,69,96,0.3);border-radius:4px;color:#e94560;cursor:pointer;font-family:inherit;margin-top:2px;';
      removeBtn.addEventListener('click', () => {
        pins = pins.filter(p => p.id !== pin.id);
        map.removeLayer(marker);
        const mi = pinMarkers.indexOf(marker);
        if (mi >= 0) pinMarkers.splice(mi, 1);
        renderPinList();
        savePins();
      });

      var distBtn = makeDistanceToButton(pin.lat, pin.lon, pin.label);
      popupContent.append(nameInput, coordsDiv, sceneDiv, distBtn, removeBtn);
      marker.unbindPopup();
      marker.bindPopup(popupContent, { closeButton: true }).openPopup();
      setTimeout(() => nameInput.focus(), 100);
    });

    // Right-click: instant delete (no confirmation needed — pins are cheap)
    marker.on('contextmenu', (e) => {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      pins = pins.filter(p => p.id !== pin.id);
      map.removeLayer(marker);
      const mi = pinMarkers.indexOf(marker);
      if (mi >= 0) pinMarkers.splice(mi, 1);
      renderPinList();
      savePins();
    });

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

  // ── Pin panel tab switching (Pins / WiFi) ──
  document.querySelectorAll('[data-pins-tab]').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var target = this.dataset.pinsTab;
      // Toggle active tab
      document.querySelectorAll('[data-pins-tab]').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      // Toggle panes
      document.querySelectorAll('[data-pins-pane]').forEach(function(p) {
        p.style.display = p.dataset.pinsPane === target ? '' : 'none';
      });
      // Render lists when switching tabs
      if (target === 'wifi') renderWifiList();
      if (target === 'aircraft') renderAircraftList();
      if (target === 'webcams') renderWebcamList();
      if (target === 'geom') renderDrawList();
      if (target === 'spots') renderSpotsList();
    });
  });

  // WiFi notes storage (keyed by BSSID)
  var _wifiNotes = {};
  browser.storage.local.get({ satWifiNotes: {} }).then(function(s) { _wifiNotes = s.satWifiNotes || {}; });
  function _saveWifiNote(bssid, note) {
    _wifiNotes[bssid] = note;
    browser.storage.local.set({ satWifiNotes: _wifiNotes });
  }

  function renderWifiList() {
    var list = document.getElementById('satWifiList');
    if (!list) return;
    var countTab = document.getElementById('satWifiTabCount');

    if (!wigleCache || !wigleCache.results || !wigleCache.results.length) {
      list.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--text-muted);text-align:center;">No WiFi data — enable WiGLE in Settings tab</div>';
      if (countTab) countTab.textContent = '';
      return;
    }

    var networks = wigleCache.results;
    if (countTab) countTab.textContent = networks.length;

    list.innerHTML = '';
    for (var i = 0; i < networks.length; i++) {
      var n = networks[i];
      var ssid = n.ssid || '(hidden)';
      var enc = n.encryption || 'None';
      var lastSeen = n.lastupdt ? new Date(n.lastupdt).toLocaleDateString() : '?';
      var lat = n.trilat ? n.trilat.toFixed(5) : '?';
      var lon = n.trilong ? n.trilong.toFixed(5) : '?';

      var item = document.createElement('div');
      item.className = 'sat-pin-item';
      item.style.cssText = 'padding:6px 8px; border-bottom:1px solid var(--border); cursor:pointer;';
      item.dataset.lat = n.trilat || '';
      item.dataset.lon = n.trilong || '';
      item.dataset.idx = i;
      var bssid = n.netid || ('wifi-' + i);
      var existingNote = _wifiNotes[bssid] || '';
      item.dataset.bssid = bssid;
      item.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<strong style="font-size:11px;">' + ssid + '</strong>' +
          '<span style="font-size:9px; color:var(--text-muted);">' + enc + '</span>' +
        '</div>' +
        '<div style="font-size:9px; color:var(--text-muted); font-family:\'SF Mono\',monospace;">' +
          (bssid) + ' · Ch:' + (n.channel || '?') + ' · ' + lat + ', ' + lon +
        '</div>' +
        '<div style="font-size:8px; color:var(--text-muted); opacity:0.6;">Type: ' + (n.type || 'WIFI') + ' · Last: ' + lastSeen + '</div>' +
        '<input class="sat-wifi-note" data-bssid="' + bssid + '" value="' + existingNote.replace(/"/g, '&quot;') + '" placeholder="Notes..." style="width:100%;margin-top:3px;padding:2px 5px;font-size:9px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:var(--text-primary);font-family:inherit;outline:none;">';

      // Wire note saving (stop click propagation so typing doesn't trigger pan)
      var noteInput = item.querySelector('.sat-wifi-note');
      noteInput.addEventListener('click', function(e) { e.stopPropagation(); });
      noteInput.addEventListener('input', function() {
        _saveWifiNote(this.dataset.bssid, this.value);
      });

      // Distance-to button
      if (n.trilat && n.trilong) {
        item.appendChild(makeDistanceToButton(n.trilat, n.trilong, ssid));
      }

      item.addEventListener('click', function() {
        var la = parseFloat(this.dataset.lat);
        var lo = parseFloat(this.dataset.lon);
        var idx = parseInt(this.dataset.idx);
        if (!la || !lo || !map) return;

        // Pan to the network
        map.panTo([la, lo]);

        // Find the corresponding marker and pulse it
        if (wigleMarkers[idx]) {
          var marker = wigleMarkers[idx];
          var origRadius = marker.getRadius();
          var pulseSize = origRadius * 5;
          // Pulse: grow then shrink back
          marker.setRadius(pulseSize);
          marker.setStyle({ weight: 3, opacity: 1 });
          setTimeout(function() {
            marker.setRadius(pulseSize * 0.7);
          }, 150);
          setTimeout(function() {
            marker.setRadius(pulseSize * 0.4);
          }, 300);
          setTimeout(function() {
            marker.setRadius(origRadius);
            marker.setStyle({ weight: 1.5, opacity: 1 });
          }, 450);
        }
      });

      list.appendChild(item);
    }
  }

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
    setTimeout(() => { btn.textContent = '+ Asset'; btn.disabled = false; }, 2000);
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

    // Save satellite image asset
    const addr = window._satLastAddress || null;
    await AssetLibrary.add({
      type: 'satellite',
      title: `${currentLocation || c.lat.toFixed(4) + ',' + c.lng.toFixed(4)} — ${layerA}`,
      description: `${sceneInfo} · ${layerA}${enhanceA !== 'none' ? ' · ' + enhanceA : ''}`,
      thumbnail,
      metadata: {
        lat: c.lat, lon: c.lng, zoom: map.getZoom(),
        searchQuery: currentLocation,
        address: addr,
        dateA, layerA, enhanceA,
        sceneA: selectedSceneA,
      },
      sourcePage: 'satellite',
    });

    // Also save the location as a separate asset
    await AssetLibrary.add({
      type: 'location',
      title: currentLocation || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`,
      description: `${addr?._display || sceneInfo} · zoom ${map.getZoom()}`,
      metadata: {
        lat: c.lat, lon: c.lng, zoom: map.getZoom(),
        searchQuery: currentLocation,
        address: addr,
        dateA, layerA,
        sceneA: selectedSceneA,
      },
      sourcePage: 'satellite',
    });

    const btn = document.getElementById('satCollectView');
    btn.textContent = 'Added!';
    setTimeout(() => { btn.textContent = '+ Asset'; }, 2000);
  });

  // ── Grabber image transform system ──
  let grabberLocked = false;
  let grabberRotation = 0;
  let grabberScale = 100;
  let grabberFixedEl = null; // the fixed-position overlay element when locked
  let grabberDragging = false;
  let grabberResizing = false;
  let dragStartX, dragStartY, dragStartLeft, dragStartTop;
  let resizeStartX, resizeStartY, resizeStartW, resizeStartH;

  function showGrabberControls(show) {
    const el = document.getElementById('satGrabberControls');
    if (el) el.style.display = show ? '' : 'none';
  }

  function resetGrabberTransform() {
    grabberRotation = 0;
    grabberScale = 100;
    grabberLocked = false;
    document.getElementById('satGrabberRotate').value = 0;
    document.getElementById('satGrabberRotateVal').textContent = '0°';
    document.getElementById('satGrabberScale').value = 100;
    document.getElementById('satGrabberScaleVal').textContent = '100%';
    document.getElementById('satGrabberLock').checked = false;
    removeGrabberFixed();
    applyGrabberTransform();
  }

  function applyGrabberTransform() {
    if (grabberLocked && grabberFixedEl) {
      // Apply to fixed overlay
      const img = grabberFixedEl.querySelector('img');
      if (img) {
        img.style.transform = `rotate(${grabberRotation}deg) scale(${grabberScale / 100})`;
      }
    } else if (imageLayerB) {
      // Apply to Leaflet overlay element
      const el = imageLayerB._image || imageLayerB.getElement?.();
      if (el) {
        el.style.transform = `rotate(${grabberRotation}deg) scale(${grabberScale / 100})`;
        el.style.transformOrigin = 'center center';
      }
    }
  }

  function createGrabberFixed() {
    if (grabberFixedEl) return;
    if (!imageLayerB) return;

    const el = imageLayerB._image || imageLayerB.getElement?.();
    if (!el || !el.src) return;

    // Get current position on screen
    const rect = el.getBoundingClientRect();

    // Remove from Leaflet (but keep the reference)
    const src = el.src;
    if (map.hasLayer(imageLayerB)) map.removeLayer(imageLayerB);

    // Create fixed overlay
    grabberFixedEl = document.createElement('div');
    grabberFixedEl.className = 'sat-grabber-fixed';
    grabberFixedEl.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      z-index: 500;
      pointer-events: auto;
      cursor: move;
    `;

    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: fill;
      transform: rotate(${grabberRotation}deg) scale(${grabberScale / 100});
      transform-origin: center center;
      opacity: ${imageLayerB?.options?.opacity ?? 0.5};
    `;
    grabberFixedEl.appendChild(img);

    // Resize handle (bottom-right corner)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'sat-grabber-resize-handle';
    grabberFixedEl.appendChild(resizeHandle);

    // Lock indicator
    const lockBadge = document.createElement('div');
    lockBadge.className = 'sat-grabber-lock-badge';
    lockBadge.textContent = '🔒';
    grabberFixedEl.appendChild(lockBadge);

    document.querySelector('.sat-map-main').appendChild(grabberFixedEl);

    // Drag to reposition
    grabberFixedEl.addEventListener('mousedown', (e) => {
      if (e.target === resizeHandle) return;
      grabberDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartLeft = grabberFixedEl.offsetLeft;
      dragStartTop = grabberFixedEl.offsetTop;
      // Use fixed positioning coords
      const fixedRect = grabberFixedEl.getBoundingClientRect();
      dragStartLeft = fixedRect.left;
      dragStartTop = fixedRect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', _grabberMouseMove);
    document.addEventListener('mouseup', _grabberMouseUp);

    // Resize via corner handle
    resizeHandle.addEventListener('mousedown', (e) => {
      grabberResizing = true;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartW = grabberFixedEl.offsetWidth;
      resizeStartH = grabberFixedEl.offsetHeight;
      e.preventDefault();
      e.stopPropagation();
    });
  }

  function _grabberMouseMove(e) {
    if (grabberDragging && grabberFixedEl) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      grabberFixedEl.style.left = (dragStartLeft + dx) + 'px';
      grabberFixedEl.style.top = (dragStartTop + dy) + 'px';
    }
    if (grabberResizing && grabberFixedEl) {
      const dx = e.clientX - resizeStartX;
      const dy = e.clientY - resizeStartY;
      grabberFixedEl.style.width = Math.max(50, resizeStartW + dx) + 'px';
      grabberFixedEl.style.height = Math.max(50, resizeStartH + dy) + 'px';
    }
  }

  function _grabberMouseUp() {
    grabberDragging = false;
    grabberResizing = false;
  }

  function removeGrabberFixed() {
    if (grabberFixedEl) {
      document.removeEventListener('mousemove', _grabberMouseMove);
      document.removeEventListener('mouseup', _grabberMouseUp);
      grabberFixedEl.remove();
      grabberFixedEl = null;
    }
  }

  // Wire up controls in setupPanelControls — but we need the elements to exist first
  // So wire them here as they're in the DOM already
  document.getElementById('satGrabberLock')?.addEventListener('change', (e) => {
    grabberLocked = e.target.checked;
    if (grabberLocked) {
      createGrabberFixed();
    } else {
      // Unlock — put image back as Leaflet overlay
      if (grabberFixedEl && map) {
        const img = grabberFixedEl.querySelector('img');
        const src = img?.src;
        const opacity = parseFloat(img?.style.opacity) || 0.5;
        removeGrabberFixed();

        if (src) {
          const bounds = map.getBounds();
          const imageBounds = L.latLngBounds(
            [bounds.getSouth(), bounds.getWest()],
            [bounds.getNorth(), bounds.getEast()]
          );
          imageLayerB = L.imageOverlay(src, imageBounds, { opacity }).addTo(map);
          imageLayerB.setZIndex(200);
          applyGrabberTransform();
          applyEnhanceFilters();
        }
      }
    }
  });

  document.getElementById('satGrabberRotate')?.addEventListener('input', (e) => {
    grabberRotation = parseInt(e.target.value);
    document.getElementById('satGrabberRotateVal').textContent = grabberRotation + '°';
    applyGrabberTransform();
  });
  document.getElementById('satGrabberRotate')?.addEventListener('dblclick', () => {
    grabberRotation = 0;
    document.getElementById('satGrabberRotate').value = 0;
    document.getElementById('satGrabberRotateVal').textContent = '0°';
    applyGrabberTransform();
  });

  document.getElementById('satGrabberScale')?.addEventListener('input', (e) => {
    grabberScale = parseInt(e.target.value);
    document.getElementById('satGrabberScaleVal').textContent = grabberScale + '%';
    applyGrabberTransform();
  });
  document.getElementById('satGrabberScale')?.addEventListener('dblclick', () => {
    grabberScale = 100;
    document.getElementById('satGrabberScale').value = 100;
    document.getElementById('satGrabberScaleVal').textContent = '100%';
    applyGrabberTransform();
  });

  document.getElementById('satGrabberReset')?.addEventListener('click', resetGrabberTransform);

  function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ── Unified Point Registry + Distance-To Calculator ──
  var _distToActive = false;
  var _distToSource = null;
  var _distToHandler = null;

  // Collect all known points across all data sources (uses ArgusGeo registry if available)
  function _getAllStoredPoints() {
    if (typeof ArgusGeo !== 'undefined') {
      var pts = ArgusGeo.getAllPoints();
      // Map source names to types for grouping
      return pts.map(function(p) {
        p.type = (p.source || '').toLowerCase().replace(/\s+/g, '');
        if (p.type === 'pins') p.type = 'pin';
        return p;
      });
    }
    // Fallback: inline collection
    var pts = [];
    for (var i = 0; i < pins.length; i++) {
      var p = pins[i];
      pts.push({ lat: p.lat, lon: p.lon, label: p.label || 'Pin ' + (i + 1), type: 'pin', icon: '📍' });
    }
    for (var j = 0; j < _pinnedAircraft.length; j++) {
      var ac = _pinnedAircraft[j];
      pts.push({ lat: ac.lat, lon: ac.lon, label: ac.callsign || ac.icao24, type: 'aircraft', icon: '✈' });
    }
    if (wigleCache && wigleCache.results) {
      for (var k = 0; k < wigleCache.results.length && k < 50; k++) {
        var n = wigleCache.results[k];
        if (n.trilat && n.trilong) {
          pts.push({ lat: n.trilat, lon: n.trilong, label: n.ssid || '(hidden)', type: 'wifi', icon: '📶' });
        }
      }
    }
    for (var d = 0; d < _savedDrawings.length; d++) {
      var dr = _savedDrawings[d];
      if (!dr.points) continue;
      var prefix = dr.type === 'distance' ? '↔' : dr.type === 'radius' ? '◯' : dr.type === 'line' ? '⟋' : dr.type === 'track' ? '✈' : '•';
      for (var v = 0; v < dr.points.length; v++) {
        var vLabel = prefix + ' ' + (dr.callsign || dr.type) + ' ' + (dr.type === 'radius' && v === 0 ? 'center' : 'pt' + (v + 1));
        pts.push({ lat: dr.points[v][0], lon: dr.points[v][1], label: vLabel, type: 'geometry', icon: '◆' });
      }
    }
    return pts;
  }

  function _showDistResult(resultEl, dist, targetLat, targetLon, targetLabel) {
    var distStr = _measureUseMiles
      ? (dist * 0.621371 < 1 ? (dist * 0.621371 * 5280).toFixed(0) + ' ft' : (dist * 0.621371).toFixed(2) + ' mi')
      : (dist < 1 ? (dist * 1000).toFixed(0) + ' m' : dist.toFixed(2) + ' km');

    if (resultEl) {
      resultEl.innerHTML = '📏 ' + distStr +
        (targetLabel ? ' <span style="opacity:0.6;font-size:8px;">to ' + escHtml(targetLabel) + '</span>' :
        ' <span style="opacity:0.5;font-size:8px;">to ' + targetLat.toFixed(4) + ',' + targetLon.toFixed(4) + '</span>');
    }

    // Draw line on map
    if (map) {
      var p1 = L.latLng(_distToSource.lat, _distToSource.lon);
      var p2 = L.latLng(targetLat, targetLon);
      var line = L.polyline([p1, p2], { color: '#e040fb', weight: 2, dashArray: '6,4', opacity: 0.8 }).addTo(map);
      var mid = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
      var lbl = L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
        .setLatLng(mid).setContent(distStr).addTo(map);
      _measureLayers.push(line, lbl);
    }
  }

  function startDistanceTo(sourceLat, sourceLon, sourceLabel, resultEl) {
    _distToActive = true;
    _distToSource = { lat: sourceLat, lon: sourceLon, label: sourceLabel };
    if (map) map.getContainer().style.cursor = 'crosshair';
    if (resultEl) resultEl.textContent = 'Click map or pick a point...';

    _distToHandler = function(e) {
      var dist = _haversineDistance(_distToSource.lat, _distToSource.lon, e.latlng.lat, e.latlng.lng);
      _showDistResult(resultEl, dist, e.latlng.lat, e.latlng.lng, null);
      _cancelDistTo();
    };
    map.on('click', _distToHandler);
  }

  function _cancelDistTo() {
    _distToActive = false;
    _distToSource = null;
    if (map) {
      map.getContainer().style.cursor = '';
      if (_distToHandler) { map.off('click', _distToHandler); _distToHandler = null; }
    }
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _distToActive) _cancelDistTo();
  });

  // Pulsing green dot on map to highlight a point from the picker
  var _pickerPulseMarker = null;
  var _pickerPulseAnim = null;

  function _showPickerPulse(lat, lon) {
    _clearPickerPulse();
    if (!map) return;
    _pickerPulseMarker = L.circleMarker([lat, lon], {
      radius: 8, fillColor: '#76ff03', fillOpacity: 0.9, color: '#76ff03', weight: 2, opacity: 0.6
    }).addTo(map);
    // Animate: pulse radius between 8 and 16
    var growing = true;
    var r = 8;
    _pickerPulseAnim = setInterval(function() {
      if (!_pickerPulseMarker) { clearInterval(_pickerPulseAnim); return; }
      r += growing ? 1.5 : -1.5;
      if (r >= 16) growing = false;
      if (r <= 8) growing = true;
      try { _pickerPulseMarker.setRadius(r); } catch(e) {}
    }, 80);
  }

  function _clearPickerPulse() {
    if (_pickerPulseAnim) { clearInterval(_pickerPulseAnim); _pickerPulseAnim = null; }
    if (_pickerPulseMarker && map) { try { map.removeLayer(_pickerPulseMarker); } catch(e) {} }
    _pickerPulseMarker = null;
  }

  // Build a "Distance to..." button with point picker dropdown + map click fallback
  function makeDistanceToButton(lat, lon, label) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:3px; position:relative;';

    var btn = document.createElement('button');
    btn.className = 'pill-chip';
    btn.style.cssText = 'font-size:9px;padding:2px 8px;';
    btn.textContent = '📏 Distance to...';

    var result = document.createElement('div');
    result.style.cssText = 'font-size:9px;color:var(--text-muted);min-height:14px;margin-top:2px;';

    var picker = document.createElement('div');
    picker.style.cssText = 'display:none; position:absolute; bottom:100%; left:0; right:0; max-height:200px; overflow-y:auto; background:var(--bg-primary,#1a1a2e); border:1px solid var(--border,#2a2a4a); border-radius:6px; z-index:3000; box-shadow:0 4px 12px rgba(0,0,0,0.5); margin-bottom:2px;';

    function closePicker() { picker.style.display = 'none'; }

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (picker.style.display !== 'none') { closePicker(); return; }

      // Build picker list
      var allPts = _getAllStoredPoints();
      // Filter out self (same lat/lon)
      allPts = allPts.filter(function(p) {
        return Math.abs(p.lat - lat) > 0.00001 || Math.abs(p.lon - lon) > 0.00001;
      });

      picker.innerHTML = '';

      // "Pick on map" option
      var mapOpt = document.createElement('div');
      mapOpt.style.cssText = 'padding:5px 8px; cursor:pointer; font-size:10px; border-bottom:1px solid var(--border,#2a2a4a); color:var(--accent,#e94560);';
      mapOpt.textContent = '🗺 Click on map...';
      mapOpt.addEventListener('click', function(ev) {
        ev.stopPropagation();
        closePicker();
        startDistanceTo(lat, lon, label || '', result);
      });
      picker.appendChild(mapOpt);

      // Group into picker categories
      var categories = [
        { key: 'pin',      label: 'Saved Pin',    icon: '📍', items: [] },
        { key: 'wifi',     label: 'Source',        icon: '📶', items: [] },
        { key: 'geometry', label: 'Geometry',      icon: '◆',  items: [] },
        { key: 'aircraft', label: 'Other Plane',   icon: '✈',  items: [] },
      ];
      var catMap = {};
      categories.forEach(function(c) { catMap[c.key] = c; });

      allPts.forEach(function(p) {
        var cat = catMap[p.type] || catMap['geometry']; // fallback to geometry
        cat.items.push(p);
      });

      categories.forEach(function(cat) {
        if (!cat.items.length) return;
        var header = document.createElement('div');
        header.style.cssText = 'padding:3px 8px; font-size:8px; font-weight:600; text-transform:uppercase; color:var(--text-muted); opacity:0.5; border-bottom:1px solid rgba(255,255,255,0.04);';
        header.textContent = cat.icon + ' ' + cat.label;
        picker.appendChild(header);

        cat.items.forEach(function(pt) {
          var opt = document.createElement('div');
          opt.style.cssText = 'padding:4px 8px; cursor:pointer; font-size:10px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.03);';
          opt.innerHTML = '<span>' + (pt.icon || cat.icon) + ' ' + escHtml(pt.label) + '</span><span style="font-size:8px;color:var(--text-muted);font-family:\'SF Mono\',monospace;">' + pt.lat.toFixed(3) + ',' + pt.lon.toFixed(3) + '</span>';
          opt.addEventListener('mouseenter', (function(p) {
            return function() {
              this.style.background = 'rgba(255,255,255,0.06)';
              _showPickerPulse(p.lat, p.lon);
            };
          })(pt));
          opt.addEventListener('mouseleave', function() {
            this.style.background = '';
            _clearPickerPulse();
          });
          opt.addEventListener('click', function(ev) {
            ev.stopPropagation();
            _clearPickerPulse();
            closePicker();
            _distToSource = { lat: lat, lon: lon, label: label || '' };
            var dist = _haversineDistance(lat, lon, pt.lat, pt.lon);
            _showDistResult(result, dist, pt.lat, pt.lon, pt.label);
            _distToSource = null;
          });
          picker.appendChild(opt);
        });
      });

      if (!allPts.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:8px; font-size:9px; color:var(--text-muted); text-align:center;';
        empty.textContent = 'No other stored points';
        picker.appendChild(empty);
      }

      picker.style.display = 'block';
      // Close on outside click
      setTimeout(function() {
        document.addEventListener('click', function closePickerOnce() {
          closePicker();
          document.removeEventListener('click', closePickerOnce);
        });
      }, 50);
    });

    wrap.append(picker, btn, result);
    return wrap;
  }

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

    // Register point sources with shared ArgusGeo library
    if (typeof ArgusGeo !== 'undefined') {
      ArgusGeo.registerPointSource('Pins', '📍', function() {
        return pins.map(function(p, i) { return { lat: p.lat, lon: p.lon, label: p.label || 'Pin ' + (i + 1) }; });
      });
      ArgusGeo.registerPointSource('Aircraft', '✈', function() {
        return _pinnedAircraft.map(function(a) { return { lat: a.lat, lon: a.lon, label: a.callsign || a.icao24 }; });
      });
      ArgusGeo.registerPointSource('WiFi', '📶', function() {
        if (!wigleCache || !wigleCache.results) return [];
        return wigleCache.results.slice(0, 50).filter(function(n) { return n.trilat && n.trilong; })
          .map(function(n) { return { lat: n.trilat, lon: n.trilong, label: n.ssid || '(hidden)' }; });
      });
      ArgusGeo.registerPointSource('Geometry', '◆', function() {
        var pts = [];
        _savedDrawings.forEach(function(dr) {
          if (!dr.points || dr.type === 'track') return; // tracks belong to Aircraft, not Geometry
          var prefix = dr.type === 'radius' ? '◯' : dr.type === 'distance' ? '↔' : dr.type === 'line' ? '⟋' : '•';
          dr.points.forEach(function(p, vi) {
            var vName = dr.type === 'radius' ? (vi === 0 ? 'center' : 'edge') : 'pt' + (vi + 1);
            pts.push({ lat: p[0], lon: p[1], label: prefix + ' ' + dr.type + ' ' + vName });
          });
        });
        return pts;
      });
    }

    // Don't auto-load imagery — wait for user to search

    // Init shared asset library
    if (typeof AssetLibrary !== 'undefined') {
      AssetLibrary.init({ pageId: 'satellite', tabs: ['image', 'satellite', 'location'] });

      // Add "Pins" button to asset library header
      AssetLibrary.addHeaderButton('Pins', 'Show pinned locations', () => {
        // Switch asset library to Locations tab
        AssetLibrary.switchTab('location');
        // Open the Pinned Locations panel
        document.getElementById('satPinsPanel')?.classList.remove('hidden');
      });

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
          const slider = document.getElementById('satOverlayA');
          slider.value = 50;
          slider.dispatchEvent(new Event('input'));
          // Update source label and highlight in library
          const srcLabel = document.getElementById('satSourceB');
          if (srcLabel) srcLabel.textContent = 'Grabber';
          // Clear old satellite scene list/info for B
          document.getElementById('satSceneListB').innerHTML = '';
          document.getElementById('satSceneInfoB').textContent = '';
          selectedSceneB = null;
          showGrabberControls(true);
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

  // ── WiGLE WiFi Network Overlay ──

  let wigleMarkers = [];
  let wigleVisible = false;
  let wigleCache = null; // { bbox, results, ts, zoom }
  let wigleCoolingDown = false;
  let wigleBboxRect = null; // Leaflet rectangle showing the cached coverage zone
  const WIGLE_CACHE_TTL = 10 * 60 * 1000;
  const WIGLE_COOLDOWN_MS = 30 * 1000;

  // Check if ANY persistent WiGLE zone overlaps the current view
  // Async — returns promise
  async function _wigleCacheStillVisible() {
    if (!map) return false;
    // Check in-memory session cache first (fast path)
    if (wigleCache && wigleCache.bbox) {
      var cached = wigleCache.bbox;
      var current = map.getBounds();
      if (!(cached[2] < current.getWest() || cached[0] > current.getEast() ||
            cached[3] < current.getSouth() || cached[1] > current.getNorth())) {
        return true;
      }
    }
    // Check persistent DB
    if (typeof WigleCacheDB !== 'undefined') {
      try {
        var viewBbox = [map.getBounds().getWest(), map.getBounds().getSouth(),
                        map.getBounds().getEast(), map.getBounds().getNorth()];
        var overlapping = await WigleCacheDB.findOverlapping(viewBbox);
        return overlapping.length > 0;
      } catch(e) { return false; }
    }
    return false;
  }

  function _wigleToast(msg, durationMs = 4000) {
    let toast = document.getElementById('wigleToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wigleToast';
      toast.style.cssText = [
        'position:absolute','top:12px','left:50%','transform:translateX(-50%)',
        'background:rgba(20,20,30,0.92)','color:#fff','padding:8px 16px',
        'border-radius:6px','font-size:12px','z-index:2000','pointer-events:none',
        'border:1px solid rgba(255,255,255,0.2)','max-width:420px','text-align:center',
      ].join(';');
      document.getElementById('satMap')?.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, durationMs);
  }

  // WiGLE API call counter (daily, persisted)
  var _wigleCallCount = 0;
  var _wigleCallDay = '';
  browser.storage.local.get({ wigleCallCount: 0, wigleCallDay: '' }).then(function(s) {
    var today = new Date().toISOString().slice(0, 10);
    if (s.wigleCallDay === today) {
      _wigleCallCount = s.wigleCallCount;
    } else {
      _wigleCallCount = 0; // new day, reset
    }
    _wigleCallDay = today;
    _wigleUpdateCountBadge();
  });
  function _wigleIncrementCall() {
    _wigleCallCount++;
    _wigleCallDay = new Date().toISOString().slice(0, 10);
    browser.storage.local.set({ wigleCallCount: _wigleCallCount, wigleCallDay: _wigleCallDay });
    _wigleUpdateCountBadge();
  }
  function _wigleUpdateCountBadge() {
    var el = document.getElementById('satWigleApiCount');
    if (el) el.textContent = _wigleCallCount > 0 ? _wigleCallCount : '';
  }

  // WiFi icon pulse during API call
  var _wiglePulseInterval = null;
  function _wigleStartPulse() {
    var icon = document.getElementById('satWigleIcon');
    if (!icon) return;
    var on = true;
    icon.style.stroke = '#44ff88';
    icon.style.opacity = '1';
    _wiglePulseInterval = setInterval(function() {
      on = !on;
      icon.style.opacity = on ? '1' : '0.2';
      icon.style.stroke = on ? '#44ff88' : '#226633';
    }, 400);
  }
  function _wigleStopPulse() {
    clearInterval(_wiglePulseInterval);
    _wiglePulseInterval = null;
    var icon = document.getElementById('satWigleIcon');
    if (icon) { icon.style.stroke = ''; icon.style.opacity = '0.6'; }
  }

  async function loadWigleOverlay() {
    if (!map) return;

    var bounds = map.getBounds();
    var bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];

    var networks;

    // 1. Check persistent DB for overlapping zones
    if (typeof WigleCacheDB !== 'undefined') {
      try {
        var overlapping = await WigleCacheDB.findOverlapping(bbox);
        if (overlapping.length > 0) {
          networks = WigleCacheDB.mergeNetworks(overlapping);
          wigleCache = { bbox: bbox, results: networks, ts: Date.now(), zoom: map.getZoom() };
          _wigleToast('WiGLE: ' + networks.length + ' networks (' + overlapping.length + ' cached zone' + (overlapping.length > 1 ? 's' : '') + ')');
          renderWifiList();
          _drawAllWigleZones(); // show all historical rectangles
          // continue to render markers below
        }
      } catch(e) { console.warn('[WiGLE] DB read error:', e); }
    }

    // 2. If no cached data, check in-memory session cache
    if (!networks && wigleCache && wigleCache.results) {
      var c = wigleCache.bbox;
      if (c && !(c[2] < bbox[0] || c[0] > bbox[2] || c[3] < bbox[1] || c[1] > bbox[3])) {
        networks = wigleCache.results;
        _wigleToast('WiGLE: ' + networks.length + ' networks (session cache)');
        renderWifiList();
      }
    }

    // 3. If still no data, make API call
    if (!networks) {
      if (wigleCoolingDown) {
        _wigleToast('WiGLE: please wait 30s before querying again (daily limit protection)', 4000);
        return;
      }
      _wigleStartPulse();
      try {
        var resp = await browser.runtime.sendMessage({
          action: 'intelSearch',
          provider: 'wigle',
          query: '',
          options: { bbox: bbox, resultsPerPage: 100 }
        });
        _wigleStopPulse();
        _wigleIncrementCall();
        console.log('[WiGLE] response:', resp);
        if (!resp || !resp.success) {
          var msg = (resp && resp.error) || 'WiGLE search failed';
          if (msg.includes('429')) {
            _wigleToast('⚠ WiGLE daily query limit reached. Free accounts ~10 queries/day. Try again tomorrow.', 8000);
          } else if (msg.includes('not configured') || msg.includes('credentials')) {
            _wigleToast('⚠ WiGLE: add API Name + Token in Settings → Intel Providers → WiGLE', 6000);
          } else {
            _wigleToast('⚠ WiGLE: ' + msg, 6000);
          }
          wigleVisible = false;
          document.getElementById('satWifiToggle')?.classList.remove('active');
          return;
        }
        networks = (resp.results && resp.results.results) || [];
        wigleCache = { bbox: bbox, results: networks, ts: Date.now(), zoom: map.getZoom() };
        wigleCoolingDown = true;
        setTimeout(function() { wigleCoolingDown = false; }, WIGLE_COOLDOWN_MS);

        // Save to persistent DB
        if (typeof WigleCacheDB !== 'undefined') {
          try {
            await WigleCacheDB.saveZone(bbox, map.getZoom(), networks);
            console.log('[WiGLE] zone saved to persistent cache');
          } catch(e) { console.warn('[WiGLE] DB save error:', e); }
        }

        renderWifiList();
        _drawAllWigleZones();
        _wigleToast('WiGLE: ' + networks.length + ' networks in view' +
          (resp.results && resp.results.totalResults ? ' (' + resp.results.totalResults + ' total)' : '') +
          ' — click a dot for details');
      } catch (e) {
        _wigleStopPulse();
        _wigleToast('WiGLE error: ' + e.message, 6000);
        wigleVisible = false;
        document.getElementById('satWifiToggle')?.classList.remove('active');
        return;
      }
    }

    // Render markers
    wigleMarkers.forEach(m => map.removeLayer(m));
    wigleMarkers = [];

    const ENCRYPTION_COLORS = {
      'WPA2': '#4fc3f7', 'WPA': '#81d4fa', 'WEP': '#ffb74d',
      'None': '#ef5350', 'WPA3': '#aed581',
    };

    networks.forEach(net => {
      if (!net.trilat || !net.trilong) return;
      const enc = net.encryption || 'None';
      const color = ENCRYPTION_COLORS[enc] || '#90a4ae';
      const marker = L.circleMarker([net.trilat, net.trilong], {
        radius: 6, color, fillColor: color, fillOpacity: 0.85,
        weight: 1.5, opacity: 1, pane: 'markerPane',
      }).addTo(map);
      const ssid = net.ssid || '(hidden)';
      const lastSeen = net.lastupdt ? new Date(net.lastupdt).toLocaleDateString() : '?';
      marker.bindPopup(
        `<strong>${ssid}</strong><br>` +
        `BSSID: <code>${net.netid || '?'}</code><br>` +
        `Encryption: ${enc} · Ch: ${net.channel || '?'}<br>` +
        `Last seen: ${lastSeen}`
      );
      wigleMarkers.push(marker);
    });

    const countEl = document.getElementById('satWifiCount');
    if (countEl) countEl.textContent = wigleMarkers.length > 0 ? wigleMarkers.length : '';

    // Draw zone rectangle for current query
    _drawAllWigleZones();
  }

  // All zone rectangle layers on the map
  var _wigleZoneLayers = [];

  function _clearWigleZoneLayers() {
    for (var i = 0; i < _wigleZoneLayers.length; i++) {
      try { map.removeLayer(_wigleZoneLayers[i]); } catch(e) {}
    }
    _wigleZoneLayers = [];
    if (wigleBboxRect) {
      if (wigleBboxRect._shadow) { try { map.removeLayer(wigleBboxRect._shadow); } catch(e) {} }
      if (wigleBboxRect._icon) { try { map.removeLayer(wigleBboxRect._icon); } catch(e) {} }
      try { map.removeLayer(wigleBboxRect); } catch(e) {}
      wigleBboxRect = null;
    }
  }

  async function _drawAllWigleZones() {
    _clearWigleZoneLayers();
    if (!map || typeof WigleCacheDB === 'undefined') return;
    try {
      var zones = await WigleCacheDB.getAllZones();
      for (var i = 0; i < zones.length; i++) {
        var cb = zones[i].bbox;
        var rectBounds = [[cb[1], cb[0]], [cb[3], cb[2]]];
        // Dark shadow
        var shadow = L.rectangle(rectBounds, {
          color: '#000', weight: 2, opacity: 0.3, fillOpacity: 0, interactive: false
        }).addTo(map);
        _wigleZoneLayers.push(shadow);
        // White dash
        var rect = L.rectangle(rectBounds, {
          color: '#fff', weight: 1, opacity: 0.6, fillOpacity: 0, dashArray: '6 4', interactive: false
        }).addTo(map);
        _wigleZoneLayers.push(rect);
        // WiFi icon at top-left corner
        var iconHtml = '<div style="background:rgba(0,0,0,0.5);border-radius:3px;padding:1px 3px;display:inline-flex;align-items:center;gap:2px;white-space:nowrap;">' +
          '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="#fff"/></svg>' +
          '<span style="font-size:7px;color:#fff;opacity:0.7;">' + (zones[i].networkCount || 0) + '</span></div>';
        var icon = L.divIcon({ className: '', html: iconHtml, iconSize: [0, 0], iconAnchor: [-3, -3] });
        var marker = L.marker([cb[3], cb[0]], { icon: icon, interactive: false }).addTo(map);
        _wigleZoneLayers.push(marker);
      }
      // Set the newest zone as wigleBboxRect for the toggle guard
      if (zones.length > 0 && wigleCache && wigleCache.bbox) {
        wigleBboxRect = _wigleZoneLayers[_wigleZoneLayers.length - 2] || null; // last rect
      }
    } catch(e) { console.warn('[WiGLE] draw zones error:', e); }
  }

  function clearWigleOverlay() {
    wigleMarkers.forEach(function(m) { try { map.removeLayer(m); } catch(e) {} });
    wigleMarkers = [];
    _clearWigleZoneLayers();
    var countEl = document.getElementById('satWifiCount');
    if (countEl) countEl.textContent = '';
    var btn = document.getElementById('satWifiToggle');
    if (btn) btn.classList.remove('active');
    var pill = document.getElementById('satWigleToggle');
    if (pill) pill.checked = false;
  }

  // Old edge-tab handler (kept for backward compat but button hidden)
  document.getElementById('satWifiToggle')?.addEventListener('click', async () => {
    const btn = document.getElementById('satWifiToggle');
    if (wigleVisible) {
      wigleVisible = false;
      clearWigleOverlay();
    } else {
      if (_wigleCacheStillVisible()) {
        _wigleToast('WiGLE: data already loaded for this area — pan away from the green zone first', 4000);
        return;
      }
      wigleVisible = true;
      btn.classList.add('active');
      const statusEl = document.getElementById('satImageryStatus');
      if (statusEl) statusEl.textContent = 'WiGLE: sending request…';
      try {
        await loadWigleOverlay();
      } catch (e) {
        if (statusEl) statusEl.textContent = `WiGLE click error: ${e.message}`;
        console.error('[WiGLE] click handler error:', e);
      }
    }
  });

  // ── New pill-toggle in Settings panel (replaces edge-tab) ──
  document.getElementById('satWigleToggle')?.addEventListener('change', async function() {
    var toggle = this;
    // Block toggle while API call is in progress
    if (_wiglePulseInterval) {
      toggle.checked = !toggle.checked; // revert
      _wigleToast('WiGLE: request in progress — wait for the signal to finish', 2000);
      return;
    }
    if (!toggle.checked) {
      wigleVisible = false;
      clearWigleOverlay();
      // Also cleanup the plugin if registered
      if (window.ArgusPluginRegistry) {
        var plugin = window.ArgusPluginRegistry.plugins?.get('wigle-wifi');
        if (plugin && plugin.cleanup) plugin.cleanup();
      }
      return;
    }

    // Block if cached rectangle is still on screen — no wasted API calls
    if (_wigleCacheStillVisible()) {
      _wigleToast('WiGLE: data already loaded for this area — pan away from the green zone first', 4000);
      toggle.checked = false;
      return;
    }

    // Check if plugin is enabled in registry first
    if (window.ArgusPluginRegistry) {
      var enabled = await window.ArgusPluginRegistry.isPluginEnabled('wigle-wifi');
      if (!enabled) {
        _wigleToast('WiGLE plugin is disabled — enable it in Options → Settings', 4000);
        toggle.checked = false;
        return;
      }
    }

    wigleVisible = true;
    var statusEl = document.getElementById('satImageryStatus');
    if (statusEl) statusEl.textContent = 'WiGLE: sending request…';
    try {
      // Use plugin if available, fall back to direct call
      if (window.ArgusPluginRegistry && window.ArgusPluginRegistry.plugins?.get('wigle-wifi')) {
        var result = await window.ArgusPluginRegistry.runPlugin('wigle-wifi');
        if (statusEl) statusEl.textContent = result.message || 'WiGLE complete';
        // Plugin renders markers directly on the map — update API counter
        var countEl = document.getElementById('satWigleApiCount');
        if (countEl && result.entities) countEl.textContent = result.entities.length || '';
      } else {
        // Fallback: direct loadWigleOverlay (no plugin system)
        await loadWigleOverlay();
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = 'WiGLE error: ' + e.message;
      console.error('[WiGLE] toggle error:', e);
      wigleVisible = false;
      toggle.checked = false;
    }
  });

  // Hide old edge-tab button
  const oldWifiBtn = document.getElementById('satWifiToggle');
  if (oldWifiBtn) oldWifiBtn.style.display = 'none';

  // NOTE: No moveend auto-reload — WiGLE free accounts rate-limit to ~1 query/10 min.
  // User must manually click the WiFi button again after panning to a new area.
  function _onMapMoveEndWigle() { /* intentionally empty — see note above */ }

  // ── OpenSky Aircraft Tracking ──
  var _openskyMarkers = [];
  var _openskyGhosts = []; // faded markers from previous positions
  var _openskyVisible = false;
  var _pinnedAircraft = []; // persisted aircraft collection

  // Load persisted aircraft
  browser.storage.local.get({ satAircraft: [] }).then(function(s) { _pinnedAircraft = s.satAircraft || []; });

  function _saveAircraft() {
    browser.storage.local.set({ satAircraft: _pinnedAircraft });
  }

  function _makeAircraftIcon(heading, onGround, ghost) {
    var rotation = heading != null ? Math.round(heading) : 0;
    var color = ghost ? 'rgba(255,255,255,0.25)' : (onGround ? '#888888' : '#ff9800');
    var strokeColor = ghost ? 'rgba(255,255,255,0.15)' : '#fff';
    var size = ghost ? 14 : (onGround ? 16 : 22);
    var filter = ghost ? 'opacity(0.4)' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))';
    return L.divIcon({
      className: 'sat-aircraft-icon',
      html: '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + color + '" stroke="' + strokeColor + '" stroke-width="0.8" style="transform:rotate(' + rotation + 'deg);filter:' + filter + ';">' +
        '<path d="M12 2L10 8H4L3 10L10 12.5V18L7 20V22L12 21L17 22V20L14 18V12.5L21 10L20 8H14L12 2Z"/>' +
      '</svg>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  function _clearGhosts() {
    _openskyGhosts.forEach(function(m) { try { map.removeLayer(m); } catch(e) {} });
    _openskyGhosts = [];
  }

  var GHOST_DECAY_MS = 30000; // 30 seconds total fade
  var GHOST_TICK_MS = 2000;   // update every 2s

  function _ghostifyMarkers() {
    // Convert current live markers into ghosts with timed decay
    for (var i = 0; i < _openskyMarkers.length; i++) {
      var m = _openskyMarkers[i];
      var data = m._aircraftData;
      if (!data) { try { map.removeLayer(m); } catch(e) {} continue; }
      try { map.removeLayer(m); } catch(e) {}
      var ghostIcon = _makeAircraftIcon(data.heading, data.onGround, true);
      var ghost = L.marker([data.lat, data.lon], { icon: ghostIcon, interactive: false, zIndexOffset: -100 }).addTo(map);
      ghost._ghostData = data;
      ghost._ghostBorn = Date.now();
      _openskyGhosts.push(ghost);
    }
    _openskyMarkers = [];
  }

  // Decay loop — fades ghosts over time and removes expired ones
  setInterval(function() {
    if (!_openskyGhosts.length || !map) return;
    var now = Date.now();
    var survivors = [];
    for (var i = 0; i < _openskyGhosts.length; i++) {
      var g = _openskyGhosts[i];
      var age = now - (g._ghostBorn || now);
      if (age >= GHOST_DECAY_MS) {
        try { map.removeLayer(g); } catch(e) {}
      } else {
        // Update opacity based on age
        var remaining = 1 - (age / GHOST_DECAY_MS);
        var el = g.getElement && g.getElement();
        if (el) el.style.opacity = (remaining * 0.4).toFixed(2); // max 0.4, fades to 0
        survivors.push(g);
      }
    }
    _openskyGhosts = survivors;
  }, GHOST_TICK_MS);

  function _renderAircraftMarkers(states) {
    // Ghost old markers instead of removing them
    _ghostifyMarkers();

    for (var j = 0; j < states.length; j++) {
      var s = states[j];
      var lon = s[5], lat = s[6];
      if (!lat || !lon) continue;
      var callsign = (s[1] || '').trim() || 'Unknown';
      var icao24 = s[0] || '';
      var altitude = s[7] != null ? Math.round(s[7]) : null;
      var velocity = s[9] != null ? Math.round(s[9]) : null;
      var heading = s[10];
      var onGround = s[8];
      var origin = s[2] || '?';

      var icon = _makeAircraftIcon(heading, onGround);
      var marker = L.marker([lat, lon], { icon: icon }).addTo(map);

      // Store aircraft data on marker for pinning
      marker._aircraftData = {
        callsign: callsign, icao24: icao24, lat: lat, lon: lon,
        altitude: altitude, velocity: velocity,
        heading: heading != null ? Math.round(heading) : null,
        onGround: onGround, origin: origin,
        ts: Date.now()
      };

      // Build popup with pin button
      (function(m, data) {
        var altStr = data.altitude != null ? data.altitude + 'm' : '?';
        var spdStr = data.velocity != null ? data.velocity + 'm/s' : '?';
        var hdgStr = data.heading != null ? data.heading + '°' : '?';

        var popup = document.createElement('div');
        popup.style.cssText = 'min-width:180px;';
        popup.innerHTML =
          '<strong style="font-size:12px;">' + escHtml(data.callsign) + '</strong>' +
          '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">ICAO24: ' + escHtml(data.icao24) + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);">Alt: ' + altStr + ' · Speed: ' + spdStr + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);">Heading: ' + hdgStr + ' · ' + (data.onGround ? 'On Ground' : 'Airborne') + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);">Origin: ' + escHtml(data.origin) + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);font-family:\'SF Mono\',monospace;">' + data.lat.toFixed(5) + ', ' + data.lon.toFixed(5) + '</div>';

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;';

        var pinBtn = document.createElement('button');
        pinBtn.className = 'pill-chip';
        pinBtn.style.cssText = 'font-size:9px;padding:2px 8px;';
        pinBtn.textContent = '+ Pin';
        pinBtn.addEventListener('click', function() {
          if (_pinnedAircraft.some(function(a) { return a.icao24 === data.icao24; })) {
            pinBtn.textContent = 'Already pinned';
            return;
          }
          _pinnedAircraft.push(Object.assign({}, data, { id: 'ac-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) }));
          _saveAircraft();
          renderAircraftList();
          pinBtn.textContent = 'Pinned ✓';
          pinBtn.disabled = true;
        });

        var trackBtn = document.createElement('button');
        trackBtn.className = 'pill-chip';
        trackBtn.style.cssText = 'font-size:9px;padding:2px 8px;';
        trackBtn.textContent = '✈ Track Distance';
        trackBtn.addEventListener('click', function() {
          // Auto-pin if not already
          if (!_pinnedAircraft.some(function(a) { return a.icao24 === data.icao24; })) {
            _pinnedAircraft.push(Object.assign({}, data, { id: 'ac-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), tracked: true }));
            _saveAircraft();
            renderAircraftList();
            pinBtn.textContent = 'Pinned ✓';
            pinBtn.disabled = true;
          }
          // Find existing track for this aircraft or create new one
          var existingTrack = _savedDrawings.find(function(d) { return d.type === 'track' && d.icao24 === data.icao24; });
          if (existingTrack) {
            // Add new position to existing track
            var lastPt = existingTrack.points[existingTrack.points.length - 1];
            var segDist = _haversineDistance(lastPt[0], lastPt[1], data.lat, data.lon);
            existingTrack.points.push([data.lat, data.lon]);
            existingTrack.distance += segDist;
            existingTrack.ts = Date.now();
            _saveDrawings();
            // Re-render track on map
            _clearAllMapDrawings();
            _restoreDrawingsOnMap();
            _openDrawTab();
            trackBtn.textContent = 'Position added ✓';
          } else {
            // Create new track with single point (next refresh will add second)
            _saveDrawingRecord({
              type: 'track',
              icao24: data.icao24,
              callsign: data.callsign,
              points: [[data.lat, data.lon]],
              distance: 0,
              label: data.callsign + ' (' + data.icao24 + ') — tracking started'
            });
            trackBtn.textContent = 'Tracking ✓';
          }
          trackBtn.disabled = true;
        });

        btnRow.append(pinBtn, trackBtn);
        popup.appendChild(btnRow);
        popup.appendChild(makeDistanceToButton(data.lat, data.lon, data.callsign));
        m.bindPopup(popup, { closeButton: true });
      })(marker, marker._aircraftData);

      _openskyMarkers.push(marker);
    }
  }

  // Peek markers — single aircraft shown without full OpenSky scan
  var _peekMarkers = [];

  function _clearPeekMarkers() {
    _peekMarkers.forEach(function(m) { try { map.removeLayer(m); } catch(e) {} });
    _peekMarkers = [];
  }

  // Direction arrow divIcon — small triangle rotated to bearing
  function _makeArrowIcon(bearingDeg) {
    return L.divIcon({
      className: 'sat-aircraft-icon',
      html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#e040fb" stroke="#fff" stroke-width="1.5" style="transform:rotate(' + Math.round(bearingDeg) + 'deg);filter:drop-shadow(0 0 4px rgba(224,64,251,0.8)) drop-shadow(0 0 8px rgba(224,64,251,0.4));">' +
        '<path d="M12 2L6 18h12L12 2z"/></svg>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }

  // Show a single aircraft on the map + its track line if tracked
  function _peekAircraft(ac) {
    if (!map || !ac) return;
    _clearPeekMarkers();

    // Highlight ring — bright pulsing circle behind the plane
    var highlight = L.circleMarker([ac.lat, ac.lon], {
      radius: 18, fillColor: '#00aaff', fillOpacity: 0.25, color: '#00aaff', weight: 2, opacity: 0.8
    }).addTo(map);
    _peekMarkers.push(highlight);
    // Pulse the highlight
    var hlGrowing = true, hlR = 18;
    var hlAnim = setInterval(function() {
      if (!highlight._map) { clearInterval(hlAnim); return; }
      hlR += hlGrowing ? 0.8 : -0.8;
      if (hlR >= 26) hlGrowing = false;
      if (hlR <= 18) hlGrowing = true;
      try { highlight.setRadius(hlR); } catch(e) { clearInterval(hlAnim); }
    }, 80);

    // Place the plane marker
    var icon = _makeAircraftIcon(ac.heading, ac.onGround, false);
    var marker = L.marker([ac.lat, ac.lon], { icon: icon, zIndexOffset: 200 }).addTo(map);
    marker._aircraftData = ac;

    var statusText = ac.onGround ? 'On Ground' : 'Airborne';
    var altStr = ac.altitude != null ? ac.altitude + 'm' : '?';
    var popup = '<strong>' + escHtml(ac.callsign) + '</strong><br>' +
      '<span style="font-size:10px;color:var(--text-muted);">ICAO24: ' + escHtml(ac.icao24) + ' · ' + statusText + '<br>Alt: ' + altStr + '</span>';
    marker.bindPopup(popup);
    _peekMarkers.push(marker);

    // If tracked, draw the track with direction arrows
    var track = _savedDrawings.find(function(d) { return d.type === 'track' && d.icao24 === ac.icao24; });
    if (track && track.points && track.points.length >= 2) {
      _renderTrackLine(track, ac);
    }
  }

  // Render a track line with start/stop markers and direction arrows
  function _renderTrackLine(track, ac) {
    var latlngs = track.points.map(function(p) { return L.latLng(p[0], p[1]); });

    // Start marker — green with "START" label
    var startDot = L.circleMarker(latlngs[0], { radius: 6, fillColor: '#76ff03', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map);
    startDot.bindTooltip('START', { permanent: true, direction: 'left', className: 'sat-measure-label', offset: [-8, 0] });
    _peekMarkers.push(startDot);

    // End marker — red with "LAST" label
    var endDot = L.circleMarker(latlngs[latlngs.length - 1], { radius: 6, fillColor: '#ff4444', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map);
    endDot.bindTooltip('LAST', { permanent: true, direction: 'right', className: 'sat-measure-label', offset: [8, 0] });
    _peekMarkers.push(endDot);

    // Track line
    var trackLine = L.polyline(latlngs, { color: '#e040fb', weight: 2.5, dashArray: '8,4', opacity: 0.85 }).addTo(map);
    _peekMarkers.push(trackLine);

    // Direction arrows at midpoint of each segment
    for (var i = 1; i < latlngs.length; i++) {
      var p1 = latlngs[i - 1], p2 = latlngs[i];
      var brng = _haversineBearing(p1.lat, p1.lng, p2.lat, p2.lng);
      var midLat = (p1.lat + p2.lat) / 2, midLng = (p1.lng + p2.lng) / 2;
      var arrow = L.marker([midLat, midLng], { icon: _makeArrowIcon(brng), interactive: false, zIndexOffset: 100 }).addTo(map);
      _peekMarkers.push(arrow);
    }

    // Distance label
    var midIdx = Math.floor(latlngs.length / 2);
    var distLabel = L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
      .setLatLng(latlngs[midIdx])
      .setContent('✈ ' + escHtml(ac.callsign) + ' · ' + _formatDist(track.distance))
      .addTo(map);
    _peekMarkers.push(distLabel);
  }

  // Bearing calculation for arrow direction
  function _haversineBearing(lat1, lon1, lat2, lon2) {
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  // Show all tracked/pinned aircraft on the map (peek mode, no full OpenSky scan)
  async function _showAllTrackedAircraft() {
    if (!map || !_pinnedAircraft.length) return;
    _clearPeekMarkers();

    var statusEl = document.getElementById('satImageryStatus');
    if (statusEl) statusEl.textContent = 'Locating ' + _pinnedAircraft.length + ' tracked aircraft...';

    // Try a wide-area lookup for all pinned aircraft
    var foundCount = 0;
    for (var i = 0; i < _pinnedAircraft.length; i++) {
      var ac = _pinnedAircraft[i];
      try {
        var resp = await browser.runtime.sendMessage({
          action: 'intelSearch', provider: 'opensky', query: '', options: { icao24: ac.icao24 }
        });
        if (resp && resp.success && resp.results && resp.results.states) {
          var found = resp.results.states.find(function(s) {
            return (s[0] || '').trim().toLowerCase() === ac.icao24.trim().toLowerCase();
          });
          if (found && found[6] && found[5]) {
            ac.lat = found[6]; ac.lon = found[5];
            ac.altitude = found[7] != null ? Math.round(found[7]) : ac.altitude;
            ac.velocity = found[9] != null ? Math.round(found[9]) : ac.velocity;
            ac.heading = found[10] != null ? Math.round(found[10]) : ac.heading;
            ac.onGround = found[8];
            ac.ts = Date.now();
            foundCount++;
          }
        }
      } catch (e) { /* use last known */ }

      // Highlight ring
      var hl = L.circleMarker([ac.lat, ac.lon], {
        radius: 18, fillColor: '#00aaff', fillOpacity: 0.25, color: '#00aaff', weight: 2, opacity: 0.8
      }).addTo(map);
      _peekMarkers.push(hl);
      (function(ring) {
        var g = true, r = 18;
        var anim = setInterval(function() {
          if (!ring._map) { clearInterval(anim); return; }
          r += g ? 0.8 : -0.8;
          if (r >= 26) g = false;
          if (r <= 18) g = true;
          try { ring.setRadius(r); } catch(e) { clearInterval(anim); }
        }, 80);
      })(hl);

      // Place marker at current (or last known) position
      var icon = _makeAircraftIcon(ac.heading, ac.onGround, false);
      var marker = L.marker([ac.lat, ac.lon], { icon: icon, zIndexOffset: 200 }).addTo(map);
      marker.bindPopup('<strong>' + escHtml(ac.callsign) + '</strong><br>' +
        '<span style="font-size:10px;">' + escHtml(ac.icao24) + ' · ' + (ac.onGround ? 'Ground' : 'Airborne') + '</span>');
      _peekMarkers.push(marker);

      // Draw track with direction arrows if exists
      var track = _savedDrawings.find(function(d) { return d.type === 'track' && d.icao24 === ac.icao24; });
      if (track && track.points && track.points.length >= 2) {
        _renderTrackLine(track, ac);
      }
    }

    _saveAircraft();
    renderAircraftList();

    // Fit map to show all markers
    if (_peekMarkers.length) {
      var group = L.featureGroup(_peekMarkers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    if (statusEl) statusEl.textContent = foundCount + '/' + _pinnedAircraft.length + ' aircraft located';
  }

  // FlightAware enrichment — adds route, origin/destination, aircraft type to a pinned aircraft
  async function _enrichWithFlightAware(ac, cardEl) {
    if (!ac.callsign || ac.callsign === 'Unknown') return;
    try {
      var resp = await browser.runtime.sendMessage({
        action: 'flightawareSearch',
        query: ac.callsign.trim()
      });
      if (!resp || !resp.success || !resp.flights || !resp.flights.length) return;

      var flight = resp.flights[0];
      // Extract route info
      var origin = flight.origin ? (flight.origin.code_iata || flight.origin.code || '') : '';
      var originName = flight.origin ? (flight.origin.name || '') : '';
      var dest = flight.destination ? (flight.destination.code_iata || flight.destination.code || '') : '';
      var destName = flight.destination ? (flight.destination.name || '') : '';
      var acType = flight.aircraft_type || '';
      var route = origin && dest ? origin + ' → ' + dest : '';

      // Store on the aircraft object
      ac.faRoute = route;
      ac.faOrigin = origin;
      ac.faOriginName = originName;
      ac.faDest = dest;
      ac.faDestName = destName;
      ac.faAircraftType = acType;
      ac.faFlightId = flight.fa_flight_id || '';
      _saveAircraft();

      // Update the card inline if still in DOM
      if (cardEl && cardEl.parentNode) {
        var existing = cardEl.querySelector('.sat-ac-fa-info');
        if (existing) existing.remove();
        var faDiv = document.createElement('div');
        faDiv.className = 'sat-ac-fa-info';
        faDiv.style.cssText = 'font-size:9px; color:#4fc3f7; margin-top:2px; padding:2px 4px; background:rgba(79,195,247,0.08); border-radius:3px;';
        var parts = [];
        if (route) parts.push('✈ ' + route);
        if (originName) parts.push('From: ' + escHtml(originName));
        if (destName) parts.push('To: ' + escHtml(destName));
        if (acType) parts.push('Type: ' + escHtml(acType));
        faDiv.innerHTML = parts.join(' · ');
        // Insert before the distance-to button
        var distBtn = cardEl.querySelector('[style*="position:relative"]');
        if (distBtn) cardEl.insertBefore(faDiv, distBtn);
        else cardEl.appendChild(faDiv);
      }
    } catch (e) {
      // FlightAware not configured or rate limited — silent
    }
  }

  function renderAircraftList() {
    var list = document.getElementById('satAircraftList');
    if (!list) return;
    var countTab = document.getElementById('satAircraftTabCount');

    if (!_pinnedAircraft.length) {
      list.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--text-muted);text-align:center;">No pinned aircraft — enable OpenSky and click "+ Pin Aircraft" on any popup</div>';
      if (countTab) countTab.textContent = '';
      return;
    }

    if (countTab) countTab.textContent = _pinnedAircraft.length;
    list.innerHTML = '';

    // "Show All Tracked" button
    var showAllBtn = document.createElement('div');
    showAllBtn.style.cssText = 'padding:6px 8px; border-bottom:1px solid var(--border); text-align:center;';
    var showAllPill = document.createElement('button');
    showAllPill.className = 'pill-chip';
    showAllPill.style.cssText = 'font-size:10px; padding:3px 12px;';
    showAllPill.textContent = '✈ Show All Tracked (' + _pinnedAircraft.length + ')';
    showAllPill.addEventListener('click', function(e) {
      e.stopPropagation();
      _showAllTrackedAircraft();
    });
    showAllBtn.appendChild(showAllPill);
    list.appendChild(showAllBtn);

    for (var i = 0; i < _pinnedAircraft.length; i++) {
      var ac = _pinnedAircraft[i];
      var item = document.createElement('div');
      item.className = 'sat-pin-item';
      item.style.cssText = 'padding:6px 8px; border-bottom:1px solid var(--border); cursor:pointer;';
      item.dataset.lat = ac.lat;
      item.dataset.lon = ac.lon;
      item.dataset.idx = i;
      item.dataset.acId = ac.id;

      var altStr = ac.altitude != null ? ac.altitude + 'm' : '?';
      var spdStr = ac.velocity != null ? ac.velocity + 'm/s' : '?';
      var hdgStr = ac.heading != null ? ac.heading + '°' : '?';
      var timeStr = ac.ts ? new Date(ac.ts).toLocaleTimeString() : '?';

      var isTracked = _savedDrawings.some(function(d) { return d.type === 'track' && d.icao24 === ac.icao24; });
      var groundBadge = ac.onGround
        ? '<span style="display:inline-block;padding:0 4px;border-radius:3px;font-size:8px;font-weight:600;background:rgba(136,136,136,0.25);color:#aaa;margin-left:4px;">GROUND</span>'
        : '<span style="display:inline-block;padding:0 4px;border-radius:3px;font-size:8px;font-weight:600;background:rgba(255,152,0,0.2);color:#ff9800;margin-left:4px;">AIRBORNE</span>';
      var trackingBadge = isTracked
        ? '<span style="display:inline-block;padding:0 6px;border-radius:3px;font-size:8px;font-weight:600;background:rgba(0,150,255,0.25);color:#00aaff;margin-left:4px;animation:sat-track-pulse 2s ease-in-out infinite;">TRACKING</span>'
        : '';
      var borderColor = isTracked ? 'rgba(0,150,255,0.4)' : (ac.onGround ? 'rgba(136,136,136,0.3)' : 'rgba(255,152,0,0.15)');
      item.style.cssText = 'padding:6px 8px; border-bottom:1px solid var(--border); border-left:3px solid ' + borderColor + '; cursor:pointer;';

      item.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span><strong style="font-size:11px;">' + escHtml(ac.callsign) + '</strong>' + groundBadge + trackingBadge + '</span>' +
          '<button class="sat-ac-remove pill-chip" data-ac-id="' + ac.id + '" style="font-size:8px;padding:1px 5px;color:#e94560;" title="Remove">&times;</button>' +
        '</div>' +
        '<div style="font-size:9px; color:var(--text-muted); font-family:\'SF Mono\',monospace;">' +
          'ICAO24: ' + escHtml(ac.icao24) + ' · ' + escHtml(ac.origin) +
        '</div>' +
        '<div style="font-size:9px; color:var(--text-muted);">' +
          'Alt: ' + altStr + ' · Spd: ' + spdStr + ' · Hdg: ' + hdgStr +
        '</div>' +
        '<div style="font-size:8px; color:var(--text-muted); opacity:0.6;">' +
          ac.lat.toFixed(5) + ', ' + ac.lon.toFixed(5) + ' · ' + timeStr +
        '</div>';

      // Track summary if tracked
      if (isTracked) {
        var trackData = _savedDrawings.find(function(d) { return d.type === 'track' && d.icao24 === ac.icao24; });
        if (trackData) {
          var trackDiv = document.createElement('div');
          trackDiv.style.cssText = 'font-size:9px; color:#00aaff; margin-top:2px; padding:2px 4px; background:rgba(0,150,255,0.08); border-radius:3px;';
          trackDiv.innerHTML = '📡 ' + trackData.points.length + ' positions · ' + _formatDist(trackData.distance) + ' traveled';
          item.appendChild(trackDiv);
        }
      }

      // FlightAware info (from previous enrichment)
      if (ac.faRoute) {
        var faDiv = document.createElement('div');
        faDiv.className = 'sat-ac-fa-info';
        faDiv.style.cssText = 'font-size:9px; color:#4fc3f7; margin-top:2px; padding:2px 4px; background:rgba(79,195,247,0.08); border-radius:3px;';
        var faParts = [];
        if (ac.faRoute) faParts.push('✈ ' + ac.faRoute);
        if (ac.faOriginName) faParts.push('From: ' + escHtml(ac.faOriginName));
        if (ac.faDestName) faParts.push('To: ' + escHtml(ac.faDestName));
        if (ac.faAircraftType) faParts.push('Type: ' + escHtml(ac.faAircraftType));
        faDiv.innerHTML = faParts.join(' · ');
        item.appendChild(faDiv);
      }

      // Distance-to button
      item.appendChild(makeDistanceToButton(ac.lat, ac.lon, ac.callsign));

      // Click to re-locate aircraft live and recenter
      item.addEventListener('click', async function(e) {
        if (e.target.classList.contains('sat-ac-remove')) return;
        // Highlight selected card
        list.querySelectorAll('.sat-pin-item').forEach(function(el) { el.style.background = ''; });
        this.style.background = 'rgba(0,170,255,0.1)';
        var acId = this.dataset.acId;
        var ac = _pinnedAircraft.find(function(a) { return a.id === acId; });
        if (!ac || !map) return;

        // Try live lookup by ICAO24
        var statusEl = document.getElementById('satImageryStatus');
        if (statusEl) statusEl.textContent = 'Finding ' + (ac.callsign || ac.icao24) + '...';
        try {
          var resp = await browser.runtime.sendMessage({
            action: 'intelSearch',
            provider: 'opensky',
            query: '',
            options: { icao24: ac.icao24 }
          });
          if (resp && resp.success && resp.results && resp.results.states) {
            var found = resp.results.states.find(function(s) {
              return (s[0] || '').trim().toLowerCase() === ac.icao24.trim().toLowerCase();
            });
            if (found && found[6] && found[5]) {
              var newLat = found[6], newLon = found[5];
              // Update stored position
              ac.lat = newLat;
              ac.lon = newLon;
              ac.altitude = found[7] != null ? Math.round(found[7]) : ac.altitude;
              ac.velocity = found[9] != null ? Math.round(found[9]) : ac.velocity;
              ac.heading = found[10] != null ? Math.round(found[10]) : ac.heading;
              ac.onGround = found[8];
              ac.ts = Date.now();
              _saveAircraft();
              map.setView([newLat, newLon], Math.max(map.getZoom(), 10));
              // Update track with new position
              _updateSingleTrack(ac);
              // Show this one plane on the map (peek) + track if exists
              _peekAircraft(ac);
              if (statusEl) statusEl.textContent = (ac.callsign || ac.icao24) + ' found — ' + (ac.onGround ? 'on ground' : 'airborne');
              // FlightAware enrichment (non-blocking)
              _enrichWithFlightAware(ac, this);
              renderAircraftList();
              return;
            }
          }
          // Fallback: show at last known position
          if (statusEl) statusEl.textContent = (ac.callsign || ac.icao24) + ' not airborne — last known position';
          map.panTo([ac.lat, ac.lon]);
          _peekAircraft(ac);
        } catch (err) {
          if (statusEl) statusEl.textContent = 'Lookup failed — using last known position';
          map.panTo([ac.lat, ac.lon]);
          _peekAircraft(ac);
        }
      });

      list.appendChild(item);
    }

    // Wire remove buttons
    list.querySelectorAll('.sat-ac-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = this.dataset.acId;
        _pinnedAircraft = _pinnedAircraft.filter(function(a) { return a.id !== id; });
        _saveAircraft();
        renderAircraftList();
      });
    });
  }

  // Auto-update positions for tracked aircraft on each OpenSky refresh
  // Update a single aircraft's track with its current position
  function _updateSingleTrack(ac) {
    if (!ac || !ac.icao24) return;
    var track = _savedDrawings.find(function(d) { return d.type === 'track' && d.icao24 === ac.icao24; });
    if (!track) return;
    var lastPt = track.points[track.points.length - 1];
    var moved = _haversineDistance(lastPt[0], lastPt[1], ac.lat, ac.lon);
    if (moved < 0.01) return; // less than 10m, skip
    track.points.push([ac.lat, ac.lon]);
    track.distance += moved;
    track.ts = Date.now();
    _saveDrawings();
  }

  function _updateTrackedAircraft(states) {
    var updated = false;
    for (var i = 0; i < _savedDrawings.length; i++) {
      var d = _savedDrawings[i];
      if (d.type !== 'track' || !d.icao24) continue;
      // Find this aircraft in current states
      for (var j = 0; j < states.length; j++) {
        var s = states[j];
        if ((s[0] || '').trim().toLowerCase() !== d.icao24.trim().toLowerCase()) continue;
        var lat = s[6], lon = s[5];
        if (!lat || !lon) break;
        var lastPt = d.points[d.points.length - 1];
        // Only add if moved (>10m)
        var moved = _haversineDistance(lastPt[0], lastPt[1], lat, lon);
        if (moved < 0.01) break;
        d.points.push([lat, lon]);
        d.distance += moved;
        d.ts = Date.now();
        updated = true;
        break;
      }
    }
    if (updated) {
      _saveDrawings();
      _clearAllMapDrawings();
      _restoreDrawingsOnMap();
    }
  }

  document.getElementById('satOpenskyToggle')?.addEventListener('change', async function() {
    var toggle = this;
    if (!toggle.checked) {
      _openskyVisible = false;
      if (window.ArgusPluginRegistry) {
        var plugin = window.ArgusPluginRegistry.plugins?.get('opensky-track');
        if (plugin && plugin.cleanup) plugin.cleanup();
      }
      _openskyMarkers.forEach(function(m) { try { map.removeLayer(m); } catch(e) {} });
      _openskyMarkers = [];
      _clearGhosts();
      return;
    }

    if (window.ArgusPluginRegistry) {
      var enabled = await window.ArgusPluginRegistry.isPluginEnabled('opensky-track');
      if (!enabled) {
        _wigleToast('OpenSky plugin is disabled — enable in Options → Settings', 4000);
        toggle.checked = false;
        return;
      }
    }

    _openskyVisible = true;
    await _refreshOpenSky();
  });

  // Reusable OpenSky fetch — called by toggle and by location search
  async function _refreshOpenSky() {
    if (!map) return;
    var statusEl = document.getElementById('satImageryStatus');
    if (statusEl) statusEl.textContent = 'OpenSky: fetching aircraft...';

    try {
      var bounds = map.getBounds();
      var resp = await browser.runtime.sendMessage({
        action: 'intelSearch',
        provider: 'opensky',
        query: '',
        options: { lamin: bounds.getSouth(), lamax: bounds.getNorth(), lomin: bounds.getWest(), lomax: bounds.getEast() }
      });
      if (resp && resp.success && resp.results && resp.results.states) {
        _renderAircraftMarkers(resp.results.states);
        _updateTrackedAircraft(resp.results.states);
        if (statusEl) statusEl.textContent = 'OpenSky: ' + resp.results.states.length + ' aircraft';
      } else {
        if (statusEl) statusEl.textContent = 'OpenSky: ' + ((resp && resp.error) || 'no data');
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = 'OpenSky error: ' + e.message;
    }
  }

  // ── Broadcastify Radio Feed Overlay ──
  // Uses RadioReference SOAP API (premium service key required)
  // Coverage: US and Canada only (RadioReference county database)

  let bcMarkers = [];
  let bcVisible = false;
  let bcCache = null; // { bbox, feeds, county, ts }
  let bcCoolingDown = false;
  const BC_CACHE_TTL = 20 * 60 * 1000; // 20 min — feed listings rarely change
  const BC_COOLDOWN_MS = 60 * 1000;    // 1 min between API calls (2 SOAP round trips)

  const BC_STYLE_COLORS = {
    1:  "#1565c0", // Police/Law — blue
    2:  "#c62828", // Fire — red
    3:  "#2e7d32", // EMS — green
    4:  "#e65100", // Aviation — orange
    5:  "#827717", // Military — olive
    6:  "#455a64", // Rail — blue-grey
    7:  "#6d4c41", // Business — brown
    8:  "#4527a0", // Federal — deep purple
    9:  "#00838f", // Weather — teal
    10: "#558b2f", // Ham Radio — light green
  };
  const BC_STYLE_LABELS = {
    1: "Police/Law", 2: "Fire",    3: "EMS",       4: "Aviation",
    5: "Military",   6: "Rail",    7: "Business",  8: "Federal",
    9: "Weather",   10: "Ham Radio", 11: "Marine", 12: "Transportation",
  };

  function _bcToast(msg, durationMs = 4000) {
    let toast = document.getElementById('bcToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bcToast';
      toast.style.cssText = [
        'position:absolute', 'top:50px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(20,20,30,0.92)', 'color:#fff', 'padding:8px 16px',
        'border-radius:6px', 'font-size:12px', 'z-index:2000', 'pointer-events:none',
        'border:1px solid rgba(255,255,255,0.2)', 'max-width:420px', 'text-align:center',
      ].join(';');
      document.getElementById('satMap')?.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, durationMs);
  }

  async function loadBroadcastifyOverlay() {
    if (!map) return;
    const bounds = map.getBounds();
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];

    // Cache check — use existing results if bbox is nearly the same and not stale
    const cacheHit = bcCache &&
      _bboxSimilar(bcCache.bbox, bbox) &&
      (Date.now() - bcCache.ts < BC_CACHE_TTL);

    let feeds, countyName;

    if (cacheHit) {
      feeds = bcCache.feeds;
      countyName = bcCache.county;
      _bcToast(`Radio: ${feeds.length} feeds in ${countyName} (cached)`);
    } else {
      if (bcCoolingDown) {
        _bcToast('Radio: please wait 60s before querying again', 4000);
        return;
      }
      try {
        _bcToast('Radio: searching for feeds in this area…', 8000);
        const resp = await browser.runtime.sendMessage({
          action: 'intelSearch',
          provider: 'broadcastify',
          query: '',
          options: { bbox },
        });
        if (!resp?.success) {
          const msg = resp?.error || 'Broadcastify search failed';
          if (msg.includes('not configured') || msg.includes('service key')) {
            _bcToast('⚠ Radio: add your RadioReference service key in Settings → Intel Providers → Broadcastify', 7000);
          } else if (msg.includes('US') || msg.includes('Canada') || msg.includes('county')) {
            _bcToast('⚠ Radio: Broadcastify/RadioReference covers US & Canada — zoom to a US/Canadian location', 7000);
          } else {
            _bcToast(`⚠ Radio: ${msg}`, 6000);
          }
          bcVisible = false;
          document.getElementById('satRadioToggle')?.classList.remove('active');
          return;
        }
        feeds = resp.results?.feeds || [];
        countyName = resp.results?.county?.name || 'this area';
        bcCache = { bbox, feeds, county: countyName, ts: Date.now() };
        bcCoolingDown = true;
        setTimeout(() => { bcCoolingDown = false; }, BC_COOLDOWN_MS);
        _bcToast(`Radio: ${feeds.length} feeds in ${countyName}` + (feeds.length ? ' — click a marker for details' : ' (none found)'));
      } catch (e) {
        _bcToast(`Radio error: ${e.message}`, 6000);
        console.error('[Broadcastify] overlay error:', e);
        bcVisible = false;
        document.getElementById('satRadioToggle')?.classList.remove('active');
        return;
      }
    }

    // Render markers
    bcMarkers.forEach(m => map.removeLayer(m));
    bcMarkers = [];

    feeds.forEach(feed => {
      const lat = feed.feed_latitude;
      const lon = feed.feed_longitude;
      if (!lat || !lon || (lat === 0 && lon === 0)) return;
      const styleId = feed.style_id || 0;
      const color = BC_STYLE_COLORS[styleId] || '#9e9e9e';
      const label = BC_STYLE_LABELS[styleId] || (styleId ? `Type ${styleId}` : 'Unknown');
      const isLive = feed.status === 1;
      const listeners = feed.listeners ?? '?';

      const marker = L.circleMarker([lat, lon], {
        radius: 7, color, fillColor: color,
        fillOpacity: isLive ? 0.85 : 0.35,
        weight: 2, opacity: 1, pane: 'markerPane',
      }).addTo(map);

      const feedUrl = `https://www.broadcastify.com/listen/feed/${encodeURIComponent(feed.fid)}`;
      const descr = (feed.descr || 'Unknown Feed').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
      const county = (feed.county || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
      marker.bindPopup(
        `<strong>${descr}</strong><br>` +
        `<span style="color:${isLive ? '#4caf50' : '#888'};font-weight:bold">` +
          `${isLive ? '● LIVE' : '○ Offline'}` +
        `</span>` +
        (isLive ? ` &middot; ${listeners} listeners` : '') + `<br>` +
        (county ? `${county}${feed.state ? ', ' + feed.state : ''}<br>` : '') +
        `Type: ${label}<br>` +
        `<a href="${feedUrl}" target="_blank" rel="noopener" style="color:#4fc3f7">Listen on Broadcastify →</a>`
      );
      bcMarkers.push(marker);
    });

    const countEl = document.getElementById('satRadioCount');
    if (countEl) countEl.textContent = bcMarkers.length > 0 ? bcMarkers.length : '';
  }

  function clearBroadcastifyOverlay() {
    bcMarkers.forEach(m => map.removeLayer(m));
    bcMarkers = [];
    const countEl = document.getElementById('satRadioCount');
    if (countEl) countEl.textContent = '';
    document.getElementById('satRadioToggle')?.classList.remove('active');
    var pill = document.getElementById('satRadioToggle2');
    if (pill) pill.checked = false;
  }

  // Old edge-tab handler (kept for backward compat but button hidden)
  document.getElementById('satRadioToggle')?.addEventListener('click', async () => {
    const btn = document.getElementById('satRadioToggle');
    if (bcVisible) {
      bcVisible = false;
      clearBroadcastifyOverlay();
    } else {
      bcVisible = true;
      btn.classList.add('active');
      try {
        await loadBroadcastifyOverlay();
      } catch (e) {
        console.error('[Broadcastify] click handler error:', e);
      }
    }
  });

  // ── New pill-toggle in Settings panel (replaces edge-tab) ──
  document.getElementById('satRadioToggle2')?.addEventListener('change', async function() {
    var checked = this.checked;
    if (!checked) {
      bcVisible = false;
      clearBroadcastifyOverlay();
      return;
    }
    bcVisible = true;
    try {
      await loadBroadcastifyOverlay();
    } catch (e) {
      console.error('[Broadcastify] toggle error:', e);
      bcVisible = false;
      this.checked = false;
    }
  });

  // Hide old edge-tab button
  var oldRadioBtn = document.getElementById('satRadioToggle');
  if (oldRadioBtn) oldRadioBtn.style.display = 'none';

  // ════════════════════════════════════════════════════════════════
  // ── Windy Webcams Overlay ──
  // ════════════════════════════════════════════════════════════════

  var _webcamMarkers = [];
  var _webcamVisible = false;
  var _webcamCache = null; // { bbox, webcams, ts }
  const WEBCAM_CACHE_TTL = 10 * 60 * 1000; // 10 min

  function _makeWebcamIcon() {
    return L.divIcon({
      className: 'sat-webcam-icon',
      html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#4fc3f7" stroke="#16213e" stroke-width="1.2" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.7));">' +
            '<path d="M23 7l-7 5 7 5V7z"/>' +
            '<rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="#4fc3f7"/>' +
            '</svg>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  function _renderWebcamMarkers(webcams) {
    _webcamMarkers.forEach(function(m) { try { map.removeLayer(m); } catch(e) {} });
    _webcamMarkers = [];
    if (!webcams || !webcams.length) return;

    webcams.forEach(function(cam) {
      var loc = cam.location || {};
      var lat = loc.latitude ?? loc.lat;
      var lon = loc.longitude ?? loc.lng ?? loc.lon;
      if (!lat || !lon) return;

      var thumb = cam.images && cam.images.current && (cam.images.current.thumbnail || cam.images.current.preview);
      var streamUrl = cam.player && (cam.player.live?.embed || cam.player.day?.embed || cam.player.month?.embed);
      var title = cam.title || 'Webcam';
      var city = (cam.location && cam.location.city) || '';
      var country = (cam.location && cam.location.country) || '';

      var popupHtml = '<div style="min-width:180px; max-width:230px;">' +
        '<strong style="font-size:12px;">' + title + '</strong><br>' +
        (city ? '<span style="font-size:10px;opacity:0.7;">' + city + (country ? ', ' + country : '') + '</span><br>' : '') +
        (thumb ? '<img src="' + thumb + '" style="width:100%;margin-top:4px;border-radius:3px;cursor:pointer;" /><br>' : '') +
        (streamUrl
          ? '<a href="' + streamUrl + '" target="_blank" rel="noopener noreferrer" style="font-size:10px;color:#4fc3f7;">▶ Live stream ↗</a>'
          : '<span style="font-size:10px;opacity:0.5;">No live stream</span>') +
        '</div>';

      var marker = L.marker([lat, lon], { icon: _makeWebcamIcon() }).addTo(map);
      marker.bindPopup(popupHtml, { maxWidth: 240 });
      marker._webcamData = cam;
      _webcamMarkers.push(marker);
    });

    var countEl = document.getElementById('satWebcamApiCount');
    if (countEl) countEl.textContent = _webcamMarkers.length || '';
    var countTab = document.getElementById('satWebcamsTabCount');
    if (countTab) countTab.textContent = _webcamMarkers.length || '';
  }

  function renderWebcamList() {
    var list = document.getElementById('satWebcamsList');
    if (!list) return;
    var countTab = document.getElementById('satWebcamsTabCount');

    if (!_webcamCache || !_webcamCache.webcams || !_webcamCache.webcams.length) {
      list.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--text-muted);text-align:center;">No webcam data — enable Webcams in Settings tab</div>';
      if (countTab) countTab.textContent = '';
      return;
    }

    var webcams = _webcamCache.webcams;
    if (countTab) countTab.textContent = webcams.length;

    var html = '';
    webcams.forEach(function(cam) {
      var loc = cam.location || {};
      var lat = loc.latitude ?? loc.lat;
      var lon = loc.longitude ?? loc.lng ?? loc.lon;
      var thumb = cam.images && cam.images.current && (cam.images.current.thumbnail || cam.images.current.preview);
      var title = cam.title || 'Webcam';
      var city = loc.city || '';
      var country = loc.country || '';
      var streamUrl = cam.player && (cam.player.live?.embed || cam.player.day?.embed || cam.player.month?.embed);
      var status = cam.status === 'active' ? '#4fc3f7' : '#666';

      html += '<div style="padding:6px 10px; border-bottom:1px solid var(--border); display:flex; gap:8px; align-items:flex-start; cursor:pointer;" ' +
        'data-cam-lat="' + lat + '" data-cam-lon="' + lon + '">' +
        (thumb ? '<img src="' + thumb + '" style="width:52px;height:36px;object-fit:cover;border-radius:3px;flex-shrink:0;" />' : '') +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + status + ';margin-right:4px;vertical-align:middle;"></span>' +
        title + '</div>' +
        (city ? '<div style="font-size:9px;opacity:0.6;">' + city + (country ? ', ' + country : '') + '</div>' : '') +
        (streamUrl ? '<a href="' + streamUrl + '" target="_blank" rel="noopener noreferrer" style="font-size:9px;color:#4fc3f7;">▶ Stream ↗</a>' : '') +
        '</div></div>';
    });
    list.innerHTML = html;

    // Click to fly-to on map
    list.querySelectorAll('[data-cam-lat]').forEach(function(row) {
      row.addEventListener('click', function(e) {
        if (e.target.tagName === 'A') return;
        var lat = parseFloat(this.dataset.camLat);
        var lon = parseFloat(this.dataset.camLon);
        if (lat && lon) map.setView([lat, lon], Math.max(map.getZoom(), 14));
      });
    });
  }

  async function loadWebcamOverlay() {
    if (!map) return;
    var bounds = map.getBounds();
    var bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    var statusEl = document.getElementById('satImageryStatus');

    // Use cache if same area and still fresh
    if (_webcamCache && _webcamCache.webcams && (Date.now() - _webcamCache.ts < WEBCAM_CACHE_TTL)) {
      _renderWebcamMarkers(_webcamCache.webcams);
      if (statusEl) statusEl.textContent = 'Webcams: ' + _webcamCache.webcams.length + ' loaded (cached)';
      renderWebcamList();
      return;
    }

    if (statusEl) statusEl.textContent = 'Webcams: loading...';
    try {
      var resp = await browser.runtime.sendMessage({
        action: 'webcamSearch',
        bbox: bbox,
        options: { limit: 50 },
      });
      if (resp && resp.success) {
        _webcamCache = { bbox, webcams: resp.webcams || [], ts: Date.now() };
        _renderWebcamMarkers(_webcamCache.webcams);
        if (statusEl) statusEl.textContent = 'Webcams: ' + (resp.webcams ? resp.webcams.length : 0) + ' found';
        renderWebcamList();
      } else {
        if (statusEl) statusEl.textContent = 'Webcams: ' + (resp && resp.error ? resp.error : 'no data');
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Webcams error: ' + e.message;
      console.error('[Webcams]', e);
    }
  }

  function _clearWebcamOverlay() {
    _webcamMarkers.forEach(function(m) { try { map.removeLayer(m); } catch(e) {} });
    _webcamMarkers = [];
    var countEl = document.getElementById('satWebcamApiCount');
    if (countEl) countEl.textContent = '';
    var countTab = document.getElementById('satWebcamsTabCount');
    if (countTab) countTab.textContent = '';
  }

  document.getElementById('satWebcamToggle')?.addEventListener('change', async function() {
    var toggle = this;
    if (!toggle.checked) {
      _webcamVisible = false;
      _clearWebcamOverlay();
      return;
    }
    _webcamVisible = true;
    try {
      await loadWebcamOverlay();
    } catch (e) {
      console.error('[Webcams] toggle error:', e);
      _webcamVisible = false;
      toggle.checked = false;
    }
  });

  // Auto-reload webcams when map pans (registered in initMap() above)

  // ════════════════════════════════════════════════════════════════
  // ── Weather Tile Overlay ──
  // ════════════════════════════════════════════════════════════════

  var _weatherLayer = null;      // active Leaflet TileLayer
  var _weatherLayerId = 'precipitation'; // currently selected layer type
  var _weatherSource  = 'owm';           // 'owm' | 'windy'

  // ── Places overlay (CartoDB label tile layer — instant, no API calls) ──
  var _placesLayer   = null;
  var _placesVisible = false;
  // Photon POI search pins
  var _placesMarkers = [];
  var _placesSearchTimer = null;
  var _weatherVisible = false;

  // ── Temp labels overlay ──
  var _tempMarkers  = [];
  var _tempVisible  = false;
  var _tempCacheKey = '';
  var _tempLoading  = false;

  // OWM layer name → Windy layer name map (for source switching)
  var OWM_TO_WINDY = {
    precipitation: 'rain', wind: 'wind', temp: 'temp',
    clouds: 'clouds', pressure: 'pressure',
  };
  var WINDY_TO_OWM = {
    rain: 'precipitation', wind: 'wind', temp: 'temp',
    clouds: 'clouds', pressure: 'pressure',
    gust: 'wind', snowcover: 'clouds', waves: 'wind',
  };
  // Windy-only layers not available in OWM
  var WINDY_ONLY_LAYERS = [
    { value: 'gust',      label: 'Gusts' },
    { value: 'snowcover', label: 'Snow' },
    { value: 'waves',     label: 'Waves' },
  ];

  function _syncWeatherLayerOptions(source) {
    var sel = document.getElementById('satWeatherLayerSelect');
    if (!sel) return;
    var current = sel.value;
    if (source === 'windy') {
      // Add Windy-only options if not present
      WINDY_ONLY_LAYERS.forEach(function(opt) {
        if (!sel.querySelector('[value="' + opt.value + '"]')) {
          var el = document.createElement('option');
          el.value = opt.value; el.textContent = opt.label;
          sel.appendChild(el);
        }
      });
      // Map OWM layer name to Windy equivalent if needed
      var mapped = OWM_TO_WINDY[current];
      if (mapped) sel.value = mapped;
    } else {
      // Remove Windy-only options
      WINDY_ONLY_LAYERS.forEach(function(opt) {
        var el = sel.querySelector('[value="' + opt.value + '"]');
        if (el) el.remove();
      });
      // Map Windy layer back to OWM equivalent
      var mapped = WINDY_TO_OWM[sel.value];
      if (mapped) sel.value = mapped;
    }
    _weatherLayerId = sel.value;
  }

  async function _loadWeatherLayer(layerId) {
    _removeWeatherLayer();
    var statusEl = document.getElementById('satImageryStatus');
    if (statusEl) statusEl.textContent = 'Weather: loading tile layer…';
    try {
      var resp;
      if (_weatherSource === 'windy') {
        resp = await browser.runtime.sendMessage({ action: 'windyTileUrl', layer: layerId });
      } else {
        resp = await browser.runtime.sendMessage({ action: 'weatherTileUrl', layer: layerId });
      }
      if (!resp || !resp.success) {
        if (statusEl) statusEl.textContent = 'Weather: ' + (resp && resp.error ? resp.error : 'API key not configured');
        return;
      }
      var attribution = _weatherSource === 'windy' ? '&copy; Windy' : '&copy; OpenWeatherMap';
      _weatherLayer = L.tileLayer(resp.url, {
        opacity: 0.6,
        attribution: attribution,
        pane: 'overlayPane',
      }).addTo(map);
      if (statusEl) statusEl.textContent = 'Weather: ' + layerId + ' (' + (_weatherSource === 'windy' ? 'Windy' : 'OWM') + ')';
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Weather error: ' + e.message;
      console.error('[Weather]', e);
    }
  }

  function _removeWeatherLayer() {
    if (_weatherLayer) {
      try { map.removeLayer(_weatherLayer); } catch(e) {}
      _weatherLayer = null;
    }
  }

  // ── Places (CartoDB dark labels tile layer — instant, scales with zoom) ──

  document.getElementById('satPlacesToggle')?.addEventListener('change', function() {
    _placesVisible = this.checked;
    if (!_placesVisible) {
      if (_placesLayer) { try { map.removeLayer(_placesLayer); } catch(e) {} _placesLayer = null; }
    } else {
      _placesLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; CARTO &copy; OSM', subdomains: 'abcd', maxZoom: 19, pane: 'overlayPane' }
      ).addTo(map);
    }
  });

  // ── Photon POI search ──

  function _clearPhotonPins() {
    _placesMarkers.forEach(function(m) { try { map.removeLayer(m); } catch(e) {} });
    _placesMarkers = [];
  }

  async function _runPhotonSearch(q) {
    if (!map) return;
    var statusEl = document.getElementById('satImageryStatus');
    var b = map.getBounds();
    var url = 'https://photon.komoot.io/api/?' +
      'q=' + encodeURIComponent(q) +
      '&bbox=' + b.getWest().toFixed(4) + ',' + b.getSouth().toFixed(4) +
                 ',' + b.getEast().toFixed(4) + ',' + b.getNorth().toFixed(4) +
      '&limit=40&lang=en';
    if (statusEl) statusEl.textContent = '🔍 Searching…';
    try {
      var resp = await fetch(url, { headers: { 'User-Agent': 'Argus/1.0' } });
      if (!resp.ok) throw new Error('Photon ' + resp.status);
      var data = await resp.json();
      var features = (data.features || []).filter(function(f) {
        var c = f.geometry && f.geometry.coordinates;
        return c && c[0] != null && c[1] != null;
      });

      _clearPhotonPins();
      // Photon returns osm_key + osm_value, not flat properties
      var ICONS = {
        amenity:    '\u26fa',
        shop:       '\ud83d\uded2',
        tourism:    '\ud83d\udccc',
        highway:    '\ud83d\udee3',
        natural:    '\ud83c\udf32',
        leisure:    '\ud83c\udfde',
        building:   '\ud83c\udfe0',
        office:     '\ud83c\udfe2',
        historic:   '\ud83c\udff0',
        emergency:  '\ud83d\ude91',
        healthcare: '\ud83c\udfe5',
        railway:    '\ud83d\ude86',
        aeroway:    '\u2708',
        waterway:   '\ud83d\udef6',
        place:      '\ud83d\udccd',
      };
      features.forEach(function(f) {
        var p    = f.properties || {};
        var name = p.name || p.street || p.city || q;
        var osmKey = (p.osm_key || '').toLowerCase();
        var osmVal = (p.osm_value || '').replace(/_/g, ' ');
        var em  = ICONS[osmKey] || '\ud83d\udccc';
        var sub = osmVal;
        var lon  = f.geometry.coordinates[0];
        var lat  = f.geometry.coordinates[1];
        var icon = L.divIcon({
          className: '',
          html: '<div style="display:flex;align-items:center;gap:3px;' +
                'background:rgba(20,20,30,0.82);border:1px solid rgba(255,255,255,0.15);' +
                'border-radius:4px;padding:2px 5px;pointer-events:none;white-space:nowrap;' +
                'font-size:10px;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.6);">' +
                em + ' <span style="font-weight:600;">' + name + '</span>' +
                (sub ? '<span style="opacity:0.55;font-size:8px;"> ' + sub + '</span>' : '') +
                '</div>',
          iconSize: [0, 0], iconAnchor: [0, 0],
        });
        var m = L.marker([lat, lon], { icon: icon }).addTo(map);
        m.bindPopup(
          '<strong>' + name + '</strong>' +
          (sub ? '<br><span style="opacity:0.7;font-size:11px;">' + sub + '</span>' : '') +
          (p.city ? '<br>' + (p.street ? p.street + ', ' : '') + p.city : '') +
          (p.country ? ', ' + p.country : '') +
          '<br><span style="font-size:9px;opacity:0.5;">' + lat.toFixed(5) + ', ' + lon.toFixed(5) + '</span>'
        );
        _placesMarkers.push(m);
      });

      if (statusEl) statusEl.textContent = 'Places: ' + features.length + ' result' + (features.length !== 1 ? 's' : '') + (features.length === 40 ? ' (max)' : '');
    } catch(e) {
      console.error('[Photon]', e);
      if (statusEl) statusEl.textContent = 'Places error: ' + e.message;
    }
  }

  (function() {
    var input = document.getElementById('satPlacesSearch');
    var clearBtn = document.getElementById('satPlacesClear');
    if (input) {
      input.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          var q = input.value.trim();
          if (q) _runPhotonSearch(q);
        }
      });
      input.addEventListener('input', function() {
        clearTimeout(_placesSearchTimer);
        var q = input.value.trim();
        if (!q) { _clearPhotonPins(); return; }
        _placesSearchTimer = setTimeout(function() { _runPhotonSearch(q); }, 600);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (input) input.value = '';
        _clearPhotonPins();
        var statusEl = document.getElementById('satImageryStatus');
        if (statusEl) statusEl.textContent = '';
      });
    }
  })();

  // ── Temp labels (cities from Photon + batch temp from Open-Meteo) ──

  function _clearTempMarkers() {
    _tempMarkers.forEach(function(m) { try { map.removeLayer(m); } catch(e) {} });
    _tempMarkers = [];
  }

  async function loadTempOverlay() {
    if (!map || !_tempVisible || _tempLoading) return;
    var b    = map.getBounds();
    var zoom = map.getZoom();
    if (zoom < 4) return;

    var w = b.getWest().toFixed(3), e = b.getEast().toFixed(3);
    var s = b.getSouth().toFixed(3), n = b.getNorth().toFixed(3);
    var cacheKey = zoom + '|' + w + s + e + n;
    if (_tempCacheKey === cacheKey) return;

    _tempLoading = true;
    var statusEl = document.getElementById('satImageryStatus');
    if (statusEl) statusEl.textContent = '🌡 Loading temps…';
    try {
      // 1. Get city/town locations from Photon within bbox
      var limit = zoom >= 10 ? 30 : zoom >= 7 ? 20 : 12;
      var placeType = zoom >= 10 ? 'city|town|village' : zoom >= 7 ? 'city|town' : 'city';
      var photonUrl = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(placeType) +
        '&bbox=' + w + ',' + s + ',' + e + ',' + n +
        '&limit=' + limit + '&lang=en';
      var photonResp = await fetch(photonUrl, { headers: { 'User-Agent': 'Argus/1.0' } });
      if (!photonResp.ok) throw new Error('Photon ' + photonResp.status);
      var photonData = await photonResp.json();
      var features = (photonData.features || []).filter(function(f) {
        return f.geometry && f.geometry.coordinates;
      });
      if (!features.length) {
        _clearTempMarkers();
        _tempCacheKey = cacheKey;
        if (statusEl) statusEl.textContent = '🌡 No places found in view';
        return;
      }

      // 2. Batch query Open-Meteo for all locations in one request
      var lats = features.map(function(f) { return f.geometry.coordinates[1].toFixed(4); });
      var lons = features.map(function(f) { return f.geometry.coordinates[0].toFixed(4); });
      var meteoUrl = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude='  + lats.join(',') +
        '&longitude=' + lons.join(',') +
        '&current=temperature_2m,wind_speed_10m,weather_code' +
        '&timezone=auto&forecast_days=1';
      var meteoResp = await fetch(meteoUrl);
      if (!meteoResp.ok) throw new Error('Open-Meteo ' + meteoResp.status);
      var meteoData = await meteoResp.json();
      // Open-Meteo returns array when multiple locations, single object when one
      var locations = Array.isArray(meteoData) ? meteoData : [meteoData];

      _clearTempMarkers();
      locations.forEach(function(loc, i) {
        var feat = features[i];
        if (!feat || !loc.current) return;
        var p    = feat.properties || {};
        var name = p.name || p.city || p.town || p.village || '';
        var temp = loc.current.temperature_2m;
        if (temp == null) return;
        var tempStr = temp.toFixed(1) + '°C';
        var lat = feat.geometry.coordinates[1];
        var lon = feat.geometry.coordinates[0];
        var icon = L.divIcon({
          className: '',
          html: '<div style="display:inline-flex;align-items:baseline;gap:3px;' +
                'pointer-events:none;">' +
                (name ? '<span style="font-size:9px;color:rgba(255,255,255,0.6);' +
                'text-shadow:0 1px 3px #000;">' + name + '</span>' : '') +
                '<span style="font-size:12px;font-weight:700;color:#ffd54f;' +
                'text-shadow:0 1px 4px #000,0 0 8px rgba(0,0,0,0.8);">' + tempStr + '</span>' +
                '</div>',
          iconSize: [0, 0], iconAnchor: [0, 0],
        });
        var m = L.marker([lat, lon], { icon: icon, interactive: false }).addTo(map);
        _tempMarkers.push(m);
      });

      _tempCacheKey = cacheKey;
      if (statusEl) statusEl.textContent = '🌡 ' + _tempMarkers.length + ' temps loaded';
    } catch(err) {
      console.error('[Temp]', err);
      if (statusEl) statusEl.textContent = 'Temp error: ' + err.message;
    } finally {
      _tempLoading = false;
    }
  }

  document.getElementById('satTempToggle')?.addEventListener('change', async function() {
    _tempVisible = this.checked;
    if (!_tempVisible) {
      _clearTempMarkers();
      _tempCacheKey = '';
    } else {
      await loadTempOverlay();
    }
  });

  document.getElementById('satWeatherToggle')?.addEventListener('change', async function() {
    _weatherVisible = this.checked;
    var layerRow = document.getElementById('satWeatherLayerRow');
    if (layerRow) layerRow.style.display = _weatherVisible ? '' : 'none';
    if (!_weatherVisible) {
      _removeWeatherLayer();
      return;
    }
    // Auto-detect source: prefer Windy if tile key is configured
    var sourceResp = await browser.runtime.sendMessage({ action: 'intelGetProviderConfig', provider: 'windyforecast' });
    if (sourceResp && sourceResp.tileKey) {
      _weatherSource = 'windy';
      var sourceEl = document.getElementById('satWeatherSourceSelect');
      if (sourceEl) sourceEl.value = 'windy';
    }
    _syncWeatherLayerOptions(_weatherSource);
    await _loadWeatherLayer(_weatherLayerId);
  });

  document.getElementById('satWeatherSourceSelect')?.addEventListener('change', async function() {
    _weatherSource = this.value;
    _syncWeatherLayerOptions(_weatherSource);
    if (_weatherVisible) await _loadWeatherLayer(_weatherLayerId);
  });

  document.getElementById('satWeatherLayerSelect')?.addEventListener('change', async function() {
    _weatherLayerId = this.value;
    if (_weatherVisible) await _loadWeatherLayer(_weatherLayerId);
  });

  // (weather contextmenu handler registered in initMap() alongside other map event listeners)

  var offlineToggleTop = document.getElementById('satOfflineSearchTop');
  // Also keep old one synced if it exists
  var offlineToggleOld = document.getElementById('satOfflineSearch');
  function _syncOfflineToggles(checked) {
    if (offlineToggleTop) offlineToggleTop.checked = checked;
    if (offlineToggleOld) offlineToggleOld.checked = checked;
    browser.storage.local.set({ satOfflineSearchOnly: checked });
  }
  browser.storage.local.get({ satOfflineSearchOnly: false }).then(function(s) {
    if (offlineToggleTop) offlineToggleTop.checked = s.satOfflineSearchOnly;
    if (offlineToggleOld) offlineToggleOld.checked = s.satOfflineSearchOnly;
  });
  if (offlineToggleTop) offlineToggleTop.addEventListener('change', function() { _syncOfflineToggles(this.checked); });
  if (offlineToggleOld) offlineToggleOld.addEventListener('change', function() { _syncOfflineToggles(this.checked); });

  // ── Sentinel Hub toggle — controls whether scene search fires on location search ──
  var _sentinelEnabled = false;
  var sentinelToggle = document.getElementById('satSentinelToggle');
  if (sentinelToggle) {
    browser.storage.local.get({ satSentinelEnabled: false }).then(function(s) {
      _sentinelEnabled = s.satSentinelEnabled;
      sentinelToggle.checked = _sentinelEnabled;
    });
    sentinelToggle.addEventListener('change', function() {
      _sentinelEnabled = this.checked;
      browser.storage.local.set({ satSentinelEnabled: _sentinelEnabled });
      if (!_sentinelEnabled) {
        // Remove imagery overlays when disabled
        if (imageLayerA) { try { map.removeLayer(imageLayerA); } catch(e) {} imageLayerA = null; }
        if (imageLayerB) { try { map.removeLayer(imageLayerB); } catch(e) {} imageLayerB = null; }
        if (baseTileLayer) baseTileLayer.setOpacity(1);
      }
    });
  }

  // ── Carto Only toggle — disables all satellite/intel API calls ──
  var cartoOnlyToggle = document.getElementById('satCartoOnly');
  var _cartoOnlyMode = false;
  if (cartoOnlyToggle) {
    browser.storage.local.get({ satCartoOnly: false }).then(function(s) {
      cartoOnlyToggle.checked = s.satCartoOnly;
      _cartoOnlyMode = s.satCartoOnly;
      if (_cartoOnlyMode) _applyCartoOnlyMode();
    });
    cartoOnlyToggle.addEventListener('change', function() {
      _cartoOnlyMode = this.checked;
      browser.storage.local.set({ satCartoOnly: _cartoOnlyMode });
      if (_cartoOnlyMode) {
        _applyCartoOnlyMode();
      } else {
        // Re-enable: restore basemap opacity, show toolbar
        if (baseTileLayer) baseTileLayer.setOpacity(1);
      }
    });
  }
  function _applyCartoOnlyMode() {
    // Remove satellite imagery overlays
    if (imageLayerA) { try { map.removeLayer(imageLayerA); } catch(e) {} imageLayerA = null; }
    if (imageLayerB) { try { map.removeLayer(imageLayerB); } catch(e) {} imageLayerB = null; }
    // Restore basemap to full opacity
    if (baseTileLayer) baseTileLayer.setOpacity(1);
    // Clear WiGLE/Broadcastify overlays
    clearWigleOverlay();
    if (typeof clearBroadcastifyOverlay === 'function') clearBroadcastifyOverlay();
  }

  // ── WiGLE cache stats + clear button ──
  function _updateWigleCacheStats() {
    if (typeof WigleCacheDB === 'undefined') return;
    WigleCacheDB.getStats().then(function(stats) {
      var el = document.getElementById('satWigleCacheStats');
      if (el) el.textContent = 'WiFi cache: ' + stats.zones + ' zones, ' + stats.networks + ' networks';
    });
  }
  _updateWigleCacheStats();

  document.getElementById('satClearWigleCache')?.addEventListener('click', async function() {
    if (typeof WigleCacheDB === 'undefined') return;
    var stats = await WigleCacheDB.getStats();
    if (!confirm('Clear all WiGLE cached data?\n\n' + stats.zones + ' zones, ' + stats.networks + ' networks will be deleted.\nThis cannot be undone.')) return;
    await WigleCacheDB.clearAll();
    wigleCache = null;
    clearWigleOverlay();
    _updateWigleCacheStats();
    _wigleToast('WiGLE cache cleared', 3000);
  });


  // ── Measurement / Drawing Tools ──
  var _measureTool = null; // 'distance' | 'radius' | 'line' | null
  var _measureState = {};  // tool-specific state
  var _measureLayers = []; // all measurement overlays on map
  var _measureUseMiles = false; // legacy compat
  var _measureUnit = 'metric'; // 'metric' | 'imperial' | 'feet' | 'meters' | 'yards'
  var _savedDrawings = []; // persisted drawing data [{type, points, distance, area, ts, id}]
  var _lineLongPressTimer = null;
  var _lineLongPressTriggered = false;
  var LINE_LONG_PRESS_MS = 600;

  // Load saved drawings
  browser.storage.local.get({ satDrawings: [] }).then(function(s) {
    _savedDrawings = s.satDrawings || [];
    setTimeout(function() { _restoreDrawingsOnMap(); }, 1500);
  });

  function _saveDrawings() {
    browser.storage.local.set({ satDrawings: _savedDrawings });
  }

  function _haversineDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function _formatDist(km) {
    switch (_measureUnit) {
      case 'imperial':
        var mi = km * 0.621371;
        return mi < 1 ? (mi * 5280).toFixed(0) + ' ft' : mi.toFixed(2) + ' mi';
      case 'feet':
        return (km * 3280.84).toFixed(0) + ' ft';
      case 'meters':
        return (km * 1000).toFixed(0) + ' m';
      case 'yards':
        return (km * 1093.61).toFixed(0) + ' yd';
      default: // metric
        return km < 1 ? (km * 1000).toFixed(0) + ' m' : km.toFixed(2) + ' km';
    }
  }

  function _formatArea(km2) {
    // Always compute all useful area units and show the most relevant ones
    var m2 = km2 * 1e6;
    var ft2 = km2 * 1.076e7;
    var yd2 = km2 * 1.196e6;
    var mi2 = km2 * 0.386102;
    var acres = km2 * 247.105;
    var hectares = km2 * 100;

    switch (_measureUnit) {
      case 'imperial':
        if (acres < 1) return ft2.toFixed(0) + ' ft² (' + (acres * 4).toFixed(1) + ' roods)';
        if (acres < 640) return acres.toFixed(2) + ' acres (' + ft2.toFixed(0) + ' ft²)';
        return mi2.toFixed(3) + ' mi² (' + acres.toFixed(0) + ' ac)';
      case 'feet':
        return ft2.toFixed(0) + ' ft² (' + acres.toFixed(2) + ' ac)';
      case 'meters':
        return m2.toFixed(0) + ' m² (' + hectares.toFixed(2) + ' ha)';
      case 'yards':
        return yd2.toFixed(0) + ' yd² (' + acres.toFixed(2) + ' ac)';
      default: // metric
        if (km2 < 0.01) return m2.toFixed(0) + ' m² (' + acres.toFixed(2) + ' ac)';
        if (km2 < 1) return hectares.toFixed(2) + ' ha (' + acres.toFixed(1) + ' ac)';
        return km2.toFixed(3) + ' km² (' + acres.toFixed(0) + ' ac · ' + hectares.toFixed(0) + ' ha)';
    }
  }

  function _formatSpeed(kmh) {
    switch (_measureUnit) {
      case 'imperial': case 'feet': case 'yards':
        return (kmh * 0.621371).toFixed(0) + ' mph';
      default:
        return kmh.toFixed(0) + ' km/h';
    }
  }

  // Polygon area using spherical excess (array of [lat, lon])
  function _polygonArea(points) {
    if (points.length < 3) return 0;
    var R = 6371;
    var total = 0;
    for (var i = 0; i < points.length; i++) {
      var j = (i + 1) % points.length;
      var dLon = (points[j][1] - points[i][1]) * Math.PI / 180;
      total += dLon * (2 + Math.sin(points[i][0] * Math.PI / 180) + Math.sin(points[j][0] * Math.PI / 180));
    }
    return Math.abs(total * R * R / 2);
  }

  function _setMeasureStatus(msg) {
    var el = document.getElementById('satMeasureStatus');
    if (el) el.textContent = msg;
  }

  function _addMeasureResult(html) {
    var el = document.getElementById('satMeasureResults');
    if (!el) return;
    var div = document.createElement('div');
    div.style.cssText = 'padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.06);';
    div.innerHTML = html;
    el.appendChild(div);
  }

  // Open pins panel to Draw tab
  function _openDrawTab() {
    document.getElementById('satPinsPanel')?.classList.remove('hidden');
    // Switch to draw tab
    document.querySelectorAll('[data-pins-tab]').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('[data-pins-tab="geom"]')?.classList.add('active');
    document.querySelectorAll('[data-pins-pane]').forEach(function(p) {
      p.style.display = p.dataset.pinsPane === 'geom' ? '' : 'none';
    });
    renderDrawList();
  }

  function _saveDrawingRecord(record) {
    record.id = 'dr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    record.ts = Date.now();
    if (map && !record.zoom) record.zoom = map.getZoom();
    _savedDrawings.push(record);
    _saveDrawings();
    if (record.type === 'spotlight') {
      _openSpotsTab();
    } else {
      _openDrawTab();
    }
  }

  function _openSpotsTab() {
    document.getElementById('satPinsPanel')?.classList.remove('hidden');
    document.querySelectorAll('[data-pins-tab]').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('[data-pins-tab="spots"]')?.classList.add('active');
    document.querySelectorAll('[data-pins-pane]').forEach(function(p) {
      p.style.display = p.dataset.pinsPane === 'spots' ? '' : 'none';
    });
    renderSpotsList();
  }

  function renderDrawList() {
    var list = document.getElementById('satDrawList');
    if (!list) return;
    var countTab = document.getElementById('satDrawTabCount');

    // Filter out tracks (Aircraft tab) — show spotlights here so they can be deleted
    var geomDrawings = _savedDrawings.filter(function(d) { return d.type !== 'track'; });

    if (!geomDrawings.length) {
      list.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--text-muted);text-align:center;">No geometry — use Measure tools to draw on the map</div>';
      if (countTab) countTab.textContent = '';
      return;
    }
    if (countTab) countTab.textContent = geomDrawings.length;

    list.innerHTML = '';
    for (var i = 0; i < geomDrawings.length; i++) {
      var d = geomDrawings[i];
      var item = document.createElement('div');
      item.className = 'sat-pin-item';
      item.style.cssText = 'padding:6px 8px; border-bottom:1px solid var(--border); cursor:pointer;';
      item.dataset.drawIdx = i;
      item.dataset.drawId = d.id;

      var typeIcon = d.type === 'distance' ? '<span style="color:#00e5ff;">↔</span>' :
                     d.type === 'radius' ? '<span style="color:#ffab00;">◯</span>' :
                     d.type === 'line' ? '<span style="color:#76ff03;">⟋</span>' :
                     d.type === 'parcel' ? '<span style="color:#ff6d00;">▢</span>' :
                     d.type === 'spotlight' ? '<span style="color:#00e5ff;">🔦</span>' : '•';
      var typeName = d.type === 'distance' ? 'Distance' :
                     d.type === 'radius' ? 'Radius Circle' :
                     d.type === 'line' ? 'Line (' + (d.points ? d.points.length : 0) + ' pts)' :
                     d.type === 'parcel' ? 'Parcel (' + (d.points ? d.points.length : 0) + ' corners)' :
                     d.type === 'spotlight' ? 'Spotlight Capture' : d.type;
      var distStr = d.distance != null ? _formatDist(d.distance) : '';
      var areaStr = d.area != null ? ' · ' + _formatArea(d.area) : '';
      // Speed info for lines with timestamps
      var speedStr = '';
      if (d.type === 'line' && d.timestamps && d.timestamps.length >= 2) {
        var totalTimeSec = (d.timestamps[d.timestamps.length - 1] - d.timestamps[0]) / 1000;
        if (totalTimeSec > 0 && d.distance > 0) {
          var avgKmh = (d.distance / totalTimeSec) * 3600;
          speedStr = ' · avg ' + _formatSpeed(avgKmh);
        }
      }
      var timeStr = d.ts ? new Date(d.ts).toLocaleString() : '';
      if (d.zoom) timeStr += ' · z' + d.zoom;
      var label = d.label || '';

      // Header row
      var headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
      headerDiv.innerHTML = '<span style="font-size:11px;">' + typeIcon + ' <strong>' + typeName + '</strong></span>' +
        '<button class="sat-draw-remove pill-chip" data-draw-id="' + d.id + '" style="font-size:8px;padding:1px 5px;color:#e94560;" title="Remove">&times;</button>';
      item.appendChild(headerDiv);

      if (distStr) {
        var distDiv = document.createElement('div');
        distDiv.style.cssText = 'font-size:10px;color:var(--text-muted);';
        distDiv.textContent = distStr + areaStr + speedStr;
        item.appendChild(distDiv);
      }
      if (label) {
        var labelDiv = document.createElement('div');
        labelDiv.style.cssText = 'font-size:9px;color:var(--text-muted);';
        labelDiv.textContent = label;
        item.appendChild(labelDiv);
      }

      // Centroid distance-to for parcels and radius center for circles
      if (d.type === 'parcel' && d.points && d.points.length >= 3) {
        var cLat = 0, cLon = 0;
        d.points.forEach(function(p) { cLat += p[0]; cLon += p[1]; });
        cLat /= d.points.length; cLon /= d.points.length;
        var centroidWrap = document.createElement('div');
        centroidWrap.style.cssText = 'font-size:9px; color:#ff6d00; margin-top:2px;';
        centroidWrap.innerHTML = '⊕ Centroid: ' + cLat.toFixed(5) + ', ' + cLon.toFixed(5);
        item.appendChild(centroidWrap);
        item.appendChild(makeDistanceToButton(cLat, cLon, typeName + ' centroid'));
      } else if (d.type === 'radius' && d.points && d.points.length >= 1) {
        item.appendChild(makeDistanceToButton(d.points[0][0], d.points[0][1], 'Circle center'));
      } else if (d.type === 'distance' && d.points && d.points.length === 2) {
        var mLat = (d.points[0][0] + d.points[1][0]) / 2;
        var mLon = (d.points[0][1] + d.points[1][1]) / 2;
        item.appendChild(makeDistanceToButton(mLat, mLon, 'Midpoint'));
      } else if (d.points && d.points.length) {
        item.appendChild(makeDistanceToButton(d.points[0][0], d.points[0][1], typeName));
      }

      // Individual vertex sub-items
      if (d.points && d.points.length) {
        var vertexWrap = document.createElement('div');
        vertexWrap.style.cssText = 'margin-top:2px; padding-left:8px; border-left:2px solid rgba(255,255,255,0.06);';
        for (var vi = 0; vi < d.points.length; vi++) {
          var vp = d.points[vi];
          var vName = d.type === 'radius' ? (vi === 0 ? 'Center' : 'Edge') :
                      d.type === 'distance' ? (vi === 0 ? 'Start' : 'End') :
                      'Pt ' + (vi + 1);
          var vertex = document.createElement('div');
          vertex.style.cssText = 'display:flex; align-items:center; gap:4px; padding:2px 0; cursor:pointer; font-size:9px; color:var(--text-muted);';
          vertex.dataset.vlat = vp[0];
          vertex.dataset.vlon = vp[1];
          vertex.innerHTML = '<span style="font-family:\'SF Mono\',monospace;font-size:8px;">◆ ' + vName + ': ' + vp[0].toFixed(5) + ', ' + vp[1].toFixed(5) + '</span>';
          // Click to pan
          vertex.addEventListener('click', function(e) {
            e.stopPropagation();
            var la = parseFloat(this.dataset.vlat);
            var lo = parseFloat(this.dataset.vlon);
            if (la && lo && map) map.panTo([la, lo]);
          });
          vertexWrap.appendChild(vertex);
          // Distance-to for each vertex
          vertexWrap.appendChild(makeDistanceToButton(vp[0], vp[1], vName));
        }
        item.appendChild(vertexWrap);
      }

      var timeDiv = document.createElement('div');
      timeDiv.style.cssText = 'font-size:8px;color:var(--text-muted);opacity:0.5;';
      timeDiv.textContent = timeStr;
      item.appendChild(timeDiv);

      list.appendChild(item);
    }

    // Wire remove buttons
    list.querySelectorAll('.sat-draw-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = this.dataset.drawId;
        _savedDrawings = _savedDrawings.filter(function(d) { return d.id !== id; });
        _saveDrawings();
        renderDrawList();
        // Re-render map overlays
        _clearAllMapDrawings();
        _restoreDrawingsOnMap();
      });
    });
  }

  function renderSpotsList() {
    var list = document.getElementById('satSpotsList');
    if (!list) return;
    var countTab = document.getElementById('satSpotsTabCount');
    var spots = _spotlightFocals || [];

    if (!spots.length) {
      list.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--text-muted);text-align:center;">No spots — use Spotlight tab → Freeze Frame to capture focal points</div>';
      if (countTab) countTab.textContent = '';
      return;
    }
    if (countTab) countTab.textContent = spots.length;
    list.innerHTML = '';

    for (var i = 0; i < spots.length; i++) {
      var f = spots[i];
      var item = document.createElement('div');
      item.className = 'sat-pin-item';
      item.style.cssText = 'padding:6px 8px; border-bottom:1px solid var(--border); border-left:3px solid rgba(0,229,255,0.4); cursor:pointer;';
      item.dataset.spotIdx = i;

      var timeStr = new Date(f.ts).toLocaleString();
      item.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span style="font-size:11px;">🔦 <strong>Spot ' + (i + 1) + '</strong></span>' +
          '<button class="sat-spot-remove pill-chip" data-spot-idx="' + i + '" style="font-size:8px;padding:1px 5px;color:#e94560;" title="Remove">&times;</button>' +
        '</div>' +
        '<div style="font-size:9px; color:var(--text-muted); font-family:\'SF Mono\',monospace;">' +
          f.lat.toFixed(5) + ', ' + f.lon.toFixed(5) +
        '</div>' +
        '<div style="font-size:8px; color:var(--text-muted);">' +
          'Zoom: ' + f.zoom + ' · Radius: ' + f.radiusPx + 'px · Bright: ' + (f.brightness || 100) + '%' +
        '</div>' +
        '<div style="font-size:8px; color:var(--text-muted); opacity:0.5;">' + timeStr + '</div>';

      // Click to recall spotlight
      item.addEventListener('click', function(e) {
        if (e.target.classList.contains('sat-spot-remove')) return;
        var idx = parseInt(this.dataset.spotIdx);
        var focal = _spotlightFocals[idx];
        if (!focal || !map) return;
        map.setView([focal.lat, focal.lon], focal.zoom);
        if (_spotlightState === 'off') _spotlightOn();
        setTimeout(function() {
          var overlay = document.getElementById('satSpotlightOverlay');
          if (overlay) {
            var rect = overlay.getBoundingClientRect();
            _spotlightAnchorX = rect.width / 2;
            _spotlightAnchorY = rect.height / 2;
            _spotlightRadius = focal.radiusPx || 48;
            _spotlightBrightness = focal.brightness || 100;
            _spotlightState = 'anchored';
            overlay.style.cursor = 'default';
            if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
            _updateSpotlightMask();
            _updateSpotlightUI();
          }
        }, 300);
      });

      // Distance-to button
      item.appendChild(makeDistanceToButton(f.lat, f.lon, 'Spot ' + (i + 1)));

      list.appendChild(item);
    }

    // Wire remove buttons
    list.querySelectorAll('.sat-spot-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.dataset.spotIdx);
        var focal = _spotlightFocals[idx];
        _spotlightFocals.splice(idx, 1);
        browser.storage.local.set({ satSpotlightFocals: _spotlightFocals });
        // Also remove matching spotlight drawing from savedDrawings so the circle goes away
        if (focal) {
          _savedDrawings = _savedDrawings.filter(function(d) {
            if (d.type !== 'spotlight') return true;
            // Match by approximate coordinates (same focal point)
            if (d.points && d.points.length && Math.abs(d.points[0][0] - focal.lat) < 0.0001 && Math.abs(d.points[0][1] - focal.lon) < 0.0001) return false;
            return true;
          });
          _saveDrawings();
          _clearAllMapDrawings();
          _restoreDrawingsOnMap();
        }
        _renderSpotlightCaptures();
        renderSpotsList();
      });
    });
  }

  function _clearAllMapDrawings() {
    _measureLayers.forEach(function(l) { try { map.removeLayer(l); } catch(e) {} });
    _measureLayers = [];
  }

  // Color config per drawing type
  var _drawColors = {
    distance: '#00e5ff', line: '#76ff03', radius: '#ffab00',
    parcel: '#ff6d00', track: '#e040fb', spotlight: '#00e5ff'
  };

  // Make a draggable vertex marker
  function _makeDraggableVertex(latlng, color, drawingId, vertexIdx) {
    var vtxIcon = L.divIcon({
      className: 'sat-drag-vertex',
      html: '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';border:2px solid #fff;cursor:grab;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    var marker = L.marker(latlng, { icon: vtxIcon, draggable: true, zIndexOffset: 500 }).addTo(map);
    marker._drawingId = drawingId;
    marker._vertexIdx = vertexIdx;

    marker.on('drag', function() {
      var pos = marker.getLatLng();
      var dr = _savedDrawings.find(function(d) { return d.id === drawingId; });
      if (!dr) return;
      dr.points[vertexIdx] = [pos.lat, pos.lng];
      // Recalculate and re-render (debounced visually)
      _recalcDrawing(dr);
      _refreshDrawingLayers(dr);
    });

    marker.on('dragend', function() {
      _saveDrawings();
      renderDrawList();
    });

    _measureLayers.push(marker);
    return marker;
  }

  // Recalculate distance/area for a drawing after vertex drag
  function _recalcDrawing(dr) {
    if (dr.type === 'distance' && dr.points.length === 2) {
      dr.distance = _haversineDistance(dr.points[0][0], dr.points[0][1], dr.points[1][0], dr.points[1][1]);
    } else if (dr.type === 'radius' && dr.points.length >= 2) {
      dr.distance = _haversineDistance(dr.points[0][0], dr.points[0][1], dr.points[1][0], dr.points[1][1]);
      dr.area = Math.PI * dr.distance * dr.distance;
    } else if (dr.type === 'line') {
      var total = 0;
      for (var k = 1; k < dr.points.length; k++) {
        total += _haversineDistance(dr.points[k-1][0], dr.points[k-1][1], dr.points[k][0], dr.points[k][1]);
      }
      dr.distance = total;
    } else if (dr.type === 'parcel' && dr.points.length >= 3) {
      dr.area = _polygonArea(dr.points);
      var perim = 0;
      for (var pk = 0; pk < dr.points.length; pk++) {
        var pn = dr.points[(pk + 1) % dr.points.length];
        perim += _haversineDistance(dr.points[pk][0], dr.points[pk][1], pn[0], pn[1]);
      }
      dr.distance = perim;
    }
  }

  // Non-vertex layers for a specific drawing (edges, labels, fills) — stored separately for refresh
  var _drawingShapeLayers = {}; // keyed by drawing id

  function _clearDrawingShapeLayers(id) {
    if (_drawingShapeLayers[id]) {
      _drawingShapeLayers[id].forEach(function(l) {
        try { map.removeLayer(l); } catch(e) {}
        var idx = _measureLayers.indexOf(l);
        if (idx >= 0) _measureLayers.splice(idx, 1);
      });
      _drawingShapeLayers[id] = [];
    }
  }

  // Refresh just the shape layers (edges, labels, fills) for one drawing — vertices stay
  function _refreshDrawingLayers(dr) {
    _clearDrawingShapeLayers(dr.id);
    var layers = [];
    var color = _drawColors[dr.type] || '#fff';

    if (dr.type === 'distance' && dr.points.length === 2) {
      var p1 = L.latLng(dr.points[0][0], dr.points[0][1]), p2 = L.latLng(dr.points[1][0], dr.points[1][1]);
      layers.push(L.polyline([p1, p2], { color: color, weight: 2, dashArray: '6,4', opacity: 0.9 }).addTo(map));
      var mid = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
      layers.push(L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
        .setLatLng(mid).setContent(_formatDist(dr.distance)).addTo(map));

    } else if (dr.type === 'radius' && dr.points.length >= 2) {
      var c = L.latLng(dr.points[0][0], dr.points[0][1]);
      layers.push(L.circle(c, { radius: dr.distance * 1000, color: color, fillColor: color, fillOpacity: 0.1, weight: 2, dashArray: '6,4' }).addTo(map));
      var e = L.latLng(dr.points[1][0], dr.points[1][1]);
      layers.push(L.polyline([c, e], { color: color, weight: 1.5, dashArray: '4,4', opacity: 0.7 }).addTo(map));
      layers.push(L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
        .setLatLng(c).setContent('r=' + _formatDist(dr.distance) + '\n' + _formatArea(dr.area || 0)).addTo(map));

    } else if (dr.type === 'line' && dr.points.length >= 2) {
      var ll = dr.points.map(function(p) { return L.latLng(p[0], p[1]); });
      layers.push(L.polyline(ll, { color: color, weight: 2, opacity: 0.8 }).addTo(map));
      for (var j = 1; j < ll.length; j++) {
        var sd = _haversineDistance(ll[j-1].lat, ll[j-1].lng, ll[j].lat, ll[j].lng);
        var sm = L.latLng((ll[j-1].lat + ll[j].lat) / 2, (ll[j-1].lng + ll[j].lng) / 2);
        layers.push(L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
          .setLatLng(sm).setContent(_formatDist(sd)).addTo(map));
      }
      layers.push(L.tooltip({ permanent: true, direction: 'right', className: 'sat-measure-label', offset: [8, 0] })
        .setLatLng(ll[ll.length - 1]).setContent('Total: ' + _formatDist(dr.distance)).addTo(map));

    } else if (dr.type === 'parcel' && dr.points.length >= 3) {
      var pl = dr.points.map(function(p) { return L.latLng(p[0], p[1]); });
      layers.push(L.polygon(pl, { color: color, fillColor: color, fillOpacity: 0.12, weight: 2 }).addTo(map));
      for (var pj = 0; pj < pl.length; pj++) {
        var pn = pl[(pj + 1) % pl.length];
        var pd = _haversineDistance(pl[pj].lat, pl[pj].lng, pn.lat, pn.lng);
        var pm = L.latLng((pl[pj].lat + pn.lat) / 2, (pl[pj].lng + pn.lng) / 2);
        layers.push(L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
          .setLatLng(pm).setContent(_formatDist(pd)).addTo(map));
      }
      var cLat = 0, cLng = 0;
      pl.forEach(function(p) { cLat += p.lat; cLng += p.lng; });
      layers.push(L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
        .setLatLng(L.latLng(cLat / pl.length, cLng / pl.length))
        .setContent(_formatArea(dr.area) + '\n' + _formatDist(dr.distance) + ' perim').addTo(map));
    }

    _drawingShapeLayers[dr.id] = layers;
    layers.forEach(function(l) { _measureLayers.push(l); });
  }

  function _restoreDrawingsOnMap() {
    if (!map) return;
    _drawingShapeLayers = {};
    for (var i = 0; i < _savedDrawings.length; i++) {
      var d = _savedDrawings[i];
      if (!d.points || !d.points.length) continue;
      var color = _drawColors[d.type] || '#fff';

      // Editable types get draggable vertices
      if (d.type === 'distance' || d.type === 'line' || d.type === 'radius' || d.type === 'parcel') {
        for (var vi = 0; vi < d.points.length; vi++) {
          _makeDraggableVertex(L.latLng(d.points[vi][0], d.points[vi][1]), color, d.id, vi);
        }
        _refreshDrawingLayers(d);

      } else if (d.type === 'track' && d.points.length >= 2) {
        var trLatlngs = d.points.map(function(p) { return L.latLng(p[0], p[1]); });
        for (var tj = 0; tj < trLatlngs.length; tj++) {
          _measureLayers.push(L.circleMarker(trLatlngs[tj], { radius: 4, fillColor: '#e040fb', fillOpacity: 1, color: '#fff', weight: 1 }).addTo(map));
        }
        _measureLayers.push(L.polyline(trLatlngs, { color: '#e040fb', weight: 2, dashArray: '8,4', opacity: 0.85 }).addTo(map));
        if (trLatlngs.length >= 2) {
          var tMid = trLatlngs[Math.floor(trLatlngs.length / 2)];
          _measureLayers.push(L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
            .setLatLng(tMid).setContent('✈ ' + escHtml(d.callsign || '') + ' ' + _formatDist(d.distance)).addTo(map));
        }

      } else if (d.type === 'spotlight' && d.points.length >= 1) {
        var slCenter = L.latLng(d.points[0][0], d.points[0][1]);
        var slRadiusM = (d.distance || 0) * 1000;
        _measureLayers.push(L.circle(slCenter, { radius: slRadiusM, color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.06, weight: 1.5, dashArray: '4,4' }).addTo(map));
        _measureLayers.push(L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
          .setLatLng(slCenter).setContent('🔦 r=' + _formatDist(d.distance)).addTo(map));
      }
    }
  }

  function _clearMeasureTool() {
    // Cancel long press timer
    if (_lineLongPressTimer) { clearTimeout(_lineLongPressTimer); _lineLongPressTimer = null; }
    _lineLongPressTriggered = false;
    _measureTool = null;
    _measureState = {};
    document.querySelectorAll('.sat-measure-tool').forEach(function(b) { b.classList.remove('active'); });
    _setMeasureStatus('');
    if (map) {
      map.getContainer().style.cursor = '';
      map.off('click', _onMeasureClick);
      map.off('mousemove', _onMeasureMouseMove);
      map.off('mousedown', _onMeasureMouseDown);
      map.off('mouseup', _onMeasureMouseUp);
    }
  }

  function _activateMeasureTool(tool) {
    _clearMeasureTool();
    _measureTool = tool;
    _measureState = {};
    document.querySelector('.sat-measure-tool[data-tool="' + tool + '"]')?.classList.add('active');
    map.getContainer().style.cursor = 'crosshair';
    map.on('click', _onMeasureClick);

    if (tool === 'distance') {
      _setMeasureStatus('Click first point');
    } else if (tool === 'radius') {
      _setMeasureStatus('Click center point');
    } else if (tool === 'line') {
      _setMeasureStatus('Click to add points · long-press to finish');
      map.on('mousemove', _onMeasureMouseMove);
      map.on('mousedown', _onMeasureMouseDown);
      map.on('mouseup', _onMeasureMouseUp);
      _measureState.points = [];
      _measureState.tempLayers = [];
    } else if (tool === 'parcel') {
      _setMeasureStatus('Click corners to draw parcel · long-press to close');
      map.on('mousemove', _onMeasureMouseMove);
      map.on('mousedown', _onMeasureMouseDown);
      map.on('mouseup', _onMeasureMouseUp);
      _measureState.points = [];
      _measureState.tempLayers = [];
    }
  }

  function _onMeasureClick(e) {
    if (!_measureTool || !map) return;
    // Ignore click if long-press just fired
    if (_lineLongPressTriggered) { _lineLongPressTriggered = false; return; }
    var latlng = e.latlng;

    if (_measureTool === 'distance') {
      if (!_measureState.p1) {
        _measureState.p1 = latlng;
        var dot = L.circleMarker(latlng, { radius: 4, fillColor: '#00e5ff', fillOpacity: 1, color: '#fff', weight: 1 }).addTo(map);
        _measureLayers.push(dot);
        _setMeasureStatus('Click second point');
      } else {
        var p1 = _measureState.p1;
        var p2 = latlng;
        var dist = _haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        var dot2 = L.circleMarker(p2, { radius: 4, fillColor: '#00e5ff', fillOpacity: 1, color: '#fff', weight: 1 }).addTo(map);
        var line = L.polyline([p1, p2], { color: '#00e5ff', weight: 2, dashArray: '6,4', opacity: 0.9 }).addTo(map);
        var midpoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
        var label = L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
          .setLatLng(midpoint)
          .setContent(_formatDist(dist))
          .addTo(map);
        _measureLayers.push(dot2, line, label);
        _addMeasureResult('<span style="color:#00e5ff;">↔</span> ' + _formatDist(dist) +
          ' <span style="opacity:0.5;font-size:8px;">' + p1.lat.toFixed(4) + ',' + p1.lng.toFixed(4) + ' → ' + p2.lat.toFixed(4) + ',' + p2.lng.toFixed(4) + '</span>');
        // Save drawing
        _saveDrawingRecord({
          type: 'distance',
          points: [[p1.lat, p1.lng], [p2.lat, p2.lng]],
          distance: dist
        });
        _clearMeasureTool();
      }
    } else if (_measureTool === 'radius') {
      if (!_measureState.center) {
        _measureState.center = latlng;
        var centerDot = L.circleMarker(latlng, { radius: 4, fillColor: '#ffab00', fillOpacity: 1, color: '#fff', weight: 1 }).addTo(map);
        _measureLayers.push(centerDot);
        _setMeasureStatus('Click edge point for radius');
        map.on('mousemove', _onMeasureMouseMove);
      } else {
        var center = _measureState.center;
        var edge = latlng;
        var radius = _haversineDistance(center.lat, center.lng, edge.lat, edge.lng);
        var radiusM = radius * 1000;
        var area = Math.PI * radius * radius;
        if (_measureState.previewCircle) { map.removeLayer(_measureState.previewCircle); }
        var circle = L.circle(center, { radius: radiusM, color: '#ffab00', fillColor: '#ffab00', fillOpacity: 0.1, weight: 2, dashArray: '6,4' }).addTo(map);
        var radiusLine = L.polyline([center, edge], { color: '#ffab00', weight: 1.5, dashArray: '4,4', opacity: 0.7 }).addTo(map);
        var rLabel = L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
          .setLatLng(center)
          .setContent('r=' + _formatDist(radius) + '\n' + _formatArea(area))
          .addTo(map);
        _measureLayers.push(circle, radiusLine, rLabel);
        _addMeasureResult('<span style="color:#ffab00;">◯</span> r=' + _formatDist(radius) + ' · area=' + _formatArea(area));
        // Save drawing
        _saveDrawingRecord({
          type: 'radius',
          points: [[center.lat, center.lng], [edge.lat, edge.lng]],
          distance: radius,
          area: area
        });
        map.off('mousemove', _onMeasureMouseMove);
        _clearMeasureTool();
      }
    } else if (_measureTool === 'line') {
      _measureState.points.push(latlng);
      if (!_measureState.timestamps) _measureState.timestamps = [];
      _measureState.timestamps.push(Date.now());
      var ptDot = L.circleMarker(latlng, { radius: 3, fillColor: '#76ff03', fillOpacity: 1, color: '#fff', weight: 1 }).addTo(map);
      _measureState.tempLayers.push(ptDot);
      _measureLayers.push(ptDot);
      if (_measureState.points.length > 1) {
        var pts = _measureState.points;
        var p1l = pts[pts.length - 2], p2l = pts[pts.length - 1];
        var seg = L.polyline([p1l, p2l], { color: '#76ff03', weight: 2, opacity: 0.8 }).addTo(map);
        _measureState.tempLayers.push(seg);
        _measureLayers.push(seg);
        // Label each segment with its distance
        var segDist = _haversineDistance(p1l.lat, p1l.lng, p2l.lat, p2l.lng);
        var segMid = L.latLng((p1l.lat + p2l.lat) / 2, (p1l.lng + p2l.lng) / 2);
        var segLabel = L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
          .setLatLng(segMid).setContent(_formatDist(segDist)).addTo(map);
        _measureState.tempLayers.push(segLabel);
        _measureLayers.push(segLabel);
      }
      var totalDist = 0;
      for (var k = 1; k < _measureState.points.length; k++) {
        var pp = _measureState.points[k - 1], pc = _measureState.points[k];
        totalDist += _haversineDistance(pp.lat, pp.lng, pc.lat, pc.lng);
      }
      _setMeasureStatus(_measureState.points.length + ' points · Total: ' + _formatDist(totalDist) + ' · long-press to finish');
    } else if (_measureTool === 'parcel') {
      _measureState.points.push(latlng);
      // Vertex dot (orange for parcel)
      var pDot = L.circleMarker(latlng, { radius: 4, fillColor: '#ff6d00', fillOpacity: 1, color: '#fff', weight: 1.5 }).addTo(map);
      _measureState.tempLayers.push(pDot);
      _measureLayers.push(pDot);
      // Edge from previous point
      if (_measureState.points.length > 1) {
        var pPts = _measureState.points;
        var pe1 = pPts[pPts.length - 2], pe2 = pPts[pPts.length - 1];
        var pEdge = L.polyline([pe1, pe2], { color: '#ff6d00', weight: 2, opacity: 0.8 }).addTo(map);
        _measureState.tempLayers.push(pEdge);
        _measureLayers.push(pEdge);
        // Segment distance label
        var pSegDist = _haversineDistance(pe1.lat, pe1.lng, pe2.lat, pe2.lng);
        var pSegMid = L.latLng((pe1.lat + pe2.lat) / 2, (pe1.lng + pe2.lng) / 2);
        var pSegLabel = L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
          .setLatLng(pSegMid).setContent(_formatDist(pSegDist)).addTo(map);
        _measureState.tempLayers.push(pSegLabel);
        _measureLayers.push(pSegLabel);
      }
      // Live preview polygon fill (3+ points)
      if (_measureState.points.length >= 3) {
        if (_measureState.previewPoly) { try { map.removeLayer(_measureState.previewPoly); } catch(e) {} }
        _measureState.previewPoly = L.polygon(_measureState.points, { color: '#ff6d00', fillColor: '#ff6d00', fillOpacity: 0.08, weight: 1, dashArray: '4,4' }).addTo(map);
      }
      // Calculate running perimeter
      var perim = 0;
      for (var pk = 1; pk < _measureState.points.length; pk++) {
        perim += _haversineDistance(_measureState.points[pk-1].lat, _measureState.points[pk-1].lng, _measureState.points[pk].lat, _measureState.points[pk].lng);
      }
      var areaHint = '';
      if (_measureState.points.length >= 3) {
        var polyPts = _measureState.points.map(function(p) { return [p.lat, p.lng]; });
        var liveArea = _polygonArea(polyPts);
        areaHint = ' · ~' + _formatArea(liveArea);
      }
      _setMeasureStatus(_measureState.points.length + ' corners · Perimeter: ' + _formatDist(perim) + areaHint + ' · long-press to close');
    }
  }

  // Long-press to finish line tool
  function _onMeasureMouseDown(e) {
    if (_measureTool === 'line' && _measureState.points && _measureState.points.length >= 2) {
      _lineLongPressTriggered = false;
      _lineLongPressTimer = setTimeout(function() {
        _lineLongPressTriggered = true;
        _finishLineTool();
      }, LINE_LONG_PRESS_MS);
    } else if (_measureTool === 'parcel' && _measureState.points && _measureState.points.length >= 3) {
      _lineLongPressTriggered = false;
      _lineLongPressTimer = setTimeout(function() {
        _lineLongPressTriggered = true;
        _finishParcelTool();
      }, LINE_LONG_PRESS_MS);
    }
  }

  function _onMeasureMouseUp(e) {
    if (_lineLongPressTimer) { clearTimeout(_lineLongPressTimer); _lineLongPressTimer = null; }
  }

  function _finishLineTool() {
    if (!_measureState.points || _measureState.points.length < 2) return;
    var totalDist = 0;
    var pointsArr = [];
    var timestamps = _measureState.timestamps || [];
    for (var k = 0; k < _measureState.points.length; k++) {
      pointsArr.push([_measureState.points[k].lat, _measureState.points[k].lng]);
      if (k > 0) {
        var pp = _measureState.points[k - 1], pc = _measureState.points[k];
        totalDist += _haversineDistance(pp.lat, pp.lng, pc.lat, pc.lng);
      }
    }
    // Remove preview line
    if (_measureState.previewLine) { try { map.removeLayer(_measureState.previewLine); } catch(e) {} }
    // Add total label at end point
    var lastPt = _measureState.points[_measureState.points.length - 1];
    var totalLabel = L.tooltip({ permanent: true, direction: 'right', className: 'sat-measure-label', offset: [8, 0] })
      .setLatLng(lastPt).setContent('Total: ' + _formatDist(totalDist)).addTo(map);
    _measureLayers.push(totalLabel);
    // Build segment breakdown with speed data
    var segBreakdown = '';
    for (var s = 1; s < _measureState.points.length; s++) {
      var sp = _measureState.points[s - 1], sc = _measureState.points[s];
      var sd = _haversineDistance(sp.lat, sp.lng, sc.lat, sc.lng);
      var speedStr = '';
      if (timestamps[s] && timestamps[s - 1]) {
        var dtSec = (timestamps[s] - timestamps[s - 1]) / 1000;
        if (dtSec > 0) {
          var speedKmh = (sd / dtSec) * 3600;
          speedStr = ' · ' + _formatSpeed(speedKmh);
        }
      }
      segBreakdown += '<span style="opacity:0.5;font-size:8px;">  leg ' + s + ': ' + _formatDist(sd) + speedStr + '</span><br>';
    }
    // Total speed (first to last timestamp)
    var totalSpeedStr = '';
    if (timestamps.length >= 2) {
      var totalTimeSec = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
      if (totalTimeSec > 0) {
        var avgKmh = (totalDist / totalTimeSec) * 3600;
        totalSpeedStr = ' · avg ' + _formatSpeed(avgKmh);
      }
    }
    _addMeasureResult('<span style="color:#76ff03;">⟋</span> ' + _measureState.points.length + ' pts · <strong>' + _formatDist(totalDist) + totalSpeedStr + '</strong><br>' + segBreakdown);
    // Save drawing with timestamps
    _saveDrawingRecord({
      type: 'line',
      points: pointsArr,
      timestamps: timestamps,
      distance: totalDist
    });
    _clearMeasureTool();
  }

  function _finishParcelTool() {
    if (!_measureState.points || _measureState.points.length < 3) return;
    var pointsArr = _measureState.points.map(function(p) { return [p.lat, p.lng]; });

    // Remove preview polygon
    if (_measureState.previewPoly) { try { map.removeLayer(_measureState.previewPoly); } catch(e) {} }
    if (_measureState.previewLine) { try { map.removeLayer(_measureState.previewLine); } catch(e) {} }

    // Calculate area and perimeter
    var area = _polygonArea(pointsArr);
    var perimeter = 0;
    for (var k = 0; k < _measureState.points.length; k++) {
      var next = _measureState.points[(k + 1) % _measureState.points.length];
      perimeter += _haversineDistance(_measureState.points[k].lat, _measureState.points[k].lng, next.lat, next.lng);
    }

    // Draw the final closed polygon
    var polygon = L.polygon(_measureState.points, { color: '#ff6d00', fillColor: '#ff6d00', fillOpacity: 0.12, weight: 2 }).addTo(map);
    _measureLayers.push(polygon);

    // Closing edge label (last point → first point)
    var lastPt = _measureState.points[_measureState.points.length - 1];
    var firstPt = _measureState.points[0];
    var closeDist = _haversineDistance(lastPt.lat, lastPt.lng, firstPt.lat, firstPt.lng);
    var closeMid = L.latLng((lastPt.lat + firstPt.lat) / 2, (lastPt.lng + firstPt.lng) / 2);
    var closeLabel = L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
      .setLatLng(closeMid).setContent(_formatDist(closeDist)).addTo(map);
    _measureLayers.push(closeLabel);

    // Center label with area
    var centroid = _polygonCentroid(_measureState.points);
    var areaLabel = L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
      .setLatLng(centroid)
      .setContent(_formatArea(area) + '\n' + _formatDist(perimeter) + ' perim')
      .addTo(map);
    _measureLayers.push(areaLabel);

    // Build results breakdown
    var segBreakdown = '';
    for (var s = 0; s < _measureState.points.length; s++) {
      var sn = (s + 1) % _measureState.points.length;
      var sd = _haversineDistance(_measureState.points[s].lat, _measureState.points[s].lng, _measureState.points[sn].lat, _measureState.points[sn].lng);
      segBreakdown += '<span style="opacity:0.5;font-size:8px;">  edge ' + (s + 1) + ': ' + _formatDist(sd) + '</span><br>';
    }
    _addMeasureResult('<span style="color:#ff6d00;">▢</span> ' + _measureState.points.length + ' corners · <strong>' + _formatArea(area) + '</strong> · ' + _formatDist(perimeter) + ' perim<br>' + segBreakdown);

    // Save drawing
    _saveDrawingRecord({
      type: 'parcel',
      points: pointsArr,
      area: area,
      distance: perimeter
    });
    _clearMeasureTool();
  }

  // Centroid of a polygon (array of LatLng objects)
  function _polygonCentroid(points) {
    var latSum = 0, lngSum = 0;
    for (var i = 0; i < points.length; i++) {
      latSum += points[i].lat;
      lngSum += points[i].lng;
    }
    return L.latLng(latSum / points.length, lngSum / points.length);
  }

  function _onMeasureMouseMove(e) {
    if (_measureTool === 'radius' && _measureState.center) {
      var r = _haversineDistance(_measureState.center.lat, _measureState.center.lng, e.latlng.lat, e.latlng.lng) * 1000;
      if (_measureState.previewCircle) map.removeLayer(_measureState.previewCircle);
      _measureState.previewCircle = L.circle(_measureState.center, { radius: r, color: '#ffab00', fillColor: '#ffab00', fillOpacity: 0.05, weight: 1, dashArray: '4,4' }).addTo(map);
    }
    if (_measureTool === 'line' && _measureState.points && _measureState.points.length > 0) {
      if (_measureState.previewLine) map.removeLayer(_measureState.previewLine);
      var last = _measureState.points[_measureState.points.length - 1];
      _measureState.previewLine = L.polyline([last, e.latlng], { color: '#76ff03', weight: 1, dashArray: '3,3', opacity: 0.5 }).addTo(map);
    }
    if (_measureTool === 'parcel' && _measureState.points && _measureState.points.length > 0) {
      if (_measureState.previewLine) map.removeLayer(_measureState.previewLine);
      var pLast = _measureState.points[_measureState.points.length - 1];
      _measureState.previewLine = L.polyline([pLast, e.latlng], { color: '#ff6d00', weight: 1, dashArray: '3,3', opacity: 0.5 }).addTo(map);
    }
  }

  // Wire measurement tool buttons
  document.querySelectorAll('.sat-measure-tool').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tool = this.dataset.tool;
      if (_measureTool === tool) {
        _clearMeasureTool();
      } else {
        if (!map) return;
        _activateMeasureTool(tool);
      }
    });
  });

  // Clear all measurements
  document.getElementById('satMeasureClear')?.addEventListener('click', function() {
    _clearMeasureTool();
    _clearAllMapDrawings();
    _savedDrawings = [];
    _saveDrawings();
    // Also clear spotlight focals so circles don't linger
    _spotlightFocals = [];
    browser.storage.local.set({ satSpotlightFocals: [] });
    _renderSpotlightCaptures();
    renderSpotsList();
    renderDrawList();
    var results = document.getElementById('satMeasureResults');
    if (results) results.innerHTML = '';
  });

  // Units toggle
  document.getElementById('satMeasureUnits')?.addEventListener('change', function() {
    _measureUnit = this.value;
    _measureUseMiles = (_measureUnit === 'imperial'); // legacy compat
    // Re-render all map overlays with new units
    _clearAllMapDrawings();
    _restoreDrawingsOnMap();
  });

  // Measurement panel toggle
  document.getElementById('satMeasureToggle')?.addEventListener('click', function() {
    document.getElementById('satMeasurePanel')?.classList.toggle('hidden');
  });
  document.getElementById('satMeasureClose')?.addEventListener('click', function() {
    document.getElementById('satMeasurePanel')?.classList.add('hidden');
    _clearMeasureTool();
  });

  // ── Spotlight System ──
  var _spotlightState = 'off'; // 'off' | 'follow' | 'anchored'
  var _spotlightX = 0, _spotlightY = 0;
  var _spotlightAnchorX = 0, _spotlightAnchorY = 0;
  var _spotlightRadius = 48;
  var _spotlightBrightness = 100; // percentage 50-300
  var _spotlightMaskOpacity = 0.92; // 0.1 → 0.98
  var _spotlightWheelMode = 'size'; // 'size' | 'bright'
  var SPOTLIGHT_MIN_R = 16, SPOTLIGHT_MAX_R = 800, SPOTLIGHT_STEP = 12;

  function _isDarkBasemap() {
    var activeTile = document.querySelector('.sat-tile-source.active');
    return /dark|toner/.test(activeTile ? activeTile.dataset.tile : 'carto-dark');
  }

  function _updateSpotlightMask() {
    var overlay = document.getElementById('satSpotlightOverlay');
    if (!overlay) return;
    var x = (_spotlightState === 'anchored') ? _spotlightAnchorX : _spotlightX;
    var y = (_spotlightState === 'anchored') ? _spotlightAnchorY : _spotlightY;
    var r = _spotlightRadius;
    var bright = _spotlightBrightness / 100;

    var maskAlpha = _spotlightMaskOpacity.toFixed(2);
    if (_isDarkBasemap()) {
      var whiteAlpha = Math.min(0.5, 0.08 * bright);
      var whiteEdge = Math.min(0.35, 0.05 * bright);
      overlay.style.background = 'radial-gradient(circle ' + r + 'px at ' + x + 'px ' + y + 'px, rgba(255,255,255,' + whiteAlpha.toFixed(2) + ') 0%, rgba(255,255,255,' + whiteEdge.toFixed(2) + ') ' + (r - 4) + 'px, rgba(0,0,0,' + maskAlpha + ') ' + r + 'px)';
    } else {
      overlay.style.background = 'radial-gradient(circle ' + r + 'px at ' + x + 'px ' + y + 'px, transparent 0%, transparent ' + (r - 4) + 'px, rgba(0,0,0,' + maskAlpha + ') ' + r + 'px)';
    }
    // Update mask readout
    var maskVal = document.getElementById('satSpotlightMaskVal');
    if (maskVal) maskVal.textContent = Math.round(_spotlightMaskOpacity * 100) + '%';
    // Update UI readouts
    var radiusEl = document.getElementById('satSpotlightRadiusVal');
    if (radiusEl) radiusEl.textContent = r + 'px';
    var brightEl = document.getElementById('satSpotlightBrightVal');
    if (brightEl) brightEl.textContent = _spotlightBrightness + '%';
    var brightSlider = document.getElementById('satSpotlightBrightness');
    if (brightSlider && parseInt(brightSlider.value) !== _spotlightBrightness) brightSlider.value = _spotlightBrightness;
  }

  function _updateSpotlightUI() {
    var statusEl = document.getElementById('satSpotlightStatus');
    var toggle = document.getElementById('satSpotlightToggle');
    if (statusEl) statusEl.textContent = _spotlightState === 'off' ? 'Off' : _spotlightState === 'follow' ? 'Following' : 'Anchored';
    if (toggle) toggle.checked = _spotlightState !== 'off';
  }

  function _spotlightOn() {
    var overlay = document.getElementById('satSpotlightOverlay');
    if (!overlay) return;
    _spotlightState = 'follow';
    _spotlightRadius = 48;
    _spotlightBrightness = 100;
    _spotlightMaskOpacity = 0.92;
    // Reset UI sliders
    var brightSlider = document.getElementById('satSpotlightBrightness');
    if (brightSlider) brightSlider.value = 100;
    var maskSlider = document.getElementById('satSpotlightMaskOpacity');
    if (maskSlider) maskSlider.value = 92;
    overlay.style.display = 'block';
    overlay.style.pointerEvents = 'auto';
    overlay.style.cursor = 'none';
    _updateSpotlightMask();
    if (map) {
      if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
      if (map.dragging) map.dragging.disable();
      if (map.doubleClickZoom) map.doubleClickZoom.disable();
    }
    overlay.addEventListener('mousemove', _spotlightMouseMove);
    overlay.addEventListener('click', _spotlightClick);
    overlay.addEventListener('wheel', _spotlightWheel, { passive: false });
    document.addEventListener('keydown', _spotlightKeydown);
    _updateSpotlightUI();
  }

  function _spotlightOff() {
    var overlay = document.getElementById('satSpotlightOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
      overlay.style.cursor = '';
      overlay.removeEventListener('mousemove', _spotlightMouseMove);
      overlay.removeEventListener('click', _spotlightClick);
      overlay.removeEventListener('wheel', _spotlightWheel);
    }
    _spotlightState = 'off';
    document.removeEventListener('keydown', _spotlightKeydown);
    if (map) {
      if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
      if (map.dragging) map.dragging.enable();
      if (map.doubleClickZoom) map.doubleClickZoom.enable();
    }
    _updateSpotlightUI();
  }

  function _spotlightMouseMove(e) {
    var overlay = document.getElementById('satSpotlightOverlay');
    var rect = overlay.getBoundingClientRect();
    if (_spotlightState === 'follow') {
      _spotlightX = e.clientX - rect.left;
      _spotlightY = e.clientY - rect.top;
      _updateSpotlightMask();
    }
  }

  // Spotlight captures — persisted, shown in Spotlight tab and saved to Geom as type 'spotlight'
  var _spotlightFocals = [];
  browser.storage.local.get({ satSpotlightFocals: [] }).then(function(s) {
    _spotlightFocals = s.satSpotlightFocals || [];
    _renderSpotlightCaptures();
  });

  function _saveSpotlightFocal(lat, lon, radiusPx, zoom, brightness) {
    var focal = { lat: lat, lon: lon, radiusPx: radiusPx, zoom: zoom, brightness: brightness || 100, ts: Date.now() };
    _spotlightFocals.unshift(focal);
    if (_spotlightFocals.length > 20) _spotlightFocals.length = 20;
    browser.storage.local.set({ satSpotlightFocals: _spotlightFocals });
    _renderSpotlightCaptures();
    return focal;
  }

  function _renderSpotlightCaptures() {
    var list = document.getElementById('satSpotlightCaptures');
    if (!list) return;
    if (!_spotlightFocals.length) { list.innerHTML = '<div style="padding:6px;font-size:9px;color:var(--text-muted);text-align:center;opacity:0.5;">No captures yet</div>'; return; }
    list.innerHTML = '';
    for (var i = 0; i < _spotlightFocals.length; i++) {
      var f = _spotlightFocals[i];
      var item = document.createElement('div');
      item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:3px 4px; cursor:pointer; font-size:9px; color:var(--text-muted); border-bottom:1px solid rgba(255,255,255,0.04);';
      item.dataset.idx = i;
      var timeStr = new Date(f.ts).toLocaleTimeString();
      item.innerHTML = '<span style="font-family:\'SF Mono\',monospace;font-size:8px;">🔦 ' +
        f.lat.toFixed(4) + ', ' + f.lon.toFixed(4) + ' · z' + f.zoom + ' · r' + f.radiusPx +
        '</span><span style="opacity:0.4;font-size:8px;">' + timeStr + '</span>';
      item.addEventListener('mouseenter', function() { this.style.background = 'rgba(0,229,255,0.08)'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', function() {
        var idx = parseInt(this.dataset.idx);
        var focal = _spotlightFocals[idx];
        if (!focal || !map) return;
        // Fly to location and activate spotlight
        map.setView([focal.lat, focal.lon], focal.zoom);
        if (_spotlightState === 'off') _spotlightOn();
        // Re-anchor at center
        setTimeout(function() {
          var overlay = document.getElementById('satSpotlightOverlay');
          if (overlay) {
            var rect = overlay.getBoundingClientRect();
            _spotlightAnchorX = rect.width / 2;
            _spotlightAnchorY = rect.height / 2;
            _spotlightRadius = focal.radiusPx || 48;
            _spotlightBrightness = focal.brightness || 100;
            _spotlightState = 'anchored';
            overlay.style.cursor = 'default';
            if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
            _updateSpotlightMask();
            _updateSpotlightUI();
          }
        }, 300);
      });
      list.appendChild(item);
    }
  }

  function _spotlightClick(e) {
    e.stopPropagation();
    e.preventDefault();
    var overlay = document.getElementById('satSpotlightOverlay');
    var rect = overlay.getBoundingClientRect();
    if (_spotlightState === 'follow') {
      _spotlightAnchorX = e.clientX - rect.left;
      _spotlightAnchorY = e.clientY - rect.top;
      _spotlightState = 'anchored';
      overlay.style.cursor = 'default';
      _updateSpotlightMask();
      _updateSpotlightUI();
    } else if (_spotlightState === 'anchored') {
      _spotlightState = 'follow';
      _spotlightX = e.clientX - rect.left;
      _spotlightY = e.clientY - rect.top;
      overlay.style.cursor = 'none';
      _updateSpotlightMask();
      _updateSpotlightUI();
    }
  }

  function _spotlightWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    if (_spotlightState !== 'anchored') return;
    var delta = e.deltaY > 0 ? -1 : 1;
    if (_spotlightWheelMode === 'size') {
      _spotlightRadius = Math.max(SPOTLIGHT_MIN_R, Math.min(SPOTLIGHT_MAX_R, _spotlightRadius + delta * SPOTLIGHT_STEP));
    } else {
      _spotlightBrightness = Math.max(50, Math.min(300, _spotlightBrightness + delta * 10));
    }
    _updateSpotlightMask();
  }

  function _spotlightKeydown(e) {
    if (e.key === 'Escape') _spotlightOff();
  }

  // Freeze frame — capture current spotlight to Geom tab + visual effect
  function _spotlightFreeze() {
    if (_spotlightState !== 'anchored' || !map) return;
    var cp = L.point(_spotlightAnchorX, _spotlightAnchorY);
    var latlng = map.containerPointToLatLng(cp);

    // Save to spotlight captures
    var focal = _saveSpotlightFocal(latlng.lat, latlng.lng, _spotlightRadius, map.getZoom(), _spotlightBrightness);

    // Save to Geom tab as a spotlight circle
    // Approximate radius in km from px at current zoom
    var edgePt = L.point(_spotlightAnchorX + _spotlightRadius, _spotlightAnchorY);
    var edgeLatLng = map.containerPointToLatLng(edgePt);
    var radiusKm = _haversineDistance(latlng.lat, latlng.lng, edgeLatLng.lat, edgeLatLng.lng);

    _saveDrawingRecord({
      type: 'spotlight',
      points: [[latlng.lat, latlng.lng]],
      distance: radiusKm,
      zoom: map.getZoom(),
      radiusPx: _spotlightRadius,
      brightness: _spotlightBrightness
    });

    // Draw the capture circle on map (cyan, distinct from other geometry)
    var captureCircle = L.circle(latlng, { radius: radiusKm * 1000, color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.08, weight: 2, dashArray: '4,4' }).addTo(map);
    var capLabel = L.tooltip({ permanent: true, direction: 'center', className: 'sat-measure-label' })
      .setLatLng(latlng).setContent('🔦 r=' + _formatDist(radiusKm)).addTo(map);
    _measureLayers.push(captureCircle, capLabel);

    // Freeze animation — bright ring that contracts and fades
    var animCircle = L.circle(latlng, { radius: radiusKm * 1000 * 1.5, color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.2, weight: 3, opacity: 1 }).addTo(map);
    _measureLayers.push(animCircle);
    var animR = radiusKm * 1000 * 1.5;
    var fadeInterval = setInterval(function() {
      animR *= 0.92;
      var opacity = animR / (radiusKm * 1000 * 1.5);
      if (opacity < 0.05) {
        try { map.removeLayer(animCircle); } catch(e) {}
        var idx = _measureLayers.indexOf(animCircle);
        if (idx > -1) _measureLayers.splice(idx, 1);
        clearInterval(fadeInterval);
        return;
      }
      try {
        animCircle.setRadius(animR);
        animCircle.setStyle({ fillOpacity: opacity * 0.2, opacity: opacity });
      } catch(e) {
        try { map.removeLayer(animCircle); } catch(ex) {}
        var idx2 = _measureLayers.indexOf(animCircle);
        if (idx2 > -1) _measureLayers.splice(idx2, 1);
        clearInterval(fadeInterval);
      }
    }, 50);

    _wigleToast('🔦 Spotlight captured', 2000);
  }

  // Screenshot (basic — captures map container)
  function _spotlightScreenshot() {
    if (!map) return;
    var container = map.getContainer();
    // Use canvas capture if available, otherwise try basic approach
    try {
      var canvas = document.createElement('canvas');
      var rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Attempt to draw map tiles (won't work with cross-origin tiles but captures overlays)
      var ctx = canvas.getContext('2d');
      // Fallback: use the leaflet-image or dom-to-image pattern
      // For now, trigger browser's native screenshot hint
      _wigleToast('📷 Use Ctrl+Shift+S or browser screenshot tool to capture this view', 4000);
    } catch (e) {
      _wigleToast('📷 Screenshot: use Ctrl+Shift+S', 3000);
    }
  }

  // Wire spotlight tab controls
  document.getElementById('satSpotlightToggle')?.addEventListener('change', function() {
    if (this.checked) _spotlightOn();
    else _spotlightOff();
  });

  document.getElementById('satSpotlightWheelMode')?.addEventListener('change', function() {
    _spotlightWheelMode = this.checked ? 'bright' : 'size';
  });

  document.getElementById('satSpotlightBrightness')?.addEventListener('input', function() {
    _spotlightBrightness = parseInt(this.value);
    if (_spotlightState !== 'off') _updateSpotlightMask();
  });

  // ── Edge Detection (Sobel) ──
  var _edgeOverlay = null;  // L.imageOverlay on the map
  var _edgeThreshold = 60;
  var _edgeOpacity = 0.7;
  var _edgeColor = [118, 255, 3]; // lime green RGB

  function _captureMapToCanvas() {
    return new Promise(function(resolve, reject) {
      if (!map) return reject('No map');
      var container = map.getContainer();
      var rect = container.getBoundingClientRect();
      var canvas = document.getElementById('satEdgeCanvas');
      canvas.width = rect.width;
      canvas.height = rect.height;
      var ctx = canvas.getContext('2d');

      // Capture all tile images from the Leaflet tile pane
      var tilePane = container.querySelector('.leaflet-tile-pane');
      if (!tilePane) return reject('No tile pane');

      // Draw each tile image onto our canvas at correct position
      var tiles = tilePane.querySelectorAll('img');
      var loaded = 0, total = tiles.length;
      if (!total) return reject('No tiles');

      // Get the map container's offset relative to tiles
      var mapRect = container.getBoundingClientRect();

      tiles.forEach(function(tile) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          var tileRect = tile.getBoundingClientRect();
          var x = tileRect.left - mapRect.left;
          var y = tileRect.top - mapRect.top;
          try { ctx.drawImage(img, x, y, tileRect.width, tileRect.height); } catch(e) {}
          loaded++;
          if (loaded >= total) resolve(canvas);
        };
        img.onerror = function() {
          loaded++;
          if (loaded >= total) resolve(canvas);
        };
        // Try to use the tile's current src
        img.src = tile.src;
      });

      // Also draw any image overlays (Sentinel imagery)
      var overlayPane = container.querySelector('.leaflet-overlay-pane');
      if (overlayPane) {
        var overlayImgs = overlayPane.querySelectorAll('img');
        overlayImgs.forEach(function(oimg) {
          try {
            var oRect = oimg.getBoundingClientRect();
            ctx.drawImage(oimg, oRect.left - mapRect.left, oRect.top - mapRect.top, oRect.width, oRect.height);
          } catch(e) {}
        });
      }
    });
  }

  function _sobelEdgeDetect(canvas, threshold, edgeColorRGB) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var imgData = ctx.getImageData(0, 0, w, h);
    var src = imgData.data;

    // Convert to grayscale
    var gray = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) {
      var idx = i * 4;
      gray[i] = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
    }

    // Sobel kernels
    var gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    var gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    // Output canvas
    var outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    var outCtx = outCanvas.getContext('2d');
    var outData = outCtx.createImageData(w, h);
    var out = outData.data;

    var r = edgeColorRGB[0], g = edgeColorRGB[1], b = edgeColorRGB[2];

    for (var y2 = 1; y2 < h - 1; y2++) {
      for (var x2 = 1; x2 < w - 1; x2++) {
        var sx = 0, sy = 0;
        for (var ky = -1; ky <= 1; ky++) {
          for (var kx = -1; kx <= 1; kx++) {
            var px = gray[(y2 + ky) * w + (x2 + kx)];
            var ki = (ky + 1) * 3 + (kx + 1);
            sx += px * gx[ki];
            sy += px * gy[ki];
          }
        }
        var mag = Math.sqrt(sx * sx + sy * sy);
        var oi = (y2 * w + x2) * 4;
        if (mag > threshold) {
          var intensity = Math.min(255, mag);
          out[oi] = r;
          out[oi + 1] = g;
          out[oi + 2] = b;
          out[oi + 3] = intensity;
        } else {
          out[oi + 3] = 0; // transparent
        }
      }
    }

    outCtx.putImageData(outData, 0, 0);
    return outCanvas;
  }

  async function _runEdgeDetection() {
    if (!map) return;
    var statusEl = document.getElementById('satMeasureStatus');
    if (statusEl) statusEl.textContent = 'Detecting edges...';

    try {
      var canvas = await _captureMapToCanvas();
      var edgeCanvas = _sobelEdgeDetect(canvas, _edgeThreshold, _edgeColor);

      // Remove old overlay
      if (_edgeOverlay) { try { map.removeLayer(_edgeOverlay); } catch(e) {} }

      // Place edge image as a map overlay at current bounds
      var bounds = map.getBounds();
      var dataUrl = edgeCanvas.toDataURL('image/png');
      _edgeOverlay = L.imageOverlay(dataUrl, bounds, { opacity: _edgeOpacity, zIndex: 600, interactive: false }).addTo(map);

      // Show controls
      document.getElementById('satEdgeControls').style.display = '';
      document.getElementById('satEdgeClear').style.display = '';
      if (statusEl) statusEl.textContent = 'Edges detected — ' + edgeCanvas.width + 'x' + edgeCanvas.height + 'px';
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Edge detection failed: ' + (e.message || e);
    }
  }

  // Wire edge detect button
  document.getElementById('satEdgeDetect')?.addEventListener('click', _runEdgeDetection);

  // Clear edges
  document.getElementById('satEdgeClear')?.addEventListener('click', function() {
    if (_edgeOverlay) { try { map.removeLayer(_edgeOverlay); } catch(e) {} _edgeOverlay = null; }
    document.getElementById('satEdgeControls').style.display = 'none';
    this.style.display = 'none';
  });

  // Threshold slider — re-run detection
  document.getElementById('satEdgeThreshold')?.addEventListener('input', function() {
    _edgeThreshold = parseInt(this.value);
    document.getElementById('satEdgeThresholdVal').textContent = _edgeThreshold;
  });
  document.getElementById('satEdgeThreshold')?.addEventListener('change', function() {
    _runEdgeDetection();
  });

  // Opacity slider — live update
  document.getElementById('satEdgeOpacity')?.addEventListener('input', function() {
    _edgeOpacity = parseInt(this.value) / 100;
    document.getElementById('satEdgeOpacityVal').textContent = this.value + '%';
    if (_edgeOverlay) _edgeOverlay.setOpacity(_edgeOpacity);
  });

  // Color buttons
  var _edgeColorMap = {
    lime: [118, 255, 3], white: [255, 255, 255],
    cyan: [0, 229, 255], red: [255, 68, 68]
  };
  document.querySelectorAll('[data-color]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _edgeColor = _edgeColorMap[this.dataset.color] || [118, 255, 3];
      if (_edgeOverlay) _runEdgeDetection();
    });
  });

  // ── View Modes ──
  var _viewMode = 'normal';

  document.querySelectorAll('.sat-view-mode').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var mode = this.dataset.view;
      if (mode === 'fullscreen') {
        _toggleFullscreen();
        return;
      }
      _setViewMode(mode === _viewMode ? 'normal' : mode);
    });
  });

  var _preSplitParents = {}; // track original parent of each panel
  var _dockedPanels = {};    // track which panels are currently in the dock
  var _dockPanelIds = ['assetLibPanel', 'satToolbar', 'satPinsPanel', 'satMeasurePanel'];
  var _activeDockTab = 'satToolbar';

  function _setViewMode(mode) {
    _viewMode = mode;
    document.body.classList.remove('sat-compact', 'sat-split', 'sat-fullscreen');
    if (mode === 'compact') document.body.classList.add('sat-compact');
    if (mode === 'split') {
      document.body.classList.add('sat-split');
      var dockBody = document.getElementById('satDockBody');
      _preSplitParents = {};
      _dockedPanels = {};
      _dockPanelIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        _preSplitParents[id] = el.parentNode;
        // Only dock panels that are hidden — leave floating ones alone
        if (el.classList.contains('hidden')) {
          el.classList.remove('hidden');
          dockBody.appendChild(el);
          el.style.display = 'none';
          _dockedPanels[id] = true;
        }
      });
      _showDockPanel(_activeDockTab);
    } else {
      // Exiting split — move docked panels back, re-hide them
      _dockPanelIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.style.display = '';
        if (_dockedPanels[id]) {
          var origParent = _preSplitParents[id];
          if (origParent) origParent.appendChild(el);
          el.classList.add('hidden');
        }
      });
      // Clean up any redock placeholders
      var redockEl = document.getElementById('satDockRedock');
      if (redockEl) redockEl.remove();
      _preSplitParents = {};
      _dockedPanels = {};
    }
    document.querySelectorAll('.sat-view-mode').forEach(function(b) {
      b.style.opacity = b.dataset.view === mode ? '1' : '0.6';
    });
    setTimeout(function() { if (map) map.invalidateSize(); }, 100);
  }

  function _showDockPanel(id) {
    _activeDockTab = id;
    var dockBody = document.getElementById('satDockBody');
    // Hide all docked panels
    _dockPanelIds.forEach(function(pid) {
      var el = document.getElementById(pid);
      if (el && _dockedPanels[pid]) el.style.display = pid === id ? '' : 'none';
    });
    // Remove any existing redock placeholder
    var redockEl = document.getElementById('satDockRedock');
    if (redockEl) redockEl.remove();
    // If the panel isn't in the dock (floating or lost), show Redock button
    if (!_dockedPanels[id]) {
      var redock = document.createElement('div');
      redock.id = 'satDockRedock';
      redock.style.cssText = 'display:flex; align-items:center; justify-content:center; height:100%;';
      redock.innerHTML = '<button class="pill-chip" style="font-size:12px; padding:8px 20px;">Redock</button>';
      redock.querySelector('button').addEventListener('click', function() {
        var panel = document.getElementById(id);
        if (!panel) return;
        _preSplitParents[id] = _preSplitParents[id] || panel.parentNode;
        panel.classList.remove('hidden');
        panel.style.display = '';
        dockBody.appendChild(panel);
        _dockedPanels[id] = true;
        redock.remove();
        _showDockPanel(id);
      });
      dockBody.appendChild(redock);
    }
    document.querySelectorAll('#satDockTabs button').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.dockTab === id);
    });
  }

  // Wire dock tab clicks
  document.getElementById('satDockTabs')?.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-dock-tab]');
    if (btn) _showDockPanel(btn.dataset.dockTab);
  });

  document.getElementById('satDockClose')?.addEventListener('click', function() {
    _setViewMode('normal');
  });

  function _toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      document.body.classList.remove('sat-fullscreen');
    } else {
      document.documentElement.requestFullscreen().then(function() {
        document.body.classList.add('sat-fullscreen');
        setTimeout(function() { if (map) map.invalidateSize(); }, 200);
      }).catch(function() {});
    }
  }

  // Restore on exit fullscreen (Escape/F11)
  document.addEventListener('fullscreenchange', function() {
    if (!document.fullscreenElement) {
      document.body.classList.remove('sat-fullscreen');
      setTimeout(function() { if (map) map.invalidateSize(); }, 100);
    }
  });

  document.getElementById('satSpotlightMaskOpacity')?.addEventListener('input', function() {
    _spotlightMaskOpacity = parseInt(this.value) / 100;
    if (_spotlightState !== 'off') _updateSpotlightMask();
  });

  document.getElementById('satSpotlightFreeze')?.addEventListener('click', _spotlightFreeze);
  document.getElementById('satSpotlightCapturePng')?.addEventListener('click', _spotlightScreenshot);


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
