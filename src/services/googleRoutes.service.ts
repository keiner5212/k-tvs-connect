import { ANDROID_CERT_SHA1, ANDROID_PACKAGE_NAME, GOOGLE_API_KEY } from '@config/geocoding';
import { motoSeconds } from '@services/eta.service';
import { chargeGoogleUsage } from '@services/googleUsage.service';
import { httpPostJson } from '@services/http.service';
import { RouteResult } from '@typings/types';
import { decodePolyline, encodePolyline } from '@utils/polyline';

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** google encodes its polyline with five decimals, the app keeps six */
const GOOGLE_POLYLINE_PRECISION = 5;

interface GoogleRoutesResponse {
    routes?: {
        distanceMeters?: number;
        duration?: string;
        polyline?: { encodedPolyline?: string };
    }[];
}

export interface GoogleRouteRequest {
    originLat: number;
    originLon: number;
    destinationLat: number;
    destinationLon: number;
}

/** the duration comes as "2730s" */
const parseDuration = (value?: string): number => {
    if (!value) {
        return 0;
    }
    const seconds = Number(value.replace(/s$/, ''));
    return Number.isFinite(seconds) ? seconds : 0;
};

/**
 * The main roads route. Google keeps it on the main roads and knows the
 * traffic, but it cannot avoid a point.
 */
export const computeGoogleRoute = async (
    request: GoogleRouteRequest,
): Promise<RouteResult> => {
    const payload = {
        origin: {
            location: {
                latLng: { latitude: request.originLat, longitude: request.originLon },
            },
        },
        destination: {
            location: {
                latLng: {
                    latitude: request.destinationLat,
                    longitude: request.destinationLon,
                },
            },
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        polylineQuality: 'HIGH_QUALITY',
        languageCode: 'es',
        regionCode: 'CO',
    };

    const { body } = await httpPostJson<GoogleRoutesResponse>(ROUTES_ENDPOINT, payload, {
        service: 'google_routes',
        headers: {
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
            'X-Android-Package': ANDROID_PACKAGE_NAME,
            'X-Android-Cert': ANDROID_CERT_SHA1,
        },
        minIntervalMs: 1000,
        maxBytes: 1024 * 1024,
    });

    const route = body.routes?.[0];
    const encoded = route?.polyline?.encodedPolyline;
    if (!route || !encoded) {
        throw new Error('the routing service answered without a route');
    }

    await chargeGoogleUsage('routes');

    const distanceMeters = route.distanceMeters ?? 0;
    const geometry = encodePolyline(decodePolyline(encoded, GOOGLE_POLYLINE_PRECISION), 6);

    return {
        distanceMeters,
        durationSeconds: motoSeconds(parseDuration(route.duration), 'car', true, distanceMeters),
        geometry,
        engine: 'google',
    };
};
