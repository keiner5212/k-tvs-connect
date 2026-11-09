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
    durationSeconds: number;
    geometry: string;
    avoidPoints: AvoidPoint[];
    /** the turns of the route, so it can be ridden again without the router */
    maneuvers: RouteManeuver[];
    createdAt: number;
}

export interface RideSummary {
    id: string;
    bikeId: string;
    startedAt: number;
    endedAt: number;
    distanceMeters: number;
    maxSpeedKmh: number;
    averageSpeedKmh: number;
    durationSeconds: number;
}

export interface VehicleAlert {
    id: string;
    kind: 'low_fuel' | 'side_stand' | 'turn_signal' | 'overspeed' | 'weak_signal' | 'info';
    title: string;
    body: string;
    raisedAt: number;
}

/**
 * The values the cluster sends. A value is null until the bike sends it, so
 * the app never shows a zero that the bike did not say.
 */

export interface Place {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    countryCode?: string;
    distanceMeters?: number | null;
}

export interface RouteLeg {
    distanceMeters: number;
    durationSeconds: number;
    maneuver: string;
    instruction: string;
}

export interface RouteManeuver {
    instruction: string;
    distance: number;
    type: number;
    index: number;
}

export interface RouteResult {
    maneuvers?: RouteManeuver[];
    avoidOutcome?: { applied: number; relaxed: boolean };
    distanceMeters: number;
    durationSeconds: number;
    geometry: string;
    legs: RouteLeg[];
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
