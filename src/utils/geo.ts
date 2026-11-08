export interface LatLon {
    lat: number;
    lon: number;
}

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const distanceMeters = (a: LatLon, b: LatLon): number => {
    const dLat = toRadians(b.lat - a.lat);
    const dLon = toRadians(b.lon - a.lon);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Distance from a point to the straight line between two points, in meters.
 */
export const distanceToSegmentMeters = (point: LatLon, start: LatLon, end: LatLon): number => {
    const latScale = 111320;
    const lonScale = 111320 * Math.cos(toRadians(start.lat));

    const px = (point.lon - start.lon) * lonScale;
    const py = (point.lat - start.lat) * latScale;
    const ex = (end.lon - start.lon) * lonScale;
    const ey = (end.lat - start.lat) * latScale;

    const lengthSquared = ex * ex + ey * ey;
    if (lengthSquared === 0) {
        return Math.sqrt(px * px + py * py);
    }

    const t = Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSquared));
    const dx = px - t * ex;
    const dy = py - t * ey;

    return Math.sqrt(dx * dx + dy * dy);
};

export interface SegmentOffset {
    distanceMeters: number;
    /** Positive when the point is still in front of the rider. */
    aheadMeters: number;
    crossMeters: number;
}

/** Where a point sits relative to the rider on this segment. */
export const segmentOffsetMeters = (point: LatLon, start: LatLon, end: LatLon): SegmentOffset => {
    const latScale = 111320;
    const lonScale = 111320 * Math.cos(toRadians(start.lat));
    const px = (point.lon - start.lon) * lonScale;
    const py = (point.lat - start.lat) * latScale;
    const ex = (end.lon - start.lon) * lonScale;
    const ey = (end.lat - start.lat) * latScale;
    const lengthSquared = ex * ex + ey * ey;
    const length = Math.sqrt(lengthSquared);
    const t =
        lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSquared));
    const cx = px - t * ex;
    const cy = py - t * ey;
    const alongEast = length === 0 ? 0 : ex / length;
    const alongNorth = length === 0 ? 0 : ey / length;

    return {
        distanceMeters: Math.sqrt(cx * cx + cy * cy),
        aheadMeters: cx * alongEast + cy * alongNorth,
        crossMeters: -cx * alongNorth + cy * alongEast,
    };
};

export const boundingBox = (
    start: LatLon,
    end: LatLon,
    marginMeters: number,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } => {
    const latMargin = marginMeters / 111320;
    const lonMargin = marginMeters / (111320 * Math.max(0.1, Math.cos(toRadians(start.lat))));

    return {
        minLat: Math.min(start.lat, end.lat) - latMargin,
        maxLat: Math.max(start.lat, end.lat) + latMargin,
        minLon: Math.min(start.lon, end.lon) - lonMargin,
        maxLon: Math.max(start.lon, end.lon) + lonMargin,
    };
};

/** The direction of a segment, in degrees, zero being the north. */
export const bearingDegrees = (from: LatLon, to: LatLon): number => {
    const lat1 = toRadians(from.lat);
    const lat2 = toRadians(to.lat);
    const dLon = toRadians(to.lon - from.lon);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
