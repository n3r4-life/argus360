// plugins/sanctions-screen.js
// Real Sanctions Screening plugin — wraps intelligence-providers.js OpenSanctions
window.ArgusPluginRegistry.registerPlugin({
    id: 'sanctions-screen',
    name: 'Sanctions Screening',
    version: '2.0',
    category: 'govintel',
    requires: ['vault'],
    init: async function(context) { console.log('[Sanctions Plugin] initialized'); },
    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({ action: 'intelSearch', provider: 'opensanctions', query: query, options: {} });
        if (!resp || !resp.success) return { message: 'Sanctions error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var results = (resp.results && resp.results.results) || [];
        var entities = results.map(function(r) { return { type: 'sanctions-match', name: r.caption || r.name, score: r.score, schema: r.schema, datasets: r.datasets }; });
        return { message: 'Sanctions: ' + results.length + ' matches', entities: entities };
    },
    cleanup: async function() { console.log('[Sanctions Plugin] cleaned up'); }
});
