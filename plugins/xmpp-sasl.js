// plugins/xmpp-sasl.js
// Real XMPP SASL plugin — wraps existing XMPP client connection/auth
// For use on chat page and anywhere XMPP messaging is needed

window.ArgusPluginRegistry.registerPlugin({
    id: 'xmpp-sasl',
    name: 'XMPP SASL',
    version: '2.0',
    category: 'communication',
    requires: ['vault'],

    init: async function(context) {
        console.log('[XMPP Plugin] initialized');
    },

    run: async function(input, context) {
        // Check XMPP connection status
        var resp = await browser.runtime.sendMessage({ action: 'xmppGetStatus' });
        if (!resp) {
            return { message: 'XMPP: status unavailable', entities: [] };
        }
        var entities = [{
            type: 'xmpp-status',
            configured: resp.configured,
            connected: resp.connected,
            jid: resp.jid || ''
        }];
        var status = resp.connected ? 'connected as ' + resp.jid : (resp.configured ? 'configured but disconnected' : 'not configured');
        return { message: 'XMPP: ' + status, entities: entities };
    },

    cleanup: async function() {
        console.log('[XMPP Plugin] cleaned up');
    }
});
