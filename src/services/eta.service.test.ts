import { AchievedTime } from '@typings/types';
import { estimateRoute, isRideOfRoute } from './eta.service';

const at = (seconds: number): AchievedTime => ({ seconds, achievedAt: 1700000000000 });

describe('route estimate', () => {
    const routerSeconds = 720;

    it('falls back to the router when the route was never ridden', () => {
        const estimate = estimateRoute([], routerSeconds);

        expect(estimate.seconds).toBe(720);
        expect(estimate.source).toBe('router');
    });

    it('uses the single time the route took', () => {
        const estimate = estimateRoute([at(840)], routerSeconds);

        expect(estimate.seconds).toBe(840);
        expect(estimate.source).toBe('history');
    });

    it('takes the average of the times the route took', () => {
        const estimate = estimateRoute([at(840), at(810), at(900)], routerSeconds);

        expect(estimate.seconds).toBe(850);
        expect(estimate.source).toBe('history');
    });

    it('keeps the times it averaged', () => {
        const times = [at(840), at(810)];
        const estimate = estimateRoute(times, routerSeconds);

        expect(estimate.achievedTimes).toEqual(times);
    });
});

describe('a reading that can be a ride of the route', () => {
    const routeMeters = 4800;

    it('accepts a ride that fits the route', () => {
        expect(isRideOfRoute(840, 4750, routeMeters)).toBe(true);
    });

    it('rejects a ride too short to be the route', () => {
        expect(isRideOfRoute(45, 4750, routeMeters)).toBe(false);
    });

    it('rejects a forgotten ride', () => {
        expect(isRideOfRoute(7 * 3600, 4750, routeMeters)).toBe(false);
    });

    it('rejects a ride that did not get to the destination', () => {
        expect(isRideOfRoute(840, 3000, routeMeters)).toBe(false);
    });

    it('rejects a pace no scooter keeps', () => {
        expect(isRideOfRoute(120, 4750, routeMeters)).toBe(false);
        expect(isRideOfRoute(3600, 4750, routeMeters)).toBe(false);
    });
});
