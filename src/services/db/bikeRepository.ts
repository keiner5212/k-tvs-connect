import { Bike, BikeInput } from '@typings/types';
import { getDatabase, newId } from './database';

interface BikeRow {
    id: string;
    nickname: string;
    model: string;
    frame_number: string;
    mac_address: string;
    is_active: number;
    created_at: number;
    updated_at: number;
}

const toBike = (row: BikeRow): Bike => ({
    id: row.id,
    nickname: row.nickname,
    model: row.model as Bike['model'],
    frameNumber: row.frame_number,
    macAddress: row.mac_address,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const normalizeMac = (value: string): string =>
    value
        .trim()
        .toUpperCase()
        .replace(/[^0-9A-F]/g, '')
        .match(/.{1,2}/g)
        ?.join(':') ?? '';

export const isValidMac = (value: string): boolean => /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(value);

export const listBikes = async (): Promise<Bike[]> => {
    const db = getDatabase();
    const rows = await db.getAllAsync<BikeRow>(
        'SELECT * FROM bikes ORDER BY is_active DESC, created_at ASC',
    );
    return rows.map(toBike);
};

export const getBike = async (id: string): Promise<Bike | null> => {
    const db = getDatabase();
    const row = await db.getFirstAsync<BikeRow>('SELECT * FROM bikes WHERE id = ?', id);
    return row ? toBike(row) : null;
};

export const findBikeByMac = async (macAddress: string): Promise<Bike | null> => {
    const db = getDatabase();
    const row = await db.getFirstAsync<BikeRow>(
        'SELECT * FROM bikes WHERE mac_address = ?',
        macAddress,
    );
    return row ? toBike(row) : null;
};

export const insertBike = async (input: BikeInput): Promise<Bike> => {
    const db = getDatabase();
    const now = Date.now();
    const bike: Bike = {
        id: newId(),
        nickname: input.nickname.trim(),
        model: input.model,
        frameNumber: input.frameNumber.trim(),
        macAddress: normalizeMac(input.macAddress),
        isActive: false,
        createdAt: now,
        updatedAt: now,
    };

    await db.runAsync(
        `INSERT INTO bikes (id, nickname, model, frame_number, mac_address, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        bike.id,
        bike.nickname,
        bike.model,
        bike.frameNumber,
        bike.macAddress,
        bike.createdAt,
        bike.updatedAt,
    );

    return bike;
};

export const updateBike = async (id: string, input: BikeInput): Promise<void> => {
    const db = getDatabase();
    await db.runAsync(
        `UPDATE bikes SET nickname = ?, model = ?, frame_number = ?, mac_address = ?, updated_at = ?
     WHERE id = ?`,
        input.nickname.trim(),
        input.model,
        input.frameNumber.trim(),
        normalizeMac(input.macAddress),
        Date.now(),
        id,
    );
};

export const deleteBike = async (id: string): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('DELETE FROM bikes WHERE id = ?', id);
    await db.runAsync('DELETE FROM rides WHERE bike_id = ?', id);
};

export const setActiveBike = async (id: string): Promise<void> => {
    const db = getDatabase();
    await db.runAsync('UPDATE bikes SET is_active = 0');
    await db.runAsync('UPDATE bikes SET is_active = 1, updated_at = ? WHERE id = ?', Date.now(), id);
};
