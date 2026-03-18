window.ArgusPluginRegistry.registerPlugin({
    id: 'airport-intelligence',
    name: 'Airport Intelligence',
    version: '1.0',
    category: 'govintel',
    requires: ['kg'],
    run: async (input, context) => {
        let flights = [];
        if (window.ArgusKG && typeof window.ArgusKG.airportTrack === 'function') {
            flights = await window.ArgusKG.airportTrack(input);
        }
        return { message: 'Airport tracking complete', entities: flights };
    }
});
