import { AvoidPoint, RouteLeg, RouteManeuver, RouteResult } from '@typings/types';
import { decodePolyline, distanceAlongPath } from '@utils/polyline';
import { httpPostJson } from './http.service';

/**
 * The router reports the summary length in kilometres whatever the units
 * parameter says, so the distance comes from the encoded shape, which is always
 * in metres.
 */
const pathLengthMeters = (shape: string): number => {
    if (!shape) {
        return 0;
    }
    const points = decodePolyline(shape, 6);
    const distances = distanceAlongPath(points);
    return distances.length > 0 ? distances[distances.length - 1] : 0;
};

export type Costing = 'motor_scooter' | 'motorcycle' | 'bicycle' | 'auto';

interface ValhallaManeuver {
    instruction: string;
    street_names?: string[];
    begin_shape_index?: number;
    end_shape_index?: number;
    distance?: number;
    type?: number;
}

interface ValhallaLeg {
    summary: { length: number; time: number };
    shape: string;
    maneuvers: ValhallaManeuver[];
}

interface ValhallaTrip {
    legs: ValhallaLeg[];
    summary: { length: number; time: number };
}

interface ValhallaResponse {
    trip: ValhallaTrip;
    alternates?: { trip: ValhallaTrip }[];
}

interface TraceEdge {
    road_class?: string;
    length?: number;
}

interface TraceResponse {
    edges?: TraceEdge[];
}

interface RoadShares {
    main: number;
    small: number;
}

export interface DirectedAvoid {
    id: string;
    /** polyline6, drawn in the one direction that must not be ridden */
    shape: string;
}

export interface RouteRequest {
    originLat: number;
    originLon: number;
    destinationLat: number;
    destinationLon: number;
    avoidPoints?: AvoidPoint[];
    /**
     * Leading avoid points that may be dropped when they make the route
     * impossible. The rest are kept on every attempt.
     */
    relaxableCount?: number;
    directedAvoids?: DirectedAvoid[];
    costing?: Costing;
}

/**
 * The public router clamps a factor of 0 up to 1, which changes nothing, and
 * a factor of 20 only nudges the route. A factor this large is what makes it
 * leave the matched edges. The match follows the shape, so the opposite
 * direction of the same road stays open.
 */
const DIRECTED_AVOID_FACTOR = 1000000;

/**
 * Short cuts the barrio on secondary and tertiary streets. Safe leaves
 * hierarchy pruning on, so a mid-route alley is not searched, then keeps an
 * alternate with more primary and trunk. A small gain stays within 1.7x. A
 * jump of 40 points may stretch to 2.5x when the extra distance is under 5 km.
 * use_highways only nudges motorway and trunk, so it does not pull a trip off
 * a secondary avenue by itself.
 * use_distance above 0.6, and shortest, were measured to dive into residential.
 */
const MAIN_ROADS = new Set(['motorway', 'trunk', 'primary']);
const SEMI_ROADS = new Set(['secondary', 'tertiary', 'unclassified']);
const MAIN_ROAD_ENOUGH = 0.7;
const MAIN_ROAD_GAIN = 0.12;
const MAIN_ROAD_STRONG_GAIN = 0.4;
const SMALL_ROAD_SLACK = 0.08;
const MAIN_ROAD_STRETCH = 1.7;
const MAIN_ROAD_STRETCH_STRONG = 2.5;
const MAIN_ROAD_EXTRA_METERS = 5000;
const ALTERNATE_ROUTES = 2;

const costingOptionsFor = (costing: Costing): Record<string, unknown> | null => {
    if (costing === 'motor_scooter') {
        return {
            motor_scooter: {
                top_speed: 70,
                use_highways: 0.15,
                use_primary: 0.45,
                use_distance: 0.55,
                use_living_streets: 0,
                use_tracks: 0,
                service_penalty: 200,
                service_factor: 40,
                maneuver_penalty: 5,
                disable_hierarchy_pruning: true,
            },
        };
    }
    if (costing === 'auto') {
        return {
            auto: {
                use_highways: 1,
                use_tolls: 0.5,
                top_speed: 120,
                use_living_streets: 0,
                use_tracks: 0,
                service_penalty: 80,
                service_factor: 15,
                maneuver_penalty: 15,
            },
        };
    }
    return null;
};

/**
 * How many of the avoid points the router actually managed to exclude. A
 * point that makes the route impossible is dropped and the request is tried
 * again with fewer points.
 */
