import { CameraOperatingState, CameraTechnology } from '@typings/types';
import { parseCameraSense } from '@utils/cameraSense';
import { httpGetJson } from './http.service';

const DATASET_URL = 'https://fotodeteccion.ansv.gov.co/map/data/sast.json';

export const ANSV_SOURCE_NAME = 'Agencia Nacional de Seguridad Vial (ANSV)';
export const ANSV_SOURCE_URL = 'https://fotodeteccion.ansv.gov.co/map/ubicaciones-aprobadas.html';

/**
 * The camera sits on the road, so the route only has to leave the spot itself.
 * A wide circle excludes the streets around it and sends the rider around the
 * block for nothing.
 */
export const CAMERA_AVOID_RADIUS_METERS = 25;

const MAX_RESULTS = 5000;
const MAX_LOCATIONS = 50000;

/**
 * The equipment that is running and the equipment whose authorisation
 * expired. An expired camera is usually still on the road, so it is avoided
 * too, but it is shown in orange.
 */
const operatingStateOf = (state: unknown): CameraOperatingState | null => {
    if (state === 'Operando') {
        return 'Operating';
    }
    if (
        state === 'Vencida' ||
        state === 'Renovada - Expirada' ||
        state === 'Prorrogada - Vencida'
    ) {
        return 'Expired';
    }
    return null;
};

const TECHNOLOGIES: CameraTechnology[] = [
    'Radar Doppler',
    'Video Detección (Con Analítica de Video)',
    'Laser (Lidar) / Infrarrojo',
    'Semi-Automática (Acción Remota)',
    'Lazo Inductivo de Piso (Espiras)',
    'Otra Tecnología',
];

interface RawSignal {
    id?: number;
    estado?: string;
    activo?: boolean;
    latitud?: number;
    longitud?: number;
}

interface RawLocation {
    id?: number;
    codigo_unico?: string;
    tipo_tramo?: string;
    estado_operacion?: string;
    tipo_tecnologia?: string;
    latitud?: number;
    longitud?: number;
    direccion?: string;
    lista_infracciones?: string[] | string | null;
    velocidad_maxima_permitida?: string | number | null;
    senales?: RawSignal[];
}

interface RawResult {
    estado?: string;
    jurisdiccion?: string;
    departamento?: string;
    municipio?: string;
    ubicaciones?: RawLocation[];
}

export interface AnsvDataset {
    timestamp: number | null;
    cameras: AnsvCamera[];
    rejected: number;
}

export interface AnsvCamera {
    cameraId: string;
    latitude: number;
    longitude: number;
    maxSpeedKmh: number | null;
    technology: CameraTechnology;
    roadType: string;
    address: string;
    municipality: string;
    department: string;
    operatingState: CameraOperatingState;
    sense: ReturnType<typeof parseCameraSense>;
    infractions: string[];
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const BIDI_OVERRIDES = /[\u202a-\u202e\u2066-\u2069]/g;

const sanitizeText = (value: unknown, maxLength: number): string => {
    if (typeof value !== 'string') {
        return '';
    }
    return value
        .replace(CONTROL_CHARS, '')
        .replace(BIDI_OVERRIDES, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
};

const parseSpeed = (value: unknown): number | null => {
    if (value === null || value === undefined || value === 'None' || value === '') {
        return null;
    }
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 130) {
        return null;
    }
    return Math.round(parsed);
};

const parseInfractions = (value: unknown): string[] => {
    const list = Array.isArray(value) ? value : [];
    const codes = list
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().toUpperCase().match(/^([A-I]\d{2})/)?.[1] ?? '')
        .filter((entry) => entry.length > 0);

    return Array.from(new Set(codes)).sort();
};

const parseTechnology = (value: unknown): CameraTechnology => {
    const text = sanitizeText(value, 80);
    const match = TECHNOLOGIES.find((technology) => technology === text);
    return match ?? 'Not reported';
};

const isValidCoordinate = (latitude: unknown, longitude: unknown): boolean =>
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0);

export const parseAnsvDataset = (payload: unknown): AnsvDataset | null => {
    if (typeof payload !== 'object' || payload === null) {
        return null;
    }

    const body = payload as { timestamp?: number; results?: RawResult[] };
    if (!Array.isArray(body.results) || body.results.length === 0 || body.results.length > MAX_RESULTS) {
        return null;
    }

    const byId = new Map<string, AnsvCamera>();
    let rejected = 0;
    let locations = 0;

    for (const result of body.results) {
        if (!Array.isArray(result?.ubicaciones)) {
            continue;
        }

        for (const location of result.ubicaciones) {
            locations += 1;
            if (locations > MAX_LOCATIONS) {
                return null;
            }

            if (!isValidCoordinate(location?.latitud, location?.longitud)) {
                rejected += 1;
                continue;
            }

            const state = operatingStateOf(location.estado_operacion);
            if (!state) {
                continue;
            }

            const cameraId = sanitizeText(location.codigo_unico, 60) || `geo-${location.latitud}-${location.longitud}`;
            const address = sanitizeText(location.direccion, 200);

            /**
             * The agency publishes the same equipment in the list of two
             * jurisdictions, and the two entries do not always carry the same
             * state. The one that is running wins, because that is the one that
             * can fine the rider.
             */
            const previous = byId.get(cameraId);
            if (previous && previous.operatingState === 'Operating') {
                continue;
            }

            byId.set(cameraId, {
                cameraId,
                latitude: location.latitud as number,
                longitude: location.longitud as number,
                maxSpeedKmh: parseSpeed(location.velocidad_maxima_permitida),
                technology: parseTechnology(location.tipo_tecnologia),
                roadType: sanitizeText(location.tipo_tramo, 60),
                address,
                municipality: sanitizeText(result.municipio, 80),
                department: sanitizeText(result.departamento, 80),
                operatingState: state,
                sense: parseCameraSense(address),
                infractions: parseInfractions(location.lista_infracciones),
            });
        }
    }

    if (byId.size === 0) {
        return null;
    }

    const cameras = Array.from(byId.values());

    const publishedAt = typeof body.timestamp === 'number' && Number.isFinite(body.timestamp)
        ? Math.round(body.timestamp * 1000)
        : null;

    return { timestamp: publishedAt, cameras, rejected };
};

export const fetchAnsvCameras = async (): Promise<AnsvDataset> => {
    const { body, notModified } = await httpGetJson<unknown>(DATASET_URL, {
        service: 'ansv',
        minIntervalMs: 5000,
        maxBytes: 12 * 1024 * 1024,
        timeoutMs: 30000,
    });

    if (notModified) {
        throw new Error('not modified');
    }

    const dataset = parseAnsvDataset(body);
    if (!dataset) {
        throw new Error('unexpected dataset shape');
    }

    return dataset;
};
