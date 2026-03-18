window.ArgusPluginRegistry.registerPlugin({
    id: 'satellite-overlay',
    name: 'Satellite Overlay',
    version: '1.0',
    category: 'location',
    requires: ['kg'],
    run: async (input, context) => {
        let overlay = [];
        if (window.ArgusKG && typeof window.ArgusKG.satelliteAnalyze === 'function') {
            overlay = await window.ArgusKG.satelliteAnalyze(input);
        }
        return { message: 'Satellite overlay complete', entities: overlay };
    }
});