export interface AvoidOutcome {
    applied: number;
    relaxed: boolean;
}

/**
 * The router takes the polygons as plain rings of coordinates, not as GeoJSON
 * objects. A GeoJSON polygon is refused with a parse error.
 *
 * The ring is a circle of the radius of the point. The router removes every
 * road that crosses the ring, so the route keeps at least that distance from
 * the point.
 */
const buildPolygon = (point: AvoidPoint): number[][] => {
    const radiusLat = point.radiusMeters / 111320;
    const radiusLon =
        point.radiusMeters / (111320 * Math.max(0.1, Math.cos((point.latitude * Math.PI) / 180)));

    const ring: number[][] = [];
    for (let step = 0; step <= 16; step += 1) {
        const angle = (step / 16) * 2 * Math.PI;
        ring.push([
            point.longitude + radiusLon * Math.cos(angle),
            point.latitude + radiusLat * Math.sin(angle),
        ]);
    }

    return ring;
};

/**
 * The attempts of the request, from every point to none. A point that makes
 * the route impossible is dropped, one half at a time, so the route keeps the
 * points that matter most. The points are given in the order they matter:
 * the manual ones first and the cameras after them, the closest camera last.
 */
const attemptCounts = (total: number): number[] =>
    [total, Math.floor(total / 2), 0].filter(
        (count, index, all) => index === 0 || count < all[index - 1],
    );

const tripShape = (trip: ValhallaTrip): string =>
    (trip.legs ?? []).map((leg) => leg.shape).join('');

const roadShares = async (
    baseUrl: string,
    shape: string,
    httpOptions: { service: string; minIntervalMs: number; maxBytes: number },
): Promise<RoadShares | null> => {
    if (!shape) {
        return null;
    }
    try {
        const response = await httpPostJson<TraceResponse>(
            `${baseUrl.replace(/\/$/, '')}/trace_attributes`,
            {
                encoded_polyline: shape,
                costing: 'auto',
                shape_match: 'map_snap',
                filters: {
                    action: 'include',
                    attributes: ['edge.road_class', 'edge.length'],
                },
            },
            httpOptions,
        );
        const totals = new Map<string, number>();
        for (const edge of response.body.edges ?? []) {
            const kind = edge.road_class || 'unknown';
            totals.set(kind, (totals.get(kind) ?? 0) + (edge.length ?? 0));
        }
        const total = [...totals.values()].reduce((sum, length) => sum + length, 0);
        if (total <= 0) {
            return null;
        }
        const share = (names: Set<string>): number =>
            [...totals.entries()].reduce(
                (sum, [kind, length]) => (names.has(kind) ? sum + length : sum),
                0,
            ) / total;
        const main = share(MAIN_ROADS);
        const semi = share(SEMI_ROADS);
        return { main, small: Math.max(0, 1 - main - semi) };
    } catch {
        return null;
    }
};

const allowsStretch = (meters: number, firstMeters: number, mainGain: number): boolean => {
    if (firstMeters <= 0) {
        return true;
    }
    const ratio = meters / firstMeters;
    if (ratio <= MAIN_ROAD_STRETCH) {
        return true;
    }
    return (
        mainGain >= MAIN_ROAD_STRONG_GAIN &&
        ratio <= MAIN_ROAD_STRETCH_STRONG &&
        meters - firstMeters <= MAIN_ROAD_EXTRA_METERS
    );
};

// Fastest auto path can be the same secondary avenue. Keep a main-road alternate.
const preferMainRoads = async (
    baseUrl: string,
    body: ValhallaResponse,
    httpOptions: { service: string; minIntervalMs: number; maxBytes: number },
): Promise<ValhallaTrip> => {
    const first = body.trip;
    const firstShape = tripShape(first);
    const firstShares = await roadShares(baseUrl, firstShape, httpOptions);
    const alternates = body.alternates ?? [];
    if (!firstShares || firstShares.main >= MAIN_ROAD_ENOUGH || alternates.length === 0) {
        return first;
    }
    const firstMeters = pathLengthMeters(firstShape);
    let best = first;
    let bestMain = firstShares.main;
    for (const alternate of alternates) {
        const shape = tripShape(alternate.trip);
        const meters = pathLengthMeters(shape);
        const shares = await roadShares(baseUrl, shape, httpOptions);
        if (!shares) {
            continue;
        }
        const gain = shares.main - firstShares.main;
        if (!allowsStretch(meters, firstMeters, gain)) {
            continue;
        }
        if (gain < MAIN_ROAD_GAIN) {
            continue;
        }
        if (shares.small > firstShares.small + SMALL_ROAD_SLACK) {
            continue;
        }
        if (shares.main > bestMain) {
            best = alternate.trip;
            bestMain = shares.main;
        }
    }
    return best;
};

