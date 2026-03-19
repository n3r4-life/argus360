// plugins/event-bus.js
// Real Event Bus plugin — wraps digest/trend detection for project events
window.ArgusPluginRegistry.registerPlugin({
    id: 'event-bus',
    name: 'Event Bus',
    version: '2.0',
    category: 'productivity',
    requires: [],
    init: async function(context) { console.log('[Event Bus Plugin] initialized'); },
    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'detectTrends' });
        if (!resp || !resp.success) return { message: 'Event Bus error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var trends = resp.trends || [];
        return { message: 'Event Bus: ' + trends.length + ' trends detected', entities: trends };
    },
    cleanup: async function() { console.log('[Event Bus Plugin] cleaned up'); }
});
