// plugins/opensky-track.js
// Real OpenSky Aircraft Tracking plugin — wraps existing intelligence-providers.js OpenSky integration
// Uses intelSearch message path (same as movement page), renders on satellite Leaflet map
// Toggle in Settings tab, same pattern as WiGLE

window.ArgusPluginRegistry.registerPlugin({
    id: 'opensky-track',
    name: 'OpenSky Aircraft Tracking',
    version: '2.0',
    category: 'location',
    requires: [],

    _markers: [],
    _map: null,

    init: async function(context) {
        try {
            var status = await browser.runtime.sendMessage({ action: 'intelGetStatus' });
            var osStatus = status && status.providers && status.providers.opensky;
            if (osStatus && osStatus.connected) {
                console.log('[OpenSky Plugin] initialized — credentials configured');
            } else {
                console.log('[OpenSky Plugin] initialized — anonymous mode (limited)');
            }
        } catch (e) {
            console.log('[OpenSky Plugin] initialized');
        }
    },

    run: async function(input, context) {
        // Get bbox from satellite map if available
        var bbox = null;
        if (input && input.lamin != null) {
            bbox = input; // direct bbox params
        } else if (typeof L !== 'undefined' && document.getElementById('satMap')) {
            var mapEl = document.getElementById('satMap');
            if (mapEl) {
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
                bbox = {
                    lamin: bounds.getSouth(),
                    lamax: bounds.getNorth(),
                    lomin: bounds.getWest(),
                    lomax: bounds.getEast()
                };
            }
        }

        if (!bbox) {
            return { message: 'OpenSky: no map available', entities: [] };
        }

        // Call real OpenSky via background intelSearch
        var resp = await browser.runtime.sendMessage({
            action: 'intelSearch',
            provider: 'opensky',
            query: '',
            options: bbox
        });

        if (!resp || !resp.success) {
            var err = (resp && resp.error) || 'OpenSky search failed';
            return { message: 'OpenSky error: ' + err, entities: [] };
        }

        var states = (resp.results && resp.results.states) || [];

        // Render on satellite map if available
        if (this._map && typeof L !== 'undefined') {
            this._clearMarkers();
            for (var j = 0; j < states.length; j++) {
                var s = states[j];
                var lon = s[5], lat = s[6];
                if (!lat || !lon) continue;
                var callsign = (s[1] || '').trim() || 'Unknown';
                var altitude = s[7] != null ? Math.round(s[7]) + 'm' : '?';
                var velocity = s[9] != null ? Math.round(s[9]) + 'm/s' : '?';
                var hdg = s[10];
                var heading = hdg != null ? Math.round(hdg) + '°' : '?';
                var onGround = s[8];
                var color = onGround ? '#888888' : '#ff9800';
                var sz = onGround ? 16 : 22;
                var rotation = hdg != null ? Math.round(hdg) : 0;

                var icon = L.divIcon({
                    className: 'sat-aircraft-icon',
                    html: '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="' + color + '" stroke="#fff" stroke-width="0.8" style="transform:rotate(' + rotation + 'deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6));">' +
                      '<path d="M12 2L10 8H4L3 10L10 12.5V18L7 20V22L12 21L17 22V20L14 18V12.5L21 10L20 8H14L12 2Z"/>' +
                    '</svg>',
                    iconSize: [sz, sz],
                    iconAnchor: [sz / 2, sz / 2],
                });

                var marker = L.marker([lat, lon], { icon: icon }).addTo(this._map);
                marker.bindPopup(
                    '<strong>' + callsign + '</strong><br>' +
                    'ICAO24: ' + (s[0] || '') + '<br>' +
                    'Alt: ' + altitude + ' · Speed: ' + velocity + '<br>' +
                    'Heading: ' + heading + ' · ' + (onGround ? 'On Ground' : 'Airborne') + '<br>' +
                    'Origin: ' + (s[2] || '?')
                );
                this._markers.push(marker);
            }
        }

        // Return entities for KG
        var entities = states.map(function(s) {
            return {
                type: 'aircraft',
                callsign: (s[1] || '').trim(),
                icao24: s[0],
                lat: s[6],
                lon: s[5],
                altitude: s[7],
                velocity: s[9],
                heading: s[10],
                onGround: s[8],
                origin: s[2]
            };
        });

        return {
            message: 'OpenSky: ' + states.length + ' aircraft in view',
            entities: entities
        };
    },

    cleanup: async function() {
        this._clearMarkers();
        this._map = null;
        console.log('[OpenSky Plugin] cleaned up');
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
