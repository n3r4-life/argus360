(function () {
  'use strict';

  let currentMode = 'aviation';
  let searchResults = [];
  let selectedItem = null;
  let watchlist = [];
  let searchHistory = [];
  let map = null;
  let mapMarkers = [];

  // ── Initialize Leaflet map ──
  function initMap() {
    if (map) return;
    const container = document.getElementById('mvmtMap');
    if (!container || typeof L === 'undefined') return;

    map = L.map('mvmtMap', {
      center: [30, 0],
      zoom: 3,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
  }

  function clearMapMarkers() {
    for (const m of mapMarkers) map?.removeLayer(m);
    mapMarkers = [];
  }

  function plotAircraftOnMap(states) {
    if (!map) initMap();
    if (!map) return;
    clearMapMarkers();

    for (const s of states) {
      const lat = s[6];
      const lon = s[5];
      if (lat == null || lon == null) continue;

      const callsign = (s[1] || '').trim();
      const icao24 = s[0] || '';
      const alt = s[7] != null ? Math.round(s[7] * 3.281) : null;
      const speed = s[9] != null ? Math.round(s[9] * 1.944) : null;
      const heading = s[10] || 0;
      const onGround = s[8];
      const country = s[2] || '';

      // Rotated aircraft icon
      const icon = L.divIcon({
        className: 'mvmt-map-icon',
        html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="${onGround ? '#6a6a80' : '#22c55e'}" stroke="none" style="transform:rotate(${heading}deg);">
          <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.7 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/>
        </svg>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([lat, lon], { icon }).addTo(map);
      marker.bindPopup(`
        <strong>${callsign || icao24}</strong><br>
        ${country}<br>
        ${alt != null ? `Alt: ${alt.toLocaleString()} ft<br>` : ''}
        ${speed != null ? `Spd: ${speed} kts<br>` : ''}
        Hdg: ${Math.round(heading)}°
      `);
      mapMarkers.push(marker);
    }

    // Fit map to markers
    if (mapMarkers.length === 1) {
      map.setView(mapMarkers[0].getLatLng(), 10);
    } else if (mapMarkers.length > 1) {
      const group = L.featureGroup(mapMarkers);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }

  function plotVesselOnMap(vessel) {
    if (!map) initMap();
    if (!map) return;
    if (vessel.lat == null || vessel.lon == null) return;
    clearMapMarkers();

    const icon = L.divIcon({
      className: 'mvmt-map-icon',
      html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#60a5fa" stroke="none" style="transform:rotate(${vessel.course || 0}deg);">
        <path d="M12 2L4 20h16L12 2z"/>
      </svg>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const marker = L.marker([vessel.lat, vessel.lon], { icon }).addTo(map);
    marker.bindPopup(`
      <strong>${vessel.name || vessel.mmsi}</strong><br>
      ${vessel.flag || ''}<br>
      ${vessel.speed != null ? `Spd: ${vessel.speed} kts<br>` : ''}
      ${vessel.destination ? `→ ${vessel.destination}` : ''}
    `);
    mapMarkers.push(marker);
    map.setView([vessel.lat, vessel.lon], 8);
  }

  // Load search history
  browser.storage.local.get({ mvmtSearchHistory: [] }).then(d => {
    searchHistory = d.mvmtSearchHistory || [];
    renderSearchHistory();
  }).catch(() => {});

  // ── Mode Toggle ──
  document.querySelectorAll('.mvmt-mode-toggle .pill-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      document.querySelectorAll('.mvmt-mode-toggle .pill-chip').forEach(b => b.classList.toggle('active', b === btn));

      const input = document.getElementById('mvmtSearchInput');
      switch (currentMode) {
        case 'aviation': input.placeholder = 'Search tail number, callsign, or ICAO hex...'; break;
        case 'maritime': input.placeholder = 'Search IMO, MMSI, or vessel name...'; break;
        case 'radio':    input.placeholder = 'Search location, frequency, or feed name...'; break;
      }
      refreshChatContext();
    });
  });

  // ── Search ──
  document.getElementById('mvmtSearchBtn').addEventListener('click', () => mvmtSearch());
  document.getElementById('mvmtSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') mvmtSearch();
  });

  function renderSearchHistory() {
    let list = document.getElementById('mvmtSearchHistoryList');
    if (!list) {
      list = document.createElement('datalist');
      list.id = 'mvmtSearchHistoryList';
      document.body.appendChild(list);
      document.getElementById('mvmtSearchInput').setAttribute('list', 'mvmtSearchHistoryList');
    }
    list.innerHTML = searchHistory.map(h => `<option value="${h.query}">${h.query} — ${h.mode}${h.info ? ' · ' + h.info : ''}</option>`).join('');
  }

  async function saveSearchHistory(query, mode, info) {
    // Remove duplicate if exists
    searchHistory = searchHistory.filter(h => !(h.query === query && h.mode === mode));
    // Add to front
    searchHistory.unshift({ query, mode, info: info || '', ts: Date.now() });
    // Keep last 30
    if (searchHistory.length > 30) searchHistory.length = 30;
    await browser.storage.local.set({ mvmtSearchHistory: searchHistory });
    renderSearchHistory();
  }

  async function mvmtSearch() {
    const query = document.getElementById('mvmtSearchInput').value.trim();
    if (!query) return;

    const btn = document.getElementById('mvmtSearchBtn');
    btn.disabled = true;
    btn.textContent = 'Searching...';

    try {
      const resp = await browser.runtime.sendMessage({ action: 'intelGetStatus' });
      const providers = resp?.providers || {};

      if (currentMode === 'aviation') {
        await searchAviation(query);
      } else if (currentMode === 'maritime') {
        await searchMaritime(query);
      } else if (currentMode === 'radio') {
        renderStubResults('radio', query);
      }
    } catch (e) {
      console.warn('[Movement] Search error:', e);
    }

    // Save to search history
    await saveSearchHistory(query, currentMode, '');

    btn.disabled = false;
    btn.textContent = 'Search';
    refreshChatContext();
  }

  async function searchAviation(query) {
    const container = document.getElementById('mvmtResults');
    const title = document.getElementById('mvmtResultsTitle');
    const detail = document.getElementById('mvmtDetail');
    title.textContent = 'Aircraft Results';

    const q = query.trim();
    const isHex = /^[0-9a-f]{6}$/i.test(q);
    const isTailNumber = /^[A-Z]-?[A-Z0-9]{1,5}$/i.test(q) || /^N[0-9]{1,5}[A-Z]{0,2}$/i.test(q);

    // ── Step 1: Resolve tail number → ICAO24 hex + aircraft info ──
    let resolvedHex = isHex ? q.toLowerCase() : null;
    let aircraftInfo = null;

    if (isTailNumber && !isHex) {
      detail.innerHTML = '<div class="comp-empty">Resolving tail number...</div>';
      try {
        const lookup = await browser.runtime.sendMessage({ action: 'aircraftLookup', query: q });
        if (lookup?.found) {
          resolvedHex = lookup.hex;
          aircraftInfo = lookup.info;
          renderAircraftDetail(lookup);
        } else {
          detail.innerHTML = `<div class="comp-empty">Could not resolve tail number "${escHtml(q)}" to an ICAO24 hex.</div>`;
        }
      } catch (e) {
        detail.innerHTML = `<div class="comp-error">Lookup error: ${escHtml(e.message)}</div>`;
      }
    } else if (isHex) {
      detail.innerHTML = '<div class="comp-empty">Looking up aircraft...</div>';
    }

    try {
      // ── Step 2: Search OpenSky for live position ──

      let states = [];
      const searchHex = resolvedHex || (isHex ? q.toLowerCase() : null);

      if (searchHex) {
        // Direct ICAO24 hex lookup
        const resp = await browser.runtime.sendMessage({
          action: 'intelSearch', provider: 'opensky', query: searchHex,
          options: { icao24: searchHex }
        });
        states = resp?.results?.states || [];
      }

      // If tail number resolved to hex but aircraft not found, also try callsign match
      if (!states.length && isTailNumber) {
        try {
          const resp = await browser.runtime.sendMessage({
            action: 'intelSearch', provider: 'opensky', query: q, options: {}
          });
          const allStates = resp?.results?.states || [];
          const tailClean = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
          states = allStates.filter(s => {
            const cs = (s[1] || '').trim().replace(/\s+/g, '').toUpperCase();
            return cs === tailClean || cs.startsWith(tailClean);
          });
        } catch { /* silent */ }
      }

      // For non-tail-number free-text queries, search by callsign
      if (!states.length && !isTailNumber && !isHex) {
        // Free-text search (callsign match) — only for non-tail-number queries
        const resp = await browser.runtime.sendMessage({
          action: 'intelSearch', provider: 'opensky', query: q.toLowerCase(), options: {}
        });
        const allStates = resp?.results?.states || [];
        const qLower = q.toLowerCase().replace(/[^a-z0-9]/g, '');
        states = allStates.filter(s => {
          const cs = (s[1] || '').trim().replace(/\s+/g, '').toLowerCase();
          return cs.includes(qLower) || qLower.includes(cs);
        });
      }

      if (!states.length) {
        const msg = aircraftInfo
          ? `Aircraft "${escHtml(aircraftInfo.registration || q)}" (${escHtml(aircraftInfo.manufacturer || '')} ${escHtml(aircraftInfo.type || '')}) is not currently airborne or transmitting.`
          : `No live aircraft found matching "${escHtml(query)}".`;

        container.innerHTML = `<div class="comp-empty">
          ${msg}<br><br>
          ${aircraftInfo ? `<strong>ICAO24:</strong> ${resolvedHex}<br>` : ''}
          <strong>Note:</strong> OpenSky only shows aircraft with active transponders. The aircraft may be parked or powered down.
        </div>`;
        return;
      }

      searchResults = states;
      renderAviationResults(states);
      plotAircraftOnMap(states);

      // Try FlightAware for richer data (if configured)
      try {
        const faResp = await browser.runtime.sendMessage({
          action: 'flightawareSearch', query: isTailNumber ? q : (states[0]?.[1]?.trim() || q),
          options: { identType: isTailNumber ? 'registration' : undefined }
        });
        if (faResp?.success && faResp.flights?.length) {
          const flight = faResp.flights[0];
          const faDetail = {
            found: true,
            query: q,
            hex: resolvedHex || (states[0]?.[0] || ''),
            source: 'flightaware',
            info: {
              icao24: resolvedHex || (states[0]?.[0] || ''),
              registration: flight.registration || q,
              manufacturer: flight.aircraft_type || '',
              type: flight.aircraft_type || '',
              owner: '',
              operator: flight.operator || flight.operator_icao || '',
              flightId: flight.ident || '',
              origin: flight.origin?.name ? `${flight.origin.name} (${flight.origin.code_iata || flight.origin.code})` : '',
              destination: flight.destination?.name ? `${flight.destination.name} (${flight.destination.code_iata || flight.destination.code})` : '',
              status: flight.status || '',
              departureTime: flight.actual_off || flight.scheduled_off || '',
              arrivalTime: flight.estimated_on || flight.scheduled_on || '',
              progress: flight.progress_percent,
            },
          };
          renderFlightAwareDetail(faDetail);
          aircraftInfo = faDetail.info;
        }
      } catch { /* FlightAware not configured or error — silent */ }

      // Enrich detail panel if we don't have good data yet
      if (!aircraftInfo?.manufacturer) {
        let enriched = false;

        // Try callsign from live results first (most useful)
        if (states.length) {
          const callsign = (states[0][1] || '').trim();
          if (callsign) {
            try {
              const csLookup = await browser.runtime.sendMessage({ action: 'aircraftLookup', query: callsign });
              if (csLookup?.found && csLookup.info) {
                aircraftInfo = csLookup.info;
                renderAircraftDetail(csLookup);
                enriched = true;
              }
            } catch { /* silent */ }
          }
        }

        // Fall back to hex lookup
        if (!enriched && isHex) {
          try {
            const hexLookup = await browser.runtime.sendMessage({ action: 'aircraftLookupHex', query: q });
            if (hexLookup?.info) {
              aircraftInfo = hexLookup.info;
              renderAircraftDetail({
                found: true, query: q, hex: q.toLowerCase(),
                source: hexLookup.found ? 'hexdb' : 'query',
                info: hexLookup.info,
              });
              enriched = true;
            }
          } catch { /* silent */ }
        }

        // Last resort — show what we have
        if (!enriched) {
          renderAircraftDetail({
            found: true, query: q,
            hex: resolvedHex || q.toLowerCase(),
            source: 'query',
            info: { icao24: resolvedHex || q.toLowerCase() },
          });
        }
      }

    } catch (e) {
      container.innerHTML = `<div class="comp-error">Error: ${escHtml(e.message)}</div>`;
    }
  }

  async function searchFlightHistory(query) {
    const detail = document.getElementById('mvmtDetail');
    try {
      const now = Math.floor(Date.now() / 1000);
      const twoDaysAgo = now - 2 * 24 * 60 * 60;

      // For flight history we need an icao24 hex
      // If query looks like a hex, use it directly
      const isHex = /^[0-9a-f]{6}$/i.test(query);
      if (!isHex) {
        detail.innerHTML = `<div class="comp-empty">
          Flight history requires an ICAO24 hex address.<br>
          Tail number "${escHtml(query)}" can't be looked up in history directly — try finding the ICAO24 hex for this aircraft.
        </div>`;
        return;
      }

      const resp = await browser.runtime.sendMessage({
        action: 'intelSearch', provider: 'opensky', query,
        options: {} // flight history needs a direct call
      });

      // Note: the generic intelSearch calls getLiveStates, not getFlights
      // We need a dedicated message for flight history
      detail.innerHTML = `<div class="comp-empty">
        ICAO24: ${escHtml(query)}<br>
        Aircraft may not be airborne. Check back when it's flying, or use the ICAO24 hex for direct tracking.
      </div>`;
    } catch (e) {
      detail.innerHTML = `<div class="comp-error">History error: ${escHtml(e.message)}</div>`;
    }
  }

  function renderAviationResults(states) {
    const container = document.getElementById('mvmtResults');

    container.innerHTML = states.map((s, i) => {
      const icao24 = s[0] || '';
      const callsign = (s[1] || '').trim();
      const country = s[2] || '';
      const lon = s[5];
      const lat = s[6];
      const altitude = s[7] != null ? Math.round(s[7] * 3.281) : null; // meters → feet
      const onGround = s[8];
      const speed = s[9] != null ? Math.round(s[9] * 1.944) : null; // m/s → knots
      const heading = s[10] != null ? Math.round(s[10]) : null;
      const vertRate = s[11] != null ? Math.round(s[11] * 196.85) : null; // m/s → ft/min
      const squawk = s[14] || '';
      const posSource = ['ADS-B', 'ASTERIX', 'MLAT', 'FLARM'][s[16]] || '';
      const CATEGORIES = ['', '', 'Light', 'Small', 'Large', 'High Vortex', 'Heavy', 'High Perf', 'Rotorcraft', 'Glider', 'Lighter-than-air', 'Skydiver', 'Ultralight', '', 'UAV', 'Space', 'Emergency', 'Service', 'Obstacle', 'Cluster', 'Line Obstacle'];
      const category = CATEGORIES[s[17]] || '';

      return `<div class="mvmt-result-card" data-idx="${i}">
        <div class="mvmt-result-header">
          <span class="mvmt-result-callsign">${callsign || icao24}</span>
          <span class="mvmt-result-icao">${icao24}</span>
          <span class="mvmt-result-country">${escHtml(country)}</span>
          ${category ? `<span class="mvmt-result-category">${category}</span>` : ''}
          ${onGround ? '<span class="mvmt-result-ground">ON GROUND</span>' : '<span class="mvmt-result-airborne">AIRBORNE</span>'}
        </div>
        <div class="mvmt-result-data">
          ${altitude != null ? `<span>Alt: ${altitude.toLocaleString()} ft</span>` : ''}
          ${speed != null ? `<span>Spd: ${speed} kts</span>` : ''}
          ${heading != null ? `<span>Hdg: ${heading}°</span>` : ''}
          ${vertRate != null && vertRate !== 0 ? `<span>V/S: ${vertRate > 0 ? '+' : ''}${vertRate} ft/min</span>` : ''}
          ${lat != null && lon != null ? `<span>Pos: ${lat.toFixed(4)}, ${lon.toFixed(4)}</span>` : ''}
          ${squawk ? `<span>Squawk: ${squawk}</span>` : ''}
          ${posSource ? `<span>Src: ${posSource}</span>` : ''}
        </div>
        <div class="mvmt-result-actions">
          <button class="pill-chip mvmt-select-btn" data-idx="${i}">Details</button>
          <button class="pill-chip mvmt-watch-btn" data-icao="${icao24}" data-callsign="${callsign}">Watch</button>
          <button class="pill-chip mvmt-kg-btn" data-icao="${icao24}" data-callsign="${callsign}" data-country="${escHtml(country)}">Add to KG</button>
        </div>
      </div>`;
    }).join('');

    // Wire buttons
    container.querySelectorAll('.mvmt-watch-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const item = { id: btn.dataset.icao, name: btn.dataset.callsign || btn.dataset.icao, mode: 'aviation' };
        watchlist.push(item);
        await browser.storage.local.set({ mvmtWatchlist: watchlist });
        renderWatchlist();
        btn.textContent = 'Watching!';
        setTimeout(() => { btn.textContent = 'Watch'; }, 2000);
      });
    });

    container.querySelectorAll('.mvmt-kg-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await browser.runtime.sendMessage({
          action: 'extractAndUpsert',
          text: `Aircraft ${btn.dataset.callsign || btn.dataset.icao} (${btn.dataset.country})`,
          pageUrl: `opensky:${btn.dataset.icao}`,
          pageTitle: `OpenSky — ${btn.dataset.callsign || btn.dataset.icao}`
        });
        btn.textContent = 'Added!';
        setTimeout(() => { btn.textContent = 'Add to KG'; }, 2000);
      });
    });

    document.getElementById('mvmtAddToKg').disabled = false;
    document.getElementById('mvmtWatchItem').disabled = false;
  }

  // ── Maritime Search ──
  async function searchMaritime(query) {
    const container = document.getElementById('mvmtResults');
    const title = document.getElementById('mvmtResultsTitle');
    const detail = document.getElementById('mvmtDetail');
    title.textContent = 'Vessel Results';
    container.innerHTML = '<div class="comp-empty">Searching...</div>';

    try {
      const resp = await browser.runtime.sendMessage({ action: 'vesselSearch', query });

      if (resp?.found && resp.results?.length) {
        // VesselFinder API returned data
        container.innerHTML = resp.results.map((v, i) => `
          <div class="mvmt-result-card" data-idx="${i}">
            <div class="mvmt-result-header">
              <span class="mvmt-result-callsign">${escHtml(v.name || 'Unknown')}</span>
              ${v.callSign ? `<span class="mvmt-result-icao">${escHtml(v.callSign)}</span>` : ''}
              ${v.flag ? `<span class="mvmt-result-country">${escHtml(v.flag)}</span>` : ''}
              ${v.type ? `<span class="mvmt-result-category">${escHtml(v.type)}</span>` : ''}
              ${v.speed != null ? '<span class="mvmt-result-airborne">UNDERWAY</span>' : ''}
            </div>
            <div class="mvmt-result-data">
              ${v.mmsi ? `<span>MMSI: ${escHtml(v.mmsi)}</span>` : ''}
              ${v.imo ? `<span>IMO: ${escHtml(v.imo)}</span>` : ''}
              ${v.speed != null ? `<span>Spd: ${v.speed} kts</span>` : ''}
              ${v.course != null ? `<span>Crs: ${v.course}\u00B0</span>` : ''}
              ${v.lat != null ? `<span>Pos: ${v.lat.toFixed(4)}, ${v.lon.toFixed(4)}</span>` : ''}
              ${v.destination ? `<span>\u2192 ${escHtml(v.destination)}</span>` : ''}
            </div>
            <div class="mvmt-result-actions">
              ${v.mmsi ? `<a class="pill-chip" href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${v.mmsi}" target="_blank" rel="noopener">MarineTraffic \u2197</a>` : ''}
              ${v.mmsi ? `<a class="pill-chip" href="https://www.vesselfinder.com/vessels/details/${v.mmsi}" target="_blank" rel="noopener">VesselFinder \u2197</a>` : ''}
              <button class="pill-chip mvmt-vessel-kg-btn" data-name="${escHtml(v.name || '')}" data-mmsi="${escHtml(v.mmsi || '')}">Add to KG</button>
              <button class="pill-chip mvmt-vessel-watch-btn" data-name="${escHtml(v.name || '')}" data-mmsi="${escHtml(v.mmsi || '')}">Watch</button>
            </div>
          </div>
        `).join('');

        wireVesselButtons(container);

        // Detail panel for first result
        const v = resp.results[0];
        renderVesselDetail(v);
        if (v.lat != null) plotVesselOnMap(v);
      } else {
        // No API results — show external links
        const links = resp.links || [];
        const noKeyMsg = !resp.hasKey
          ? `<br><br><strong>VesselFinder API key not configured.</strong> Add your key in <a href="../providers/providers.html" style="color:var(--accent);">Settings \u2192 Intelligence Providers \u2192 VesselFinder</a> for live vessel data ($10/mo).`
          : '';

        container.innerHTML = `<div class="comp-empty">
          ${resp.error ? `<strong>Error:</strong> ${escHtml(resp.error)}<br><br>` : ''}
          Search for "${escHtml(query)}" — use the links below to look up this vessel on tracking sites.${noKeyMsg}
        </div>
        <div class="mvmt-detail-links" style="margin-top:8px;">
          ${links.map(l => `<a class="pill-chip" href="${escHtml(l.url)}" target="_blank" rel="noopener">${escHtml(l.label)} \u2197</a>`).join(' ')}
        </div>`;

        detail.innerHTML = '<div class="comp-empty">No live data available. Try the external tracking links.</div>';
      }
    } catch (e) {
      container.innerHTML = `<div class="comp-error">Error: ${escHtml(e.message)}</div>`;
    }
  }

  function renderVesselDetail(v) {
    const detail = document.getElementById('mvmtDetail');
    detail.innerHTML = `
      <div class="mvmt-aircraft-detail">
        <div class="mvmt-detail-row"><span class="mvmt-detail-label">Vessel Name</span><span class="mvmt-detail-value">${escHtml(v.name)}</span></div>
        ${v.mmsi ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">MMSI</span><span class="mvmt-detail-value" style="font-family:monospace;">${escHtml(v.mmsi)}</span></div>` : ''}
        ${v.imo ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">IMO</span><span class="mvmt-detail-value" style="font-family:monospace;">${escHtml(v.imo)}</span></div>` : ''}
        ${v.callSign ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Call Sign</span><span class="mvmt-detail-value">${escHtml(v.callSign)}</span></div>` : ''}
        ${v.flag ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Flag</span><span class="mvmt-detail-value">${escHtml(v.flag)}</span></div>` : ''}
        ${v.type ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Type</span><span class="mvmt-detail-value">${escHtml(v.type)}</span></div>` : ''}
        ${v.lat != null ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Position</span><span class="mvmt-detail-value">${v.lat.toFixed(4)}, ${v.lon.toFixed(4)}</span></div>` : ''}
        ${v.speed != null ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Speed</span><span class="mvmt-detail-value">${v.speed} kts</span></div>` : ''}
        ${v.course != null ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Course</span><span class="mvmt-detail-value">${v.course}\u00B0</span></div>` : ''}
        ${v.destination ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Destination</span><span class="mvmt-detail-value">${escHtml(v.destination)}</span></div>` : ''}
        ${v.eta ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">ETA</span><span class="mvmt-detail-value">${escHtml(v.eta)}</span></div>` : ''}
        ${v.draught ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Draught</span><span class="mvmt-detail-value">${v.draught}m</span></div>` : ''}
        ${v.length ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Dimensions</span><span class="mvmt-detail-value">${v.length}m \u00D7 ${v.width}m</span></div>` : ''}
        <div class="mvmt-detail-row"><span class="mvmt-detail-label">Source</span><span class="mvmt-detail-value">${v.source === 'vesselfinder' ? 'VesselFinder (live)' : 'Search'}</span></div>
      </div>
      <div class="mvmt-detail-links">
        ${v.mmsi ? `<a class="pill-chip" href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${v.mmsi}" target="_blank" rel="noopener">MarineTraffic \u2197</a>` : ''}
        ${v.mmsi ? `<a class="pill-chip" href="https://www.myshiptracking.com/vessels?mmsi=${v.mmsi}" target="_blank" rel="noopener">MyShipTracking \u2197</a>` : ''}
        ${v.name ? `<a class="pill-chip" href="https://www.vesselfinder.com/?name=${encodeURIComponent(v.name)}" target="_blank" rel="noopener">VesselFinder \u2197</a>` : ''}
      </div>
    `;
  }

  function wireVesselButtons(container) {
    container.querySelectorAll('.mvmt-vessel-kg-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await browser.runtime.sendMessage({
          action: 'extractAndUpsert',
          text: `Vessel ${btn.dataset.name} (MMSI: ${btn.dataset.mmsi})`,
          pageUrl: `vessel:mmsi:${btn.dataset.mmsi}`,
          pageTitle: `Vessel — ${btn.dataset.name}`
        });
        btn.textContent = 'Added!';
        setTimeout(() => { btn.textContent = 'Add to KG'; }, 2000);
      });
    });

    container.querySelectorAll('.mvmt-vessel-watch-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        watchlist.push({ id: btn.dataset.mmsi, name: btn.dataset.name, mode: 'maritime' });
        await browser.storage.local.set({ mvmtWatchlist: watchlist });
        renderWatchlist();
        btn.textContent = 'Watching!';
        setTimeout(() => { btn.textContent = 'Watch'; }, 2000);
      });
    });
  }

  function renderFlightAwareDetail(lookup) {
    const detail = document.getElementById('mvmtDetail');
    const info = lookup.info || {};
    const reg = info.registration || lookup.query || '';
    detail.innerHTML = `
      <div class="mvmt-aircraft-detail">
        <div class="mvmt-detail-row"><span class="mvmt-detail-label">Registration</span><span class="mvmt-detail-value">${escHtml(reg)}</span></div>
        ${info.flightId ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Flight</span><span class="mvmt-detail-value">${escHtml(info.flightId)}</span></div>` : ''}
        ${info.type ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Aircraft</span><span class="mvmt-detail-value">${escHtml(info.type)}</span></div>` : ''}
        ${info.operator ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Operator</span><span class="mvmt-detail-value">${escHtml(info.operator)}</span></div>` : ''}
        ${info.origin ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Origin</span><span class="mvmt-detail-value">${escHtml(info.origin)}</span></div>` : ''}
        ${info.destination ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Destination</span><span class="mvmt-detail-value">${escHtml(info.destination)}</span></div>` : ''}
        ${info.status ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Status</span><span class="mvmt-detail-value">${escHtml(info.status)}</span></div>` : ''}
        ${info.progress != null ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Progress</span><span class="mvmt-detail-value">${info.progress}%</span></div>` : ''}
        ${info.departureTime ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Departed</span><span class="mvmt-detail-value">${escHtml(info.departureTime)}</span></div>` : ''}
        ${info.arrivalTime ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Arrival</span><span class="mvmt-detail-value">${escHtml(info.arrivalTime)}</span></div>` : ''}
        <div class="mvmt-detail-row"><span class="mvmt-detail-label">Source</span><span class="mvmt-detail-value">FlightAware AeroAPI</span></div>
      </div>
      <div class="mvmt-detail-links">
        ${reg && /^N/i.test(reg) ? `<a class="pill-chip" href="https://registry.faa.gov/AircraftInquiry/Search/NNumberResult?nNumberTxt=${encodeURIComponent(reg.replace(/^N/i, ''))}" target="_blank" rel="noopener">FAA Registry \u2197</a>` : ''}
        <a class="pill-chip" href="https://www.flightaware.com/live/flight/${encodeURIComponent(reg)}" target="_blank" rel="noopener">FlightAware \u2197</a>
        ${lookup.hex ? `<a class="pill-chip" href="https://globe.adsbexchange.com/?icao=${lookup.hex}" target="_blank" rel="noopener">ADS-B Exchange \u2197</a>` : ''}
      </div>
    `;
  }

  function renderAircraftDetail(lookup) {
    const detail = document.getElementById('mvmtDetail');
    const info = lookup.info || {};
    const reg = info.registration || lookup.query || '';
    detail.innerHTML = `
      <div class="mvmt-aircraft-detail">
        <div class="mvmt-detail-row"><span class="mvmt-detail-label">Registration</span><span class="mvmt-detail-value">${escHtml(info.registration || lookup.query)}</span></div>
        <div class="mvmt-detail-row"><span class="mvmt-detail-label">ICAO24 Hex</span><span class="mvmt-detail-value" style="font-family:monospace;">${escHtml(lookup.hex)}</span></div>
        ${info.manufacturer ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Manufacturer</span><span class="mvmt-detail-value">${escHtml(info.manufacturer)}</span></div>` : ''}
        ${info.type ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Type</span><span class="mvmt-detail-value">${escHtml(info.type)}</span></div>` : ''}
        ${info.model ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Model</span><span class="mvmt-detail-value">${escHtml(info.model)}</span></div>` : ''}
        ${info.owner ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Owner</span><span class="mvmt-detail-value">${escHtml(info.owner)}</span></div>` : ''}
        ${info.operator ? `<div class="mvmt-detail-row"><span class="mvmt-detail-label">Operator</span><span class="mvmt-detail-value">${escHtml(info.operator)}</span></div>` : ''}
        <div class="mvmt-detail-row"><span class="mvmt-detail-label">Source</span><span class="mvmt-detail-value">${lookup.source === 'computed' ? 'FAA N-number algorithm' : 'hexdb.io'}</span></div>
      </div>
      <div class="mvmt-detail-links">
        ${reg && /^N/i.test(reg) ? `<a class="pill-chip" href="https://registry.faa.gov/AircraftInquiry/Search/NNumberResult?nNumberTxt=${encodeURIComponent(reg.replace(/^N/i, ''))}" target="_blank" rel="noopener">FAA Registry \u2197</a>` : ''}
        ${reg ? `<a class="pill-chip" href="https://www.flightaware.com/resources/registration/${encodeURIComponent(reg)}" target="_blank" rel="noopener">FlightAware \u2197</a>` : ''}
        <a class="pill-chip" href="https://globe.adsbexchange.com/?icao=${lookup.hex}" target="_blank" rel="noopener">ADS-B Exchange \u2197</a>
      </div>
    `;
  }

  function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function renderNoProvider(name) {
    const container = document.getElementById('mvmtResults');
    container.innerHTML = `<div class="comp-empty">
      ${name} is not configured. <a href="../providers/providers.html" style="color:var(--accent);">Add your API key</a> to enable search.
    </div>`;
  }

  function renderStubResults(mode, query) {
    const container = document.getElementById('mvmtResults');
    const title = document.getElementById('mvmtResultsTitle');
    const empty = document.getElementById('mvmtResultsEmpty');

    const modeLabels = { aviation: 'Aircraft', maritime: 'Vessel', radio: 'Radio Feed' };
    title.textContent = `${modeLabels[mode]} Results`;

    container.innerHTML = `<div class="comp-empty">
      <strong>${modeLabels[mode]} search for "${query}"</strong><br>
      Provider integration pending. When connected, this will show:<br><br>
      ${mode === 'aviation' ? '• Tail number, operator, aircraft type<br>• Current position, altitude, speed<br>• Origin → Destination route<br>• Flight history timeline' : ''}
      ${mode === 'maritime' ? '• Vessel name, IMO, MMSI, flag state<br>• Current position, heading, speed<br>• Port calls and voyage history<br>• Ownership chain' : ''}
      ${mode === 'radio' ? '• Feed name, frequency, location<br>• Coverage radius on map<br>• Live stream link<br>• Archive search' : ''}
    </div>`;
  }

  // ── KG Actions (stubs) ──
  document.getElementById('mvmtAddToKg')?.addEventListener('click', async () => {
    if (!selectedItem) return;
    try {
      await browser.runtime.sendMessage({
        action: 'extractAndUpsert',
        text: selectedItem.name || selectedItem.query,
        pageUrl: `movement:${currentMode}:${selectedItem.id || ''}`,
        pageTitle: `Movement — ${selectedItem.name || ''}`
      });
      const btn = document.getElementById('mvmtAddToKg');
      btn.textContent = 'Added!';
      setTimeout(() => { btn.textContent = 'Add to KG'; }, 2000);
    } catch (e) { console.warn(e); }
  });

  // ── Watchlist persistence ──
  async function loadWatchlist() {
    const { mvmtWatchlist = [] } = await browser.storage.local.get({ mvmtWatchlist: [] });
    watchlist = mvmtWatchlist;
    renderWatchlist();
  }

  function renderWatchlist() {
    const container = document.getElementById('mvmtWatchlist');
    if (!watchlist.length) {
      container.innerHTML = '<div class="comp-empty">No tracked aircraft or vessels. Use "Watch" on search results to add items here.</div>';
      return;
    }
    container.innerHTML = watchlist.map(w => `
      <div class="mvmt-watch-item">
        <span class="mvmt-watch-icon">${w.mode === 'aviation' ? '✈' : w.mode === 'maritime' ? '🚢' : '📻'}</span>
        <span class="mvmt-watch-name">${w.name || w.id}</span>
        <span class="mvmt-watch-mode">${w.mode}</span>
        <button class="pill-chip mvmt-unwatch" data-id="${w.id}" style="font-size:8px;padding:1px 6px;">Remove</button>
      </div>
    `).join('');

    container.querySelectorAll('.mvmt-unwatch').forEach(btn => {
      btn.addEventListener('click', async () => {
        watchlist = watchlist.filter(w => w.id !== btn.dataset.id);
        await browser.storage.local.set({ mvmtWatchlist: watchlist });
        renderWatchlist();
      });
    });
  }

  // ── AI Chat ──
  function refreshChatContext() {
    if (typeof ArgusChat === 'undefined') return;
    const lines = [`Movement Intelligence — Mode: ${currentMode}\n`];
    if (searchResults.length) {
      lines.push(`Search results: ${searchResults.length}`);
    }
    if (watchlist.length) {
      lines.push(`\nWatchlist (${watchlist.length}):`);
      watchlist.forEach(w => lines.push(`- ${w.name || w.id} (${w.mode})`));
    }
    ArgusChat.updateContext(lines.join('\n'));
  }

  // ── Init ──
  async function init() {
    initMap();
    await loadWatchlist();

    if (typeof ArgusChat !== 'undefined') {
      ArgusChat.init({
        container: document.getElementById('argus-chat-container'),
        contextType: 'Movement Intelligence',
        contextData: `Movement tracking page. Mode: ${currentMode}. Providers: OpenSky, ADS-B Exchange, MarineTraffic, Broadcastify.`,
        pageUrl: window.location.href,
        pageTitle: 'Movement — Argus Intelligence'
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
