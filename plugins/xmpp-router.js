window.ArgusPluginRegistry.registerPlugin({
    id: 'xmpp-router',
    name: 'XMPP Router',
    version: '1.0',
    category: 'communication',
    requires: ['vault'],
    run: async (input, context) => {
        let routed = [];
        if (window.ArgusKG && typeof window.ArgusKG.sendTextIt === 'function') {
            routed = await window.ArgusKG.sendTextIt(input);
        }
        return { message: 'XMPP routing complete', entities: routed };
    }
});
