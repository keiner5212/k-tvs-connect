import { AchievedTime } from '@typings/types';

/**
 * The estimate of a route. It starts from the time the router gave and, once
 * the rider has ridden the route, it is the average of the times it took.
 */

export interface RouteEstimate {
    /** the seconds the whole route is expected to take */
    seconds: number;
    /** the times the route actually took, the newest first */
    achievedTimes: AchievedTime[];
    source: 'router' | 'history';
}

export const estimateRoute = (
    achievedTimes: AchievedTime[],
    routerSeconds: number,
): RouteEstimate => {
    if (achievedTimes.length === 0) {
        return { seconds: routerSeconds, achievedTimes, source: 'router' };
    }

    const total = achievedTimes.reduce((sum, time) => sum + time.seconds, 0);
    return {
        seconds: Math.round(total / achievedTimes.length),
        achievedTimes,
        source: 'history',
    };
};

/** a ride shorter than this is a jump of the position, not a ride */
const MIN_RIDE_SECONDS = 60;
/** a ride longer than this is a forgotten ride */
const MAX_RIDE_SECONDS = 21600;
/** the rider has to have done most of the route for the time to describe it */
const MIN_DISTANCE_RATIO = 0.85;
const MAX_DISTANCE_RATIO = 1.15;
/** the pace of the ride has to be one a scooter can keep */
const MIN_SPEED_KMH = 8;
const MAX_SPEED_KMH = 90;

/**
 * A reading is kept only when it can be the time this rider took on this
 * route: the ride has to last long enough, the rider has to have done most
 * of the route and the pace has to be one a scooter can keep.
 */
export const isRideOfRoute = (
    seconds: number,
    travelledMeters: number,
    routeMeters: number,
): boolean => {
    if (seconds < MIN_RIDE_SECONDS || seconds > MAX_RIDE_SECONDS) {
        return false;
    }
    if (routeMeters <= 0) {
        return false;
    }

    const distanceRatio = travelledMeters / routeMeters;
    if (distanceRatio < MIN_DISTANCE_RATIO || distanceRatio > MAX_DISTANCE_RATIO) {
        return false;
    }

    const speedKmh = (routeMeters / seconds) * 3.6;
    return speedKmh >= MIN_SPEED_KMH && speedKmh <= MAX_SPEED_KMH;
};
