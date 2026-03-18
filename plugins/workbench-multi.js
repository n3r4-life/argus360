window.ArgusPluginRegistry.registerPlugin({
    id: 'workbench-multi',
    name: 'Workbench Multi',
    version: '1.0',
    category: 'workbench',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://api.gdeltproject.org/api/v2/doc/doc',
                options: { method: 'GET' }
            }, resolve);
        });
        var items = [];
        if (response && response.success) {
            items = response.data.articles || [];
        }
        return { message: 'Workbench multi analysis complete', entities: items };
    }
});
