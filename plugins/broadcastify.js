// plugins/broadcastify.js
// Real Broadcastify plugin — wraps existing RadioReference/Broadcastify integration
// Toggle already exists on satellite page Settings tab
// This plugin provides the registry wrapper for the per-page plugin panel (future)

window.ArgusPluginRegistry.registerPlugin({
    id: 'broadcastify',
    name: 'Broadcastify',
    version: '2.0',
    category: 'monitors',
    requires: [],

    _markers: [],
    _map: null,

    init: async function(context) {
        console.log('[Broadcastify Plugin] initialized — requires RadioReference API key');
    },

    run: async function(input, context) {
        // Get bbox from satellite map if available
        var bbox = null;
        if (typeof L !== 'undefined' && document.getElementById('satMap')) {
            var maps = Object.values(L.Map._maps || {});
            for (var i = 0; i < maps.length; i++) {
                if (maps[i].getContainer().id === 'satMap') {
                    this._map = maps[i];
                    break;
                }
            }
            if (this._map) {
                var bounds = this._map.getBounds();
                bbox = { lat: bounds.getCenter().lat, lon: bounds.getCenter().lng };
            }
        }

        if (!bbox) {
            return { message: 'Broadcastify: no map available', entities: [] };
        }

        var resp = await browser.runtime.sendMessage({
            action: 'intelSearch',
            provider: 'broadcastify',
            query: '',
            options: bbox
        });

        if (!resp || !resp.success) {
            return { message: 'Broadcastify error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }

        var feeds = (resp.results && resp.results.feeds) || [];
        var entities = feeds.map(function(f) {
            return { type: 'radio-feed', name: f.descr || f.name, county: f.county, state: f.state, feedId: f.feedId };
        });
        return { message: 'Broadcastify: ' + feeds.length + ' radio feeds', entities: entities };
    },

    cleanup: async function() {
        if (this._map) {
            for (var i = 0; i < this._markers.length; i++) {
                try { this._map.removeLayer(this._markers[i]); } catch(e) {}
            }
        }
        this._markers = [];
        this._map = null;
        console.log('[Broadcastify Plugin] cleaned up');
    }
});
