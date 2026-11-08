/**
 * Parses the links a map app shares. Google Maps, and the other map apps, share
 * a `geo:` uri or an https link with the coordinates in the query.
 */

export interface SharedPlace {
    latitude: number;
    longitude: number;
    name: string | null;
}

const COORDINATE_PATTERN = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/;

const isValid = (latitude: number, longitude: number): boolean =>
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0);

const decode = (value: string | null): string | null => {
    if (!value) {
        return null;
    }
    try {
        return decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
        return value;
    }
};

export const parseSharedLocation = (url: string): SharedPlace | null => {
    if (!url) {
        return null;
    }

    const trimmed = url.trim();

    if (trimmed.startsWith('geo:')) {
        const body = trimmed.slice('geo:'.length);
        const queryIndex = body.indexOf('?');
        const coordinatesPart = queryIndex >= 0 ? body.slice(0, queryIndex) : body;
        const query = queryIndex >= 0 ? body.slice(queryIndex + 1) : '';
        const parameters = new URLSearchParams(query);

        const label = decode(parameters.get('q'));
        const queryMatch = label ? COORDINATE_PATTERN.exec(label) : null;
        const linkMatch = parameters.get('ll')
            ? COORDINATE_PATTERN.exec(parameters.get('ll') as string)
            : null;

        if (queryMatch) {
            const latitude = Number(queryMatch[1]);
            const longitude = Number(queryMatch[2]);
            if (isValid(latitude, longitude)) {
                return {
                    latitude,
                    longitude,
                    name: label ? label.replace(COORDINATE_PATTERN, '').trim() || null : null,
                };
            }
        }

        const directMatch = linkMatch ?? COORDINATE_PATTERN.exec(coordinatesPart);
        if (directMatch) {
            const latitude = Number(directMatch[1]);
            const longitude = Number(directMatch[2]);
            if (isValid(latitude, longitude)) {
                return { latitude, longitude, name: label };
            }
        }

        return null;
    }

    const separator = trimmed.indexOf('?');
    if (separator < 0) {
        return null;
    }

    const parameters = new URLSearchParams(trimmed.slice(separator + 1));
    const query = parameters.get('query') ?? parameters.get('q') ?? parameters.get('daddr');
    if (!query) {
        return null;
    }

    const match = COORDINATE_PATTERN.exec(query);
    if (!match) {
        return null;
    }

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!isValid(latitude, longitude)) {
        return null;
    }

    return {
        latitude,
        longitude,
        name: decode(query.replace(COORDINATE_PATTERN, '').trim()) || null,
    };
};
