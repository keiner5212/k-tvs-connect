import { create } from 'zustand';

import {
    AvoidPoint,
    Place,
    RouteResult,
    SavedRoute,
    TrafficCamera,
} from '@typings/types';
import { estimateRoute, isRideOfRoute, RouteEstimate } from '@services/eta.service';
import { CAMERA_AVOID_RADIUS_METERS } from '@services/ansv.service';
import { Costing, computeRoute, DirectedAvoid } from '@services/valhalla.service';
import { CameraPassage, ROUTE_CORRIDOR_METERS, useCameraStore } from '@stores/cameraStore';
import { decodePolyline, distanceBetween, projectOntoPath } from '@utils/polyline';
import {
    deleteAvoidPoint as deleteStoredAvoidPoint,
    insertAvoidPoint,
    listAvoidPoints,
} from '@services/db/avoidPointRepository';
import { useSettingsStore } from '@stores/settingsStore';
import { logger } from '@utils/logger';

export interface NavigationProgress {
    started: boolean;
    /** when the rider actually moved, the time of the route starts here */
    ridingSince: number;
    /** where the rider was when the route started, to know when it begins */
    startLatitude: number;
    startLongitude: number;
    distanceLeftMeters: number;
    timeLeftSeconds: number;
    arrived: boolean;
}

export interface FocusPoint {
    latitude: number;
    longitude: number;
    cameraId: string | null;
}

export type RouteVariant = 'short' | 'safe';

const REPAIR_PASSES = 4;

export interface RouteVariants {
    /** the shortest way, it can cut between neighbourhoods */
    short: RouteResult | null;
    /** the way that stays on the main roads */
    safe: RouteResult | null;
}

interface MapState {
    destination: Place | null;
    avoidPoints: AvoidPoint[];
    route: RouteResult | null;
    /** the saved route that is on screen, a computed one has none */
    activeRouteId: string | null;
    routes: RouteVariants;
    variant: RouteVariant;
    estimate: RouteEstimate | null;
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
    compute: (originLat: number, originLon: number) => Promise<void>;
    setVariant: (variant: RouteVariant) => void;
    clearRoute: () => void;
    startSavedRoute: (saved: SavedRoute) => Promise<boolean>;
    startNavigation: () => Promise<boolean>;
    stopNavigation: () => void;
    updateNavigation: (latitude: number, longitude: number) => void;
    recordRide: (travelledMeters: number) => Promise<void>;
}

/** how far the rider has to move before the ride counts as started */
const RIDE_START_METERS = 10;

/** the ride ends when the rider is this close to the destination */
const ARRIVAL_METERS = 10;

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

interface CameraPlan {
    sent: number;
    leftOut: number;
    cameras: TrafficCamera[];
}

interface CameraBans {
    directed: DirectedAvoid[];
    hard: AvoidPoint[];
    seen: Set<string>;
    cameras: Map<string, TrafficCamera>;
}

const EMPTY_PLAN: CameraPlan = { sent: 0, leftOut: 0, cameras: [] };

let cameraPlans: { short: CameraPlan; safe: CameraPlan } = {
    short: EMPTY_PLAN,
    safe: EMPTY_PLAN,
};

const emptyBans = (): CameraBans => ({
    directed: [],
    hard: [],
    seen: new Set<string>(),
    cameras: new Map<string, TrafficCamera>(),
});

const hardRadius = (distanceMeters: number): number =>
    Math.min(
        ROUTE_CORRIDOR_METERS,
        Math.max(CAMERA_AVOID_RADIUS_METERS, Math.round(distanceMeters) + 12),
    );

const addHard = (bans: CameraBans, passage: CameraPassage): boolean => {
    const id = `ansv-${passage.camera.cameraId}`;
    const radius = hardRadius(passage.distanceMeters);
    const existing = bans.hard.find((point) => point.id === id);
    bans.cameras.set(passage.camera.cameraId, passage.camera);
    if (!existing) {
        bans.hard.push({
            id,
            latitude: passage.camera.latitude,
            longitude: passage.camera.longitude,
            label: passage.camera.address || 'ANSV camera',
            radiusMeters: radius,
            createdAt: Date.now(),
            source: 'ansv',
        });
        return true;
    }
    if (radius > existing.radiusMeters) {
        existing.radiusMeters = radius;
        return true;
    }
    return false;
};

/**
 * A watched direction is banned only along the stretches the route actually
 * rode that way, so the opposite direction stays rideable. A camera with no
 * published sense closes the spot in every direction.
 */
const addPassage = (bans: CameraBans, passage: CameraPassage): boolean => {
    if (passage.everyDirection) {
        return addHard(bans, passage);
    }
    let added = false;
    for (const shape of passage.shapes) {
        const key = `${passage.camera.cameraId}:${shape}`;
        if (bans.seen.has(key)) {
            continue;
        }
        bans.directed.push({ id: key, shape });
        bans.seen.add(key);
        bans.cameras.set(passage.camera.cameraId, passage.camera);
        added = true;
    }
    if (added) {
        return true;
    }
    // A ring would close the facing direction too, and that seals the destination.
    if (!passage.everyDirection) {
        return false;
    }
    return addHard(bans, passage);
};

