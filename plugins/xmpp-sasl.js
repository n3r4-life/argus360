window.ArgusPluginRegistry.registerPlugin({
    id: 'xmpp-sasl',
    name: 'XMPP SASL',
    version: '1.0',
    category: 'communication',
    requires: ['vault'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://api.gdeltproject.org/api/v2/doc/doc',
                options: { method: 'GET' }
            }, resolve);
        });
        var sasl = [];
        if (response && response.success) {
            sasl = response.data.articles || [];
        }
        return { message: 'XMPP SASL complete', entities: sasl };
    }
});
