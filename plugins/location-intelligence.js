window.ArgusPluginRegistry.registerPlugin({
    id: 'location-intelligence',
    name: 'Location Intelligence',
    version: '1.0',
    category: 'location',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://opensky-network.org/api/states/all',
                options: { method: 'GET' }
            }, resolve);
        });
        var geo = [];
        if (response && response.success) {
            geo = response.data.states || [];
        }
        return { message: 'Geo enrichment complete', entities: geo };
    }
});
