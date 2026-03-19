// plugins/calendar-event-bus.js
// Real Calendar Event Bus plugin — wraps GDELT event timeline analysis
window.ArgusPluginRegistry.registerPlugin({
    id: 'calendar-event-bus',
    name: 'Calendar Event Bus',
    version: '2.0',
    category: 'productivity',
    requires: [],
    init: async function(context) { console.log('[Calendar Plugin] initialized'); },
    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({ action: 'gdeltTimeline', query: query });
        if (!resp || !resp.success) return { message: 'Calendar error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var timeline = resp.timeline || [];
        return { message: 'Calendar: ' + timeline.length + ' timeline entries', entities: timeline };
    },
    cleanup: async function() { console.log('[Calendar Plugin] cleaned up'); }
});
