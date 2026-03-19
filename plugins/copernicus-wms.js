// plugins/copernicus-wms.js
// Real Copernicus WMS plugin — wraps Sentinel Hub WMS tile layer
// Provides WMS URL generation for Leaflet tile layers on the satellite page

window.ArgusPluginRegistry.registerPlugin({
    id: 'copernicus-wms',
    name: 'Copernicus WMS',
    version: '2.0',
    category: 'location',
    requires: [],

    init: async function(context) {
        console.log('[Copernicus WMS Plugin] initialized');
    },

    run: async function(input, context) {
        // Check if Sentinel Hub is configured — WMS needs instanceId
        var resp = await browser.runtime.sendMessage({ action: 'intelGetStatus' });
        var shStatus = resp && resp.providers && resp.providers.sentinelhub;
        if (!shStatus || !shStatus.connected) {
            return { message: 'Copernicus WMS: Sentinel Hub not configured', entities: [] };
        }
        // Get the WMS URL from the provider
        var cfg = null;
        try {
            var s = await browser.storage.local.get('argusIntelProviders');
            cfg = s.argusIntelProviders && s.argusIntelProviders.sentinelhub;
        } catch(e) {}
        if (!cfg || !cfg.instanceId) {
            return { message: 'Copernicus WMS: no instance ID configured', entities: [] };
        }
        var wmsUrl = 'https://sh.dataspace.copernicus.eu/ogc/wms/' + cfg.instanceId;
        return {
            message: 'Copernicus WMS ready: ' + wmsUrl,
            entities: [{ type: 'wms-endpoint', url: wmsUrl, provider: 'sentinelhub' }]
        };
    },

    cleanup: async function() {
        console.log('[Copernicus WMS Plugin] cleaned up');
    }
});
