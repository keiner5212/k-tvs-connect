import { AppSettings } from '@typings/types';
import { getDatabase } from './database';

const DEFAULTS: AppSettings = {
    unitSystem: 'metric',
    cameraAvoidEnabled: true,
    cameraRadiusMeters: 5000,
    ansvFetchedAt: null,
    ansvPublishedAt: null,
    overspeedLimitKmh: 80,
    mapProvider: 'google',
    mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
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
        cameraAvoidEnabled: stored.cameraAvoidEnabled
            ? stored.cameraAvoidEnabled === 'true'
            : DEFAULTS.cameraAvoidEnabled,
        cameraRadiusMeters: stored.cameraRadiusMeters
            ? Number(stored.cameraRadiusMeters)
            : DEFAULTS.cameraRadiusMeters,
        ansvFetchedAt: stored.ansvFetchedAt ? Number(stored.ansvFetchedAt) : DEFAULTS.ansvFetchedAt,
        ansvPublishedAt: stored.ansvPublishedAt ? Number(stored.ansvPublishedAt) : DEFAULTS.ansvPublishedAt,
        overspeedLimitKmh: stored.overspeedLimitKmh
            ? Number(stored.overspeedLimitKmh)
            : DEFAULTS.overspeedLimitKmh,
        mapProvider: (stored.mapProvider as AppSettings['mapProvider']) ?? DEFAULTS.mapProvider,
        mapStyleUrl: stored.mapStyleUrl ?? DEFAULTS.mapStyleUrl,
        valhallaBaseUrl: stored.valhallaBaseUrl ?? DEFAULTS.valhallaBaseUrl,
        saveTracks: stored.saveTracks ? stored.saveTracks === 'true' : DEFAULTS.saveTracks,
        pinEnabled: stored.pinEnabled ? stored.pinEnabled === 'true' : DEFAULTS.pinEnabled,
    };
};

export const getSetting = async (key: string): Promise<string | null> => {
    const db = getDatabase();
    const row = await db.getFirstAsync<SettingRow>('SELECT value FROM settings WHERE key = ?', key);
    return row?.value ?? null;
};

export const setSetting = async (key: string, value: string): Promise<void> => {
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
