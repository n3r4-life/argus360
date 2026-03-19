// plugins/ssh-proxy.js
// Real SSH Proxy plugin — wraps existing SSH/WebSocket terminal session management
// For use on SSH page (ssh/ssh.js)

window.ArgusPluginRegistry.registerPlugin({
    id: 'ssh-proxy',
    name: 'SSH Proxy',
    version: '1.0',
    category: 'ssh',
    requires: ['vault'],

    init: async function(context) {
        console.log('[SSH Plugin] initialized');
    },

    run: async function(input, context) {
        // SSH sessions are managed client-side via xterm.js + WebSocket
        // This plugin provides session metadata for the registry
        return {
            message: 'SSH Proxy: ready — sessions managed via xterm.js on the SSH page',
            entities: [{ type: 'ssh-status', ready: true, protocols: ['ttyd', 'raw', 'proxy'] }]
        };
    },

    cleanup: async function() {
        console.log('[SSH Plugin] cleaned up');
    }
});
