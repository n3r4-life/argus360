// plugins/chat-xmpp.js
// Real Chat XMPP plugin — wraps XMPP chat connection for messaging
window.ArgusPluginRegistry.registerPlugin({
    id: 'chat-xmpp',
    name: 'Chat XMPP',
    version: '2.0',
    category: 'communication',
    requires: ['vault'],
    init: async function(context) { console.log('[Chat XMPP Plugin] initialized'); },
    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'xmppGetStatus' });
        if (!resp) return { message: 'XMPP: unavailable', entities: [] };
        return { message: 'XMPP: ' + (resp.connected ? 'connected as ' + resp.jid : 'disconnected'), entities: [{ type: 'xmpp-status', connected: resp.connected, jid: resp.jid }] };
    },
    cleanup: async function() { console.log('[Chat XMPP Plugin] cleaned up'); }
});
