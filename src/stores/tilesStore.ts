import { create } from 'zustand';

import { GOOGLE_TILES_API_KEY } from '@config/tiles';
import { buildGoogleStyle, getTileSession } from '@services/tiles.service';
import { canUseGoogle, chargeGoogleUsage } from '@services/googleUsage.service';

/** the tiles are loaded by the map itself, so the app counts what it can see */
const TILES_PER_VIEWPORT = 30;

/** the map fires the change on every frame of a pan */
const VIEWPORT_CHARGE_INTERVAL_MS = 2000;

let lastCharge = 0;

interface TilesState {
    googleStyle: Record<string, unknown> | null;
    loading: boolean;
    unavailable: boolean;
    /** the free monthly cap of the tiles is used up */
    quotaReached: boolean;
    load: () => Promise<void>;
    useOpenFreeMap: () => void;
    chargeTiles: () => Promise<void>;
}

/**
 * The google map is the background when it is available. The style object is
 * kept here so it keeps the same identity, otherwise maplibre reloads the
 * style on every render and asks for every tile again.
 */
export const useTilesStore = create<TilesState>((set, get) => ({
    googleStyle: null,
    loading: false,
    unavailable: false,
    quotaReached: false,

    load: async () => {
        if (!GOOGLE_TILES_API_KEY || get().loading) {
            return;
        }
        if (!(await canUseGoogle('tiles'))) {
            set({ loading: false, unavailable: true, quotaReached: true, googleStyle: null });
            return;
        }
        set({ loading: true });
        const session = await getTileSession();
        if (!session) {
            set({ loading: false, unavailable: true, googleStyle: null });
            return;
        }
        set({
            loading: false,
            unavailable: false,
            googleStyle: buildGoogleStyle(session),
        });
    },

    useOpenFreeMap: () => {
        /** the style has to go too, otherwise the map keeps asking google */
        set({ unavailable: true, googleStyle: null });
    },

    chargeTiles: async () => {
        const now = Date.now();
        if (now - lastCharge < VIEWPORT_CHARGE_INTERVAL_MS) {
            return;
        }
        lastCharge = now;
        await chargeGoogleUsage('tiles', TILES_PER_VIEWPORT);
        if (!(await canUseGoogle('tiles'))) {
            set({ quotaReached: true, unavailable: true, googleStyle: null });
        }
    },
}));
