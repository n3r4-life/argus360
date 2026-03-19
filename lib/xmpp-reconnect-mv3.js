// lib/xmpp-reconnect-mv3.js
// MV3 XMPP reconnection helper for service worker lifecycle
// WebSocket connections die when SW unloads. This helper:
// - Attempts reconnect on SW wake-up if XMPP was previously connected
// - Uses alarms for keep-alive pings
// - Stores connection intent in storage.local so reconnect knows to try
//
// Does NOT modify xmpp-client.js or the existing connection code in background.js.
// Works alongside the existing _xmppWs / handleXmppTestConnection pattern.

var ArgusMV3XmppReconnect = {
    // Save that we intend to stay connected
    markConnected: async function() {
        await browser.storage.local.set({ _xmppWasConnected: true });
    },

    markDisconnected: async function() {
        await browser.storage.local.set({ _xmppWasConnected: false });
    },

    // Try to reconnect if we were previously connected
    tryReconnect: async function() {
        try {
            var result = await browser.storage.local.get({ _xmppWasConnected: false });
            if (!result._xmppWasConnected) return;

            // Check if already connected
            if (typeof _xmppWs !== 'undefined' && _xmppWs && _xmppWs.readyState === WebSocket.OPEN) return;

            // Use the existing handleXmppTestConnection from background.js
            if (typeof handleXmppTestConnection === 'function') {
                var status = await handleXmppTestConnection();
                if (status.success) {
                    console.log('[XMPP-MV3] Reconnected after SW wake-up');
                } else {
                    console.warn('[XMPP-MV3] Reconnect failed:', status.error);
                }
            }
        } catch (e) {
            console.warn('[XMPP-MV3] Reconnect error:', e.message);
        }
    }
};
