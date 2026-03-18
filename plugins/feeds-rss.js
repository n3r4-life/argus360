window.ArgusPluginRegistry.registerPlugin({
    id: 'feeds-rss',
    name: 'Feeds RSS',
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
        var feeds = [];
        if (response && response.success) {
            feeds = response.data.articles || [];
        }
        return { message: 'RSS feeds complete', entities: feeds };
    }
});
