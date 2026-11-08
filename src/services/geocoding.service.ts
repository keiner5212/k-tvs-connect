import { Place } from '@typings/types';
import { distanceMeters } from '@utils/geo';
import { logger } from '@utils/logger';
import {
    ANDROID_CERT_SHA1,
    ANDROID_PACKAGE_NAME,
    GEOCODE_BIAS_CELL_DEGREES,
    GEOCODE_CACHE_TTL_MS,
    GEOCODE_COUNTRY,
    GEOCODE_LANGUAGE,
    GOOGLE_API_KEY,
    GOOGLE_GEOCODE_ENDPOINT,
    GOOGLE_PLACES_ENDPOINT,
    MAX_GOOGLE_REQUESTS_PER_DAY,
    MIN_QUERY_LENGTH,
} from '@config/geocoding';
import { readCachedPlaces, writeCachedPlaces } from './db/geocodeCacheRepository';
import { getSetting, setSetting } from './db/settingsRepository';
import { HttpError, httpGetJson, httpPostJson } from './http.service';

export type GeocodeFailure = 'missing_key' | 'denied' | 'quota' | 'network' | 'invalid' | 'unknown';

export type GeocodeOutcome =
    | { ok: true; places: Place[]; fromCache: boolean }
    | { ok: false; failure: GeocodeFailure; message: string };

interface Bias {
    latitude: number;
    longitude: number;
}

interface GooglePlace {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
}

interface PlacesResponse {
    places?: GooglePlace[];
}

interface GoogleAddressComponent {
    short_name: string;
    types: string[];
}

interface GoogleGeocodeResult {
    formatted_address: string;
    place_id: string;
    types: string[];
    address_components: GoogleAddressComponent[];
    geometry: { location: { lat: number; lng: number } };
}

interface GeocodeResponse {
    status: string;
    error_message?: string;
    results?: GoogleGeocodeResult[];
}

const ANDROID_HEADERS = {
    'X-Android-Package': ANDROID_PACKAGE_NAME,
    'X-Android-Cert': ANDROID_CERT_SHA1,
};

const BIAS_RADIUS_METERS = 5000;
const POINT_OF_INTEREST_TYPES = ['point_of_interest', 'establishment', 'premise', 'subpremise'];

const FAILURE_MESSAGES: Record<GeocodeFailure, string> = {
    missing_key:
        'The Google api key is missing. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local and rebuild the app.',
    denied: 'Google refused the api key. Check the key, the api restriction and the android certificate.',
    quota: 'The google search quota for today is used up. Try again tomorrow.',
    network: 'No answer from the search service. Check the connection.',
    invalid: 'Google rejected the search. Try a different name.',
    unknown: 'The search service failed.',
};

class GeocodeFailureError extends Error {
    readonly failure: GeocodeFailure;

    constructor(failure: GeocodeFailure, message: string) {
        super(message);
        this.name = 'GeocodeFailureError';
        this.failure = failure;
    }
}

const failureFromHttp = (error: HttpError): GeocodeFailure => {
    if (error.status === 403) {
        return 'denied';
    }
    if (error.status === 429) {
        return 'quota';
    }
    if (error.status === 400) {
        return 'invalid';
    }
    return 'unknown';
};

const failureFromStatus = (status: string): GeocodeFailure => {
    if (status === 'REQUEST_DENIED') {
        return 'denied';
    }
    if (status === 'OVER_QUERY_LIMIT' || status === 'OVER_DAILY_LIMIT') {
        return 'quota';
    }
    if (status === 'INVALID_REQUEST') {
        return 'invalid';
    }
    return 'unknown';
};

const describeFailure = (error: unknown): GeocodeFailure => {
    if (error instanceof GeocodeFailureError) {
        return error.failure;
    }
    if (error instanceof HttpError) {
        return failureFromHttp(error);
    }
    const message = error instanceof Error ? error.message : '';
    if (message.includes('aborted') || message.includes('timeout') || message.includes('Network request failed')) {
        return 'network';
    }
    return 'unknown';
};

