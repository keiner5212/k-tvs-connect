import { AvoidPoint } from '@typings/types';
import { getDatabase, newId } from './database';

interface AvoidPointRow {
    id: string;
    label: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    created_at: number;
}

const toAvoidPoint = (row: AvoidPointRow): AvoidPoint => ({
    id: row.id,
    label: row.label,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radius_meters,
    createdAt: row.created_at,
});

export const listAvoidPoints = async (): Promise<AvoidPoint[]> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<AvoidPointRow>(
        'SELECT * FROM avoid_points ORDER BY created_at ASC',
    );
    return rows.map(toAvoidPoint);
};

export const insertAvoidPoint = async (
    point: Omit<AvoidPoint, 'id' | 'createdAt'>,
): Promise<AvoidPoint> => {
    const db = getDatabase();
    const saved: AvoidPoint = { ...point, id: newId(), createdAt: Date.now() };

    await db.runAsync(
        'INSERT INTO avoid_points (id, label, latitude, longitude, radius_meters, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        saved.id,
        saved.label,
        saved.latitude,
        saved.longitude,
        saved.radiusMeters,
        saved.createdAt,
    );

    return saved;
};

export const deleteAvoidPoint = async (id: string): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('DELETE FROM avoid_points WHERE id = ?', id);
};

export const clearAvoidPoints = async (): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('DELETE FROM avoid_points');
};
