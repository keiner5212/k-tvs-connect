import { AvoidPoint, RouteLeg, RouteResult } from '@typings/types';
import { httpPostJson } from './http.service';

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

    const legs: RouteLeg[] = (body.trip?.legs ?? []).map((leg) => ({
        distanceMeters: leg.summary?.length ?? 0,
        durationSeconds: leg.summary?.time ?? 0,
        maneuver: leg.maneuvers?.[0]?.instruction ?? '',
        instruction: leg.maneuvers?.map((maneuver) => maneuver.instruction).join(' ') ?? '',
    }));

    const geometry = (body.trip?.legs ?? []).map((leg) => leg.shape).join('');

    return {
        distanceMeters: body.trip?.summary?.length ?? 0,
        durationSeconds: body.trip?.summary?.time ?? 0,
        geometry,
        legs,
    };
};
