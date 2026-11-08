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

interface ValhallaResponse {
    trip: {
        legs: ValhallaLeg[];
        summary: { length: number; time: number };
    };
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
 * Short cuts the barrio on secondary and tertiary streets. Safe stays on
 * primary roads. Service roads, living streets and tracks lose in both,
 * because those are the alleys. A maneuver stays cheap enough that stepping
 * one block off a camera and rejoining beats a long detour.
 * use_distance above 0.6, and shortest, were measured to dive into residential.
 */
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
                maneuver_penalty: 10,
                disable_hierarchy_pruning: true,
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
        language: 'es-ES',
        directions_options: { units: 'kilometers', language: 'es-ES' },
        units: 'kilometers',
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

    const maneuvers: RouteManeuver[] = (body.trip?.legs ?? []).flatMap((leg) =>
        (leg.maneuvers ?? []).map((maneuver, index) => ({
            instruction: maneuver.instruction ?? '',
            distance: maneuver.distance ?? 0,
            type: maneuver.type ?? 0,
            index,
        })),
    );

    const legs: RouteLeg[] = (body.trip?.legs ?? []).map((leg) => {
        const legMeters = pathLengthMeters(leg.shape);
        return {
            distanceMeters: legMeters > 0 ? legMeters : (leg.summary?.length ?? 0) * 1000,
            durationSeconds: leg.summary?.time ?? 0,
            maneuver: leg.maneuvers?.[0]?.instruction ?? '',
            instruction: leg.maneuvers?.map((maneuver) => maneuver.instruction).join(' ') ?? '',
        };
    });

    const geometry = (body.trip?.legs ?? []).map((leg) => leg.shape).join('');
    const routeMeters = pathLengthMeters(geometry);

    return {
        distanceMeters: routeMeters > 0 ? routeMeters : (body.trip?.summary?.length ?? 0) * 1000,
        durationSeconds: body.trip?.summary?.time ?? 0,
        geometry,
        legs,
        maneuvers,
        avoidOutcome: { applied, relaxed },
    };
};
