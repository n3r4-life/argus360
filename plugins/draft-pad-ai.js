// plugins/draft-pad-ai.js
// Real Draft Pad AI plugin — wraps draft/report management
window.ArgusPluginRegistry.registerPlugin({
    id: 'draft-pad-ai',
    name: 'Draft Pad AI',
    version: '2.0',
    category: 'reporting',
    requires: [],
    init: async function(context) { console.log('[Draft Pad Plugin] initialized'); },
    run: async function(input, context) {
        var resp = await browser.runtime.sendMessage({ action: 'draftGetAll' });
        if (!resp || !resp.success) return { message: 'Drafts error: ' + ((resp && resp.error) || 'failed'), entities: [] };
        var drafts = resp.drafts || [];
        var entities = drafts.map(function(d) { return { type: 'draft', id: d.id, title: d.title, ts: d.ts }; });
        return { message: 'Drafts: ' + drafts.length + ' saved', entities: entities };
    },
    cleanup: async function() { console.log('[Draft Pad Plugin] cleaned up'); }
});
