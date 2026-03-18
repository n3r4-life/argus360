window.ArgusPluginRegistry.registerPlugin({
    id: '100-eyes-library',
    name: '100 Eyes Script Library',
    version: '1.0',
    category: 'osint',
    requires: ['kg'],
    run: async (input, context) => {
        let scripts = [];
        if (window.ArgusKG && typeof window.ArgusKG.run100Eyes === 'function') {
            scripts = await window.ArgusKG.run100Eyes(input);
        }
        return { message: '100 Eyes scripts complete', entities: scripts };
    }
});
