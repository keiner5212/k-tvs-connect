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

const OUTBOUND_FRAME_LENGTH = 20;

/**
 * The cluster routes with its own map engine, so the phone only sends the
 * destination address as text, not the geometry. Header 0x5B 0x5C.
 */
export const buildLocationAddressPacket = (address: string, key = APACHE_XOR_KEY): Uint8Array => {
    const frame = new Uint8Array(OUTBOUND_FRAME_LENGTH);
    frame[0] = 0x5b;
    frame[1] = 0x5c;

    const text = address.slice(0, 17);
    const bytes = utf8Encode(text);
    frame.set(bytes.subarray(0, 17), 2);
    frame[OUTBOUND_FRAME_LENGTH - 1] = END_BYTE;

    return encryptFrame(frame, key);
};

export const TRAFFIC_SEQUENCE = {
    Default: 0,
    Cricket: 121,
    Football: 0x80,
} as const;

/**
 * Tells the cluster which kind of content it is showing. Header 0x5B 0x4C.
 */
export const buildTrafficSequencePacket = (
    sequence: number = TRAFFIC_SEQUENCE.Default,
    key = APACHE_XOR_KEY,
): Uint8Array => {
    const frame = new Uint8Array(OUTBOUND_FRAME_LENGTH);
    frame[0] = 0x5b;
    frame[1] = 0x4c;
    frame[2] = 0x00;
    frame[3] = sequence & 0xff;
    frame[OUTBOUND_FRAME_LENGTH - 1] = END_BYTE;

    return encryptFrame(frame, key);
};

const utf8Encode = (value: string): Uint8Array => {
    const bytes: number[] = [];
    for (const char of value) {
        const code = char.codePointAt(0) ?? 0;
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (code < 0x10000) {
            bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        } else {
            bytes.push(
                0xf0 | (code >> 18),
                0x80 | ((code >> 12) & 0x3f),
                0x80 | ((code >> 6) & 0x3f),
                0x80 | (code & 0x3f),
            );
        }
    }
    return new Uint8Array(bytes);
};

const SYMBOL_PATTERN = /[\p{So}\p{Cn}\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u200D]/gu;

/**
 * The cluster only renders latin characters, so everything else becomes an X,
 * the way the original app does it.
 */
export const sanitizeClusterText = (value: string): string => {
    const withoutSymbols = value.replace(SYMBOL_PATTERN, '@');
    let filtered = '';
    for (const char of withoutSymbols) {
        const isLetter = (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z');
        const isDigit = char >= '0' && char <= '9';
        filtered += isLetter || isDigit || char === ' ' ? char : 'X';
    }
    return filtered.trim().slice(0, 17);
};

/**
 * The name the cluster shows. Header 0x5B 0x52.
 */
export const buildRiderNamePacket = (name: string, key = APACHE_XOR_KEY): Uint8Array => {
    const frame = new Uint8Array(OUTBOUND_FRAME_LENGTH);
    frame[0] = 0x5b;
    frame[1] = 0x52;

    const bytes = utf8Encode(sanitizeClusterText(name));
    frame.set(bytes.subarray(0, 17), 2);
    frame[OUTBOUND_FRAME_LENGTH - 1] = END_BYTE;

    return encryptFrame(frame, key);
};

export interface MobileDataOptions {
    batteryPercent: number;
    signalStrength: number;
    overspeedLimitKmh: number | null;
    networkType: number;
    missedCalls: number;
    callState: number;
    voiceAssistEnabled: boolean;
    now: Date;
}

/**
 * The battery is a nibble with the steps the original uses.
 */
export const batteryNibble = (percent: number): number => {
    if (percent < 10) return 0;
    if (percent < 20) return 1;
    if (percent < 40) return 2;
    if (percent < 60) return 3;
    if (percent < 80) return 4;
    return 5;
};

/**
 * The packet the original app refreshes every two seconds while connected. It
 * carries the clock, the phone battery, the signal, the overspeed limit and the
 * call state. Header 0x5B 0x4A.
 */
export const buildMobileDataPacket = (
    options: MobileDataOptions,
    key = APACHE_XOR_KEY,
): Uint8Array => {
    const frame = new Uint8Array(OUTBOUND_FRAME_LENGTH);
    const now = options.now;

    const signal = Math.max(0, Math.min(15, Math.round(options.signalStrength)));
    const battery = batteryNibble(options.batteryPercent);

    frame[0] = 0x5b;
    frame[1] = 0x4a;
    frame[2] = (signal << 4) | battery;
    frame[3] = options.overspeedLimitKmh === null ? 0xff : options.overspeedLimitKmh & 0xff;
    frame[4] = 0x00;
    frame[5] = 0x00;
    frame[6] = now.getHours() % 12;
    frame[7] = now.getMinutes();
    frame[8] = now.getSeconds();
    frame[9] = now.getHours() < 12 ? 0 : 1;
    frame[10] = Math.max(0, Math.min(255, options.missedCalls));
    frame[11] = options.networkType & 0xff;
    frame[12] = now.getDate();
    frame[13] = now.getMonth() + 1;
    frame[14] = now.getFullYear() % 100;
    frame[15] = options.callState & 0xff;
    frame[16] = options.voiceAssistEnabled ? 0x01 : 0x00;
    frame[17] = 0x00;
    frame[18] = 0x00;
    frame[OUTBOUND_FRAME_LENGTH - 1] = END_BYTE;

    return encryptFrame(frame, key);
};
