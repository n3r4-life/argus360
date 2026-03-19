// plugins/wigle-wifi.js
// REAL plugin wrapper for WiGLE WiFi network overlay
// Uses the existing intelligence-providers.js WiGLE integration via intelSearch message
// Renders on the satellite page's Leaflet map when available, otherwise returns data

window.ArgusPluginRegistry.registerPlugin({
    id: 'wigle-wifi',
    name: 'WiGLE WiFi',
    version: '2.0',
    category: 'osint',
    requires: ['kg'],

    // Track state for cleanup
    _markers: [],
    _map: null,

    init: async function(context) {
        // Check if WiGLE credentials are configured
        try {
            var status = await browser.runtime.sendMessage({ action: 'intelGetStatus' });
            var wigleStatus = status && status.providers && status.providers.wigle;
            if (wigleStatus && wigleStatus.connected) {
                console.log('[WiGLE Plugin] initialized — credentials configured');
            } else {
                console.log('[WiGLE Plugin] initialized — no credentials (configure in Intel Providers)');
            }
        } catch (e) {
            console.log('[WiGLE Plugin] initialized — status check skipped');
        }
    },

    run: async function(input, context) {
        // Determine bbox: use input if provided, or try to get from satellite map
        var bbox = null;

        if (input && Array.isArray(input) && input.length === 4) {
            // Direct bbox input [west, south, east, north]
            bbox = input;
        } else if (typeof L !== 'undefined' && document.getElementById('satMap')) {
            // On satellite page — get bbox from the live Leaflet map
            var mapEl = document.getElementById('satMap');
            if (mapEl && mapEl._leaflet_id) {
                // Find the map instance
                var maps = Object.values(L.Map._maps || {});
                for (var i = 0; i < maps.length; i++) {
                    if (maps[i].getContainer() === mapEl || maps[i].getContainer().id === 'satMap') {
                        this._map = maps[i];
                        break;
                    }
                }
            }
            if (this._map) {
                var bounds = this._map.getBounds();
                bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
            }
        }

        if (!bbox) {
            return { message: 'WiGLE: no bbox available (open satellite page or provide [west,south,east,north])', entities: [] };
        }

        // Call the real WiGLE integration via background message (same path as satellite page)
        var resp = await browser.runtime.sendMessage({
            action: 'intelSearch',
            provider: 'wigle',
            query: '',
            options: { bbox: bbox, resultsPerPage: 100 }
        });

        if (!resp || !resp.success) {
            var err = (resp && resp.error) || 'WiGLE search failed';
            return { message: 'WiGLE error: ' + err, entities: [] };
        }

        var networks = (resp.results && resp.results.results) || [];

        // If on satellite page with Leaflet, render markers on the map
        if (this._map && typeof L !== 'undefined') {
            this._clearMarkers();
            for (var j = 0; j < networks.length; j++) {
                var n = networks[j];
                if (!n.trilat || !n.trilong) continue;
                var color = n.type === 'BT' ? '#4488ff' : '#44ff88';
                var marker = L.circleMarker([n.trilat, n.trilong], {
                    radius: 5,
                    fillColor: color,
                    fillOpacity: 0.7,
                    color: '#fff',
                    weight: 1
                }).addTo(this._map);
                marker.bindPopup(
                    '<strong>' + (n.ssid || '(hidden)') + '</strong><br>' +
                    'BSSID: ' + (n.netid || '') + '<br>' +
                    'Type: ' + (n.type || 'WIFI') + '<br>' +
                    'Encryption: ' + (n.encryption || '') + '<br>' +
                    'Channel: ' + (n.channel || '') + '<br>' +
                    'Last seen: ' + (n.lastupdt || '')
                );
                this._markers.push(marker);
            }
        }

        // Return entities for KG integration
        var entities = networks.map(function(n) {
            return {
                type: 'wifi-network',
                name: n.ssid || n.netid || '(hidden)',
                lat: n.trilat,
                lon: n.trilong,
                bssid: n.netid,
                encryption: n.encryption,
                channel: n.channel,
                networkType: n.type,
                lastSeen: n.lastupdt
            };
        });

        return {
            message: 'WiGLE: ' + networks.length + ' networks found' + (resp.results && resp.results.totalResults ? ' (' + resp.results.totalResults + ' total)' : ''),
            entities: entities
        };
    },

    cleanup: async function() {
        this._clearMarkers();
        this._map = null;
        console.log('[WiGLE Plugin] cleaned up');
    },

    _clearMarkers: function() {
        if (this._map) {
            for (var i = 0; i < this._markers.length; i++) {
                try { this._map.removeLayer(this._markers[i]); } catch (e) {}
            }
        }
        this._markers = [];
    }
});
