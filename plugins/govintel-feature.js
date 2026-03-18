window.ArgusPluginRegistry.registerPlugin({
    id: 'govintel-feature',
    name: 'GovIntel Feature',
    version: '1.0',
    category: 'govintel',
    requires: ['kg'],
    run: async (input, context) => {
        let intel = [];
        if (window.ArgusKG && typeof window.ArgusKG.govEnrich === 'function') {
            intel = await window.ArgusKG.govEnrich(input);
        }
        return { message: 'GovIntel complete', entities: intel };
    }
});
