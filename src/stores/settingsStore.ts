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
        overspeedLimitKmh: 80,
        mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
        photonBaseUrl: 'https://photon.komoot.io/api',
        valhallaBaseUrl: 'https://valhalla1.openstreetmap.de',
        saveTracks: false,
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
