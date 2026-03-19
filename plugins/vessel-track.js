// plugins/vessel-track.js
// Real Vessel Tracking plugin — wraps intelligence-providers.js VesselFinder/MarineTraffic
// For use on movement page (intel/movement.js) and satellite page overlay

window.ArgusPluginRegistry.registerPlugin({
    id: 'vessel-track',
    name: 'Vessel Tracking',
    version: '2.0',
    category: 'location',
    requires: [],

    _markers: [],
    _map: null,

    init: async function(context) {
        console.log('[Vessel Plugin] initialized');
    },

    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({
            action: 'intelSearch',
            provider: 'vesselfinder',
            query: query,
            options: {}
        });
        if (!resp || !resp.success) {
            return { message: 'Vessel error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        var vessels = resp.results || [];
        var entities = (Array.isArray(vessels) ? vessels : []).map(function(v) {
            return { type: 'vessel', name: v.name || v.SHIPNAME, imo: v.imo || v.IMO, mmsi: v.mmsi || v.MMSI, lat: v.lat || v.LAT, lon: v.lon || v.LON };
        });
        return { message: 'Vessels: ' + entities.length + ' tracked', entities: entities };
    },

    cleanup: async function() {
        if (this._map) {
            for (var i = 0; i < this._markers.length; i++) {
                try { this._map.removeLayer(this._markers[i]); } catch(e) {}
            }
        }
        this._markers = [];
        this._map = null;
        console.log('[Vessel Plugin] cleaned up');
    }
});
