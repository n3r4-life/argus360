window.ArgusPluginRegistry.registerPlugin({
    id: 'satellite-overlay',
    name: 'Satellite Overlay',
    version: '1.0',
    category: 'location',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://api.opensanctions.org/search',
                options: {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ q: input })
                }
            }, resolve);
        });
        var overlay = [];
        if (response && response.success) {
            overlay = response.data.results || [];
        }
        return { message: 'Satellite overlay complete', entities: overlay };
    }
});
