import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { logger } from '@utils/logger';

const DB_NAME = 'k-routes.db';
const DB_KEY_NAME = 'k_routes_db_key';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  origin_name TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  origin_lat REAL NOT NULL,
  origin_lon REAL NOT NULL,
  destination_lat REAL NOT NULL,
  destination_lon REAL NOT NULL,
  distance_meters REAL NOT NULL,
  duration_seconds REAL NOT NULL,
  geometry TEXT NOT NULL,
  avoid_points TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS avoid_points (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters REAL NOT NULL DEFAULT 30,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cameras (
  camera_id TEXT PRIMARY KEY NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters REAL NOT NULL DEFAULT 50,
  max_speed_kmh INTEGER,
  technology TEXT NOT NULL,
  road_type TEXT NOT NULL,
  address TEXT NOT NULL,
  municipality TEXT NOT NULL,
  department TEXT NOT NULL,
  operating_state TEXT NOT NULL,
  infractions TEXT NOT NULL,
  dataset_published_at INTEGER,
  snapshot_id TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cameras_position ON cameras (latitude, longitude);

CREATE TABLE IF NOT EXISTS camera_preferences (
  camera_id TEXT PRIMARY KEY NOT NULL,
  avoid_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS route_origins (
  id TEXT PRIMARY KEY NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS route_contexts (
  id TEXT PRIMARY KEY NOT NULL,
  destination_key TEXT NOT NULL,
  origin_anchor_id TEXT NOT NULL,
  origin_lat REAL NOT NULL,
  origin_lon REAL NOT NULL,
  destination_lat REAL NOT NULL,
  destination_lon REAL NOT NULL,
  router_seconds REAL NOT NULL,
  router_meters REAL NOT NULL,
  computed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS route_observations (
  id TEXT PRIMARY KEY NOT NULL,
  destination_key TEXT NOT NULL,
  origin_anchor_id TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  observed_seconds REAL NOT NULL,
  router_seconds REAL NOT NULL,
  observed_meters REAL NOT NULL,
  router_meters REAL NOT NULL,
  confidence REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_route_observations_key
  ON route_observations (destination_key, origin_anchor_id, observed_at);

CREATE TABLE IF NOT EXISTS geocode_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  query TEXT NOT NULL,
  provider TEXT NOT NULL,
  results TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_geocode_cache_expiry ON geocode_cache (expires_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

/**
 * The schema of the app has a version, so a table that changes shape can be
 * rebuilt on the phones that already have the old one.
 */
const SCHEMA_VERSION = 4;

const MIGRATIONS: { version: number; statements: string[] }[] = [
    {
        version: 4,
        statements: ['DROP TABLE IF EXISTS bikes;', 'DROP TABLE IF EXISTS rides;'],
    },
];

const countRows = async (db: SQLite.SQLiteDatabase, table: string): Promise<number> => {
    const row = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) AS total FROM ${table};`);
    return row?.total ?? 0;
};

const hexFromBytes = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

const getOrCreateKey = async (): Promise<string> => {
    const stored = await SecureStore.getItemAsync(DB_KEY_NAME);
    if (stored) {
        return stored;
    }
    const hex = hexFromBytes(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(DB_KEY_NAME, hex, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return hex;
};

let instance: SQLite.SQLiteDatabase | null = null;

export const openDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    if (instance) {
        return instance;
    }

    const key = await getOrCreateKey();
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    await db.execAsync(SCHEMA);

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const current = version?.user_version ?? 0;
    const routesBefore = current < SCHEMA_VERSION ? await countRows(db, 'routes') : null;

    if (current < SCHEMA_VERSION) {
        /**
         * The whole migration goes in one transaction, so a phone that is
         * closed in the middle of it keeps the table it had.
         */
        await db.withExclusiveTransactionAsync(async () => {
            for (const migration of MIGRATIONS) {
                if (current < migration.version) {
                    await db.execAsync(migration.statements.join('\n'));
                }
            }
            await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
        });
    }

    if (routesBefore !== null) {
        const routesAfter = await countRows(db, 'routes');
        logger.info('the database was migrated', {
            event: 'migrate',
            count: routesAfter,
            durationMs: routesBefore - routesAfter,
        });
        if (routesAfter < routesBefore) {
            logger.warn('the migration lost routes', {
                event: 'migrate',
                count: routesBefore - routesAfter,
            });
        }
    }

    const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version;');
    if (!cipher?.cipher_version) {
        throw new Error('database encryption is not active');
    }

    instance = db;
    logger.info('database opened', { event: 'open', count: 1 });
    return db;
};

export const getDatabase = (): SQLite.SQLiteDatabase => {
    if (!instance) {
        throw new Error('database is not open');
    }
    return instance;
};

export const newId = (): string => Crypto.randomUUID();
