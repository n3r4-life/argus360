window.ArgusPluginRegistry.registerPlugin({
    id: 'bookmarks-smart',
    name: 'Smart Bookmarks',
    version: '1.0',
    category: 'bookmarks',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://api.gdeltproject.org/api/v2/doc/doc',
                options: { method: 'GET' }
            }, resolve);
        });
        var bookmarks = [];
        if (response && response.success) {
            bookmarks = response.data.articles || [];
        }
        return { message: 'Smart bookmarks complete', entities: bookmarks };
    }
});
