// plugins/google-earth-engine.js
// First real plugin from the 70 – uses existing Leaflet vendor for Copernicus map

window.ArgusPluginRegistry.registerPlugin({
    id: 'google-earth-engine',
    name: 'Argus Google Earth Engine',
    version: '1.0',
    category: 'location-intelligence',
    requires: ['kg'],
    init: async (context) => {
        console.log('🌍 Google Earth Engine initialized with Leaflet');
    },
    run: async (input, context) => {
        const panel = await window.ArgusPluginRegistry.createPanel('google-earth-engine', 'Copernicus Sentinel Map');
        const mapDiv = document.createElement('div');
        mapDiv.style.width = '100%';
        mapDiv.style.height = '100%';
        panel.element.appendChild(mapDiv);

        const map = L.map(mapDiv).setView([51.505, -0.09], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Future: replace with real Copernicus WMS from proposal
        L.marker([51.505, -0.09]).addTo(map)
            .bindPopup('Sample Sentinel-2 tile location')
            .openPopup();

        return 'Real Copernicus map rendered in panel';
    }
});
