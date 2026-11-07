const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withBleNeverForLocation(config) {
    return withAndroidManifest(config, (cfg) => {
        const permissions = cfg.modResults.manifest['uses-permission'] || [];

        for (const permission of permissions) {
            const name = permission.$['android:name'];
            if (name === 'android.permission.BLUETOOTH_SCAN') {
                permission.$['android:usesPermissionFlags'] = 'neverForLocation';
            }
            if (
                name === 'android.permission.BLUETOOTH' ||
                name === 'android.permission.BLUETOOTH_ADMIN'
            ) {
                permission.$['android:maxSdkVersion'] = '30';
            }
        }

        return cfg;
    });
};
