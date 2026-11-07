import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const SALT_KEY = 'k_tvs_connect_pin_salt';
const VERIFIER_KEY = 'k_tvs_connect_pin_verifier';
const LOCKOUT_KEY = 'k_tvs_connect_pin_lockout';

const ITERATIONS = 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60000;

const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

const derive = async (salt: string, pin: string): Promise<string> => {
    let value = `${salt}:${pin}`;
    for (let index = 0; index < ITERATIONS; index += 1) {
        value = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
    }
    return value;
};

const constantTimeEquals = (a: string, b: string): boolean => {
    if (a.length !== b.length) {
        return false;
    }
    let difference = 0;
    for (let index = 0; index < a.length; index += 1) {
        difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return difference === 0;
};

export const isPinConfigured = async (): Promise<boolean> =>
    (await SecureStore.getItemAsync(VERIFIER_KEY)) !== null;

export const setPin = async (pin: string): Promise<void> => {
    const salt = toHex(Crypto.getRandomBytes(16));
    const verifier = await derive(salt, pin);

    await SecureStore.setItemAsync(SALT_KEY, salt, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(VERIFIER_KEY, verifier, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.deleteItemAsync(LOCKOUT_KEY);
};

export const removePin = async (): Promise<void> => {
    await SecureStore.deleteItemAsync(SALT_KEY);
    await SecureStore.deleteItemAsync(VERIFIER_KEY);
    await SecureStore.deleteItemAsync(LOCKOUT_KEY);
};

export const lockoutRemainingMs = async (): Promise<number> => {
    const raw = await SecureStore.getItemAsync(LOCKOUT_KEY);
    if (!raw) {
        return 0;
    }
    const until = Number(raw);
    return Math.max(0, until - Date.now());
};

export const verifyPin = async (pin: string): Promise<boolean> => {
    const salt = await SecureStore.getItemAsync(SALT_KEY);
    const verifier = await SecureStore.getItemAsync(VERIFIER_KEY);
    if (!salt || !verifier) {
        return false;
    }

    const remaining = await lockoutRemainingMs();
    if (remaining > 0) {
        return false;
    }

    const candidate = await derive(salt, pin);
    if (constantTimeEquals(candidate, verifier)) {
        await SecureStore.deleteItemAsync(LOCKOUT_KEY);
        return true;
    }

    const attempts = Number((await SecureStore.getItemAsync(`${LOCKOUT_KEY}_attempts`)) ?? '0') + 1;
    await SecureStore.setItemAsync(`${LOCKOUT_KEY}_attempts`, String(attempts));

    if (attempts >= MAX_ATTEMPTS) {
        await SecureStore.setItemAsync(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
        await SecureStore.deleteItemAsync(`${LOCKOUT_KEY}_attempts`);
    }

    return false;
};
