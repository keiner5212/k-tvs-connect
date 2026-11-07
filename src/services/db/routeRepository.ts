import { AvoidPoint, SavedRoute } from '@typings/types';
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
    created_at: number;
}

const toRoute = (row: RouteRow): SavedRoute => {
    let avoidPoints: AvoidPoint[] = [];
    try {
        avoidPoints = JSON.parse(row.avoid_points) as AvoidPoint[];
    } catch {
        avoidPoints = [];
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
        createdAt: row.created_at,
    };
};

export const listRoutes = async (): Promise<SavedRoute[]> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<RouteRow>('SELECT * FROM routes ORDER BY created_at DESC');
    return rows.map(toRoute);
};

export const getRoute = async (id: string): Promise<SavedRoute | null> => {
    const db = getDatabase();
    const row = await db.getFirstAsync<RouteRow>('SELECT * FROM routes WHERE id = ?', id);
    return row ? toRoute(row) : null;
};

export const insertRoute = async (route: Omit<SavedRoute, 'id' | 'createdAt'>): Promise<SavedRoute> => {
    const db = getDatabase();
    const saved: SavedRoute = { ...route, id: newId(), createdAt: Date.now() };

    await db.runAsync(
        `INSERT INTO routes (id, name, origin_name, destination_name, origin_lat, origin_lon,
       destination_lat, destination_lon, distance_meters, duration_seconds, geometry, avoid_points, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
