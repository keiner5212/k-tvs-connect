import * as SecureStore from 'expo-secure-store';

import {
    GOOGLE_TILES_API_KEY,
    GOOGLE_TILES_ATTRIBUTION,
    GOOGLE_TILES_SESSION_ENDPOINT,
    GOOGLE_TILES_URL,
    MAX_TILE_SESSIONS_PER_DAY,
    TILE_SESSION_RENEW_MS,
} from '@config/tiles';
import { getSetting, setSetting } from './db/settingsRepository';
import { httpPostJson } from './http.service';
import { logger } from '@utils/logger';

const SESSION_ITEM = 'k_tvs_connect_tiles_session';

export interface TileSession {
    session: string;
    expiry: number;
}

interface SessionResponse {
    session?: string;
    expiry?: number;
    tileWidth?: number;
    tileHeight?: number;
}

const readStoredSession = async (): Promise<TileSession | null> => {
    const stored = await SecureStore.getItemAsync(SESSION_ITEM);
    if (!stored) {
        return null;
    }
    try {
        const parsed = JSON.parse(stored) as TileSession;
        if (typeof parsed.session !== 'string' || typeof parsed.expiry !== 'number') {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

const storeSession = async (session: TileSession): Promise<void> => {
    await SecureStore.setItemAsync(SESSION_ITEM, JSON.stringify(session), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
};

const clearStoredSession = async (): Promise<void> => {
    await SecureStore.deleteItemAsync(SESSION_ITEM);
};

const today = (): string => new Date().toISOString().slice(0, 10);

const sessionsToday = async (): Promise<number> => {
    const day = await getSetting('tilesSessionDay');
    if (day !== today()) {
        return 0;
    }
    const count = await getSetting('tilesSessionCount');
    return count ? Number(count) : 0;
};

const requestSession = async (): Promise<TileSession> => {
    const { body } = await httpPostJson<SessionResponse>(
        GOOGLE_TILES_SESSION_ENDPOINT,
        { mapType: 'roadmap', language: 'es-ES', region: 'CO' },
        {
            service: 'google_tiles',
            headers: { 'X-Goog-Api-Key': GOOGLE_TILES_API_KEY },
            maxBytes: 256 * 1024,
        },
    );

    if (!body.session || !body.expiry) {
        throw new Error('the session answer had no token');
    }

    return { session: body.session, expiry: body.expiry * 1000 };
};

const loadSession = async (): Promise<TileSession | null> => {
    const stored = await readStoredSession();
    if (stored && stored.expiry - TILE_SESSION_RENEW_MS > Date.now()) {
        return stored;
    }

    const used = await sessionsToday();
    if (used >= MAX_TILE_SESSIONS_PER_DAY) {
        logger.warn('the tiles session limit is reached', { service: 'google_tiles', count: used });
        return null;
    }

    try {
        const session = await requestSession();
        await storeSession(session);
        await setSetting('tilesSessionDay', today());
        await setSetting('tilesSessionCount', String(used + 1));
        return session;
    } catch (error) {
        logger.warn('the tiles session failed', {
            service: 'google_tiles',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        await clearStoredSession();
        return null;
    }
};

let inFlight: Promise<TileSession | null> | null = null;

export const getTileSession = async (): Promise<TileSession | null> => {
    if (!GOOGLE_TILES_API_KEY) {
        return null;
    }
    if (!inFlight) {
        inFlight = loadSession().finally(() => {
            inFlight = null;
        });
    }
    return inFlight;
};

/**
 * The style maplibre renders. It is built in memory so the key and the token
 * never reach the settings table or the exported data.
 */
export const buildGoogleStyle = (session: TileSession): Record<string, unknown> => ({
    version: 8,
    sources: {
        google: {
            type: 'raster',
            tiles: [
                `${GOOGLE_TILES_URL}?session=${session.session}&key=${GOOGLE_TILES_API_KEY}`,
            ],
            tileSize: 256,
            attribution: GOOGLE_TILES_ATTRIBUTION,
            maxzoom: 22,
        },
    },
    layers: [{ id: 'google', type: 'raster', source: 'google' }],
});
