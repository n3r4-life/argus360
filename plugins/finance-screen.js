window.ArgusPluginRegistry.registerPlugin({
    id: 'finance-screen',
    name: 'Finance Screening',
    version: '1.0',
    category: 'finance',
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
        var screen = [];
        if (response && response.success) {
            screen = response.data.results || [];
        }
        return { message: 'Finance screening complete', entities: screen };
    }
});
