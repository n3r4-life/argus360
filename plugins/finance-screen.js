// plugins/finance-screen.js
// Real Finance Screening plugin — wraps existing finance price refresh + watchlist
// For use on finance page (finance/finance.js)

window.ArgusPluginRegistry.registerPlugin({
    id: 'finance-screen',
    name: 'Finance Screening',
    version: '2.0',
    category: 'finance',
    requires: [],

    init: async function(context) {
        console.log('[Finance Plugin] initialized');
    },

    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'financeGetState' });
        if (!resp || !resp.success) {
            return { message: 'Finance error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        var watchlist = resp.watchlist || [];
        var entities = watchlist.map(function(w) {
            return { type: 'finance-item', symbol: w.symbol, name: w.name, price: w.price, change: w.change };
        });
        return { message: 'Finance: ' + watchlist.length + ' watchlist items', entities: entities };
    },

    cleanup: async function() {
        console.log('[Finance Plugin] cleaned up');
    }
});
