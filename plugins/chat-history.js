// plugins/chat-history.js
// Real Chat History plugin — wraps existing chat session management
// For use on chat page (chat/chat.js)

window.ArgusPluginRegistry.registerPlugin({
    id: 'chat-history',
    name: 'Chat History',
    version: '1.0',
    category: 'communication',
    requires: [],

    init: async function(context) {
        console.log('[Chat History Plugin] initialized');
    },

    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'chatGetSessions' });
        if (!resp || !resp.success) {
            return { message: 'Chat history error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        }
        var sessions = resp.sessions || [];
        var entities = sessions.map(function(s) {
            return { type: 'chat-session', id: s.id, title: s.title, provider: s.provider, messageCount: s.messages ? s.messages.length : 0, ts: s.ts };
        });
        return { message: 'Chat: ' + sessions.length + ' sessions', entities: entities };
    },

    cleanup: async function() {
        console.log('[Chat History Plugin] cleaned up');
    }
});
