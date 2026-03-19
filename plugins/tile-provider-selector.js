// plugins/tile-provider-selector.js
// Real Tile Provider Selector plugin — wraps basemap tile switching on the satellite page
// Does NOT auto-open a panel — the tile controls live in the Basemap tab of Imagery Controls
// This plugin registers the available providers with the registry for future per-page plugin panel use

window.ArgusPluginRegistry.registerPlugin({
    id: 'tile-provider-selector',
    name: 'Tile Provider Selector',
    version: '2.0',
    category: 'location',
    requires: [],

    // Available tile providers (all free, no API keys)
    providers: [
        { id: 'carto-dark', label: 'CARTO Dark', free: true },
        { id: 'carto-light', label: 'CARTO Light', free: true },
        { id: 'carto-voyager', label: 'CARTO Voyager', free: true },
        { id: 'osm', label: 'OpenStreetMap', free: true },
        { id: 'esri-sat', label: 'ESRI Satellite', free: true },
        { id: 'esri-topo', label: 'ESRI Topographic', free: true },
        { id: 'stadia-dark', label: 'Stadia Dark', free: true }
    ],

    init: async function(context) {
        console.log('[TileProvider Plugin] initialized — ' + this.providers.length + ' free tile sources available');
    },

    run: async function(input, context) {
        // List available providers and their status
        var available = this.providers.map(function(p) {
            return {
                type: 'tile-provider',
                name: p.label,
                id: p.id,
                free: p.free,
                status: 'available'
            };
        });

        return {
            message: 'Tile providers: ' + available.length + ' sources available (all free)',
            entities: available
        };
    },

    cleanup: async function() {
        console.log('[TileProvider Plugin] cleaned up');
    }
});
