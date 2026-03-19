// plugins/sanctions-v2.js
// Sanctions Screening v2 — same as sanctions-screen but with enrichment
window.ArgusPluginRegistry.registerPlugin({
    id: 'sanctions-v2',
    name: 'Sanctions Screening v2',
    version: '2.0',
    category: 'govintel',
    requires: ['vault'],
    init: async function(context) { console.log('[Sanctions v2 Plugin] initialized'); },
    run: async function(input, context) {
        var query = (typeof input === 'string') ? input : '';
        var resp = await browser.runtime.sendMessage({ action: 'intelScreenAll' });
        if (!resp || !resp.success) return { message: 'Sanctions v2 error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var screened = resp.results || [];
        return { message: 'Sanctions v2: ' + (Array.isArray(screened) ? screened.length : 0) + ' entities screened', entities: Array.isArray(screened) ? screened : [] };
    },
    cleanup: async function() { console.log('[Sanctions v2 Plugin] cleaned up'); }
});
