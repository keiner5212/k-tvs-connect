const { withAndroidManifest } = require('@expo/config-plugins');

const SCHEME = 'kroutes';

const HOSTS = ['maps.google.com', 'www.google.com', 'google.com'];

/**
 * Lets the other map apps share a place with this one. The links are the
 * `geo:` uris and the https links the map apps use.
 */
module.exports = function withSharedLocation(config) {
    return withAndroidManifest(config, (cfg) => {
        const application = cfg.modResults.manifest.application?.[0];
        if (!application) {
            return cfg;
        }

        const activity = application.activity?.find(
            (item) => item.$?.['android:name'] === '.MainActivity',
        );
        if (!activity) {
            return cfg;
        }

        const existing = activity['intent-filter'] ?? [];
        const filters = existing.filter((filter) => {
            const hasScheme = filter.category?.some((category) =>
                category.$?.['android:name'] === 'android.intent.category.DEFAULT',
            );
            const isBrowser = filter.data?.some((data) =>
                (data.$?.['android:scheme'] ?? '') === 'http',
            );
            return !(hasScheme && isBrowser);
        });

        filters.push({
            $: { 'android:autoVerify': 'false' },
            action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
            category: [
                { $: { 'android:name': 'android.intent.category.DEFAULT' } },
                { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
            ],
            data: [{ $: { 'android:scheme': 'geo' } }],
        });

        filters.push({
            $: { 'android:autoVerify': 'false' },
            action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
            category: [
                { $: { 'android:name': 'android.intent.category.DEFAULT' } },
                { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
            ],
            data: [{ $: { 'android:scheme': SCHEME } }],
        });

        for (const host of HOSTS) {
            filters.push({
                $: { 'android:autoVerify': 'false' },
                action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
                category: [
                    { $: { 'android:name': 'android.intent.category.DEFAULT' } },
                    { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
                ],
                data: [{ $: { 'android:scheme': 'https', 'android:host': host } }],
            });
        }

        activity['intent-filter'] = filters;
        return cfg;
    });
};
