// plugins/xmpp-router.js
// Real XMPP Router plugin — wraps XMPP message routing + SMS gateway
window.ArgusPluginRegistry.registerPlugin({
    id: 'xmpp-router',
    name: 'XMPP Router',
    version: '2.0',
    category: 'communication',
    requires: ['vault'],
    init: async function(context) { console.log('[XMPP Router Plugin] initialized'); },
    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'xmppGetConfig' });
        if (!resp) return { message: 'XMPP Router: config unavailable', entities: [] };
        return { message: 'XMPP Router: ' + (resp.configured ? 'gateway configured' : 'not configured'), entities: [{ type: 'xmpp-config', configured: resp.configured, gateway: resp.gateway, country: resp.country }] };
    },
    cleanup: async function() { console.log('[XMPP Router Plugin] cleaned up'); }
});
