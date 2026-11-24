/**
 * The free monthly caps of the google apis this app calls, one per sku.
 * The caps reset on the first day of the month, midnight pacific time, and
 * google counts them over every project of the billing account.
 * Source: developers.google.com/maps/billing-and-pricing/pricing (2026-11-17).
 */

export type GoogleSku = 'routes' | 'tiles' | 'places' | 'geocode';

export const GOOGLE_FREE_MONTHLY: Record<GoogleSku, number> = {
    /** the main roads route uses the traffic aware sku, the pro one */
    routes: 5000,
    tiles: 100000,
    places: 5000,
    geocode: 10000,
};

/** what each sku is for the rider, and what takes over when it is used up */
export const GOOGLE_SERVICES: Record<
    GoogleSku,
    { label: string; fallback: string; estimated: boolean }
> = {
    routes: {
        label: 'Routes',
        fallback: 'Valhalla answers the main roads route.',
        estimated: false,
    },
    tiles: {
        label: 'Map tiles',
        fallback: 'the map uses the OpenFreeMap style.',
        estimated: true,
    },
    places: {
        label: 'Place search',
        fallback: 'the search falls back to the geocoder.',
        estimated: false,
    },
    geocode: {
        label: 'Geocoding',
        fallback: 'the address search stops until the limit resets.',
        estimated: false,
    },
};

/** the app stops a little before the cap, so a retry cannot push it over */
export const GOOGLE_CAP_SHARE = 0.95;

const PACIFIC_MONTH = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
});

/** the month the google free usage is counted in */
export const googleMonthKey = (now: Date = new Date()): string => {
    try {
        return PACIFIC_MONTH.format(now);
    } catch {
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    }
};