export const computeRoute = async (
    baseUrl: string,
    request: RouteRequest,
): Promise<RouteResult> => {
    const avoidPoints = request.avoidPoints ?? [];
    const relaxableCount = Math.min(request.relaxableCount ?? avoidPoints.length, avoidPoints.length);
    const relaxable = avoidPoints.slice(0, relaxableCount);
    const required = avoidPoints.slice(relaxableCount);
    const directed = [
        ...new Map(
            (request.directedAvoids ?? [])
                .filter((item) => item.shape.length > 0)
                .map((item) => [item.shape, item]),
        ).values(),
    ];
    const costing = request.costing ?? 'motor_scooter';
    const profile = costingOptionsFor(costing);
    const base: Record<string, unknown> = {
        locations: [
            { lat: request.originLat, lon: request.originLon },
            { lat: request.destinationLat, lon: request.destinationLon },
        ],
        costing,
        language: 'en-US',
        directions_options: { units: 'kilometers', language: 'en-US' },
        units: 'kilometers',
        ...(costing === 'auto' ? { alternates: ALTERNATE_ROUTES } : {}),
        ...(profile ? { costing_options: profile } : {}),
    };

    const url = `${baseUrl.replace(/\/$/, '')}/route`;
    const options = { service: 'valhalla', minIntervalMs: 1000, maxBytes: 5 * 1024 * 1024 };

    const attempts: { payload: Record<string, unknown>; applied: number; relaxed: boolean }[] =
        attemptCounts(relaxable.length).map((count) => {
            const polygons = [...relaxable.slice(0, count), ...required].map(buildPolygon);
            const payload: Record<string, unknown> = { ...base };
            if (polygons.length > 0) {
                payload.exclude_polygons = polygons;
            }
            if (directed.length > 0) {
                payload.linear_cost_factors = directed.map((item) => ({
                    shape: item.shape,
                    factor: DIRECTED_AVOID_FACTOR,
                }));
            }
            return {
                payload,
                applied: count + required.length,
                relaxed: count < relaxable.length,
            };
        });

    let body: ValhallaResponse | null = null;
    let applied = 0;
    let relaxed = false;

    for (const attempt of attempts) {
        try {
            const response = await httpPostJson<ValhallaResponse>(url, attempt.payload, options);
            body = response.body;
            applied = attempt.applied;
            relaxed = attempt.relaxed;
            break;
        } catch (error) {
            if (error instanceof Error && error.message.includes('status 4')) {
                continue;
            }
            throw error;
        }
    }

    if (!body) {
        throw new Error('no route could be computed');
    }

    const trip =
        costing === 'auto' ? await preferMainRoads(baseUrl, body, options) : body.trip;

    const maneuvers: RouteManeuver[] = (trip?.legs ?? []).flatMap((leg) =>
        (leg.maneuvers ?? []).map((maneuver, index) => ({
            instruction: maneuver.instruction ?? '',
            distance: maneuver.distance ?? 0,
            type: maneuver.type ?? 0,
            index,
        })),
    );

    const legs: RouteLeg[] = (trip?.legs ?? []).map((leg) => {
        const legMeters = pathLengthMeters(leg.shape);
        return {
            distanceMeters: legMeters > 0 ? legMeters : (leg.summary?.length ?? 0) * 1000,
            durationSeconds: leg.summary?.time ?? 0,
            maneuver: leg.maneuvers?.[0]?.instruction ?? '',
            instruction: leg.maneuvers?.map((maneuver) => maneuver.instruction).join(' ') ?? '',
        };
    });

    const geometry = tripShape(trip);
    const routeMeters = pathLengthMeters(geometry);

    return {
        distanceMeters: routeMeters > 0 ? routeMeters : (trip?.summary?.length ?? 0) * 1000,
        durationSeconds: trip?.summary?.time ?? 0,
        geometry,
        legs,
        maneuvers,
        avoidOutcome: { applied, relaxed },
    };
};
