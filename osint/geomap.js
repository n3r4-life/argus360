(function () {
  'use strict';

  /* ---- Constants ---- */
  const TYPE_COLORS = {
    location:     '#4caf50',
    organization: '#64b5f6',
    ip:           '#ffb74d'
  };

  const MIN_RADIUS = 6;
  const MAX_RADIUS = 20;

  /* ---- State ---- */
  let map = null;
  let allLocations = [];
  let markers = [];
  let visibleTypes = new Set(Object.keys(TYPE_COLORS));
  let activeLocationName = null;

  /* ---- Data loading ---- */
  function getProjectId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('project');
  }

  function loadData() {
    const projectId = getProjectId();
    if (!projectId) {
      showEmpty('No project specified. Open this page from a project.');
      hideLoading();
      return;
    }

    showLoading('Loading location data...');

    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage({ action: 'buildGeomap', projectId })
        .then(handleResponse)
        .catch(err => {
          console.error('Geomap load error:', err);
          showEmpty('Failed to load location data: ' + err.message);
          hideLoading();
        });
    } else {
      // Demo/fallback
      handleResponse(demoData());
    }
  }

  function handleResponse(response) {
    hideLoading();

    if (!response || !response.success) {
      showEmpty(response && response.error ? response.error : 'Failed to load location data.');
      return;
    }

    if (response.projectName) {
      document.getElementById('projectName').textContent = response.projectName;
    }

    allLocations = response.locations || [];

    if (allLocations.length === 0) {
      showEmpty();
      return;
    }

    updateStats();
    renderMarkers();
    renderPanel();
    fitMapBounds();

    const summary = allLocations.slice(0, 60).map(l =>
      `- ${l.name || l.text} (${l.type || "location"})${l.lat ? " [" + l.lat + ", " + l.lon + "]" : ""}${l.source ? " — " + l.source : ""}`
    ).join("\n");
    ArgusChat.init({
      container: document.getElementById("argus-chat-container"),
      contextType: "Geolocation Map",
      contextData: `Locations for project "${response.projectName || "Unknown"}" (${allLocations.length} total):\n${summary}`,
      pageTitle: response.projectName
    });
  }

  function demoData() {
    return {
      success: true,
      projectName: 'Demo Project',
      locations: [
        { name: 'New York', type: 'location', lat: 40.7128, lng: -74.0060, mentions: 8, sources: [{ title: 'Article about NYC events', url: 'https://example.com/article1' }, { title: 'NYC Business Report', url: 'https://example.com/article2' }] },
        { name: 'London', type: 'location', lat: 51.5074, lng: -0.1278, mentions: 5, sources: [{ title: 'London Tech Scene', url: 'https://example.com/article3' }] },
        { name: 'Acme Corp HQ', type: 'organization', lat: 37.7749, lng: -122.4194, mentions: 3, sources: [{ title: 'Company Profile', url: 'https://example.com/company1' }] },
        { name: 'Tokyo', type: 'location', lat: 35.6762, lng: 139.6503, mentions: 4, sources: [{ title: 'Asia Pacific Report', url: 'https://example.com/article4' }] },
        { name: 'Berlin', type: 'location', lat: 52.5200, lng: 13.4050, mentions: 2, sources: [{ title: 'EU Regulation Update', url: 'https://example.com/article5' }] },
        { name: '192.168.1.1', type: 'ip', lat: 47.6062, lng: -122.3321, mentions: 1, sources: [{ title: 'Network Scan Results', url: 'https://example.com/scan1' }] },
        { name: 'Sydney', type: 'location', lat: -33.8688, lng: 151.2093, mentions: 3, sources: [{ title: 'APAC Overview', url: 'https://example.com/article6' }] },
        { name: 'Washington DC', type: 'location', lat: 38.9072, lng: -77.0369, mentions: 6, sources: [{ title: 'Policy Briefing', url: 'https://example.com/article7' }, { title: 'Regulatory Filing', url: 'https://example.com/filing1' }] }
      ]
    };
  }

  /* ---- Map ---- */
  function initMap() {
    map = L.map('map', {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
  }

  function renderMarkers() {
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const maxMentions = Math.max(...allLocations.map(l => l.mentions || 1), 1);

    allLocations.forEach(loc => {
      if (!visibleTypes.has(loc.type)) return;
      if (loc.lat == null || loc.lng == null) return;

      const ratio = (loc.mentions || 1) / maxMentions;
      const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * ratio;
      const color = TYPE_COLORS[loc.type] || TYPE_COLORS.location;

      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: radius,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.5
      }).addTo(map);

      // Build popup content
      const sourcesHtml = (loc.sources || []).map(s =>
        '<li><a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.title || s.url) + '</a></li>'
      ).join('');

      marker.bindPopup(
        '<div class="popup-title">' + escapeHtml(loc.name) + '</div>' +
        '<div class="popup-type">' + escapeHtml(loc.type) + '</div>' +
        '<div class="popup-mentions">' + (loc.mentions || 0) + ' mention' + ((loc.mentions || 0) !== 1 ? 's' : '') + '</div>' +
        (sourcesHtml ? '<ul class="popup-sources">' + sourcesHtml + '</ul>' : '')
      );

      marker._argusLocation = loc;
      markers.push(marker);
    });
  }

  function fitMapBounds() {
    const validMarkers = markers.filter(m => m._argusLocation);
    if (validMarkers.length === 0) return;

    if (validMarkers.length === 1) {
      const loc = validMarkers[0]._argusLocation;
      map.setView([loc.lat, loc.lng], 6);
      return;
    }

    const group = L.featureGroup(validMarkers);
    map.fitBounds(group.getBounds().pad(0.15));
  }

  function panToLocation(loc) {
    if (loc.lat == null || loc.lng == null) return;

    map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 6), { animate: true });

    // Open the corresponding marker popup
    const marker = markers.find(m => m._argusLocation && m._argusLocation.name === loc.name);
    if (marker) {
      marker.openPopup();
    }
  }

  /* ---- Side panel ---- */
  function renderPanel() {
    const list = document.getElementById('locationList');
    list.innerHTML = '';

    const filtered = allLocations
      .filter(l => visibleTypes.has(l.type) && l.lat != null && l.lng != null)
      .sort((a, b) => (b.mentions || 0) - (a.mentions || 0));

    if (filtered.length === 0) {
      list.textContent = "";
      const noMatch = document.createElement("li");
      noMatch.style.cssText = "padding:16px;color:var(--text-secondary);font-size:13px;text-align:center;";
      noMatch.textContent = "No locations match the current filter.";
      list.appendChild(noMatch);
      return;
    }

    filtered.forEach(loc => {
      const li = document.createElement('li');
      li.className = 'location-item' + (activeLocationName === loc.name ? ' active' : '');

      const nameDiv = document.createElement('div');
      nameDiv.className = 'location-name';
      nameDiv.textContent = loc.name;
      li.appendChild(nameDiv);

      const metaDiv = document.createElement('div');
      metaDiv.className = 'location-meta';

      const typeBadge = document.createElement('span');
      typeBadge.className = 'location-type-badge type-' + loc.type;
      typeBadge.textContent = loc.type;
      metaDiv.appendChild(typeBadge);

      const mentionsSpan = document.createElement('span');
      mentionsSpan.textContent = (loc.mentions || 0) + ' mentions';
      metaDiv.appendChild(mentionsSpan);

      const coordsSpan = document.createElement('span');
      coordsSpan.textContent = (loc.lat || 0).toFixed(2) + ', ' + (loc.lng || 0).toFixed(2);
      metaDiv.appendChild(coordsSpan);

      li.appendChild(metaDiv);

      const sources = (loc.sources || []).slice(0, 3);
      if (sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'location-sources';
        sources.forEach(s => {
          const a = document.createElement('a');
          a.className = 'location-source-link';
          a.setAttribute('href', s.url);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener');
          a.setAttribute('title', s.title || s.url);
          a.textContent = s.title || s.url;
          sourcesDiv.appendChild(a);
        });
        li.appendChild(sourcesDiv);
      }

      li.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') return; // let link clicks pass through
        activeLocationName = loc.name;
        document.querySelectorAll('.location-item').forEach(el => el.classList.remove('active'));
        li.classList.add('active');
        panToLocation(loc);
      });

      list.appendChild(li);
    });
  }

  /* ---- Stats ---- */
  function updateStats() {
    const geocoded = allLocations.filter(l => l.lat != null && l.lng != null);
    const allSources = new Set();
    allLocations.forEach(l => (l.sources || []).forEach(s => allSources.add(s.url)));

    document.getElementById('statFound').textContent = allLocations.length;
    document.getElementById('statGeocoded').textContent = geocoded.length;
    document.getElementById('statSources').textContent = allSources.size;
  }

  /* ---- CSV export ---- */
  function exportCsv() {
    const filtered = allLocations.filter(l => visibleTypes.has(l.type) && l.lat != null && l.lng != null);
    if (filtered.length === 0) return;

    const rows = [['Name', 'Type', 'Latitude', 'Longitude', 'Mentions', 'Sources']];

    filtered.forEach(loc => {
      const sources = (loc.sources || []).map(s => s.url).join('; ');
      rows.push([
        csvEscape(loc.name),
        csvEscape(loc.type),
        String(loc.lat),
        String(loc.lng),
        String(loc.mentions || 0),
        csvEscape(sources)
      ]);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = 'geomap-locations.csv';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function csvEscape(str) {
    if (!str) return '""';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /* ---- UI helpers ---- */
  function showLoading(text) {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    overlay.classList.remove('hidden');
    if (text) loadingText.textContent = text;
    updateGeoStatus('active', text || 'Loading...');
  }

  function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
    updateGeoStatus('done', 'Ready');
  }

  function showEmpty(message) {
    const empty = document.getElementById('emptyState');
    empty.classList.add('visible');
    if (message) {
      empty.querySelector('p').textContent = message;
    }
  }

  function updateGeoStatus(state, text) {
    const dot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    dot.className = 'status-dot ' + (state || '');
    statusText.textContent = text || '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---- Event handlers ---- */
  function setupEvents() {
    // Filter checkboxes
    document.querySelectorAll('.filter-checkbox input').forEach(cb => {
      cb.addEventListener('change', () => {
        const type = cb.dataset.type;
        if (cb.checked) visibleTypes.add(type);
        else visibleTypes.delete(type);
        renderMarkers();
        renderPanel();
        updateStats();
      });
    });

    // Panel toggle
    document.getElementById('togglePanel').addEventListener('click', () => {
      document.getElementById('sidePanel').classList.toggle('open');
    });

    document.getElementById('panelClose').addEventListener('click', () => {
      document.getElementById('sidePanel').classList.remove('open');
    });

    // Export CSV
    document.getElementById('exportCsv').addEventListener('click', exportCsv);

    // Handle map resize when panel toggles
    const observer = new MutationObserver(() => {
      setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    });
    observer.observe(document.getElementById('sidePanel'), { attributes: true, attributeFilter: ['class'] });
  }

  /* ---- Init ---- */
  function init() {
    initMap();
    setupEvents();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
