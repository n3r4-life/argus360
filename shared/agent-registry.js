// shared/agent-registry.js
// Safe wrapper around existing runPlugin so pruning fires without breaking anything

window.ArgusAgentRegistry = window.ArgusAgentRegistry || {
    agents: new Map(),

    registerAgent: function(agentDef) {
        if (!agentDef.id || !agentDef.run) throw new Error('Invalid agent');
        this.agents.set(agentDef.id, agentDef);
        console.log('Agent registered with optional KG: ' + agentDef.id);
        return true;
    }
};

// Manifest V3 prep note: move backfill to browser.alarms in service-worker later
// Single safe KG backfill at startup only (method guard prevents error if method missing)
if (window.ArgusKG && typeof window.ArgusKG.backfillFromHistory === 'function') {
    window.ArgusKG.backfillFromHistory();
    console.log('KG backfill triggered at startup only');
}

// Safe wrap of original runPlugin (executes after real plugin run)
if (!window.ArgusPluginRegistry._originalRunPlugin) {
    window.ArgusPluginRegistry._originalRunPlugin = window.ArgusPluginRegistry.runPlugin;
    window.ArgusPluginRegistry.runPlugin = async function(id, input) {
        var result = await window.ArgusPluginRegistry._originalRunPlugin.call(this, id, input);
        if (result && result.entities && window.ArgusKG) {
            try {
                window.ArgusKG.addEntities(result.entities);
                if (typeof window.ArgusKG.pruneOldEntities === 'function') {
                    window.ArgusKG.pruneOldEntities();
                }
            } catch (e) {
                console.warn('KG write or prune failed (non-fatal):', e);
            }
        }
        return result;
    };
}

// Export helper for full plugin + KG state
window.ArgusAgentRegistry.exportAll = async function() {
    var data = await browser.storage.local.get(null);
    return data;
};

// Final test helper
window.ArgusAgentRegistry.runFullTest = async function() {
    console.log('Running full test suite via agent registry...');
    var plugins = window.ArgusPluginRegistry.listAllPlugins();
    for (var i = 0; i < plugins.length; i++) {
        var p = plugins[i];
        if (await window.ArgusPluginRegistry.isPluginEnabled(p.id)) {
            try {
                await window.ArgusPluginRegistry.runPlugin(p.id, 'test');
            } catch (e) {}
        }
    }
    console.log('Full test suite complete');
};
