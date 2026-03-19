// plugins/bookmarks-smart.js
// Real Smart Bookmarks plugin — wraps existing bookmark management
// For use on bookmarks page (bookmarks/bookmarks.js)

window.ArgusPluginRegistry.registerPlugin({
    id: 'bookmarks-smart',
    name: 'Smart Bookmarks',
    version: '2.0',
    category: 'bookmarks',
    requires: [],

    init: async function(context) {
        console.log('[Bookmarks Plugin] initialized');
    },

    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'getBookmarks' });
        if (!resp || !resp.success) {
            return { message: 'Bookmarks error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        var bookmarks = resp.bookmarks || [];
        var entities = bookmarks.map(function(b) {
            return { type: 'bookmark', title: b.title, url: b.url, tags: b.tags, folder: b.folder, ts: b.ts };
        });
        return { message: 'Bookmarks: ' + bookmarks.length + ' saved', entities: entities };
    },

    cleanup: async function() {
        console.log('[Bookmarks Plugin] cleaned up');
    }
});
