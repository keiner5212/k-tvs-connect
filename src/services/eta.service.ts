/**
 * Arrival time estimate. It starts from the router's own estimate and learns
 * from the times this rider actually took on the same route.
 *
 * The learned quantity is a ratio, rider time over router time, so it survives
 * the route length changing between sessions. The blend is geometric, so the
 * router's answer is the limit when there is no history and the rider's history
 * never fully replaces the router.
 */

export interface RouteObservation {
    observedAt: number;
    observedSeconds: number;
    routerSeconds: number;
    routerMeters: number;
    confidence: number;
}

export interface ArrivalEstimate {
    minutes: number;
    arrivalAt: number;
    factor: number;
    source: 'router' | 'history';
    explanation: string;
}

const PRIOR_STRENGTH = 2;
const HALF_LIFE_DAYS = 90;
const MAX_OBSERVATION_AGE_DAYS = 180;
const MIN_EFFECTIVE_COUNT = 0.5;
const MIN_BUCKET_OBSERVATIONS = 2;
const RATIO_MIN = 0.4;
const RATIO_MAX = 2;
const ROUTE_LENGTH_BAND_MIN = 0.8;
const ROUTE_LENGTH_BAND_MAX = 1.25;
const FACTOR_MIN = 0.5;
const FACTOR_MAX = 2;
const MIN_ROUTER_SECONDS = 60;
const MAX_ROUTER_SECONDS = 14400;
const MIN_IMPLIED_SPEED_KMH = 3;
const MAX_IMPLIED_SPEED_KMH = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The clock is split in four buckets, because a commute at rush hour and a
 * ride at midday are two different quantities.
 */
const timeBucket = (hour: number): number => {
    if (hour >= 5 && hour < 10) {
        return 0;
    }
    if (hour >= 10 && hour < 17) {
        return 1;
    }
    if (hour >= 17 && hour < 21) {
        return 2;
    }
    return 3;
};

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

export const destinationKey = (latitude: number, longitude: number): string =>
    `geo:${Math.round(latitude * 1000)},${Math.round(longitude * 1000)}`;

export const estimateArrival = (
    routerSeconds: number,
    routerMeters: number,
    observations: RouteObservation[],
    now: Date = new Date(),
): ArrivalEstimate | null => {
    if (!Number.isFinite(routerSeconds) || routerSeconds < MIN_ROUTER_SECONDS) {
        return null;
    }
    if (routerSeconds > MAX_ROUTER_SECONDS) {
        return null;
    }

    const impliedSpeedKmh = (routerMeters / routerSeconds) * 3.6;
    if (
        !Number.isFinite(impliedSpeedKmh) ||
        impliedSpeedKmh < MIN_IMPLIED_SPEED_KMH ||
        impliedSpeedKmh > MAX_IMPLIED_SPEED_KMH
    ) {
        return null;
    }

    const bucket = timeBucket(now.getHours());
    const fresh = observations.filter(
        (observation) =>
            now.getTime() - observation.observedAt <= MAX_OBSERVATION_AGE_DAYS * DAY_MS &&
            observation.routerMeters >= routerMeters * ROUTE_LENGTH_BAND_MIN &&
            observation.routerMeters <= routerMeters * ROUTE_LENGTH_BAND_MAX,
    );

    const inBucket = fresh.filter(
        (observation) => timeBucket(new Date(observation.observedAt).getHours()) === bucket,
    );
    const used = inBucket.length >= MIN_BUCKET_OBSERVATIONS ? inBucket : fresh;

    const weighted: { weight: number; ratio: number }[] = [];
    for (const observation of used) {
        if (observation.routerSeconds <= 0) {
            continue;
        }
        const ratio = observation.observedSeconds / observation.routerSeconds;
        if (!Number.isFinite(ratio) || ratio < RATIO_MIN || ratio > RATIO_MAX) {
            continue;
        }
        const ageDays = Math.max(0, (now.getTime() - observation.observedAt) / DAY_MS);
        const weight = observation.confidence * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
        weighted.push({ weight, ratio });
    }

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight < MIN_EFFECTIVE_COUNT) {
        const minutes = Math.max(1, Math.round(routerSeconds / 60));
        return {
            minutes,
            arrivalAt: now.getTime() + minutes * 60_000,
            factor: 1,
            source: 'router',
            explanation: "Still mostly the map's estimate.",
        };
    }

    const logMean =
        weighted.reduce((sum, entry) => sum + entry.weight * Math.log(entry.ratio), 0) / totalWeight;
    const geometricMean = Math.exp(logMean);
    const lambda = totalWeight / (totalWeight + PRIOR_STRENGTH);
    const factor = clamp(Math.pow(geometricMean, lambda), FACTOR_MIN, FACTOR_MAX);

    const durationSeconds = routerSeconds * factor;
    const minutes = Math.max(1, Math.round(durationSeconds / 60));

    return {
        minutes,
        arrivalAt: now.getTime() + minutes * 60_000,
        factor,
        source: lambda > 0.5 ? 'history' : 'router',
        explanation:
            lambda > 0.5
                ? `Based on your last ${weighted.length} trips on this route.`
                : `Still mostly the map's estimate, nudged by your ${weighted.length} recorded trip${weighted.length === 1 ? '' : 's'
                }.`,
    };
};