const planOf = (
    bans: CameraBans,
    facing: TrafficCamera[],
    behind: TrafficCamera[] = [],
): CameraPlan => {
    const skip = new Set([...facing, ...behind].map((camera) => camera.cameraId));
    const avoided = [...bans.cameras.values()].filter((camera) => !skip.has(camera.cameraId));
    return { sent: avoided.length, leftOut: facing.length, cameras: avoided };
};

const publishPlan = (plan: CameraPlan): void => {
    useCameraStore.getState().setRouteSplit({ sent: plan.sent, leftOut: plan.leftOut });
    useCameraStore.getState().setRouteCameras(plan.cameras);
};

/**
 * Recompute until the route no longer leaves a camera behind the rider.
 * Facing a camera, and crossing it, are left as they are. A ban that seals
 * the destination is dropped and the best route already found is kept.
 */
const routeAroundCameras = async (
    baseUrl: string,
    originLat: number,
    originLon: number,
    destinationLat: number,
    destinationLon: number,
    manual: AvoidPoint[],
    costing: Costing,
): Promise<{ route: RouteResult; plan: CameraPlan }> => {
    const bans = emptyBans();
    const ask = () =>
        computeRoute(baseUrl, {
            originLat,
            originLon,
            destinationLat,
            destinationLon,
            avoidPoints: [...manual, ...bans.hard],
            relaxableCount: manual.length,
            directedAvoids: bans.directed,
            costing,
        });

    let route = await ask();
    let best = route;
    let bestBack = Number.POSITIVE_INFINITY;
    let bestFacing: TrafficCamera[] = [];
    let bestBehind: TrafficCamera[] = [];

    const keep = (candidate: RouteResult, back: CameraPassage[], facing: TrafficCamera[]) => {
        if (
            back.length < bestBack ||
            (back.length === bestBack && candidate.distanceMeters < best.distanceMeters)
        ) {
            best = candidate;
            bestBack = back.length;
            bestFacing = facing;
            bestBehind = back.map((passage) => passage.camera);
        }
    };

    for (let pass = 0; pass < REPAIR_PASSES; pass += 1) {
        const { back, facing } = await useCameraStore.getState().classifyRoute(route.geometry);
        keep(route, back, facing);
        if (back.length === 0) {
            return { route, plan: planOf(bans, facing) };
        }
        let added = false;
        for (const passage of back) {
            if (addPassage(bans, passage)) {
                added = true;
            }
        }
        if (!added) {
            break;
        }
        try {
            route = await ask();
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            if (
                message.includes('timeout') ||
                message.includes('aborted') ||
                message.includes('too large')
            ) {
                throw error;
            }
            break;
        }
    }

    const last = await useCameraStore.getState().classifyRoute(route.geometry);
    keep(route, last.back, last.facing);
    if (last.back.length === 0) {
        return { route, plan: planOf(bans, last.facing) };
    }
    return { route: best, plan: planOf(bans, bestFacing, bestBehind) };
};

