// plugins/sec-edgar.js
// Real SEC EDGAR plugin — wraps intelligence-providers.js SEC integration
// For use on finance/compliance pages — free, no API key required

window.ArgusPluginRegistry.registerPlugin({
    id: 'sec-edgar',
    name: 'SEC EDGAR',
    version: '2.0',
    category: 'finance',
    requires: [],

    init: async function(context) {
        console.log('[SEC EDGAR Plugin] initialized — free, no API key required');
    },

    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({
            action: 'intelSearch',
            provider: 'secedgar',
            query: query,
            options: {}
        });
        if (!resp || !resp.success) {
            return { message: 'SEC EDGAR error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        var results = resp.results || {};
        var filings = results.filings || results.hits || [];
        var entities = Array.isArray(filings) ? filings.map(function(f) {
            return { type: 'filing', company: f.entity_name || f.company, form: f.form_type || f.form, date: f.file_date || f.date, url: f.url };
        }) : [];
        return { message: 'SEC EDGAR: ' + entities.length + ' filings', entities: entities };
    },

    cleanup: async function() {
        console.log('[SEC EDGAR Plugin] cleaned up');
    }
});