/**
 * The position bias is rounded to a cell, so the cache key says exactly what
 * was asked for. Two positions in the same cell share an answer.
 */
const biasFor = (position?: [number, number] | null): Bias | null => {
    if (!position) {
        return null;
    }
    return {
        latitude: Math.floor(position[0] / GEOCODE_BIAS_CELL_DEGREES) * GEOCODE_BIAS_CELL_DEGREES,
        longitude: Math.floor(position[1] / GEOCODE_BIAS_CELL_DEGREES) * GEOCODE_BIAS_CELL_DEGREES,
    };
};

const cacheKeyFor = (query: string, bias: Bias | null): string => {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const cell = bias ? `${bias.latitude.toFixed(2)},${bias.longitude.toFixed(2)}` : '-';
    return `${GEOCODE_COUNTRY}|${normalized}|${cell}`;
};

const findComponent = (
    components: GoogleAddressComponent[],
    type: string,
): GoogleAddressComponent | undefined => components.find((component) => component.types.includes(type));

const buildGeocodeName = (result: GoogleGeocodeResult): string => {
    if (result.types.some((type) => POINT_OF_INTEREST_TYPES.includes(type))) {
        const head = result.formatted_address.split(',')[0]?.trim();
        if (head) {
            return head;
        }
    }

    const components = result.address_components ?? [];
    const streetNumber = findComponent(components, 'street_number')?.short_name ?? '';
    const route = findComponent(components, 'route')?.short_name ?? '';
    const street = [streetNumber, route].filter(Boolean).join(' ');
    const area =
        findComponent(components, 'neighborhood')?.short_name ||
        findComponent(components, 'locality')?.short_name ||
        findComponent(components, 'sublocality')?.short_name ||
        '';

    return street || area || result.formatted_address;
};

const toPlace = (
    id: string,
    name: string,
    address: string,
    latitude: number,
    longitude: number,
): Place => ({
    id,
    name,
    address,
    latitude,
    longitude,
    countryCode: GEOCODE_COUNTRY,
    distanceMeters: null,
});

const withDistance = (places: Place[], position?: [number, number] | null): Place[] => {
    if (!position) {
        return places;
    }
    return places
        .map((place) => ({
            ...place,
            distanceMeters: distanceMeters(
                { lat: place.latitude, lon: place.longitude },
                { lat: position[0], lon: position[1] },
            ),
        }))
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
};

/**
 * The places search answers for a business, a category or a street, so it is
 * the one that finds a gas station near the rider.
 */
