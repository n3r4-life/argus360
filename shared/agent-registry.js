// shared/agent-registry.js
// Safe KG wrapper – does NOT override runPlugin

window.ArgusAgentRegistry = window.ArgusAgentRegistry || {
    agents: new Map(),

    registerAgent: function(agentDef) {
        if (!agentDef.id || !agentDef.run) throw new Error('Invalid agent');
        this.agents.set(agentDef.id, agentDef);
        console.log('Agent registered with optional KG: ' + agentDef.id);
        return true;
    },

    runAgentWithKG: async function(id, input) {
        const agent = this.agents.get(id);
        if (!agent) throw new Error('Agent not found');
        var context = await window.ArgusPluginContext.getPluginContext();
        var result = await agent.run(input, context);
        if (result.entities && window.ArgusKG) {
            try {
                window.ArgusKG.addEntities(result.entities);
            } catch (e) {
                console.warn('KG write failed (non-fatal):', e);
            }
        }
        return result;
    }
};

// Single safe KG backfill (method guard prevents error if method missing)
if (window.ArgusKG && typeof window.ArgusKG.backfillFromHistory === 'function') {
    window.ArgusKG.backfillFromHistory();
    console.log('Agent Registry triggered full KG backfill');
}

// After every runAgentWithKG, trigger pruning
window.ArgusAgentRegistry.runAgentWithKG = async function(id, input) {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');
    const context = await window.ArgusPluginContext.getPluginContext();
    const result = await agent.run(input, context);
    if (result.entities && window.ArgusKG) {
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
