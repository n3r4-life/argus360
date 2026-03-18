window.ArgusPluginRegistry.registerPlugin({
    id: 'gdelt-events',
    name: 'GDELT Events',
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
        var events = [];
        if (response && response.success) {
            events = response.data.articles || [];
        }
        return { message: 'GDELT events complete', entities: events };
    }
});
