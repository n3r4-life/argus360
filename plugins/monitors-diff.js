// plugins/monitors-diff.js
// Real Monitors Diff plugin — wraps existing monitor change tracking
// For use on the Monitors page (monitors/monitor-history.js)

window.ArgusPluginRegistry.registerPlugin({
    id: 'monitors-diff',
    name: 'Monitors Diff',
    version: '2.0',
    category: 'monitors',
    requires: [],

    init: async function(context) {
        console.log('[Monitors Plugin] initialized');
    },

    run: async function(input, context) {
        // Get all monitor changes via existing message handler
        var resp = await browser.runtime.sendMessage({
            action: 'getAllMonitorChanges'
        });
        if (!resp || !resp.success) {
            return { message: 'Monitors error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        var changes = resp.changes || [];
        var entities = changes.map(function(c) {
            return { type: 'monitor-change', url: c.url, title: c.title, changeType: c.type, ts: c.ts };
        });
        return { message: 'Monitors: ' + changes.length + ' changes detected', entities: entities };
    },

    cleanup: async function() {
        console.log('[Monitors Plugin] cleaned up');
    }
});
