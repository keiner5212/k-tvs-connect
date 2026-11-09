import { create } from 'zustand';

import {
    AvoidPoint,
    Place,
    RouteManeuver,
    RouteResult,
    RouteStep,
    SavedRoute,
    TrafficCamera,
} from '@typings/types';
import { ArrivalEstimate, destinationKey, estimateArrival } from '@services/eta.service';
import { CAMERA_AVOID_RADIUS_METERS } from '@services/ansv.service';
import { Costing, computeRoute, DirectedAvoid } from '@services/valhalla.service';
import { CameraPassage, ROUTE_CORRIDOR_METERS, useCameraStore } from '@stores/cameraStore';
import { decodePolyline, distanceBetween, projectOntoPath } from '@utils/polyline';
import {
    listObservations,
    recordRouteContext,
    RouteContext,
} from '@services/db/etaRepository';
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
    /** the turns that are still ahead, with the distance to each one */
    steps: RouteStep[];
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
    /** a route that comes from the saved list is not asked to the router again */
    routeSource: 'computed' | 'saved';
    routes: RouteVariants;
    variant: RouteVariant;
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
    compute: (originLat: number, originLon: number) => Promise<void>;
    setVariant: (variant: RouteVariant) => void;
    clearRoute: () => void;
    startSavedRoute: (saved: SavedRoute) => Promise<boolean>;
    startNavigation: () => Promise<boolean>;
    stopNavigation: () => void;
    updateNavigation: (latitude: number, longitude: number) => void;
}

/**
 * The pictogram the cluster draws. The original sends the id of the arrow of
 * the manoeuvre, and 34 when there is no manoeuvre left.
 */
/**
 * The direction of a valhalla manoeuvre, which is what the cluster uses to show
 * a left or a right arrow when the turn is close.
 */
/**
 * The types of the router: 1 start, 4 destination, 5 destination right, 6
 * destination left, 9 slight right, 10 right, 11 sharp right, 12 u-turn
 * right, 13 u-turn left, 14 sharp left, 15 left, 16 slight left, 20 exit
 * right, 21 exit left, 23 stay right, 24 stay left, 37 merge right, 38 merge
 * left.
 */
const START_MANEUVER_TYPE = 1;
const ARRIVAL_MANEUVER_TYPES = [4, 5, 6];

/** how far the rider has to move before the ride counts as started */
const RIDE_START_METERS = 40;

const turnDirectionFromType = (type: number): 'left' | 'right' | null => {
    if (type < 0) {
        return null;
    }
    if ([9, 10, 11, 12, 20, 23, 37].includes(type)) {
        return 'right';
    }
    if ([13, 14, 15, 16, 21, 24, 38].includes(type)) {
        return 'left';
    }
    return null;
};

/**
 * The steps that are still ahead of the rider, with the distance to each one.
 * The arrival is the last step of the list.
 */
