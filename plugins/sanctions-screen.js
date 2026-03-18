window.ArgusPluginRegistry.registerPlugin({
    id: 'sanctions-screen',
    name: 'Sanctions Screening',
    version: '1.0',
    category: 'govintel',
    requires: ['vault', 'kg'],
    run: async (input, context) => {
        let entities = [];
        if (window.ArgusKG && typeof window.ArgusKG.screenSanctions === 'function') {
            entities = await window.ArgusKG.screenSanctions(input);
        }
        return { message: 'Sanctions check complete', entities: entities };
    }
});
