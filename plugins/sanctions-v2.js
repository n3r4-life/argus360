window.ArgusPluginRegistry.registerPlugin({
    id: 'sanctions-v2',
    name: 'Sanctions Screening v2',
    version: '1.0',
    category: 'govintel',
    requires: ['vault', 'kg'],
    run: async (input, context) => {
        let advanced = [];
        if (window.ArgusKG && typeof window.ArgusKG.advancedSanctions === 'function') {
            advanced = await window.ArgusKG.advancedSanctions(input);
        }
        return { message: 'Advanced sanctions complete', entities: advanced };
    }
});
