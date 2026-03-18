window.ArgusPluginRegistry.registerPlugin({
    id: 'broadcastify',
    name: 'Broadcastify',
    version: '1.0',
    category: 'monitors',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://api.gdeltproject.org/api/v2/doc/doc',
                options: { method: 'GET' }
            }, resolve);
        });
        var streams = [];
        if (response && response.success) {
            streams = response.data || [];
        }
        return { message: 'Broadcastify complete', entities: streams };
    }
});
