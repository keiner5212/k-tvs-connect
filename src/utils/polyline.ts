export interface LatLon {
    lat: number;
    lon: number;
}

export const decodePolyline = (encoded: string, precision = 6): LatLon[] => {
    const factor = 10 ** precision;
    const points: LatLon[] = [];
    let index = 0;
    let lat = 0;
    let lon = 0;

    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte: number;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        lat += result & 1 ? ~(result >> 1) : result >> 1;

        shift = 0;
        result = 0;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        lon += result & 1 ? ~(result >> 1) : result >> 1;

        points.push({ lat: lat / factor, lon: lon / factor });
    }

    return points;
};

export const encodePolyline = (points: LatLon[], precision = 6): string => {
    const factor = 10 ** precision;
    let output = '';
    let previousLat = 0;
    let previousLon = 0;

    for (const point of points) {
        const lat = Math.round(point.lat * factor);
        const lon = Math.round(point.lon * factor);

        const encodeValue = (value: number) => {
            let encoded = value < 0 ? ~(value << 1) : value << 1;
            let chunk = '';
            while (encoded >= 0x20) {
                chunk += String.fromCharCode((0x20 | (encoded & 0x1f)) + 63);
                encoded >>= 5;
            }
            chunk += String.fromCharCode(encoded + 63);
            return chunk;
        };

        output += encodeValue(lat - previousLat);
        output += encodeValue(lon - previousLon);

        previousLat = lat;
        previousLon = lon;
    }

    return output;
};

export const distanceAlongPath = (points: LatLon[]): number[] => {
    const cumulative: number[] = [0];

    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const meters =
            Math.sin((current.lat * Math.PI) / 180) * Math.sin((previous.lat * Math.PI) / 180) +
            Math.cos((current.lat * Math.PI) / 180) *
            Math.cos((previous.lat * Math.PI) / 180) *
            Math.cos(((current.lon - previous.lon) * Math.PI) / 180);
        const angle = Math.acos(Math.min(1, Math.max(-1, meters)));
        cumulative.push(cumulative[index - 1] + angle * 6371000);
    }

    return cumulative;
};

export const pointAtDistance = (
    points: LatLon[],
    cumulative: number[],
    meters: number,
): LatLon | null => {
    if (points.length === 0) {
        return null;
    }
    if (meters <= 0) {
        return points[0];
    }
    const total = cumulative[cumulative.length - 1];
    if (meters >= total) {
        return points[points.length - 1];
    }

    for (let index = 1; index < cumulative.length; index += 1) {
        if (cumulative[index] >= meters) {
            const span = cumulative[index] - cumulative[index - 1];
            const ratio = span === 0 ? 0 : (meters - cumulative[index - 1]) / span;
            const previous = points[index - 1];
            const current = points[index];
            return {
                lat: previous.lat + (current.lat - previous.lat) * ratio,
                lon: previous.lon + (current.lon - previous.lon) * ratio,
            };
        }
    }

    return points[points.length - 1];
};
