window.ArgusPluginRegistry.registerPlugin({
    id: 'wigle-wifi',
    name: 'WiGLE WiFi',
    version: '1.0',
    category: 'osint',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://api.wigle.net/api/v2/network/search',
                options: { method: 'GET' }
            }, resolve);
        });
        var wifi = [];
        if (response && response.success) {
            wifi = response.data.results || [];
        }
        return { message: 'WiGLE WiFi complete', entities: wifi };
    }
});
