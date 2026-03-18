window.ArgusPluginRegistry.registerPlugin({
    id: 'chat-xmpp',
    name: 'Chat XMPP',
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
        var chat = [];
        if (response && response.success) {
            chat = response.data.articles || [];
        }
        return { message: 'XMPP chat complete', entities: chat };
    }
});
