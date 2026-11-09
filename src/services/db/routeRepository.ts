import { AvoidPoint, RouteManeuver, SavedRoute } from '@typings/types';
import { getDatabase, newId } from './database';

interface RouteRow {
    id: string;
    name: string;
    origin_name: string;
    destination_name: string;
    origin_lat: number;
    origin_lon: number;
    destination_lat: number;
    destination_lon: number;
    distance_meters: number;
    duration_seconds: number;
    geometry: string;
    avoid_points: string;
    maneuvers: string;
    created_at: number;
}

const toRoute = (row: RouteRow): SavedRoute => {
    let avoidPoints: AvoidPoint[] = [];
    try {
        avoidPoints = JSON.parse(row.avoid_points) as AvoidPoint[];
    } catch {
        avoidPoints = [];
    }

    let maneuvers: RouteManeuver[] = [];
    try {
        maneuvers = JSON.parse(row.maneuvers ?? '[]') as RouteManeuver[];
    } catch {
        maneuvers = [];
    }

    return {
        id: row.id,
        name: row.name,
        originName: row.origin_name,
        destinationName: row.destination_name,
        originLat: row.origin_lat,
        originLon: row.origin_lon,
        destinationLat: row.destination_lat,
        destinationLon: row.destination_lon,
        distanceMeters: row.distance_meters,
        durationSeconds: row.duration_seconds,
        geometry: row.geometry,
        avoidPoints,
        maneuvers,
        createdAt: row.created_at,
    };
};

export const listRoutes = async (): Promise<SavedRoute[]> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<RouteRow>('SELECT * FROM routes ORDER BY created_at DESC');
    /**
     * A route saved twice is one route in the list. The copies stay in the
     * database, they just do not show up twice.
     */
    const seen = new Set<string>();
    const routes: SavedRoute[] = [];
    for (const row of rows) {
        const key = `${row.destination_lat},${row.destination_lon},${row.geometry}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        routes.push(toRoute(row));
    }
    return routes;
};

export const getRoute = async (id: string): Promise<SavedRoute | null> => {
    const db = getDatabase();
    const row = await db.getFirstAsync<RouteRow>('SELECT * FROM routes WHERE id = ?', id);
    return row ? toRoute(row) : null;
};

export const insertRoute = async (route: Omit<SavedRoute, 'id' | 'createdAt'>): Promise<SavedRoute> => {
    const db = getDatabase();

    /**
     * The same route saved twice is one route. The rider taps the save button
     * until the app answers, so the answer is the button, but the database
     * also refuses the copy.
     */
    const existing = await db.getFirstAsync<RouteRow>(
        `SELECT * FROM routes
     WHERE destination_lat = ? AND destination_lon = ? AND geometry = ?
     LIMIT 1;`,
        route.destinationLat,
        route.destinationLon,
        route.geometry,
    );
    if (existing) {
        /**
         * A route that was saved before the app kept the turns has none of
         * them, and a route that is ridden again needs them. They come with
         * the route the rider is on now.
         */
        if (toRoute(existing).maneuvers.length === 0 && (route.maneuvers ?? []).length > 0) {
            await db.runAsync(
                'UPDATE routes SET maneuvers = ? WHERE id = ?;',
                JSON.stringify(route.maneuvers),
                existing.id,
            );
            return { ...toRoute(existing), maneuvers: route.maneuvers ?? [] };
        }
        return toRoute(existing);
    }

    const saved: SavedRoute = { ...route, id: newId(), createdAt: Date.now() };

    await db.runAsync(
        `INSERT INTO routes (id, name, origin_name, destination_name, origin_lat, origin_lon,
       destination_lat, destination_lon, distance_meters, duration_seconds, geometry, avoid_points,
       maneuvers, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        saved.id,
        saved.name,
        saved.originName,
        saved.destinationName,
        saved.originLat,
        saved.originLon,
        saved.destinationLat,
        saved.destinationLon,
        saved.distanceMeters,
        saved.durationSeconds,
        saved.geometry,
        JSON.stringify(saved.avoidPoints),
        JSON.stringify(saved.maneuvers ?? []),
        saved.createdAt,
    );

    return saved;
};

export const renameRoute = async (id: string, name: string): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('UPDATE routes SET name = ? WHERE id = ?', name.trim(), id);
};

export const deleteRoute = async (id: string): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('DELETE FROM routes WHERE id = ?', id);
};
