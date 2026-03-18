window.ArgusPluginRegistry.registerPlugin({
    id: 'semantic-index',
    name: 'Semantic Index',
    version: '1.0',
    category: 'osint',
    requires: ['kg'],
    run: async (input, context) => {
        let indexed = [];
        if (window.ArgusKG && typeof window.ArgusKG.semanticIndex === 'function') {
            indexed = await window.ArgusKG.semanticIndex(input);
        }
        return { message: 'Semantic index complete', entities: indexed };
    }
});
