import { RideSummary } from '@typings/types';
import { getDatabase, newId } from './database';

interface RideRow {
    id: string;
    bike_id: string;
    started_at: number;
    ended_at: number | null;
    distance_meters: number;
    max_speed_kmh: number;
    average_speed_kmh: number;
    duration_seconds: number;
}

const toRide = (row: RideRow): RideSummary => ({
    id: row.id,
    bikeId: row.bike_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? row.started_at,
    distanceMeters: row.distance_meters,
    maxSpeedKmh: row.max_speed_kmh,
    averageSpeedKmh: row.average_speed_kmh,
    durationSeconds: row.duration_seconds,
});

export const startRide = async (bikeId: string): Promise<RideSummary> => {
    const db = getDatabase();
    const ride: RideSummary = {
        id: newId(),
        bikeId,
        startedAt: Date.now(),
        endedAt: Date.now(),
        distanceMeters: 0,
        maxSpeedKmh: 0,
        averageSpeedKmh: 0,
        durationSeconds: 0,
    };

    await db.runAsync(
        'INSERT INTO rides (id, bike_id, started_at, ended_at, distance_meters, max_speed_kmh, average_speed_kmh, duration_seconds) VALUES (?, ?, ?, ?, 0, 0, 0, 0)',
        ride.id,
        ride.bikeId,
        ride.startedAt,
    );

    return ride;
};

export const finishRide = async (
    id: string,
    summary: { distanceMeters: number; maxSpeedKmh: number; averageSpeedKmh: number },
): Promise<void> => {
    const db = getDatabase();
    const row = await db.getFirstAsync<RideRow>('SELECT * FROM rides WHERE id = ?', id);
    if (!row) {
        return;
    }

    const endedAt = Date.now();
    const durationSeconds = Math.max(0, (endedAt - row.started_at) / 1000);

    await db.runAsync(
        'UPDATE rides SET ended_at = ?, distance_meters = ?, max_speed_kmh = ?, average_speed_kmh = ?, duration_seconds = ? WHERE id = ?',
        endedAt,
        summary.distanceMeters,
        summary.maxSpeedKmh,
        summary.averageSpeedKmh,
        durationSeconds,
        id,
    );
};

export const listRides = async (bikeId?: string): Promise<RideSummary[]> => {
    const db = getDatabase();
    if (bikeId) {
        const rows = await db.getAllAsync<RideRow>(
            'SELECT * FROM rides WHERE bike_id = ? ORDER BY started_at DESC LIMIT 200',
            bikeId,
        );
        return rows.map(toRide);
    }
    const rows = await db.getAllAsync<RideRow>(
        'SELECT * FROM rides ORDER BY started_at DESC LIMIT 200',
    );
    return rows.map(toRide);
};
