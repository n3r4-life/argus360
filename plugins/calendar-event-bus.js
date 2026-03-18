window.ArgusPluginRegistry.registerPlugin({
    id: 'calendar-event-bus',
    name: 'Calendar Event Bus',
    version: '1.0',
    category: 'productivity',
    requires: ['kg'],
    run: async (input, context) => {
        let events = [];
        if (window.ArgusKG && typeof window.ArgusKG.createEvents === 'function') {
            events = await window.ArgusKG.createEvents(input);
        }
        return { message: 'Events created', entities: events };
    }
});
