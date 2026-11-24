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

/**
 * The meters between two points.
 */
export const distanceBetween = (a: LatLon, b: LatLon): number => {
    const toRadians = Math.PI / 180;
    const lat1 = a.lat * toRadians;
    const lat2 = b.lat * toRadians;
    const deltaLat = (b.lat - a.lat) * toRadians;
    const deltaLon = (b.lon - a.lon) * toRadians;
    const h =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Where the target sits on the path: the distance along it from the start, the
 * index of the vertex before it, and how far it is from the path. The point is
 * projected on the segment it falls between, so the distance does not jump
 * with the spacing of the vertices.
 */
export const projectOntoPath = (
    points: LatLon[],
    target: LatLon,
): { index: number; distance: number; offset: number } | null => {
    if (points.length === 0) {
        return null;
    }
    const cumulative = distanceAlongPath(points);
    const latScale = 111320;
    const lonScale = 111320 * Math.max(0.1, Math.cos((target.lat * Math.PI) / 180));
    let bestIndex = 0;
    let bestRatio = 0;
    let bestOffset = Number.POSITIVE_INFINITY;

    for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const ax = (start.lon - target.lon) * lonScale;
        const ay = (start.lat - target.lat) * latScale;
        const dx = (end.lon - start.lon) * lonScale;
        const dy = (end.lat - start.lat) * latScale;
        const span = dx * dx + dy * dy;
        const ratio =
            span === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / span));
        const px = ax + ratio * dx;
        const py = ay + ratio * dy;
        const offset = Math.sqrt(px * px + py * py);
        if (offset < bestOffset) {
            bestOffset = offset;
            bestIndex = index;
            bestRatio = ratio;
        }
    }

    const segment = cumulative[bestIndex + 1] - cumulative[bestIndex];
    return {
        index: bestIndex,
        distance: cumulative[bestIndex] + segment * bestRatio,
        offset: bestOffset,
    };
};
