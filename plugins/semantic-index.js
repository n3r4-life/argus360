window.ArgusPluginRegistry.registerPlugin({
    id: 'semantic-index',
    name: 'Semantic Index',
    version: '1.0',
    category: 'osint',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://api.gdeltproject.org/api/v2/doc/doc',
                options: { method: 'GET' }
            }, resolve);
        });
        var indexed = [];
        if (response && response.success) {
            indexed = response.data.articles || [];
        }
        return { message: 'Semantic index complete', entities: indexed };
    }
});
