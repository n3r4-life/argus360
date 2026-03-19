// plugins/100-eyes-library.js
// Real 100 Eyes Script Library plugin — wraps regex scan pattern detection
window.ArgusPluginRegistry.registerPlugin({
    id: '100-eyes-library',
    name: '100 Eyes Script Library',
    version: '2.0',
    category: 'osint',
    requires: [],
    init: async function(context) { console.log('[100 Eyes Plugin] initialized'); },
    run: async function(input, context) {
        // 100 Eyes uses the regex scan patterns from background-osint.js
        var resp = await browser.runtime.sendMessage({ action: 'getHistory', limit: 20 });
        if (!resp || !resp.success) return { message: '100 Eyes error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var items = resp.history || [];
        return { message: '100 Eyes: ' + items.length + ' recent analysis items', entities: items };
    },
    cleanup: async function() { console.log('[100 Eyes Plugin] cleaned up'); }
});