export const useMapStore = create<MapState>((set, get) => ({
    destination: null,
    avoidPoints: [],
    route: null,
    activeRouteId: null,
    routes: { short: null, safe: null },
    variant: 'short',
    estimate: null,
    computing: false,
    error: null,
    routeFailures: 0,
    navigation: {
        started: false,
        ridingSince: 0,
        startLatitude: 0,
        startLongitude: 0,
        distanceLeftMeters: 0,
        timeLeftSeconds: 0,
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
             * The short route cuts between neighbourhoods, the safe one stays
             * on the main roads. Each one is repaired until it no longer leaves
             * a camera behind the rider. Facing a camera stays allowed.
             */
            const short = await routeAroundCameras(
                valhallaBaseUrl,
                originLat,
                originLon,
                destination.latitude,
                destination.longitude,
                manualPoints,
                'motor_scooter',
            );
            const safe = await routeAroundCameras(
                valhallaBaseUrl,
                originLat,
                originLon,
                destination.latitude,
                destination.longitude,
                manualPoints,
                'auto',
            ).catch(() => null);

            cameraPlans = { short: short.plan, safe: safe?.plan ?? EMPTY_PLAN };

            const variant = get().variant;
            const chosen = variant === 'safe' && safe ? safe : short;

            publishPlan(chosen.plan);

            set({
                route: chosen.route,
                activeRouteId: null,
                routes: { short: short.route, safe: safe?.route ?? null },
                estimate: estimateRoute([], chosen.route.durationSeconds),
                computing: false,
                routeFailures: 0,
            });
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
        cameraPlans = { short: EMPTY_PLAN, safe: EMPTY_PLAN };
        publishPlan(EMPTY_PLAN);
        set({
            route: null,
            routes: { short: null, safe: null },
            activeRouteId: null,
            estimate: null,
            destination: null,
            error: null,
        });
    },
    setVariant: (variant) => {
        const { estimate, routes, variant: current } = get();
        if (variant === current) {
            return;
        }
        const next = routes[variant];
        if (!next) {
            return;
        }
        publishPlan(cameraPlans[variant]);
        set({
            variant,
            route: next,
            estimate: estimateRoute(estimate?.achievedTimes ?? [], next.durationSeconds),
        });
    },

    /**
     * Doing a saved route again: the destination is set again and the route
     * is the one that was saved, the router is not asked. From here the ride
     * counts the time it takes and the estimate moves with it.
     */
    startSavedRoute: async (saved: SavedRoute) => {
        const destination: Place = {
            id: `saved-${saved.id}`,
            name: saved.destinationName,
            address: saved.destinationName,
            latitude: saved.destinationLat,
            longitude: saved.destinationLon,
        };

        const route: RouteResult = {
            distanceMeters: saved.distanceMeters,
            durationSeconds: saved.durationSeconds,
            geometry: saved.geometry,
        };

        set({
            activeRouteId: saved.id,
            destination,
            error: null,
            estimate: estimateRoute(saved.achievedTimes, saved.durationSeconds),
            route,
            routes: { short: route, safe: null },
            variant: 'short',
        });

        await get().startNavigation();
        return true;
    },

    startNavigation: async () => {
        const { destination, route } = get();
        if (!destination || !route) {
            return false;
        }

        const { requestNotificationPermission } = await import('@services/notifications.service');
        await requestNotificationPermission();

        const { useLocationStore } = await import('@stores/locationStore');
        const position = useLocationStore.getState().position;

        set({
            navigation: {
                ...get().navigation,
                started: true,
                ridingSince: 0,
                startLatitude: position?.[0] ?? 0,
                startLongitude: position?.[1] ?? 0,
                arrived: false,
            },
        });

        await useLocationStore.getState().startWatching('navigation');

        if (position) {
            get().updateNavigation(position[0], position[1]);
        }

        return true;
    },

    stopNavigation: () => {
        set({
            navigation: {
                started: false,
                ridingSince: 0,
                startLatitude: 0,
                startLongitude: 0,
                distanceLeftMeters: 0,
                timeLeftSeconds: 0,
                arrived: false,
            },
        });

        void import('@stores/locationStore').then(({ useLocationStore }) => {
            useLocationStore.getState().stopWatching('navigation');
        });
    },

    updateNavigation: (latitude, longitude) => {
        const { destination, estimate, navigation, route } = get();
        if (!route || !navigation.started || !route.geometry || !destination) {
            return;
        }

        const points = pointsOfRoute(route.geometry);
        const projection = projectOntoPath(points, { lat: latitude, lon: longitude });
        if (!projection) {
            return;
        }

        const travelled = projection.distance;
        const distanceLeftMeters = Math.max(0, route.distanceMeters - travelled);
        const total = estimate?.seconds ?? route.durationSeconds;
        const timeLeftSeconds = Math.max(
            0,
            Math.round((total * distanceLeftMeters) / Math.max(1, route.distanceMeters)),
        );

        /**
         * The time of the route starts when the rider moves, not when the
         * button is pressed, otherwise the minutes spent getting on the bike
         * would be learned as riding time.
         */
        const ridingSince =
            navigation.ridingSince ||
            (navigation.startLatitude !== 0 &&
                distanceBetween(
                    { lat: navigation.startLatitude, lon: navigation.startLongitude },
                    { lat: latitude, lon: longitude },
                ) > RIDE_START_METERS
                ? Date.now()
                : 0);

        /**
         * The ride ends when the rider is on the destination. The place can be
         * a few metres off the road, so the end of the route counts too.
         */
        const arrived =
            navigation.arrived ||
            distanceLeftMeters <= ARRIVAL_METERS ||
            distanceBetween(
                { lat: latitude, lon: longitude },
                { lat: destination.latitude, lon: destination.longitude },
            ) <= ARRIVAL_METERS;

        set({
            navigation: {
                started: true,
                ridingSince,
                startLatitude: navigation.startLatitude,
                startLongitude: navigation.startLongitude,
                distanceLeftMeters,
                timeLeftSeconds,
                arrived,
            },
        });

        if (arrived && !navigation.arrived) {
            void get().recordRide(travelled);
        }
    },

    /**
     * What the route really took. Only a saved route keeps the time, so the
     * history belongs to the routes the rider keeps.
     */
    recordRide: async (travelledMeters) => {
        const { activeRouteId, navigation, route } = get();
        if (!activeRouteId || !navigation.ridingSince || !route) {
            return;
        }

        const seconds = Math.round((Date.now() - navigation.ridingSince) / 1000);
        if (!isRideOfRoute(seconds, travelledMeters, route.distanceMeters)) {
            return;
        }

        try {
            const { recordAchievedTime } = await import('@services/db/routeRepository');
            const achievedTimes = await recordAchievedTime(activeRouteId, seconds);
            if (!achievedTimes) {
                return;
            }

            set({ estimate: estimateRoute(achievedTimes, route.durationSeconds) });
            logger.info('the time of the route was stored', {
                service: 'db',
                event: 'route_observed',
                count: seconds,
                durationMs: seconds * 1000,
            });
        } catch (error) {
            logger.warn('the time of the route could not be stored', {
                service: 'db',
                event: 'route_observed',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
        }
    },
}));
