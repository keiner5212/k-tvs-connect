export type CameraTechnology =
    | 'Radar Doppler'
    | 'Video Detección (Con Analítica de Video)'
    | 'Laser (Lidar) / Infrarrojo'
    | 'Semi-Automática (Acción Remota)'
    | 'Lazo Inductivo de Piso (Espiras)'
    | 'Otra Tecnología'
    | 'Not reported';

export type CameraOperatingState = 'Operando' | 'Not operating' | 'Not reported';

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
    label: string;
}

export type ConnectionState =
    | 'off'
    | 'scanning'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'failed';

export type BikeModel =
    | 'apache'
    | 'ntorq'
    | 'jupiter'
    | 'iqube'
    | 'u388'
    | 'other';

export interface Bike {
    id: string;
    nickname: string;
    model: BikeModel;
    frameNumber: string;
    macAddress: string;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface BikeInput {
    nickname: string;
    model: BikeModel;
    frameNumber: string;
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

export interface BikeTelemetry {
    speedKmh: number;
    engineRpm: number;
    fuelLevelPercent: number;
    batteryVoltage: number;
    odometerKm: number;
    tripDistanceKm: number;
    tripTimeSeconds: number;
    tripMileage: number;
    tripFuel: number;
    averageSpeedKmh: number;
    topSpeedKmh: number;
    throttlePercent: number;
    leanAngleDegree: number;
    gearPosition: number;
    sideStandDown: boolean;
    turnSignal: 'none' | 'left' | 'right';
    turnSignalStatus: number;
    vehicleState: number;
    switchStatus: number;
    overspeedThreshold: number;
    engineTemperature: number;
    intakeAirTemperature: number;
    cruisingRange: number;
    lapNumber: number;
    lapTimeMs: number;
    bestLapNumber: number;
    bestLapMs: number;
    latitude: number | null;
    longitude: number | null;
    frameNumber: string | null;
    receivedAt: number;
}

export interface Place {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

export interface RouteLeg {
    distanceMeters: number;
    durationSeconds: number;
    maneuver: string;
    instruction: string;
}

export interface RouteResult {
    distanceMeters: number;
    durationSeconds: number;
    geometry: string;
    legs: RouteLeg[];
}

export interface AppSettings {
    unitSystem: 'metric' | 'imperial';
    cameraAvoidEnabled: boolean;
    cameraRadiusMeters: number;
    ansvFetchedAt: number | null;
    ansvPublishedAt: number | null;
    overspeedLimitKmh: number;
    mapStyleUrl: string;
    photonBaseUrl: string;
    valhallaBaseUrl: string;
    saveTracks: boolean;
    pinEnabled: boolean;
}

export type RootStackParamList = {
    Main: undefined;
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
    DeleteData: undefined;
    Permissions: undefined;
};

export type MainTabParamList = {
    Garage: undefined;
    Dashboard: undefined;
    Map: undefined;
    Settings: undefined;
};
