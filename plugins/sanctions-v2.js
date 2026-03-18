window.ArgusPluginRegistry.registerPlugin({
    id: 'sanctions-v2',
    name: 'Sanctions Screening v2',
    version: '1.0',
    category: 'govintel',
    requires: ['vault', 'kg'],
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
        var advanced = [];
        if (response && response.success) {
            advanced = response.data.results || [];
        }
        return { message: 'Advanced sanctions complete', entities: advanced };
    }
});
