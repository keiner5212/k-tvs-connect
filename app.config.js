const base = require('./app.json');

module.exports = ({ config }) => ({
    ...config,
    extra: {
        ...base.expo.extra,
        valhallaBaseUrl: process.env.VALHALLA_BASE_URL || 'https://valhalla1.openstreetmap.de',
        mapStyleUrl: process.env.MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
    },
});