const buildSteps = (maneuvers: RouteManeuver[], travelled: number): RouteStep[] => {
    const steps: RouteStep[] = [];
    for (const maneuver of maneuvers) {
        if (maneuver.type === START_MANEUVER_TYPE) {
            continue;
        }
        const distance = maneuver.distance - travelled;
        if (distance < -15) {
            continue;
        }
        steps.push({
            distanceMeters: Math.max(0, distance),
            instruction: maneuver.instruction,
            turnDirection: turnDirectionFromType(maneuver.type),
            isArrival: ARRIVAL_MANEUVER_TYPES.includes(maneuver.type),
        });
    }
    return steps;
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

/**
 * What the route really took. Only a route that is on the list of saved
 * routes counts, so the history belongs to the routes the rider keeps.
 */
const recordCompletion = async (state: MapState): Promise<void> => {
    const { destination, navigation, route, routeContext } = state;
    if (!route || !routeContext || !destination || !navigation.ridingSince) {
        return;
    }

    try {
        const { listRoutes } = await import('@services/db/routeRepository');
        const saved = await listRoutes();
        const isSaved = saved.some(
            (item) =>
                item.destinationLat === destination.latitude &&
                item.destinationLon === destination.longitude &&
                item.geometry === route.geometry,
        );
        if (!isSaved) {
            return;
        }

        const observedSeconds = Math.round((Date.now() - navigation.ridingSince) / 1000);
        const { recordObservation } = await import('@services/db/etaRepository');
        const stored = await recordObservation({
            context: routeContext,
            observedMeters: route.distanceMeters,
            observedSeconds,
        });
        if (stored) {
            logger.info('the time of the route was stored', {
                service: 'db',
                event: 'route_observed',
                count: observedSeconds,
                durationMs: observedSeconds * 1000,
            });
        }
    } catch (error) {
        logger.warn('the time of the route could not be stored', {
            service: 'db',
            event: 'route_observed',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
    }
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
    routeSource: 'computed',
    routes: { short: null, safe: null },
    variant: 'short',
    arrival: null,
    routeContext: null,
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
        steps: [],
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

            const context = await recordRouteContext({
                destinationKey: destinationKey(destination.latitude, destination.longitude),
                originLat,
                originLon,
                destinationLat: destination.latitude,
                destinationLon: destination.longitude,
                routerSeconds: chosen.route.durationSeconds,
                routerMeters: chosen.route.distanceMeters,
            });

            const observations = await listObservations(
                context.destinationKey,
                context.originAnchorId,
            );
            const arrival = estimateArrival(
                chosen.route.durationSeconds,
                chosen.route.distanceMeters,
                observations,
            );

            publishPlan(chosen.plan);

            set({
                route: chosen.route,
                routeSource: 'computed',
                routes: { short: short.route, safe: safe?.route ?? null },
                arrival,
                routeContext: context,
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
            arrival: null,
            routeContext: null,
            destination: null,
            error: null,
        });
    },
    setVariant: (variant) => {
        const { routes, routeContext, variant: current } = get();
        if (variant === current) {
            return;
        }
        const next = routes[variant];
        if (!next) {
            return;
        }
        publishPlan(cameraPlans[variant]);
        set({ variant, route: next });

        if (!routeContext) {
            return;
        }
        void listObservations(routeContext.destinationKey, routeContext.originAnchorId).then(
            (observations) => {
                set({
                    arrival: estimateArrival(
                        next.durationSeconds,
                        next.distanceMeters,
                        observations,
                    ),
                });
            },
        );
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
            legs: [],
            maneuvers: saved.maneuvers ?? [],
        };

        const { useLocationStore } = await import('@stores/locationStore');
        const position = useLocationStore.getState().position;
        const context = await recordRouteContext({
            destinationKey: destinationKey(destination.latitude, destination.longitude),
            originLat: position?.[0] ?? saved.originLat,
            originLon: position?.[1] ?? saved.originLon,
            destinationLat: destination.latitude,
            destinationLon: destination.longitude,
            routerSeconds: saved.durationSeconds,
            routerMeters: saved.distanceMeters,
        });
        const observations = await listObservations(
            context.destinationKey,
            context.originAnchorId,
        );
        const arrival = estimateArrival(
            saved.durationSeconds,
            saved.distanceMeters,
            observations,
        );

        set({
            arrival,
            destination,
            error: null,
            route,
            routeSource: 'saved',
            routeContext: context,
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
                steps: [],
                arrived: false,
            },
        });

        void import('@stores/locationStore').then(({ useLocationStore }) => {
            useLocationStore.getState().stopWatching('navigation');
        });
    },

    updateNavigation: (latitude, longitude) => {
        const { route, navigation, arrival } = get();
        if (!route || !navigation.started || !route.geometry) {
            return;
        }

        const points = pointsOfRoute(route.geometry);
        const projection = projectOntoPath(points, { lat: latitude, lon: longitude });
        if (!projection) {
            return;
        }

        const travelled = projection.distance;
        const distanceLeftMeters = Math.max(0, route.distanceMeters - travelled);
        const factor = arrival?.factor ?? 1;
        const timeLeftSeconds = Math.max(
            0,
            Math.round((route.durationSeconds * distanceLeftMeters) / Math.max(1, route.distanceMeters) * factor),
        );

        const steps = buildSteps(route.maneuvers ?? [], travelled);

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

        const arrived = distanceLeftMeters < 25;

        set({
            navigation: {
                started: true,
                ridingSince,
                startLatitude: navigation.startLatitude,
                startLongitude: navigation.startLongitude,
                distanceLeftMeters,
                timeLeftSeconds,
                steps,
                arrived,
            },
        });

        if (arrived && !navigation.arrived) {
            void recordCompletion(get());
        }

    },
}));
