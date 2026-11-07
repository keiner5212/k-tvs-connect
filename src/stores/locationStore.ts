import * as Location from 'expo-location';
import { create } from 'zustand';

import { logger } from '@utils/logger';

interface LocationState {
    position: [number, number] | null;
    permission: 'unknown' | 'granted' | 'denied';
    lastFixAt: number | null;
    request: () => Promise<void>;
}

export const useLocationStore = create<LocationState>((set) => ({
    position: null,
    permission: 'unknown',
    lastFixAt: null,
    request: async () => {
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                set({ permission: 'denied' });
                return;
            }

            const current = await Location.getCurrentPositionAsync({});
            set({
                permission: 'granted',
                position: [current.coords.latitude, current.coords.longitude],
                lastFixAt: Date.now(),
            });
        } catch (error) {
            logger.warn('location failed', {
                event: 'location',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
            set({ permission: 'denied' });
        }
    },
}));
