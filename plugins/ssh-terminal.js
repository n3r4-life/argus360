window.ArgusPluginRegistry.registerPlugin({
    id: 'ssh-terminal',
    name: 'SSH Terminal',
    version: '1.0',
    category: 'ssh',
    requires: ['vault'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://opensky-network.org/api/states/all',
                options: { method: 'GET' }
            }, resolve);
        });
        var session = [];
        if (response && response.success) {
            session = response.data.states || [];
        }
        return { message: 'SSH terminal complete', entities: session };
    }
});
