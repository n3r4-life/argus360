window.ArgusPluginRegistry.registerPlugin({
    id: 'vessel-track',
    name: 'Vessel Tracking',
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
        var vessels = [];
        if (response && response.success) {
            vessels = response.data.states || [];
        }
        return { message: 'Vessel tracking complete', entities: vessels };
    }
});
