// plugins/govintel-feature.js
// Real GovIntel plugin — wraps sanctions + court records for government intelligence
window.ArgusPluginRegistry.registerPlugin({
    id: 'govintel-feature',
    name: 'GovIntel Feature',
    version: '2.0',
    category: 'govintel',
    requires: [],
    init: async function(context) { console.log('[GovIntel Plugin] initialized'); },
    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({ action: 'intelSearch', provider: 'opensanctions', query: query, options: {} });
        if (!resp || !resp.success) return { message: 'GovIntel error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var results = (resp.results && resp.results.results) || [];
        return { message: 'GovIntel: ' + results.length + ' matches', entities: results };
    },
    cleanup: async function() { console.log('[GovIntel Plugin] cleaned up'); }
});
