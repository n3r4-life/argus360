// plugins/location-intelligence.js
// Real Location Intelligence plugin — wraps geocoding + KG location entities
window.ArgusPluginRegistry.registerPlugin({
    id: 'location-intelligence',
    name: 'Location Intelligence',
    version: '2.0',
    category: 'location',
    requires: [],
    init: async function(context) { console.log('[Location Intel Plugin] initialized'); },
    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({ action: 'searchKGNodes', query: query });
        if (!resp || !resp.success) return { message: 'Location error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var locations = (resp.nodes || []).filter(function(n) { return n.type === 'location'; });
        return { message: 'Location Intel: ' + locations.length + ' locations in KG', entities: locations };
    },
    cleanup: async function() { console.log('[Location Intel Plugin] cleaned up'); }
});
