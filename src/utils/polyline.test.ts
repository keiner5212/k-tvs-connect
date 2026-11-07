import { decodePolyline, distanceAlongPath, encodePolyline, pointAtDistance } from './polyline';

describe('polyline', () => {
    it('round trips through the encoder', () => {
        const points = [
            { lat: 4.5709, lon: -74.2973 },
            { lat: 4.6100, lon: -74.2500 },
            { lat: 4.6500, lon: -74.2000 },
        ];

        const decoded = decodePolyline(encodePolyline(points));

        expect(decoded).toHaveLength(points.length);
        decoded.forEach((point, index) => {
            expect(point.lat).toBeCloseTo(points[index].lat, 5);
            expect(point.lon).toBeCloseTo(points[index].lon, 5);
        });
    });

    it('decodes the google precision 6 format', () => {
        expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toHaveLength(3);
    });

    it('accumulates the distance along the path', () => {
        const points = [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 0.001 },
        ];

        const cumulative = distanceAlongPath(points);

        expect(cumulative[0]).toBe(0);
        expect(cumulative[1]).toBeGreaterThan(100);
        expect(cumulative[1]).toBeLessThan(120);
    });

    it('finds the point at a distance along the path', () => {
        const points = [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 0.001 },
        ];
        const cumulative = distanceAlongPath(points);

        const middle = pointAtDistance(points, cumulative, cumulative[1] / 2);

        expect(middle?.lon).toBeCloseTo(0.0005, 4);
        expect(pointAtDistance(points, cumulative, 0)?.lon).toBe(0);
        expect(pointAtDistance(points, cumulative, 1e9)?.lon).toBeCloseTo(0.001, 4);
    });
});
