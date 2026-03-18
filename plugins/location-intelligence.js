window.ArgusPluginRegistry.registerPlugin({
    id: 'location-intelligence',
    name: 'Location Intelligence',
    version: '1.0',
    category: 'location',
    requires: ['kg'],
    run: async (input, context) => {
        let geo = [];
        if (window.ArgusKG && typeof window.ArgusKG.geoEnrich === 'function') {
            geo = await window.ArgusKG.geoEnrich(input);
        }
        return { message: 'Geo enrichment complete', entities: geo };
    }
});
