import { create } from 'zustand';

import { AvoidPoint, Place, RouteResult } from '@typings/types';
import { computeRoute } from '@services/valhalla.service';
import {
    clearAvoidPoints as clearStoredAvoidPoints,
    deleteAvoidPoint as deleteStoredAvoidPoint,
    insertAvoidPoint,
    listAvoidPoints,
} from '@services/db/avoidPointRepository';
import { useSettingsStore } from '@stores/settingsStore';

export interface ReplayRoute {
    geometry: string;
    distanceMeters: number;
    durationSeconds: number;
}

interface MapState {
    destination: Place | null;
    replayRoute: ReplayRoute | null;
    avoidPoints: AvoidPoint[];
    route: RouteResult | null;
    computing: boolean;
    error: string | null;
    loadAvoidPoints: () => Promise<void>;
    setDestination: (place: Place | null) => void;
    addAvoidPoint: (latitude: number, longitude: number) => Promise<void>;
    removeAvoidPoint: (id: string) => Promise<void>;
    clearAvoidPoints: () => Promise<void>;
    compute: (originLat: number, originLon: number) => Promise<void>;
    clearRoute: () => void;
    setReplayRoute: (route: ReplayRoute | null) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
    destination: null,
    replayRoute: null,
    avoidPoints: [],
    route: null,
    computing: false,
    error: null,
    loadAvoidPoints: async () => {
        const points = await listAvoidPoints();
        set({ avoidPoints: points });
    },
    setDestination: (place) => {
        set({ destination: place, error: null });
    },
    addAvoidPoint: async (latitude, longitude) => {
        const saved = await insertAvoidPoint({
            label: `Avoid ${get().avoidPoints.length + 1}`,
            latitude,
            longitude,
            radiusMeters: 30,
        });
        set({ avoidPoints: [...get().avoidPoints, saved] });
    },
    removeAvoidPoint: async (id) => {
        await deleteStoredAvoidPoint(id);
        set({ avoidPoints: get().avoidPoints.filter((point) => point.id !== id) });
    },
    clearAvoidPoints: async () => {
        await clearStoredAvoidPoints();
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
        set({ route: null, destination: null, error: null });
    },
    setReplayRoute: (route) => {
        set({ replayRoute: route });
    },
}));
