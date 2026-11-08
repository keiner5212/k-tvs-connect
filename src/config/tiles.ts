/**
 * The google map tiles key lives in the gitignored .env.local as
 * EXPO_PUBLIC_GOOGLE_TILES_API_KEY, so it never reaches the repository.
 *
 * The key has no application restriction on purpose. The tiles are fetched by
 * the maplibre native loader, outside javascript, and that loader cannot send
 * the headers an android restriction needs. The key is limited to the map
 * tiles api and the daily quota in the google console keeps it under the free
 * cap.
 */
export const GOOGLE_TILES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_TILES_API_KEY ?? '';

export const GOOGLE_TILES_SESSION_ENDPOINT = 'https://tile.googleapis.com/v1/createSession';

export const GOOGLE_TILES_URL = 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}';

export const GOOGLE_TILES_ATTRIBUTION = 'Map data: Google, Maxar Technologies';

/** the session is renewed a day before it expires */
export const TILE_SESSION_RENEW_MS = 24 * 60 * 60 * 1000;

/** the session requests are capped per day, they do not count as tiles */
export const MAX_TILE_SESSIONS_PER_DAY = 5;
