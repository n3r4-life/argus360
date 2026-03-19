// plugins/workbench-multi.js
// Real Workbench Multi plugin — wraps project workbench analysis
window.ArgusPluginRegistry.registerPlugin({
    id: 'workbench-multi',
    name: 'Workbench Multi',
    version: '2.0',
    category: 'workbench',
    requires: [],
    init: async function(context) { console.log('[Workbench Plugin] initialized'); },
    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'getProjects' });
        if (!resp || !resp.success) return { message: 'Workbench error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var projects = resp.projects || [];
        var entities = projects.map(function(p) { return { type: 'project', id: p.id, name: p.name, itemCount: p.items ? p.items.length : 0 }; });
        return { message: 'Workbench: ' + projects.length + ' projects', entities: entities };
    },
    cleanup: async function() { console.log('[Workbench Plugin] cleaned up'); }
});
