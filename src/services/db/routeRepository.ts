import { AchievedTime, AvoidPoint, SavedRoute } from '@typings/types';
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
    achieved_times: string;
    created_at: number;
}

const toRoute = (row: RouteRow): SavedRoute => {
    let avoidPoints: AvoidPoint[] = [];
    try {
        avoidPoints = JSON.parse(row.avoid_points) as AvoidPoint[];
    } catch {
        avoidPoints = [];
    }

    let achievedTimes: AchievedTime[] = [];
    try {
        achievedTimes = JSON.parse(row.achieved_times ?? '[]') as AchievedTime[];
    } catch {
        achievedTimes = [];
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
        achievedTimes,
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
        return toRoute(existing);
    }

    const saved: SavedRoute = { ...route, id: newId(), createdAt: Date.now() };

    await db.runAsync(
        `INSERT INTO routes (id, name, origin_name, destination_name, origin_lat, origin_lon,
       destination_lat, destination_lon, distance_meters, duration_seconds, geometry, avoid_points,
       achieved_times, created_at)
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
        JSON.stringify(saved.achievedTimes ?? []),
        saved.createdAt,
    );

    return saved;
};

/**
 * The time a ride of this route really took. It joins the times the rider
 * already made on the same route, the newest first.
 */
export const recordAchievedTime = async (
    id: string,
    seconds: number,
): Promise<AchievedTime[] | null> => {
    const db = getDatabase();
    const row = await db.getFirstAsync<RouteRow>('SELECT * FROM routes WHERE id = ?', id);
    if (!row) {
        return null;
    }

    const achievedTimes: AchievedTime[] = [
        { seconds, achievedAt: Date.now() },
        ...toRoute(row).achievedTimes,
    ];
    await db.runAsync(
        'UPDATE routes SET achieved_times = ? WHERE id = ?;',
        JSON.stringify(achievedTimes),
        id,
    );

    return achievedTimes;
};

export const renameRoute = async (id: string, name: string): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('UPDATE routes SET name = ? WHERE id = ?', name.trim(), id);
};

export const deleteRoute = async (id: string): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('DELETE FROM routes WHERE id = ?', id);
};
