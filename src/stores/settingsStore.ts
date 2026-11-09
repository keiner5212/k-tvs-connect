import { create } from 'zustand';

import { AppSettings } from '@typings/types';
import { getSettings, setSettings } from '@services/db/settingsRepository';

interface SettingsState {
    settings: AppSettings;
    loading: boolean;
    load: () => Promise<void>;
    update: (values: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: {
        unitSystem: 'metric',
        cameraAvoidEnabled: true,
        cameraRadiusMeters: 5000,
        ansvFetchedAt: null,
        ansvPublishedAt: null,
        mapProvider: 'google',
        mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
        valhallaBaseUrl: 'https://valhalla1.openstreetmap.de',
        pinEnabled: false,
    },
    loading: false,
    load: async () => {
        set({ loading: true });
        try {
            const settings = await getSettings();
            set({ settings, loading: false });
        } catch {
            set({ loading: false });
        }
    },
    update: async (values) => {
        const next = { ...get().settings, ...values };
        set({ settings: next });
        await setSettings(values);
    },
}));
