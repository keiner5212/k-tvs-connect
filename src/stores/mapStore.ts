import { create } from 'zustand';

import { AvoidPoint, Place, RouteResult } from '@typings/types';
import { ArrivalEstimate, destinationKey, estimateArrival } from '@services/eta.service';
import { computeRoute } from '@services/valhalla.service';
import { decodePolyline, nearestPointIndex, remainingDistanceMeters } from '@utils/polyline';
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

export interface NavigationProgress {
    started: boolean;
    distanceLeftMeters: number;
    timeLeftSeconds: number;
    distanceToManeuverMeters: number;
    instruction: string;
    arrived: boolean;
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
    navigation: NavigationProgress;
    loadAvoidPoints: () => Promise<void>;
    setDestination: (place: Place | null) => void;
    addAvoidPoint: (latitude: number, longitude: number) => Promise<void>;
    removeAvoidPoint: (id: string) => Promise<void>;
    clearAvoidPoints: () => Promise<void>;
    compute: (originLat: number, originLon: number) => Promise<void>;
    clearRoute: () => void;
    setReplayRoute: (route: ReplayRoute | null) => void;
    startNavigation: () => Promise<boolean>;
    stopNavigation: () => void;
    updateNavigation: (latitude: number, longitude: number) => void;
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
    navigation: {
        started: false,
        distanceLeftMeters: 0,
        timeLeftSeconds: 0,
        distanceToManeuverMeters: 0,
        instruction: '',
        arrived: false,
    },
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
            radiusMeters: 60,
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
        const cameras = await selectForRoute(
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

            const applied = route.avoidOutcome?.applied ?? cameraPoints.length;
            if (applied < cameraPoints.length) {
                useCameraStore.getState().setRouteSplit({
                    sent: 0,
                    leftOut: cameraPoints.length,
                });
                useCameraStore.getState().setRouteCameras([]);
            }

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

    startNavigation: async () => {
        const { destination, route } = get();
        if (!destination || !route) {
            return false;
        }

        const { connectionController } = await import('@ble/connectionController');
        const address = destination.address || destination.name;
        const sent = await connectionController.sendDestinationToCluster(address);

        set({
            navigation: {
                ...get().navigation,
                started: true,
                arrived: false,
            },
        });

        const { useLocationStore } = await import('@stores/locationStore');
        await useLocationStore.getState().startWatching();

        return sent;
    },

    stopNavigation: () => {
        set({
            navigation: {
                started: false,
                distanceLeftMeters: 0,
                timeLeftSeconds: 0,
                distanceToManeuverMeters: 0,
                instruction: '',
                arrived: false,
            },
        });
    },

    updateNavigation: (latitude, longitude) => {
        const { route, navigation, arrival } = get();
        if (!route || !navigation.started || !route.geometry) {
            return;
        }

        const points = decodePolyline(route.geometry, 6);
        const index = nearestPointIndex(points, { lat: latitude, lon: longitude });
        if (index < 0) {
            return;
        }

        const distanceLeftMeters = remainingDistanceMeters(points, index);
        const factor = arrival?.factor ?? 1;
        const timeLeftSeconds = Math.max(
            0,
            Math.round((route.durationSeconds * distanceLeftMeters) / Math.max(1, route.distanceMeters) * factor),
        );

        const maneuvers = route.maneuvers ?? [];
        const travelled = route.distanceMeters - distanceLeftMeters;
        let accumulated = 0;
        let next = maneuvers[maneuvers.length - 1];
        let distanceToManeuver = distanceLeftMeters;

        for (const maneuver of maneuvers) {
            accumulated += maneuver.distance;
            if (accumulated > travelled) {
                next = maneuver;
                distanceToManeuver = Math.max(0, accumulated - travelled);
                break;
            }
        }

        set({
            navigation: {
                started: true,
                distanceLeftMeters,
                timeLeftSeconds,
                distanceToManeuverMeters: distanceToManeuver,
                instruction: next?.instruction ?? '',
                arrived: distanceLeftMeters < 25,
            },
        });
    },
}));
