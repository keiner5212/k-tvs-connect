/**
 * Wire format of the newer bikes, ported from the original app:
 * `com/tvs/bluetooth/core/utils/BluetoothUtil` and
 * `com/tvs/bike/core/protocol/DataParser`.
 */

export const APACHE_XOR_KEY = 0xea;
export const LEGACY_XOR_KEY = 0xeb;

const END_BYTE = 0xff;

/**
 * The frame that arrives over ble is [start, dataId, encrypted payload..., tail].
 * The payload is xored with a constant key and the tail is replaced by the end byte.
 */
export const decryptFrame = (bytes: Uint8Array, key = APACHE_XOR_KEY): Uint8Array | null => {
    if (bytes.length < 4) {
        return null;
    }

    const decrypted = new Uint8Array(bytes.length);
    decrypted[0] = bytes[0];
    decrypted[1] = bytes[1];

    for (let index = 2; index < bytes.length - 1; index += 1) {
        decrypted[index] = bytes[index] ^ key;
    }

    decrypted[bytes.length - 1] = END_BYTE;
    return decrypted;
};

export const encryptFrame = (bytes: Uint8Array, key = APACHE_XOR_KEY): Uint8Array => {
    const encrypted = new Uint8Array(bytes.length);
    encrypted[0] = bytes[0];
    encrypted[1] = bytes[1];

    for (let index = 2; index < bytes.length - 1; index += 1) {
        encrypted[index] = bytes[index] ^ key;
    }

    encrypted[bytes.length - 1] = bytes[bytes.length - 1];
    return encrypted;
};

const unsignedSum = (bytes: Uint8Array, length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
        sum += bytes[index];
    }
    return sum;
};

/**
 * The original sums every byte except the last two, and the checksum byte plus that
 * sum has to reach 255.
 */
export const isValidChecksum = (bytes: Uint8Array): boolean => {
    if (bytes.length < 3) {
        return false;
    }

    const checksum = bytes[bytes.length - 2];
    const sum = unsignedSum(bytes, bytes.length - 2) % 256;
    return (checksum + sum) % 256 === 255;
};

export const computeChecksum = (bytes: Uint8Array): number =>
    255 - (unsignedSum(bytes, bytes.length - 2) % 256);

/**
 * Builds the plain frame the cluster expects: the payload with the checksum in the
 * second to last slot and the end byte in the last one.
 */
export const addChecksum = (payload: Uint8Array): Uint8Array => {
    const frame = new Uint8Array(payload.length);
    frame.set(payload.subarray(0, payload.length - 2));
    frame[payload.length - 2] = computeChecksum(payload);
    frame[payload.length - 1] = END_BYTE;
    return frame;
};

/**
 * The full outbound packet: checksum first, then the same xor envelope the
 * cluster uses for its own frames.
 */
export const buildPacket = (payload: Uint8Array, key = APACHE_XOR_KEY): Uint8Array =>
    encryptFrame(addChecksum(payload), key);
