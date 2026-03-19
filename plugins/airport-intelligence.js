// plugins/airport-intelligence.js
// Real Airport Intelligence plugin — wraps FlightAware + aircraft lookup
window.ArgusPluginRegistry.registerPlugin({
    id: 'airport-intelligence',
    name: 'Airport Intelligence',
    version: '2.0',
    category: 'govintel',
    requires: [],
    init: async function(context) { console.log('[Airport Intel Plugin] initialized'); },
    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({ action: 'flightawareSearch', query: query, options: {} });
        if (!resp || !resp.success) return { message: 'Airport error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var flights = resp.flights || [];
        return { message: 'Airport Intel: ' + flights.length + ' flights', entities: flights };
    },
    cleanup: async function() { console.log('[Airport Intel Plugin] cleaned up'); }
});
