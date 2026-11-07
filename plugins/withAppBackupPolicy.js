const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAppBackupPolicy(config) {
    return withAndroidManifest(config, (cfg) => {
        const application = cfg.modResults.manifest.application?.[0];
        if (!application) {
            return cfg;
        }
        application.$['android:allowBackup'] = 'false';
        delete application.$['android:fullBackupContent'];
        delete application.$['android:dataExtractionRules'];
        return cfg;
    });
};