const requestPlaces = async (query: string, bias: Bias | null): Promise<Place[]> => {
    const payload: Record<string, unknown> = {
        textQuery: query,
        languageCode: GEOCODE_LANGUAGE,
        regionCode: GEOCODE_COUNTRY,
    };
    if (bias) {
        payload.locationBias = {
            circle: {
                center: { latitude: bias.latitude, longitude: bias.longitude },
                radius: BIAS_RADIUS_METERS,
            },
        };
    }

    try {
        const { body } = await httpPostJson<PlacesResponse>(GOOGLE_PLACES_ENDPOINT, payload, {
            service: 'google_places',
            headers: {
                ...ANDROID_HEADERS,
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
            },
            minIntervalMs: 1000,
            maxBytes: 1024 * 1024,
        });

        const places: Place[] = [];
        for (const place of body.places ?? []) {
            const latitude = place.location?.latitude;
            const longitude = place.location?.longitude;
            if (typeof latitude !== 'number' || typeof longitude !== 'number') {
                continue;
            }
            const address = place.formattedAddress?.trim() ?? '';
            const name = place.displayName?.text?.trim() ?? '';
            places.push(
                toPlace(
                    place.id?.replace(/^places\//, '') ?? `${latitude},${longitude}`,
                    name || address || 'Unnamed place',
                    address,
                    latitude,
                    longitude,
                ),
            );
        }
        return places;
    } catch (error) {
        if (error instanceof HttpError) {
            throw new GeocodeFailureError(failureFromHttp(error), error.message);
        }
        throw error;
    }
};

/**
 * The address geocoder answers for a street address. It is the fallback when
 * the places search is not enabled for the key.
 */
const requestGeocode = async (query: string, bias: Bias | null): Promise<Place[]> => {
    const params = new URLSearchParams({
        address: query,
        language: GEOCODE_LANGUAGE,
        components: `country:${GEOCODE_COUNTRY}`,
        key: GOOGLE_API_KEY,
    });
    if (bias) {
        params.set('latlng', `${bias.latitude.toFixed(4)},${bias.longitude.toFixed(4)}`);
    }

    const { body } = await httpGetJson<GeocodeResponse>(
        `${GOOGLE_GEOCODE_ENDPOINT}?${params.toString()}`,
        {
            service: 'google_geocode',
            headers: ANDROID_HEADERS,
            minIntervalMs: 1000,
            maxBytes: 1024 * 1024,
        },
    );

    if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
        throw new GeocodeFailureError(failureFromStatus(body.status), body.error_message ?? body.status);
    }

    const places: Place[] = [];
    for (const result of body.results ?? []) {
        places.push(
            toPlace(
                result.place_id,
                buildGeocodeName(result),
                result.formatted_address,
                result.geometry.location.lat,
                result.geometry.location.lng,
            ),
        );
    }
    return places;
};

const today = (): string => new Date().toISOString().slice(0, 10);

const readRequestsToday = async (): Promise<number> => {
    const day = await getSetting('googleQuotaDay');
    if (day !== today()) {
        return 0;
    }
    const count = await getSetting('googleQuotaCount');
    return count ? Number(count) : 0;
};

const writeRequestsToday = async (count: number): Promise<void> => {
    await setSetting('googleQuotaDay', today());
    await setSetting('googleQuotaCount', String(count));
};

/**
 * Every search goes out to google, is kept for a day and is charged once.
 * The cache is what makes the search free in practice, so a repeated text
 * never reaches the api again.
 */
export const searchPlaces = async (
    query: string,
    position?: [number, number] | null,
): Promise<GeocodeOutcome> => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
        return { ok: true, places: [], fromCache: false };
    }

    if (!GOOGLE_API_KEY) {
        return { ok: false, failure: 'missing_key', message: FAILURE_MESSAGES.missing_key };
    }

    const bias = biasFor(position);
    const cacheKey = cacheKeyFor(trimmed, bias);
    const now = Date.now();

    const cached = await readCachedPlaces(cacheKey, now);
    if (cached) {
        return { ok: true, places: withDistance(cached, position), fromCache: true };
    }

    const used = await readRequestsToday();
    if (used >= MAX_GOOGLE_REQUESTS_PER_DAY) {
        return { ok: false, failure: 'quota', message: FAILURE_MESSAGES.quota };
    }
    await writeRequestsToday(used + 1);

    try {
        const places = await requestPlaces(trimmed, bias);
        if (places.length > 0) {
            await writeCachedPlaces(cacheKey, trimmed, 'google_places', places, now, GEOCODE_CACHE_TTL_MS);
            return { ok: true, places: withDistance(places, position), fromCache: false };
        }
    } catch (error) {
        logger.warn('the places search failed', {
            service: 'google_places',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
    }

    try {
        const places = await requestGeocode(trimmed, bias);
        await writeCachedPlaces(cacheKey, trimmed, 'google_geocode', places, now, GEOCODE_CACHE_TTL_MS);
        return { ok: true, places: withDistance(places, position), fromCache: false };
    } catch (error) {
        const failure = describeFailure(error);
        logger.warn('the geocoder failed', {
            service: 'google_geocode',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        return { ok: false, failure, message: FAILURE_MESSAGES[failure] };
    }
};
