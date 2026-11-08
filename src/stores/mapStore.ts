import { create } from 'zustand';

import { AvoidPoint, Place, RouteResult } from '@typings/types';
import { ArrivalEstimate, destinationKey, estimateArrival } from '@services/eta.service';
import { computeRoute } from '@services/valhalla.service';
import {
    listObservations,
    recordRouteContext,
    RouteContext,
} from '@services/db/etaRepository';
import {
    clearAvoidPoints as clearStoredAvoidPoints,
    deleteAvoidPoint as deleteStoredAvoidPoint,
    insertAvoidPoint,
    listAvoidPoints,
} from '@services/db/avoidPointRepository';
import { useCameraStore } from '@stores/cameraStore';
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
    arrival: ArrivalEstimate | null;
    routeContext: RouteContext | null;
    computing: boolean;
    error: string | null;
    routeFailures: number;
    loadAvoidPoints: () => Promise<void>;
    setDestination: (place: Place | null) => void;
    addAvoidPoint: (latitude: number, longitude: number) => Promise<void>;
    removeAvoidPoint: (id: string) => Promise<void>;
    clearAvoidPoints: () => Promise<void>;
    compute: (originLat: number, originLon: number) => Promise<void>;
    clearRoute: () => void;
    setReplayRoute: (route: ReplayRoute | null) => void;
}

const describeRouteError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('too large')) {
        return 'The routing answer was too large. Try a shorter route.';
    }
    if (message.includes('status 4')) {
        return 'The routing service refused the request. Check the routing url in Settings.';
    }
    if (message.includes('timeout') || message.includes('aborted')) {
        return 'The routing service took too long. Try again.';
    }
    return 'Could not compute the route.';
};

export const useMapStore = create<MapState>((set, get) => ({
    destination: null,
    replayRoute: null,
    avoidPoints: [],
    route: null,
    arrival: null,
    routeContext: null,
    computing: false,
    error: null,
    routeFailures: 0,
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
        const { selectForRoute } = useCameraStore.getState();
        const cameras = selectForRoute(
            originLat,
            originLon,
            destination.latitude,
            destination.longitude,
        );

        const cameraPoints: AvoidPoint[] = cameras.map((camera) => ({
            id: `ansv-${camera.cameraId}`,
            latitude: camera.latitude,
            longitude: camera.longitude,
            label: camera.address || 'ANSV camera',
            radiusMeters: camera.radiusMeters,
            createdAt: Date.now(),
            source: 'ansv',
        }));

        set({ computing: true, error: null });

        try {
            const route = await computeRoute(valhallaBaseUrl, {
                originLat,
                originLon,
                destinationLat: destination.latitude,
                destinationLon: destination.longitude,
                avoidPoints: [...get().avoidPoints, ...cameraPoints],
            });
            const context = await recordRouteContext({
                destinationKey: destinationKey(destination.latitude, destination.longitude),
                originLat,
                originLon,
                destinationLat: destination.latitude,
                destinationLon: destination.longitude,
                routerSeconds: route.durationSeconds,
                routerMeters: route.distanceMeters,
            });

            const observations = await listObservations(
                context.destinationKey,
                context.originAnchorId,
            );
            const arrival = estimateArrival(
                route.durationSeconds,
                route.distanceMeters,
                observations,
            );

            set({ route, arrival, routeContext: context, computing: false, routeFailures: 0 });
        } catch (error) {
            const failures = get().routeFailures + 1;
            set({
                computing: false,
                routeFailures: failures,
                error:
                    failures > 1
                        ? 'The routing service did not answer. Check the routing url in Settings.'
                        : describeRouteError(error),
            });
        }
    },
    clearRoute: () => {
        set({ route: null, arrival: null, routeContext: null, destination: null, error: null });
    },
    setReplayRoute: (route) => {
        set({ replayRoute: route });
    },
}));
