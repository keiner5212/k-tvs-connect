import * as Location from 'expo-location';
import { create } from 'zustand';

import { logger } from '@utils/logger';

interface LocationState {
    position: [number, number] | null;
    permission: 'unknown' | 'granted' | 'denied';
    lastFixAt: number | null;
    following: boolean;
    request: () => Promise<void>;
    startWatching: (owner: string) => Promise<void>;
    stopWatching: (owner: string) => void;
}

let watchSubscription: Location.LocationSubscription | null = null;

/** The map and the navigation need the position, the last one to release wins. */
const watchOwners = new Set<string>();

/**
 * The position is the base of everything that moves: the map, the distances to
 * the cameras, the remaining distance on the route and the navigation the bike
 * receives. It lives in one place so nothing has to ask the system twice.
 */
export const useLocationStore = create<LocationState>((set, get) => ({
    position: null,
    permission: 'unknown',
    lastFixAt: null,
    following: false,

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

    startWatching: async (owner: string) => {
        watchOwners.add(owner);
        if (watchSubscription || get().following) {
            return;
        }

        if (get().permission !== 'granted') {
            await get().request();
            if (get().permission !== 'granted') {
                watchOwners.delete(owner);
                return;
            }
        }

        try {
            watchSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    distanceInterval: 1,
                    timeInterval: 1000,
                },
                (location) => {
                    set({
                        position: [location.coords.latitude, location.coords.longitude],
                        lastFixAt: Date.now(),
                    });
                },
            );
            set({ following: true });
        } catch (error) {
            logger.warn('the location watch failed', {
                event: 'location',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
        }
    },

    stopWatching: (owner: string) => {
        watchOwners.delete(owner);
        if (watchOwners.size > 0) {
            return;
        }
        watchSubscription?.remove();
        watchSubscription = null;
        set({ following: false });
    },
}));
