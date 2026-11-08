import { create } from 'zustand';

import { TrafficCamera } from '@typings/types';
import { ANSV_SOURCE_NAME, CAMERA_AVOID_RADIUS_METERS, fetchAnsvCameras } from '@services/ansv.service';
import {
    clearCameraPreferences,
    countCameras,
    listAllCameras,
    listCameraPreferences,
    replaceCameraSnapshot,
    setCameraAvoidEnabled,
} from '@services/db/cameraRepository';
import { getSettings, setSetting } from '@services/db/settingsRepository';
import { bearingDegrees, distanceMeters, distanceToSegmentMeters } from '@utils/geo';
import { isRiskyDirection } from '@utils/cameraSense';
import { decodePolyline } from '@utils/polyline';
import { logger } from '@utils/logger';
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const NEARBY_RADIUS_METERS = 5000;
const ROUTE_CORRIDOR_METERS = 80;
const ROUTE_MAX_CAMERAS = 40;

/** The list of cameras only changes when the rider moves this far. */
const CAMERA_RELOAD_METERS = 50;

let lastLoadPosition: [number, number] | null = null;

export interface CameraRefreshResult {
    sent: number;
    leftOut: number;
}

interface CameraState {
    cameras: TrafficCamera[];
    nearby: TrafficCamera[];
    publishedAt: number | null;
    fetchedAt: number | null;
    loading: boolean;
    error: string | null;
    avoidEnabled: boolean;
    radiusMeters: number;
    stale: boolean;
    routeSplit: CameraRefreshResult;
    routeCameras: TrafficCamera[];
    removedCount: number;
    load: (force?: boolean) => Promise<void>;
    refresh: (force?: boolean) => Promise<void>;
    setAvoidEnabled: (cameraId: string, enabled: boolean) => Promise<void>;
    setAvoidEnabledGlobally: (enabled: boolean) => Promise<void>;
    setRadiusMeters: (meters: number) => Promise<void>;
    setRouteSplit: (split: CameraRefreshResult) => void;
    setRouteCameras: (cameras: TrafficCamera[]) => void;
    restoreRemovedCameras: () => Promise<void>;
    selectForRoute: (geometry: string) => Promise<{
        risky: TrafficCamera[];
        safe: TrafficCamera[];
    }>;
}

const distanceFor = (camera: TrafficCamera, position: [number, number] | null): number | null => {
    if (!position) {
        return null;
    }
    return distanceMeters(
        { lat: camera.latitude, lon: camera.longitude },
        { lat: position[0], lon: position[1] },
    );
};

