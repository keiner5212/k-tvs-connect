import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { logger } from '@utils/logger';

const DB_NAME = 'k-tvs-connect.db';
const DB_KEY_NAME = 'k_tvs_connect_db_key';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bikes (
  id TEXT PRIMARY KEY NOT NULL,
  nickname TEXT NOT NULL,
  model TEXT NOT NULL,
  frame_number TEXT NOT NULL,
  mac_address TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY NOT NULL,
  bike_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  distance_meters REAL NOT NULL DEFAULT 0,
  max_speed_kmh REAL NOT NULL DEFAULT 0,
  average_speed_kmh REAL NOT NULL DEFAULT 0,
  duration_seconds REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

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
