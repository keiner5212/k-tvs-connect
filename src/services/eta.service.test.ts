import { RouteObservation, estimateArrival } from './eta.service';

const DAY = 24 * 60 * 60 * 1000;

const at = (daysAgo: number, hour: number): number => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, 30, 0, 0);
    return date.getTime();
};

describe('arrival estimate', () => {
    const routerSeconds = 720;
    const routerMeters = 4800;

    it('falls back to the router when there is no history', () => {
        const estimate = estimateArrival(routerSeconds, routerMeters, [], new Date());

        expect(estimate).not.toBeNull();
        expect(estimate?.minutes).toBe(12);
        expect(estimate?.source).toBe('router');
        expect(estimate?.factor).toBe(1);
    });

    it('learns from the rider history', () => {
        const observations: RouteObservation[] = [
            {
                observedAt: at(14, 7),
                observedSeconds: 840,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
            {
                observedAt: at(7, 7),
                observedSeconds: 810,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
            {
                observedAt: at(1, 7),
                observedSeconds: 900,
                routerSeconds: 750,
                routerMeters: 4830,
                confidence: 1,
            },
        ];

        const estimate = estimateArrival(
            routerSeconds,
            routerMeters,
            observations,
            new Date(at(0, 8)),
        );

        expect(estimate).not.toBeNull();
        expect(estimate?.minutes).toBe(13);
        expect(estimate?.source).toBe('history');
        expect(estimate?.factor).toBeGreaterThan(1);
        expect(estimate?.factor).toBeLessThan(1.2);
    });

    it('moves only a third of the way with a single observation', () => {
        const observations: RouteObservation[] = [
            {
                observedAt: at(1, 8),
                observedSeconds: 1440,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
        ];

        const estimate = estimateArrival(
            routerSeconds,
            routerMeters,
            observations,
            new Date(at(0, 8)),
        );

        expect(estimate?.minutes).toBe(15);
        expect(estimate?.source).toBe('router');
    });

    it('ignores an observation that is not the same route', () => {
        const observations: RouteObservation[] = [
            {
                observedAt: at(1, 8),
                observedSeconds: 900,
                routerSeconds: 720,
                routerMeters: 9000,
                confidence: 1,
            },
        ];

        const estimate = estimateArrival(
            routerSeconds,
            routerMeters,
            observations,
            new Date(at(0, 8)),
        );

        expect(estimate?.factor).toBe(1);
        expect(estimate?.minutes).toBe(12);
    });

    it('ignores an observation older than half a year', () => {
        const observations: RouteObservation[] = [
            {
                observedAt: at(200, 8),
                observedSeconds: 1800,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
        ];

        const estimate = estimateArrival(
            routerSeconds,
            routerMeters,
            observations,
            new Date(at(0, 8)),
        );

        expect(estimate?.factor).toBe(1);
    });

    it('rejects a broken router duration', () => {
        expect(estimateArrival(10, 4800, [], new Date())).toBeNull();
        expect(estimateArrival(20000, 4800, [], new Date())).toBeNull();
    });

    it('rejects a router duration that implies an impossible speed', () => {
        expect(estimateArrival(60, 4800, [], new Date())).toBeNull();
        expect(estimateArrival(600, 100, [], new Date())).toBeNull();
    });

    it('never promises less than a minute', () => {
        const estimate = estimateArrival(60, 60, [], new Date());
        expect(estimate?.minutes).toBe(1);
    });

    it('keeps the destination key stable', () => {
        const key = (latitude: number, longitude: number) =>
            `geo:${Math.round(latitude * 1000)},${Math.round(longitude * 1000)}`;
        expect(key(11.24071, -74.19472)).toBe(key(11.2406, -74.1948));
    });

    it('gives the arrival time from the clock', () => {
        const now = new Date();
        now.setHours(14, 5, 0, 0);
        const estimate = estimateArrival(routerSeconds, routerMeters, [], now);

        const arrival = new Date(estimate!.arrivalAt);
        expect(arrival.getHours()).toBe(14);
        expect(arrival.getMinutes()).toBe(17);
    });

    it('weighs an inferred observation less than a linked one', () => {
        const linked: RouteObservation[] = [
            {
                observedAt: at(1, 8),
                observedSeconds: 900,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
            {
                observedAt: at(2, 8),
                observedSeconds: 900,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
            {
                observedAt: at(3, 8),
                observedSeconds: 900,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
        ];
        const withInferred = linked.map((observation, index) =>
            index === 2 ? { ...observation, confidence: 0.5 } : observation,
        );

        const strong = estimateArrival(routerSeconds, routerMeters, linked, new Date(at(0, 8)));
        const weaker = estimateArrival(
            routerSeconds,
            routerMeters,
            withInferred,
            new Date(at(0, 8)),
        );

        expect(weaker!.factor).toBeLessThan(strong!.factor);
    });

    it('uses the time of day bucket when it has enough observations', () => {
        const observations: RouteObservation[] = [
            {
                observedAt: at(1, 8),
                observedSeconds: 1200,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
            {
                observedAt: at(2, 8),
                observedSeconds: 1200,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
            {
                observedAt: at(3, 8),
                observedSeconds: 1200,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
            {
                observedAt: at(1, 23),
                observedSeconds: 780,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
            {
                observedAt: at(2, 23),
                observedSeconds: 780,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
        ];

        const morning = estimateArrival(routerSeconds, routerMeters, observations, new Date(at(0, 8)));
        const night = estimateArrival(routerSeconds, routerMeters, observations, new Date(at(0, 23)));

        expect(morning!.minutes).toBe(16);
        expect(morning!.minutes).toBeGreaterThan(night!.minutes);
        expect(night!.minutes).toBe(12);
    });

    it('keeps the observation age out of the picture after half a year', () => {
        const old: RouteObservation[] = [
            {
                observedAt: Date.now() - 400 * DAY,
                observedSeconds: 1800,
                routerSeconds: 720,
                routerMeters: 4800,
                confidence: 1,
            },
        ];

        const estimate = estimateArrival(routerSeconds, routerMeters, old, new Date());
        expect(estimate?.source).toBe('router');
    });
});
