import { Place } from '@typings/types';
import { distanceMeters } from '@utils/geo';
import { httpGetJson } from './http.service';

interface PhotonFeature {
    geometry: { coordinates: [number, number] };
    properties: {
        osm_id?: number;
        osm_type?: string;
        name?: string;
        street?: string;
        housenumber?: string;
        city?: string;
        state?: string;
        country?: string;
        countrycode?: string;
        postcode?: string;
    };
}

interface PhotonResponse {
    features: PhotonFeature[];
}

/**
 * A result further than this from the rider is dropped. The public geocoder
 * answers with matches anywhere in the world, and a street called "Calle 10"
 * exists in every city on earth.
 */
const MAX_RESULT_DISTANCE_METERS = 100_000;

const buildAddress = (properties: PhotonFeature['properties']): string => {
    const street = [properties.street, properties.housenumber].filter(Boolean).join(' ');
    const city = [properties.postcode, properties.city].filter(Boolean).join(' ');
    return [street, city, properties.state, properties.country].filter(Boolean).join(', ');
};

export const searchPlaces = async (
    baseUrl: string,
    query: string,
    limit = 10,
    position?: [number, number] | null,
): Promise<Place[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
        return [];
    }

    const params = new URLSearchParams({ q: trimmed, limit: String(limit), lang: 'es' });
    if (position) {
        params.set('lat', position[0].toFixed(5));
        params.set('lon', position[1].toFixed(5));
        params.set('zoom', '12');
        params.set('location_bias_scale', '0.5');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/?${params.toString()}`;
    const { body } = await httpGetJson<PhotonResponse>(url, {
        service: 'photon',
        minIntervalMs: 1000,
        maxBytes: 2 * 1024 * 1024,
    });

    const places = (body.features ?? []).map((feature, index) => ({
        id: `${feature.properties.osm_type ?? 'node'}-${feature.properties.osm_id ?? index}`,
        name: feature.properties.name || feature.properties.street || 'Unnamed place',
        address: buildAddress(feature.properties),
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
        countryCode: feature.properties.countrycode ?? '',
        distanceMeters: null,
    }));

    if (!position) {
        return places;
    }

    const withDistance = places.map((place) => ({
        ...place,
        distanceMeters: distanceMeters(
            { lat: place.latitude, lon: place.longitude },
            { lat: position[0], lon: position[1] },
        ),
    }));

    return withDistance
        .filter((place) => (place.distanceMeters ?? 0) <= MAX_RESULT_DISTANCE_METERS)
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
};
