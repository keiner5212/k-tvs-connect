import { Place } from '@typings/types';
import { getDatabase } from './database';

interface GeocodeCacheRow {
    cache_key: string;
    results: string;
    expires_at: number;
}

/**
 * The cached answer of a search. Only the fields the app uses are kept, and
 * for a day, which is inside the thirty days google allows for coordinates.
 */
export const readCachedPlaces = async (cacheKey: string, now: number): Promise<Place[] | null> => {
    const db = getDatabase();
    await db.runAsync('DELETE FROM geocode_cache WHERE expires_at <= ?', now);
    const row = await db.getFirstAsync<GeocodeCacheRow>(
        'SELECT cache_key, results, expires_at FROM geocode_cache WHERE cache_key = ?',
        cacheKey,
    );
    if (!row || row.expires_at <= now) {
        return null;
    }

    try {
        return JSON.parse(row.results) as Place[];
    } catch {
        return null;
    }
};

export const writeCachedPlaces = async (
    cacheKey: string,
    query: string,
    provider: string,
    places: Place[],
    now: number,
    ttlMs: number,
): Promise<void> => {
    const db = getDatabase();
    await db.runAsync(
        `INSERT INTO geocode_cache (cache_key, query, provider, results, fetched_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       query = excluded.query,
       provider = excluded.provider,
       results = excluded.results,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at`,
        cacheKey,
        query,
        provider,
        JSON.stringify(places),
        now,
        now + ttlMs,
    );
};

export const pruneExpiredPlaces = async (now: number): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('DELETE FROM geocode_cache WHERE expires_at <= ?', now);
};
