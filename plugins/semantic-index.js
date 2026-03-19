// plugins/semantic-index.js
// Real Semantic Index plugin — wraps KG search for entity cross-referencing
window.ArgusPluginRegistry.registerPlugin({
    id: 'semantic-index',
    name: 'Semantic Index',
    version: '2.0',
    category: 'osint',
    requires: [],
    init: async function(context) { console.log('[Semantic Index Plugin] initialized'); },
    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({ action: 'searchKGNodes', query: query });
        if (!resp || !resp.success) return { message: 'Semantic error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var nodes = resp.nodes || [];
        return { message: 'Semantic Index: ' + nodes.length + ' KG nodes', entities: nodes };
    },
    cleanup: async function() { console.log('[Semantic Index Plugin] cleaned up'); }
});
