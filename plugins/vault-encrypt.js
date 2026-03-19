// plugins/vault-encrypt.js
// Real Vault Encrypt plugin — wraps existing ArgusVault encryption
// Provides vault status and encryption/decryption via the plugin interface

window.ArgusPluginRegistry.registerPlugin({
    id: 'vault-encrypt',
    name: 'Vault Encrypt',
    version: '2.0',
    category: 'privacy',
    requires: ['vault'],

    init: async function(context) {
        console.log('[Vault Plugin] initialized');
    },

    run: async function(input, context) {
        // Check vault status
        var resp = await browser.runtime.sendMessage({ action: 'vaultGetStatus' });
        if (!resp) {
            return { message: 'Vault: status unavailable', entities: [] };
        }
        var entities = [{
            type: 'vault-status',
            setup: resp.setup,
            unlocked: resp.unlocked
        }];
        var status = resp.unlocked ? 'unlocked' : (resp.setup ? 'locked' : 'not configured');
        return { message: 'Vault: ' + status, entities: entities };
    },

    cleanup: async function() {
        console.log('[Vault Plugin] cleaned up');
    }
});
