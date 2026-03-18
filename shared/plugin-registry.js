// shared/plugin-registry.js
// Global namespace version – matches existing Argus style

window.ArgusPluginRegistry = window.ArgusPluginRegistry || {
    plugins: new Map(),
    activePlugins: new Set(),

    registerPlugin: async function(pluginDef) {
        if (!pluginDef.id || typeof pluginDef.run !== 'function') {
            throw new Error('Invalid plugin definition');
        }
        this.plugins.set(pluginDef.id, pluginDef);
        console.log(`✅ Registered plugin: ${pluginDef.name || pluginDef.id}`);

        // Security gate (pro-sec-paul) — register always, but only activate if deps met
        if (pluginDef.requires?.includes('vault') && !window.ArgusVault) {
            console.warn(`Plugin ${pluginDef.id} requires Vault but it is locked — registered but not activated`);
            return true;
        }

        if (await this.isPluginEnabled(pluginDef.id)) {
            await this.activatePlugin(pluginDef.id);
        }
        return true;
    },

    activatePlugin: async function(id) {
        const plugin = this.plugins.get(id);
        if (!plugin || this.activePlugins.has(id)) return false;

        try {
            const context = await window.ArgusPluginContext.getPluginContext();
            await plugin.init?.(context);
            this.activePlugins.add(id);
            browser.runtime.sendMessage({ type: 'PLUGIN_ACTIVATED', id });
            return true;
        } catch (err) {
            console.error(`Plugin ${id} activation failed:`, err);
            return false;
        }
    },

    runPlugin: async function(id, input = null) {
        const plugin = this.plugins.get(id);
        if (!plugin) throw new Error(`Plugin ${id} not found`);

        if (!this.activePlugins.has(id)) await this.activatePlugin(id);

        try {
            const context = await window.ArgusPluginContext.getPluginContext();
            return await plugin.run(input, context);
        } catch (err) {
            console.error(`Plugin ${id} run failed:`, err);
            throw err;
        }
    },

    listAllPlugins: function() {
        return Array.from(this.plugins.values());
    },

    isPluginEnabled: async function(id) {
        return true; // default for now – will wire to options later
    },

    createPanel: async function(pluginId, title) {
        const context = await window.ArgusPluginContext.getPluginContext();
        const panel = context.createFloatingPanel(title);
        return panel;
    },

    saveToggleState: async function(id, enabled) {
        let settings = await browser.storage.local.get('pluginSettings') || {};
        settings.pluginSettings = settings.pluginSettings || {};
        settings.pluginSettings[id] = enabled;
        await browser.storage.local.set(settings);
        return enabled;
    },

    loadToggleState: async function(id) {
        const settings = await browser.storage.local.get('pluginSettings') || {};
        return settings.pluginSettings && settings.pluginSettings[id] !== false;
    }
};
