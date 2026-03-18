window.ArgusPluginRegistry.registerPlugin({
    id: 'copernicus-wms',
    name: 'Copernicus WMS',
    version: '1.0',
    category: 'location',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://api.gdeltproject.org/api/v2/doc/doc',
                options: { method: 'GET' }
            }, resolve);
        });
        var wms = [];
        if (response && response.success) {
            wms = response.data || [];
        }
        return { message: 'Copernicus WMS complete', entities: wms };
    }
});
