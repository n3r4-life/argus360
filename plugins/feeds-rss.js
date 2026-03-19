// plugins/feeds-rss.js
// Real Feeds RSS plugin — wraps existing feed management
// For use on the Feeds page (feeds/feeds.js)

window.ArgusPluginRegistry.registerPlugin({
    id: 'feeds-rss',
    name: 'Feeds RSS',
    version: '2.0',
    category: 'feeds',
    requires: [],

    init: async function(context) {
        console.log('[Feeds Plugin] initialized');
    },

    run: async function(input, context) {
        // Get all feeds via existing message handler
        var resp = await browser.runtime.sendMessage({
            action: 'getFeeds'
        });
        if (!resp || !resp.success) {
            return { message: 'Feeds error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        var feeds = resp.feeds || [];
        var entities = feeds.map(function(f) {
            return { type: 'feed', title: f.title, url: f.url, lastRefresh: f.lastRefresh, unreadCount: f.unreadCount };
        });
        return { message: 'Feeds: ' + feeds.length + ' subscriptions', entities: entities };
    },

    cleanup: async function() {
        console.log('[Feeds Plugin] cleaned up');
    }
});
