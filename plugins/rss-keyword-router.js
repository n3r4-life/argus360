// plugins/rss-keyword-router.js
// Real RSS Keyword Router plugin — wraps existing feed routing/rescan logic
// For use on feeds page — routes entries by keyword match

window.ArgusPluginRegistry.registerPlugin({
    id: 'rss-keyword-router',
    name: 'RSS Keyword Router',
    version: '2.0',
    category: 'feeds',
    requires: [],

    init: async function(context) {
        console.log('[RSS Router Plugin] initialized');
    },

    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'feedRouteRescan' });
        if (!resp || !resp.success) {
            return { message: 'RSS Router error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        var routed = resp.routed || 0;
        return { message: 'RSS Router: ' + routed + ' entries routed by keyword', entities: [] };
    },

    cleanup: async function() {
        console.log('[RSS Router Plugin] cleaned up');
    }
});
