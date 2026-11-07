import { create } from 'zustand';

import { TrafficCamera } from '@typings/types';
import { ANSV_SOURCE_NAME, CAMERA_AVOID_RADIUS_METERS, fetchAnsvCameras } from '@services/ansv.service';
import {
    countCameras,
    listAllCameras,
    listCameraPreferences,
    replaceCameraSnapshot,
    setCameraAvoidEnabled,
} from '@services/db/cameraRepository';
import { getSettings, setSetting } from '@services/db/settingsRepository';
import { boundingBox, distanceMeters, distanceToSegmentMeters } from '@utils/geo';
import { logger } from '@utils/logger';

const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const NEARBY_RADIUS_METERS = 5000;
const ROUTE_CORRIDOR_METERS = 150;
const ROUTE_ENDPOINT_METERS = 1000;
const ROUTE_MAX_CAMERAS = 40;

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
    routeSplit: CameraRefreshResult;
    load: () => Promise<void>;
    refresh: (force?: boolean) => Promise<void>;
    setAvoidEnabled: (cameraId: string, enabled: boolean) => Promise<void>;
    setAvoidEnabledGlobally: (enabled: boolean) => Promise<void>;
    setRadiusMeters: (meters: number) => Promise<void>;
    selectForRoute: (
        originLat: number,
        originLon: number,
        destinationLat: number,
        destinationLon: number,
    ) => TrafficCamera[];
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
    routeSplit: { sent: 0, leftOut: 0 },

    load: async () => {
        const [cameras, preferences, settings] = await Promise.all([
            listAllCameras(),
            listCameraPreferences(),
            getSettings(),
        ]);

        const { useLocationStore } = await import('@stores/locationStore');
        if (!useLocationStore.getState().position) {
            await useLocationStore.getState().request();
        }
        const position = useLocationStore.getState().position;
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
        });
    },

    refresh: async (force = false) => {
        const settings = await getSettings();
        const fresh =
            settings.ansvFetchedAt !== null && Date.now() - settings.ansvFetchedAt < REFRESH_INTERVAL_MS;

        if (fresh && !force) {
            await get().load();
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
            await get().load();
        } catch (error) {
            logger.warn('camera refresh failed', {
                service: 'ansv',
                event: 'refresh',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
            set({ loading: false, error: 'Camera data could not be updated.' });
            await get().load();
        }
    },

    setAvoidEnabled: async (cameraId, enabled) => {
        await setCameraAvoidEnabled(cameraId, enabled);
        await get().load();
    },

    setAvoidEnabledGlobally: async (enabled) => {
        await setSetting('cameraAvoidEnabled', String(enabled));
        set({ avoidEnabled: enabled });
    },

    setRadiusMeters: async (meters) => {
        await setSetting('cameraRadiusMeters', String(meters));
        set({ radiusMeters: meters });
        await get().load();
    },

    selectForRoute: (originLat, originLon, destinationLat, destinationLon) => {
        const box = boundingBox(
            { lat: originLat, lon: originLon },
            { lat: destinationLat, lon: destinationLon },
            ROUTE_ENDPOINT_METERS,
        );

        const candidates = get().cameras.filter(
            (camera) =>
                camera.latitude >= box.minLat &&
                camera.latitude <= box.maxLat &&
                camera.longitude >= box.minLon &&
                camera.longitude <= box.maxLon,
        );

        const scored = candidates
            .map((camera) => ({
                camera,
                distance: distanceToSegmentMeters(
                    { lat: camera.latitude, lon: camera.longitude },
                    { lat: originLat, lon: originLon },
                    { lat: destinationLat, lon: destinationLon },
                ),
                toOrigin: distanceMeters(
                    { lat: camera.latitude, lon: camera.longitude },
                    { lat: originLat, lon: originLon },
                ),
                toDestination: distanceMeters(
                    { lat: camera.latitude, lon: camera.longitude },
                    { lat: destinationLat, lon: destinationLon },
                ),
            }))
            .filter(
                (entry) =>
                    entry.distance <= ROUTE_CORRIDOR_METERS ||
                    entry.toOrigin <= ROUTE_ENDPOINT_METERS ||
                    entry.toDestination <= ROUTE_ENDPOINT_METERS,
            )
            .sort((a, b) => a.distance - b.distance);

        const selected = scored.slice(0, ROUTE_MAX_CAMERAS).map((entry) => entry.camera);
        set({ routeSplit: { sent: selected.length, leftOut: scored.length - selected.length } });

        return get().avoidEnabled ? selected : [];
    },
}));

export { ANSV_SOURCE_NAME };
