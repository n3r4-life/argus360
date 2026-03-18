window.ArgusPluginRegistry.registerPlugin({
    id: 'xmpp-router',
    name: 'XMPP Router',
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
        var routed = [];
        if (response && response.success) {
            routed = response.data || [];
        }
        return { message: 'XMPP routing complete', entities: routed };
    }
});
