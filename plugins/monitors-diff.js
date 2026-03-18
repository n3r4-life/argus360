window.ArgusPluginRegistry.registerPlugin({
    id: 'monitors-diff',
    name: 'Monitors Diff',
    version: '1.0',
    category: 'monitors',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://opensky-network.org/api/states/all',
                options: { method: 'GET' }
            }, resolve);
        });
        var diff = [];
        if (response && response.success) {
            diff = response.data.states || [];
        }
        return { message: 'Monitor diff complete', entities: diff };
    }
});
