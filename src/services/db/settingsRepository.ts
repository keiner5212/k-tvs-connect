import { AppSettings } from '@typings/types';
import { getDatabase } from './database';

const DEFAULTS: AppSettings = {
    unitSystem: 'metric',
    overspeedLimitKmh: 80,
    mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    photonBaseUrl: 'https://photon.komoot.io/api',
    valhallaBaseUrl: 'https://valhalla1.openstreetmap.de',
    saveTracks: false,
    pinEnabled: false,
};

interface SettingRow {
    key: string;
    value: string;
}

export const getSettings = async (): Promise<AppSettings> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<SettingRow>('SELECT key, value FROM settings');
    const stored: Record<string, string> = {};

    for (const row of rows) {
        stored[row.key] = row.value;
    }

    return {
        unitSystem: (stored.unitSystem as AppSettings['unitSystem']) ?? DEFAULTS.unitSystem,
        overspeedLimitKmh: stored.overspeedLimitKmh
            ? Number(stored.overspeedLimitKmh)
            : DEFAULTS.overspeedLimitKmh,
        mapStyleUrl: stored.mapStyleUrl ?? DEFAULTS.mapStyleUrl,
        photonBaseUrl: stored.photonBaseUrl ?? DEFAULTS.photonBaseUrl,
        valhallaBaseUrl: stored.valhallaBaseUrl ?? DEFAULTS.valhallaBaseUrl,
        saveTracks: stored.saveTracks ? stored.saveTracks === 'true' : DEFAULTS.saveTracks,
        pinEnabled: stored.pinEnabled ? stored.pinEnabled === 'true' : DEFAULTS.pinEnabled,
    };
};

const setSetting = async (key: string, value: string): Promise<void> => {
    const db = getDatabase();
    await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        value,
    );
};

export const setSettings = async (values: Partial<AppSettings>): Promise<void> => {
    for (const [key, value] of Object.entries(values)) {
        await setSetting(key, String(value));
    }
};
