// plugins/kg-prune.js
// Real KG Prune plugin — wraps existing Knowledge Graph pruning
// Triggers pruneOldEntities via background message handler

window.ArgusPluginRegistry.registerPlugin({
    id: 'kg-prune',
    name: 'KG Prune',
    version: '2.0',
    category: 'kg',
    requires: [],

    init: async function(context) {
        console.log('[KG Prune Plugin] initialized');
    },

    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'pruneKGNoise' });
        if (!resp || !resp.success) {
            return { message: 'KG prune error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        return { message: 'KG prune complete — ' + (resp.pruned || 0) + ' entities removed', entities: [] };
    },

    cleanup: async function() {
        console.log('[KG Prune Plugin] cleaned up');
    }
});
