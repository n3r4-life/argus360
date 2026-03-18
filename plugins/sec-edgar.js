window.ArgusPluginRegistry.registerPlugin({
    id: 'sec-edgar',
    name: 'SEC EDGAR',
    version: '1.0',
    category: 'finance',
    requires: ['kg'],
    run: async (input, context) => {
        var response = await new Promise(function(resolve) {
            browser.runtime.sendMessage({
                type: 'EXTERNAL_API_CALL',
                url: 'https://efts.sec.gov/LATEST/search-index?q=test',
                options: { method: 'GET' }
            }, resolve);
        });
        var filings = [];
        if (response && response.success) {
            filings = response.data || [];
        }
        return { message: 'SEC EDGAR complete', entities: filings };
    }
});
