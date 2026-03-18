window.ArgusPluginRegistry.registerPlugin({
    id: 'draft-pad-ai',
    name: 'Draft Pad AI',
    version: '1.0',
    category: 'reporting',
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
        var draft = [];
        if (response && response.success) {
            draft = response.data.results || [];
        }
        return { message: 'Draft pad AI complete', entities: draft };
    }
});
