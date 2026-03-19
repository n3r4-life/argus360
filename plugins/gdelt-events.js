// plugins/gdelt-events.js
// Real GDELT Events plugin — wraps intelligence-providers.js GDELT integration
// For use on the Events page (intel/events.js) — timeline, tone, geo analysis

window.ArgusPluginRegistry.registerPlugin({
    id: 'gdelt-events',
    name: 'GDELT Events',
    version: '2.0',
    category: 'osint',
    requires: [],

    init: async function(context) {
        console.log('[GDELT Plugin] initialized — free, no API key required');
    },

    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({
            action: 'intelSearch',
            provider: 'gdelt',
            query: query,
            options: {}
        });
        if (!resp || !resp.success) {
            return { message: 'GDELT error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        var articles = (resp.results && resp.results.articles) || [];
        var entities = articles.map(function(a) {
            return { type: 'event', title: a.title, url: a.url, source: a.domain, date: a.seendate, tone: a.tone };
        });
        return { message: 'GDELT: ' + articles.length + ' events', entities: entities };
    },

    cleanup: async function() {
        console.log('[GDELT Plugin] cleaned up');
    }
});
