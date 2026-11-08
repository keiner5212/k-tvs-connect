import { create } from 'zustand';

import { AvoidPoint, Place, RouteResult } from '@typings/types';
import { NavigationUpdate } from '@ble/protocol';
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
    turnDirection: 'left' | 'right' | null;
    arrived: boolean;
}

export interface FocusPoint {
    latitude: number;
    longitude: number;
    cameraId: string | null;
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
    focus: FocusPoint | null;
    cameraKey: number;
    loadAvoidPoints: () => Promise<void>;
    setDestination: (place: Place | null) => void;
    focusOn: (latitude: number, longitude: number, cameraId?: string | null) => void;
    recenter: () => void;
    addAvoidPoint: (latitude: number, longitude: number) => Promise<void>;
    removeAvoidPoint: (id: string) => Promise<void>;
    clearAvoidPoints: () => Promise<void>;
    compute: (originLat: number, originLon: number) => Promise<void>;
    clearRoute: () => void;
    setReplayRoute: (route: ReplayRoute | null) => void;
    startNavigation: () => Promise<boolean>;
    stopNavigation: () => void;
    navigationUpdate: () => NavigationUpdate;
    updateNavigation: (latitude: number, longitude: number) => void;
}

/**
 * The pictogram the cluster draws. The original sends the id of the arrow of
 * the manoeuvre, and 34 when there is no manoeuvre left.
 */
const NAVIGATION_PICTO_DEFAULT = 0;
const NAVIGATION_PICTO_ARRIVED = 34;

/**
 * The direction of a valhalla manoeuvre, which is what the cluster uses to show
 * a left or a right arrow when the turn is close.
 */
const turnDirectionFromType = (type: number): 'left' | 'right' | null => {
    if ([2, 13, 14, 15, 16, 24].includes(type)) {
        return 'right';
    }
    if ([3, 9, 10, 11, 12, 25].includes(type)) {
        return 'left';
    }
    return null;
};

/**
 * The shape of the route is decoded once and kept, because the navigation reads
 * it on every position and the decoding is the expensive part.
 */
let decodedGeometry: string | null = null;
let decodedPoints: { lat: number; lon: number }[] = [];

const pointsOfRoute = (geometry: string): { lat: number; lon: number }[] => {
    if (geometry !== decodedGeometry) {
        decodedGeometry = geometry;
        decodedPoints = decodePolyline(geometry, 6);
    }
    return decodedPoints;
};

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
        turnDirection: null,
        arrived: false,
    },
    focus: null,
    cameraKey: 0,
    loadAvoidPoints: async () => {
        const points = await listAvoidPoints();
        set({ avoidPoints: points });
    },
    setDestination: (place) => {
        set((state) => ({
            destination: place,
            error: null,
            focus: null,
            cameraKey: state.cameraKey + 1,
        }));
    },
    focusOn: (latitude, longitude, cameraId = null) => {
        set({ focus: { latitude, longitude, cameraId } });
    },
    recenter: () => {
        set((state) => ({ focus: null, cameraKey: state.cameraKey + 1 }));
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
        const manualPoints = get().avoidPoints;

        set({ computing: true, error: null });

        try {
            /**
             * The first route is the shortest one, without the cameras. It shows
             * which way the rider goes through every street, and that is what
             * decides whether a camera watches the back of the bike or the
             * front of it.
             */
            const baseline = await computeRoute(valhallaBaseUrl, {
                originLat,
                originLon,
                destinationLat: destination.latitude,
                destinationLon: destination.longitude,
                avoidPoints: manualPoints,
            });

            const { risky } = await useCameraStore.getState().selectForRoute(baseline.geometry);

            const cameraPoints: AvoidPoint[] = risky.map((camera) => ({
                id: `ansv-${camera.cameraId}`,
                latitude: camera.latitude,
                longitude: camera.longitude,
                label: camera.address || 'ANSV camera',
                radiusMeters: camera.radiusMeters,
                createdAt: Date.now(),
                source: 'ansv',
            }));

            const route =
                cameraPoints.length > 0
                    ? await computeRoute(valhallaBaseUrl, {
                        originLat,
                        originLon,
                        destinationLat: destination.latitude,
                        destinationLon: destination.longitude,
                        avoidPoints: [...manualPoints, ...cameraPoints],
                    })
                    : baseline;

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

    startNavigation: async () => {
        const { destination, route } = get();
        if (!destination || !route) {
            return false;
        }

        const { connectionController } = await import('@ble/connectionController');
        const address = destination.address || destination.name;
        await connectionController.requestNotificationPermission();
        const sent = await connectionController.sendDestinationToCluster(address);

        set({
            navigation: {
                ...get().navigation,
                started: true,
                arrived: false,
            },
        });

        const { useLocationStore } = await import('@stores/locationStore');
        await useLocationStore.getState().startWatching('navigation');

        const position = useLocationStore.getState().position;
        if (position) {
            get().updateNavigation(position[0], position[1]);
        }

        await connectionController.refreshEnvironment();
        await connectionController.startNavigation(get().navigationUpdate());

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
                turnDirection: null,
                arrived: false,
            },
        });

        void import('@ble/connectionController').then(({ connectionController }) => {
            connectionController.stopNavigation();
        });
        void import('@stores/locationStore').then(({ useLocationStore }) => {
            useLocationStore.getState().stopWatching('navigation');
        });
    },

    navigationUpdate: () => {
        const { navigation } = get();
        return {
            distanceToNextManeuverMeters: Math.round(navigation.distanceToManeuverMeters),
            timeLeftMinutes: Math.round(navigation.timeLeftSeconds / 60),
            totalDistanceLeftMeters: Math.round(navigation.distanceLeftMeters),
            pictogramId: navigation.arrived ? NAVIGATION_PICTO_ARRIVED : NAVIGATION_PICTO_DEFAULT,
            navigationOn: navigation.started && !navigation.arrived,
            arrived: navigation.arrived,
            turnDirection: navigation.turnDirection,
            instruction: navigation.instruction,
        };
    },

    updateNavigation: (latitude, longitude) => {
        const { route, navigation, arrival } = get();
        if (!route || !navigation.started || !route.geometry) {
            return;
        }

        const points = pointsOfRoute(route.geometry);
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
                turnDirection: turnDirectionFromType(next?.type ?? 0),
                arrived: distanceLeftMeters < 25,
            },
        });

        void import('@ble/connectionController').then(({ connectionController }) => {
            connectionController.updateNavigation(get().navigationUpdate());
        });
    },
}));
