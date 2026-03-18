window.ArgusPluginRegistry.registerPlugin({
    id: 'govintel-feature',
    name: 'GovIntel Feature',
    version: '1.0',
    category: 'govintel',
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
        var intel = [];
        if (response && response.success) {
            intel = response.data.results || [];
        }
        return { message: 'GovIntel complete', entities: intel };
    }
});
