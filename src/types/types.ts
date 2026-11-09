import type { NavigatorScreenParams } from '@react-navigation/native';

import type { CameraSense } from '@utils/cameraSense';

export type CameraTechnology =
    | 'Radar Doppler'
    | 'Video Detección (Con Analítica de Video)'
    | 'Laser (Lidar) / Infrarrojo'
    | 'Semi-Automática (Acción Remota)'
    | 'Lazo Inductivo de Piso (Espiras)'
    | 'Otra Tecnología'
    | 'Not reported';

export type CameraOperatingState = 'Operating' | 'Expired' | 'Not operating' | 'Not reported';

export interface TrafficCamera {
    cameraId: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    maxSpeedKmh: number | null;
    technology: CameraTechnology;
    roadType: string;
    address: string;
    municipality: string;
    department: string;
    operatingState: CameraOperatingState;
    /** the direction the camera watches, when the agency published one */
    sense: CameraSense | null;
    infractions: string[];
    datasetPublishedAt: number | null;
    distanceMeters: number | null;
    avoidEnabled: boolean;
}

export interface CameraMarkerData {
    id: string;
    latitude: number;
    longitude: number;
    maxSpeedKmh: number | null;
    isAvoided: boolean;
    isExpired: boolean;
    /** the direction the camera watches, when the agency published one */
    watchBearing: number | null;
    /** the equipment watches both directions of its street */
    bothWays: boolean;
    /** the street axis, used when the camera watches both directions */
    axisBearing: number | null;
    label: string;
}

export interface AvoidPoint {
    id: string;
    latitude: number;
    longitude: number;
    label: string;
    radiusMeters: number;
    createdAt: number;
    source?: 'manual' | 'ansv';
}

/** one ride of a saved route, with the moment it was ridden */
export interface AchievedTime {
    seconds: number;
    achievedAt: number;
}

export interface SavedRoute {
    id: string;
    name: string;
    originName: string;
    destinationName: string;
    originLat: number;
    originLon: number;
    destinationLat: number;
    destinationLon: number;
    distanceMeters: number;
    /** the time the router gave for the route when it was saved */
    durationSeconds: number;
    geometry: string;
    avoidPoints: AvoidPoint[];
    /** the times the rider took on this route, the newest first */
    achievedTimes: AchievedTime[];
    createdAt: number;
}

export interface Place {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    countryCode?: string;
    distanceMeters?: number | null;
}

export interface RouteResult {
    avoidOutcome?: { applied: number; relaxed: boolean };
    distanceMeters: number;
    durationSeconds: number;
    geometry: string;
}

export interface AppSettings {
    unitSystem: 'metric' | 'imperial';
    /** the name the bike greets the rider with */
    cameraAvoidEnabled: boolean;
    cameraRadiusMeters: number;
    ansvFetchedAt: number | null;
    ansvPublishedAt: number | null;
    mapProvider: 'google' | 'openfreemap';
    mapStyleUrl: string;
    valhallaBaseUrl: string;
    pinEnabled: boolean;
}

export type RootStackParamList = {
    Main: NavigatorScreenParams<MainTabParamList> | undefined;
    RouteDetails: undefined;
    Cameras: undefined;
    CameraDetail: { cameraId: string };
    PlaceSearch: undefined;
    SavedRoutes: undefined;
    RoutePreview: { routeId: string };
    Pin: { mode: 'create' | 'change' | 'remove' };
    ExportData: undefined;
    DeleteData: undefined;
    Permissions: undefined;
};

export type MainTabParamList = {
    Map: undefined;
    Settings: undefined;
};
