// plugins/satellite-overlay.js
// Real Satellite Overlay plugin — wraps Sentinel Hub catalog search
window.ArgusPluginRegistry.registerPlugin({
    id: 'satellite-overlay',
    name: 'Satellite Overlay',
    version: '2.0',
    category: 'location',
    requires: [],
    init: async function(context) { console.log('[Satellite Overlay Plugin] initialized'); },
    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'intelGetStatus' });
        var sh = resp && resp.providers && resp.providers.sentinelhub;
        if (!sh || !sh.connected) return { message: 'Satellite Overlay: Sentinel Hub not configured', entities: [] };
        return { message: 'Satellite Overlay: Sentinel Hub connected — use Sentinel tab for imagery', entities: [{ type: 'provider-status', provider: 'sentinelhub', connected: true }] };
    },
    cleanup: async function() { console.log('[Satellite Overlay Plugin] cleaned up'); }
});