export const useCameraStore = create<CameraState>((set, get) => ({
    cameras: [],
    nearby: [],
    publishedAt: null,
    fetchedAt: null,
    loading: false,
    error: null,
    avoidEnabled: true,
    radiusMeters: NEARBY_RADIUS_METERS,
    stale: false,
    routeSplit: { sent: 0, leftOut: 0 },
    routeCameras: [],
    removedCount: 0,

    load: async (force = false) => {
        const { useLocationStore } = await import('@stores/locationStore');
        if (!useLocationStore.getState().position) {
            await useLocationStore.getState().request();
        }
        const position = useLocationStore.getState().position;

        /**
         * The position arrives once a second while the navigation runs, and the
         * list of cameras only changes when the rider moves far enough.
         */
        if (
            !force &&
            position &&
            lastLoadPosition &&
            distanceMeters(
                { lat: position[0], lon: position[1] },
                { lat: lastLoadPosition[0], lon: lastLoadPosition[1] },
            ) < CAMERA_RELOAD_METERS
        ) {
            return;
        }
        lastLoadPosition = position;

        const [cameras, preferences, settings] = await Promise.all([
            listAllCameras(),
            listCameraPreferences(),
            getSettings(),
        ]);

        const nearby = cameras
            .map((camera) => ({
                ...camera,
                distanceMeters: distanceFor(camera, position),
                avoidEnabled: preferences[camera.cameraId] !== false,
            }))
            .filter((camera) => {
                if (camera.distanceMeters === null) {
                    return false;
                }
                return camera.distanceMeters <= get().radiusMeters;
            })
            .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));

        set({
            cameras,
            nearby,
            publishedAt: settings.ansvPublishedAt,
            fetchedAt: settings.ansvFetchedAt,
            avoidEnabled: settings.cameraAvoidEnabled,
            radiusMeters: settings.cameraRadiusMeters,
            removedCount: Object.values(preferences).filter((value) => value === false).length,
            stale:
                settings.ansvFetchedAt !== null &&
                Date.now() - settings.ansvFetchedAt > REFRESH_INTERVAL_MS,
        });
    },

    refresh: async (force = false) => {
        const settings = await getSettings();
        const fresh =
            settings.ansvFetchedAt !== null && Date.now() - settings.ansvFetchedAt < REFRESH_INTERVAL_MS;

        if (fresh && !force) {
            await get().load(true);
            return;
        }

        set({ loading: true, error: null });

        try {
            const dataset = await fetchAnsvCameras();
            const snapshotId = new Date().toISOString();
            const total = await countCameras();

            if (total > 0 && dataset.cameras.length < total * 0.8) {
                throw new Error('the dataset shrank unexpectedly');
            }

            const cameras = dataset.cameras.map((camera) => ({
                ...camera,
                radiusMeters: CAMERA_AVOID_RADIUS_METERS,
                datasetPublishedAt: dataset.timestamp,
                distanceMeters: null,
                avoidEnabled: true,
            }));

            await replaceCameraSnapshot(cameras, snapshotId, dataset.timestamp);
            await setSetting('ansvFetchedAt', String(Date.now()));
            await setSetting('ansvPublishedAt', dataset.timestamp === null ? '' : String(dataset.timestamp));
            await setSetting('ansvSnapshotId', snapshotId);

            set({ loading: false, error: null });
            await get().load(true);
        } catch (error) {
            logger.warn('camera refresh failed', {
                service: 'ansv',
                event: 'refresh',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
            set({ loading: false, error: 'Camera data could not be updated.' });
            await get().load(true);
        }
    },

    setAvoidEnabled: async (cameraId, enabled) => {
        await setCameraAvoidEnabled(cameraId, enabled);
        await get().load(true);
    },

    setAvoidEnabledGlobally: async (enabled) => {
        await setSetting('cameraAvoidEnabled', String(enabled));
        set({ avoidEnabled: enabled });
    },

    setRadiusMeters: async (meters) => {
        await setSetting('cameraRadiusMeters', String(meters));
        set({ radiusMeters: meters });
        await get().load(true);
    },

    setRouteSplit: (split) => {
        set({ routeSplit: split });
    },
    setRouteCameras: (cameras) => {
        set({ routeCameras: cameras });
    },
    restoreRemovedCameras: async () => {
        await clearCameraPreferences();
        await get().load(true);
    },
    selectForRoute: async (geometry: string) => {
        const points = decodePolyline(geometry, 6);
        if (points.length < 2) {
            return { risky: [] as TrafficCamera[], safe: [] as TrafficCamera[] };
        }

        const preferences = await listCameraPreferences();
        const allowed = get().cameras.filter((camera) => preferences[camera.cameraId] !== false);

        const scored = allowed
            .map((camera) => {
                const point = { lat: camera.latitude, lon: camera.longitude };
                let distance = Infinity;
                let risky = false;

                /**
                 * Every stretch of the route that goes by the camera counts, not
                 * only the closest point. At a crossing the closest point can be
                 * on the leg before the turn, and the rider leaves the camera
                 * behind with the back turned to it.
                 */
                for (let index = 1; index < points.length; index += 1) {
                    const toSegment = distanceToSegmentMeters(point, points[index - 1], points[index]);
                    if (toSegment > ROUTE_CORRIDOR_METERS) {
                        continue;
                    }
                    distance = Math.min(distance, toSegment);
                    const travel = bearingDegrees(points[index - 1], points[index]);
                    if (isRiskyDirection(camera.sense, travel)) {
                        risky = true;
                    }
                }

                if (distance === Infinity) {
                    return null;
                }
                return { camera, distance, risky };
            })
            .filter((entry): entry is { camera: TrafficCamera; distance: number; risky: boolean } =>
                entry !== null,
            )
            .sort((a, b) => a.distance - b.distance);

        /**
         * A camera that watches the traffic that goes the same way the rider
         * goes ends up behind the rider and photographs the plate. The other
         * ones see the front of the bike and are left alone.
         */
        const risky = scored
            .filter((entry) => entry.risky)
            .slice(0, ROUTE_MAX_CAMERAS)
            .map((entry) => ({
                ...entry.camera,
                /**
                 * The ring has to reach the route, or the camera is flagged and
                 * the route goes past it anyway.
                 */
                radiusMeters: Math.min(
                    50,
                    Math.max(entry.camera.radiusMeters, Math.round(entry.distance) + 15),
                ),
            }));
        const safe = scored
            .filter((entry) => !entry.risky)
            .map((entry) => entry.camera);

        const enabled = get().avoidEnabled;
        const avoided = enabled ? risky : [];

        set({
            routeSplit: { sent: avoided.length, leftOut: enabled ? safe.length : risky.length + safe.length },
            routeCameras: avoided,
        });

        return { risky: avoided, safe };
    },
}));

export { ANSV_SOURCE_NAME };
