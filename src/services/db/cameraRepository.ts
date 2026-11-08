import { TrafficCamera } from '@typings/types';
import { CameraSense } from '@utils/cameraSense';
import { getDatabase } from './database';

interface CameraRow {
    camera_id: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    max_speed_kmh: number | null;
    technology: string;
    road_type: string;
    address: string;
    municipality: string;
    department: string;
    operating_state: string;
    sense: string | null;
    infractions: string;
    dataset_published_at: number | null;
    snapshot_id: string;
    last_seen_at: number;
}

const toSense = (value: string | null): CameraSense | null => {
    if (!value) {
        return null;
    }
    try {
        const parsed = JSON.parse(value) as CameraSense;
        return parsed && typeof parsed.axisBearing === 'number' ? parsed : null;
    } catch {
        return null;
    }
};

const toOperatingState = (value: string): TrafficCamera['operatingState'] => {
    if (value === 'Operating') {
        return 'Operating';
    }
    if (value === 'Expired') {
        return 'Expired';
    }
    // the rows of the installs that came before the expired cameras existed
    if (value === 'Operando') {
        return 'Operating';
    }
    if (value === 'Vencida' || value === 'Renovada - Expirada' || value === 'Prorrogada - Vencida') {
        return 'Expired';
    }
    return 'Not reported';
};

const toCamera = (row: CameraRow): TrafficCamera => ({
    cameraId: row.camera_id,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radius_meters,
    maxSpeedKmh: row.max_speed_kmh,
    technology: row.technology as TrafficCamera['technology'],
    roadType: row.road_type,
    address: row.address,
    municipality: row.municipality,
    department: row.department,
    operatingState: toOperatingState(row.operating_state),
    sense: toSense(row.sense),
    infractions: JSON.parse(row.infractions) as string[],
    datasetPublishedAt: row.dataset_published_at,
    distanceMeters: null,
    avoidEnabled: true,
});

export const listCameras = async (): Promise<TrafficCamera[]> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<CameraRow>('SELECT * FROM cameras ORDER BY camera_id');
    return rows.map(toCamera);
};

export const listAllCameras = async (): Promise<TrafficCamera[]> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<CameraRow>('SELECT * FROM cameras');
    return rows.map(toCamera);
};

export const listCamerasInBox = async (
    minLat: number,
    minLon: number,
    maxLat: number,
    maxLon: number,
): Promise<TrafficCamera[]> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<CameraRow>(
        `SELECT * FROM cameras
         WHERE latitude >= ? AND latitude <= ? AND longitude >= ? AND longitude <= ?`,
        minLat,
        maxLat,
        minLon,
        maxLon,
    );
    return rows.map(toCamera);
};

export const getCamera = async (cameraId: string): Promise<TrafficCamera | null> => {
    const db = getDatabase();
    const row = await db.getFirstAsync<CameraRow>(
        'SELECT * FROM cameras WHERE camera_id = ?',
        cameraId,
    );
    return row ? toCamera(row) : null;
};

export const countCameras = async (): Promise<number> => {
    const db = getDatabase();
    const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM cameras');
    return row?.total ?? 0;
};

/**
 * Replaces the camera snapshot. The rows of the current snapshot are upserted and
 * every row of a previous snapshot that is not in this one is removed, so a camera
 * that stops operating stops being avoided. The whole swap runs in one transaction.
 */
export const replaceCameraSnapshot = async (
    cameras: TrafficCamera[],
    snapshotId: string,
    publishedAt: number | null,
): Promise<void> => {
    const db = getDatabase();
    const now = Date.now();

    await db.withExclusiveTransactionAsync(async () => {
        for (const camera of cameras) {
            await db.runAsync(
                `INSERT INTO cameras (camera_id, latitude, longitude, radius_meters, max_speed_kmh,
             technology, road_type, address, municipality, department, operating_state,
             sense, infractions, dataset_published_at, snapshot_id, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(camera_id) DO UPDATE SET
             latitude = excluded.latitude,
             longitude = excluded.longitude,
             radius_meters = excluded.radius_meters,
             max_speed_kmh = excluded.max_speed_kmh,
             technology = excluded.technology,
             road_type = excluded.road_type,
             address = excluded.address,
             municipality = excluded.municipality,
             department = excluded.department,
             operating_state = excluded.operating_state,
             sense = excluded.sense,
             infractions = excluded.infractions,
             dataset_published_at = excluded.dataset_published_at,
             snapshot_id = excluded.snapshot_id,
             last_seen_at = excluded.last_seen_at`,
                camera.cameraId,
                camera.latitude,
                camera.longitude,
                camera.radiusMeters,
                camera.maxSpeedKmh,
                camera.technology,
                camera.roadType,
                camera.address,
                camera.municipality,
                camera.department,
                camera.operatingState,
                camera.sense ? JSON.stringify(camera.sense) : null,
                JSON.stringify(camera.infractions),
                publishedAt,
                snapshotId,
                now,
            );
        }

        await db.runAsync('DELETE FROM cameras WHERE snapshot_id != ?', snapshotId);
    });
};

export const setCameraAvoidEnabled = async (
    cameraId: string,
    enabled: boolean,
): Promise<void> => {
    const db = getDatabase();
    await db.runAsync(
        'INSERT INTO camera_preferences (camera_id, avoid_enabled) VALUES (?, ?) ON CONFLICT(camera_id) DO UPDATE SET avoid_enabled = excluded.avoid_enabled',
        cameraId,
        enabled ? 1 : 0,
    );
};

export const listCameraPreferences = async (): Promise<Record<string, boolean>> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<{ camera_id: string; avoid_enabled: number }>(
        'SELECT camera_id, avoid_enabled FROM camera_preferences',
    );
    const preferences: Record<string, boolean> = {};
    for (const row of rows) {
        preferences[row.camera_id] = row.avoid_enabled === 1;
    }
    return preferences;
};



/**
 * Puts every camera back on the routes. The per camera choice is what the rider
 * turned off, so clearing it restores all of them.
 */
export const clearCameraPreferences = async (): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('DELETE FROM camera_preferences');
};
