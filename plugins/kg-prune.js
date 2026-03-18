window.ArgusPluginRegistry.registerPlugin({
    id: 'kg-prune',
    name: 'KG Prune',
    version: '1.0',
    category: 'kg',
    requires: ['kg'],
    run: async (input, context) => {
        if (window.ArgusKG && typeof window.ArgusKG.pruneOldEntities === 'function') {
            window.ArgusKG.pruneOldEntities();
        }
        return { message: 'KG prune complete', entities: [] };
    }
});
