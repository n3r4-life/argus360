window.ArgusPluginRegistry.registerPlugin({
    id: 'opensky-track',
    name: 'OpenSky Track',
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
        var aircraft = [];
        if (response && response.success) {
            aircraft = response.data.states || [];
        }
        return { message: 'OpenSky tracking complete', entities: aircraft };
    }
});
