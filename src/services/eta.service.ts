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

/** a trip inside the city is the one that feels the traffic */
const URBAN_ROUTE_METERS = 30000;

/** the city slows the ride down, the motorcycle less than the car */
const URBAN_TRAFFIC_FACTOR = 1.15;

/** in the city the motorcycle filters the queue, so it beats the car */
const URBAN_MOTO_FACTOR = 0.85;

/** on the same streets the motorcycle is slower than the car */
const FREE_FLOW_MOTO_FACTOR = 1.1;

/**
 * The time the rider is expected to take.
 *
 * The router gives a free flow time with no traffic. No engine publishes a
 * motorcycle to car ratio, so the factors here are the ones the app can
 * defend: the traffic factor comes from the bogota observatory (23.0 km/h in
 * the peak windows and 23.7 all day, measured from waze probes) and the
 * motorcycle factor is the queue a motorcycle filters in the city.
 */
export const motoSeconds = (
    routerSeconds: number,
    kind: 'moto' | 'car',
    trafficAware: boolean,
    distanceMeters: number,
): number => {
    if (routerSeconds <= 0) {
        return 0;
    }
    const urban = distanceMeters <= URBAN_ROUTE_METERS;
    if (kind === 'moto') {
        return Math.round(routerSeconds * (urban ? URBAN_TRAFFIC_FACTOR : 1));
    }
    if (trafficAware) {
        return Math.round(routerSeconds * (urban ? URBAN_MOTO_FACTOR : 1));
    }
    return Math.round(
        routerSeconds * FREE_FLOW_MOTO_FACTOR * (urban ? URBAN_TRAFFIC_FACTOR : 1),
    );
};

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
