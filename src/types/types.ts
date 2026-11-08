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
    label: string;
}

export type ConnectionState =
    | 'off'
    | 'scanning'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'failed';

/** the value of the model comes from the catalog of bikes */
export type BikeModel = string;

export interface Bike {
    id: string;
    nickname: string;
    model: BikeModel;
    macAddress: string;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface BikeInput {
    nickname: string;
    model: BikeModel;
    macAddress: string;
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
export interface BikeTelemetry {
    speedKmh: number | null;
    engineRpm: number | null;
    fuelLevelPercent: number | null;
    batteryVoltage: number | null;
    odometerKm: number | null;
    tripDistanceKm: number | null;
    tripTimeSeconds: number | null;
    tripMileage: number | null;
    tripFuel: number | null;
    averageSpeedKmh: number | null;
    topSpeedKmh: number | null;
    throttlePercent: number | null;
    leanAngleDegree: number | null;
    gearPosition: number | null;
    sideStandDown: boolean;
    turnSignal: 'none' | 'left' | 'right';
    turnSignalStatus: number;
    vehicleState: number;
    switchStatus: number;
    overspeedThreshold: number;
    engineTemperature: number | null;
    intakeAirTemperature: number | null;
    cruisingRange: number | null;
    lapNumber: number | null;
    lapTimeMs: number | null;
    bestLapNumber: number | null;
    bestLapMs: number | null;
    latitude: number | null;
    longitude: number | null;
    receivedAt: number;
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
    riderName: string;
    cameraAvoidEnabled: boolean;
    cameraRadiusMeters: number;
    ansvFetchedAt: number | null;
    ansvPublishedAt: number | null;
    overspeedLimitKmh: number;
    mapProvider: 'google' | 'openfreemap';
    mapStyleUrl: string;
    valhallaBaseUrl: string;
    saveTracks: boolean;
    pinEnabled: boolean;
}

export type RootStackParamList = {
    Main: NavigatorScreenParams<MainTabParamList> | undefined;
    RouteDetails: undefined;
    Cameras: undefined;
    CameraDetail: { cameraId: string };
    AddBike: undefined;
    EditBike: { bikeId: string };
    BikeDetails: { bikeId: string };
    Connection: { bikeId: string };
    PlaceSearch: undefined;
    SavedRoutes: undefined;
    RoutePreview: { routeId: string };
    Pin: { mode: 'create' | 'change' | 'remove' };
    ExportData: undefined;
    Diagnostics: undefined;
    DeleteData: undefined;
    Permissions: undefined;
};

export type MainTabParamList = {
    Garage: undefined;
    Dashboard: undefined;
    Map: undefined;
    Settings: undefined;
};
