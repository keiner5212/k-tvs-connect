import { create } from 'zustand';

import { AvoidPoint, Place, RouteResult, TrafficCamera } from '@typings/types';
import { NavigationUpdate } from '@ble/protocol';
import { ArrivalEstimate, destinationKey, estimateArrival } from '@services/eta.service';
import { CAMERA_AVOID_RADIUS_METERS } from '@services/ansv.service';
import { Costing, computeRoute, DirectedAvoid } from '@services/valhalla.service';
import { CameraPassage, useCameraStore } from '@stores/cameraStore';
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

export type RouteVariant = 'short' | 'safe';

const CAMERA_BEHIND = 'No route avoids a camera behind the bike.';
const REPAIR_PASSES = 4;

export interface RouteVariants {
    /** the shortest way, it can cut between neighbourhoods */
    short: RouteResult | null;
    /** the way that stays on the main roads */
    safe: RouteResult | null;
}

interface MapState {
    destination: Place | null;
    replayRoute: ReplayRoute | null;
    avoidPoints: AvoidPoint[];
    route: RouteResult | null;
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
    clearAvoidPoints: () => Promise<void>;
    compute: (originLat: number, originLon: number) => Promise<void>;
    setVariant: (variant: RouteVariant) => void;
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
    if (message.includes('camera behind')) {
        return CAMERA_BEHIND;
    }
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
    Math.min(45, Math.max(CAMERA_AVOID_RADIUS_METERS, Math.round(distanceMeters) + 12));

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
    return addHard(bans, passage);
};

const planOf = (bans: CameraBans, facing: TrafficCamera[]): CameraPlan => {
    const facingIds = new Set(facing.map((camera) => camera.cameraId));
    const avoided = [...bans.cameras.values()].filter((camera) => !facingIds.has(camera.cameraId));
    return { sent: avoided.length, leftOut: facing.length, cameras: avoided };
};

const publishPlan = (plan: CameraPlan): void => {
    useCameraStore.getState().setRouteSplit({ sent: plan.sent, leftOut: plan.leftOut });
    useCameraStore.getState().setRouteCameras(plan.cameras);
};

/**
 * Recompute until the route no longer leaves a camera behind the rider.
 * Facing a camera, and crossing it, are left as they are.
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

    for (let pass = 0; pass < REPAIR_PASSES; pass += 1) {
        const { back, facing } = await useCameraStore.getState().classifyRoute(route.geometry);
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
            throw new Error(CAMERA_BEHIND);
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
            throw new Error(CAMERA_BEHIND);
        }
    }

    const last = await useCameraStore.getState().classifyRoute(route.geometry);
    if (last.back.length > 0) {
        throw new Error(CAMERA_BEHIND);
    }
    return { route, plan: planOf(bans, last.facing) };
};

export const useMapStore = create<MapState>((set, get) => ({
    destination: null,
    replayRoute: null,
    avoidPoints: [],
    route: null,
    routes: { short: null, safe: null },
    variant: 'short',
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
