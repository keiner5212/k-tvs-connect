import { create } from 'zustand';

import { GOOGLE_TILES_API_KEY } from '@config/tiles';
import { buildGoogleStyle, getTileSession } from '@services/tiles.service';

export type MapProvider = 'google' | 'openfreemap';

interface TilesState {
    provider: MapProvider;
    googleStyle: Record<string, unknown> | null;
    loading: boolean;
    unavailable: boolean;
    load: () => Promise<void>;
    useOpenFreeMap: () => void;
}

/**
 * The google map is the background when it is available. The style object is
 * kept here so it keeps the same identity, otherwise maplibre reloads the
 * style on every render and asks for every tile again.
 */
export const useTilesStore = create<TilesState>((set, get) => ({
    provider: 'openfreemap',
    googleStyle: null,
    loading: false,
    unavailable: false,

    load: async () => {
        if (!GOOGLE_TILES_API_KEY || get().loading) {
            return;
        }
        set({ loading: true });
        const session = await getTileSession();
        if (!session) {
            set({ loading: false, unavailable: true, provider: 'openfreemap', googleStyle: null });
            return;
        }
        set({
            loading: false,
            unavailable: false,
            provider: 'google',
            googleStyle: buildGoogleStyle(session),
        });
    },

    useOpenFreeMap: () => {
        set({ provider: 'openfreemap', unavailable: true });
    },
}));
