import { create } from 'zustand';

import { AvoidPoint, Place, RouteResult } from '@typings/types';
import { computeRoute } from '@services/valhalla.service';
import { newId } from '@services/db/database';
import { useSettingsStore } from '@stores/settingsStore';

interface MapState {
    destination: Place | null;
    avoidPoints: AvoidPoint[];
    route: RouteResult | null;
    computing: boolean;
    error: string | null;
    setDestination: (place: Place | null) => void;
    addAvoidPoint: (latitude: number, longitude: number) => void;
    removeAvoidPoint: (id: string) => void;
    clearAvoidPoints: () => void;
    compute: (originLat: number, originLon: number) => Promise<void>;
    clearRoute: () => void;
}

export const useMapStore = create<MapState>((set, get) => ({
    destination: null,
    avoidPoints: [],
    route: null,
    computing: false,
    error: null,
    setDestination: (place) => {
        set({ destination: place, error: null });
    },
    addAvoidPoint: (latitude, longitude) => {
        const point: AvoidPoint = {
            id: newId(),
            latitude,
            longitude,
            label: `Avoid ${get().avoidPoints.length + 1}`,
            radiusMeters: 30,
            createdAt: Date.now(),
        };
        set({ avoidPoints: [...get().avoidPoints, point] });
    },
    removeAvoidPoint: (id) => {
        set({ avoidPoints: get().avoidPoints.filter((point) => point.id !== id) });
    },
    clearAvoidPoints: () => {
        set({ avoidPoints: [] });
    },
    compute: async (originLat, originLon) => {
        const destination = get().destination;
        if (!destination) {
            return;
        }

        const { valhallaBaseUrl } = useSettingsStore.getState().settings;
        set({ computing: true, error: null });

        try {
            const route = await computeRoute(valhallaBaseUrl, {
                originLat,
                originLon,
                destinationLat: destination.latitude,
                destinationLon: destination.longitude,
                avoidPoints: get().avoidPoints,
            });
            set({ route, computing: false });
        } catch {
            set({ computing: false, error: 'Could not compute the route.' });
        }
    },
    clearRoute: () => {
        set({ route: null, destination: null, avoidPoints: [], error: null });
    },
}));
