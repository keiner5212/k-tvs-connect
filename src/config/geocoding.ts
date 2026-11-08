/**
 * The google key lives in the gitignored .env.local as
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, so it never reaches the repository.
 *
 * On the google side the key is restricted to the package name below, to the
 * certificate below and to the apis it may call. Google only accepts a
 * request that carries both headers, which is why every call sends them.
 *
 * The places api (new) is the one that finds a place by category, the
 * gas stations around here for example. The geocoding api is the one that
 * finds a street address. Both have to be allowed in the key restriction or
 * the search only answers for addresses.
 */
export const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export const ANDROID_PACKAGE_NAME = 'com.ktvsconnect.app';

/** sha1 of the certificate that signs the apk, in the form google expects it */
export const ANDROID_CERT_SHA1 = '5e8f16062ea3cd2c4a0d547876baa6f38cabf625';

export const GOOGLE_PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
export const GOOGLE_GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

export const GEOCODE_COUNTRY = 'CO';
export const GEOCODE_LANGUAGE = 'es';

/** a search is repeated for a day before it goes out again */
export const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The version of the cache key. It changes when the answer changes, so the
 * answers written by an older build are not read again.
 */
export const GEOCODE_CACHE_VERSION = 'v2';

/** the position bias is rounded to this cell, so the cache key says what was asked */
export const GEOCODE_BIAS_CELL_DEGREES = 0.05;

/** the app stops asking google after this many requests in one day */
export const MAX_GOOGLE_REQUESTS_PER_DAY = 100;

/** a shorter text is a prefix of a longer one and google charges for every prefix */
export const MIN_QUERY_LENGTH = 5;
