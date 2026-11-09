import { RouteObservation } from '@services/eta.service';
import { getDatabase, newId } from './database';

interface ObservationRow {
    observed_at: number;
    observed_seconds: number;
    router_seconds: number;
    router_meters: number;
    confidence: number;
}

export interface RouteContext {
    id: string;
    destinationKey: string;
    originAnchorId: string;
    routerSeconds: number;
    routerMeters: number;
}

const ORIGIN_CLUSTER_METERS = 300;

const distanceMeters = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const h =
        Math.sin(toRad(bLat - aLat) / 2) ** 2 +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(toRad(bLon - aLon) / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * The origin of the same commute moves a few dozen metres every time, so the
 * origins are clustered instead of compared exactly.
 */
const findOrCreateOriginAnchor = async (
    latitude: number,
    longitude: number,
): Promise<string> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<{ id: string; latitude: number; longitude: number }>(
        'SELECT id, latitude, longitude FROM route_origins',
    );

    let closest: { id: string; distance: number } | null = null;
    for (const row of rows) {
        const distance = distanceMeters(latitude, longitude, row.latitude, row.longitude);
        if (distance <= ORIGIN_CLUSTER_METERS && (!closest || distance < closest.distance)) {
            closest = { id: row.id, distance };
        }
    }

    if (closest) {
        return closest.id;
    }

    const id = newId();
    await db.runAsync(
        'INSERT INTO route_origins (id, latitude, longitude, created_at) VALUES (?, ?, ?, ?)',
        id,
        latitude,
        longitude,
        Date.now(),
    );
    return id;
};

export const recordRouteContext = async (input: {
    destinationKey: string;
    originLat: number;
    originLon: number;
    destinationLat: number;
    destinationLon: number;
    routerSeconds: number;
    routerMeters: number;
}): Promise<RouteContext> => {
    const db = getDatabase();
    const originAnchorId = await findOrCreateOriginAnchor(input.originLat, input.originLon);
    const id = newId();

    await db.runAsync(
        `INSERT INTO route_contexts (id, destination_key, origin_anchor_id, origin_lat, origin_lon,
           destination_lat, destination_lon, router_seconds, router_meters, computed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.destinationKey,
        originAnchorId,
        input.originLat,
        input.originLon,
        input.destinationLat,
        input.destinationLon,
        input.routerSeconds,
        input.routerMeters,
        Date.now(),
    );

    return {
        id,
        destinationKey: input.destinationKey,
        originAnchorId,
        routerSeconds: input.routerSeconds,
        routerMeters: input.routerMeters,
    };
};

export const listObservations = async (
    destinationKey: string,
    originAnchorId: string,
): Promise<RouteObservation[]> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<ObservationRow>(
        `SELECT observed_at, observed_seconds, router_seconds, router_meters, confidence
         FROM route_observations
         WHERE destination_key = ? AND origin_anchor_id = ?
         ORDER BY observed_at DESC`,
        destinationKey,
        originAnchorId,
    );

    return rows.map((row) => ({
        observedAt: row.observed_at,
        observedSeconds: row.observed_seconds,
        routerSeconds: row.router_seconds,
        routerMeters: row.router_meters,
        confidence: row.confidence,
    }));
};

const RATIO_MIN = 0.4;
const RATIO_MAX = 2;
const DISTANCE_RATIO_MIN = 0.85;
const DISTANCE_RATIO_MAX = 1.2;

/**
 * Writes what the rider actually took on that route. A trip that does not look
 * like the route is rejected instead of stored, so a bad row cannot poison the
 * estimate later.
 */
export const recordObservation = async (input: {
    context: RouteContext;
    observedSeconds: number;
    observedMeters: number;
}): Promise<boolean> => {
    const db = getDatabase();

    if (input.observedSeconds < 60 || input.observedMeters < 300) {
        return false;
    }

    const ratio = input.observedSeconds / input.context.routerSeconds;
    if (!Number.isFinite(ratio) || ratio < RATIO_MIN || ratio > RATIO_MAX) {
        return false;
    }

    const distanceRatio = input.observedMeters / input.context.routerMeters;
    if (
        !Number.isFinite(distanceRatio) ||
        distanceRatio < DISTANCE_RATIO_MIN ||
        distanceRatio > DISTANCE_RATIO_MAX
    ) {
        return false;
    }

    const now = Date.now();
    await db.runAsync(
        `INSERT INTO route_observations (id, destination_key, origin_anchor_id, observed_at,
           observed_seconds, router_seconds, observed_meters, router_meters, confidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        input.context.destinationKey,
        input.context.originAnchorId,
        now,
        input.observedSeconds,
        input.context.routerSeconds,
        input.observedMeters,
        input.context.routerMeters,
        1,
        now,
    );

    return true;
};
