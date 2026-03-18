window.ArgusPluginRegistry.registerPlugin({
    id: 'rss-keyword-router',
    name: 'RSS Keyword Router',
    version: '1.0',
    category: 'feeds',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://api.gdeltproject.org/api/v2/doc/doc',
                options: { method: 'GET' }
            }, resolve);
        });
        var routed = [];
        if (response && response.success) {
            routed = response.data.articles || [];
        }
        return { message: 'RSS keyword routing complete', entities: routed };
    }
});
