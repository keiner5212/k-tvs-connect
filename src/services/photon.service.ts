import { Place } from '@typings/types';
import { httpGetJson } from './http.service';

interface PhotonFeature {
    geometry: { coordinates: [number, number] };
    properties: {
        osm_id?: number;
        name?: string;
        street?: string;
        housenumber?: string;
        city?: string;
        state?: string;
        country?: string;
        postcode?: string;
    };
}

interface PhotonResponse {
    features: PhotonFeature[];
}

const buildAddress = (properties: PhotonFeature['properties']): string => {
    const street = [properties.street, properties.housenumber].filter(Boolean).join(' ');
    const city = [properties.postcode, properties.city].filter(Boolean).join(' ');
    return [street, city, properties.state, properties.country].filter(Boolean).join(', ');
};

export const searchPlaces = async (
    baseUrl: string,
    query: string,
    limit = 10,
): Promise<Place[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
        return [];
    }

    const url = `${baseUrl.replace(/\/$/, '')}/?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
    const { body } = await httpGetJson<PhotonResponse>(url, {
        service: 'photon',
        minIntervalMs: 1000,
        maxBytes: 2 * 1024 * 1024,
    });

    return (body.features ?? []).map((feature, index) => ({
        id: `${feature.properties.osm_id ?? index}`,
        name: feature.properties.name || feature.properties.street || 'Unnamed place',
        address: buildAddress(feature.properties),
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
    }));
};

export const reverseGeocode = async (
    baseUrl: string,
    latitude: number,
    longitude: number,
): Promise<Place | null> => {
    const url = `${baseUrl.replace(/\/$/, '')}/reverse?lon=${longitude}&lat=${latitude}`;
    const { body } = await httpGetJson<PhotonResponse>(url, {
        service: 'photon',
        minIntervalMs: 1000,
        maxBytes: 512 * 1024,
    });

    const feature = body.features?.[0];
    if (!feature) {
        return null;
    }

    return {
        id: `${feature.properties.osm_id ?? 0}`,
        name: feature.properties.name || 'Current position',
        address: buildAddress(feature.properties),
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
    };
};
