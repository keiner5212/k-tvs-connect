import { AvoidPoint, RouteLeg, RouteResult } from '@typings/types';
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

export interface RouteRequest {
    originLat: number;
    originLon: number;
    destinationLat: number;
    destinationLon: number;
    avoidPoints?: AvoidPoint[];
    costing?: Costing;
}

const buildPolygon = (point: AvoidPoint): unknown => {
    const radiusLat = point.radiusMeters / 111320;
    const radiusLon =
        point.radiusMeters / (111320 * Math.max(0.1, Math.cos((point.latitude * Math.PI) / 180)));

    const ring = [
        [point.longitude - radiusLon, point.latitude - radiusLat],
        [point.longitude + radiusLon, point.latitude - radiusLat],
        [point.longitude + radiusLon, point.latitude + radiusLat],
        [point.longitude - radiusLon, point.latitude + radiusLat],
        [point.longitude - radiusLon, point.latitude - radiusLat],
    ];

    return { type: 'Polygon', coordinates: [ring] };
};

export const computeRoute = async (
    baseUrl: string,
    request: RouteRequest,
): Promise<RouteResult> => {
    const avoidPoints = request.avoidPoints ?? [];
    const payload: Record<string, unknown> = {
        locations: [
            { lat: request.originLat, lon: request.originLon },
            { lat: request.destinationLat, lon: request.destinationLon },
        ],
        costing: request.costing ?? 'motor_scooter',
        language: 'es-ES',
        directions_options: { units: 'kilometers', language: 'es-ES' },
        units: 'kilometers',
    };

    if (avoidPoints.length > 0) {
        payload.exclude_locations = avoidPoints.map((point) => ({
            lat: point.latitude,
            lon: point.longitude,
        }));
        payload.exclude_polygons = avoidPoints.map(buildPolygon);
    }

    const url = `${baseUrl.replace(/\/$/, '')}/route`;
    const { body } = await httpPostJson<ValhallaResponse>(url, payload, {
        service: 'valhalla',
        minIntervalMs: 1000,
        maxBytes: 5 * 1024 * 1024,
    });

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
    };
};
