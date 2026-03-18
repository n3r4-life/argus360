window.ArgusPluginRegistry.registerPlugin({
    id: 'event-bus',
    name: 'Event Bus',
    version: '1.0',
    category: 'productivity',
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
        return { message: 'Event bus complete', entities: events };
    }
});
