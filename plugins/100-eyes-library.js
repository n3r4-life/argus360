window.ArgusPluginRegistry.registerPlugin({
    id: '100-eyes-library',
    name: '100 Eyes Script Library',
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
        var scripts = [];
        if (response && response.success) {
            scripts = response.data || [];
        }
        return { message: '100 Eyes scripts complete', entities: scripts };
    }
});
