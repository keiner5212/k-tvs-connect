import {
    APACHE_XOR_KEY,
    batteryNibble,
    buildMobileDataPacket,
    buildRiderNamePacket,
    buildTrafficSequencePacket,
    decryptFrame,
    sanitizeClusterText,
} from './protocol';

const decrypt = (bytes: Uint8Array) => decryptFrame(bytes, APACHE_XOR_KEY)!;

describe('rider name packet', () => {
    it('keeps latin characters and spaces', () => {
        expect(sanitizeClusterText('Juan Perez')).toBe('Juan Perez');
        expect(sanitizeClusterText('Ana-Maria 42')).toBe('AnaXMaria 42');
    });

    it('replaces anything else with an X', () => {
        expect(sanitizeClusterText('Ana María')).toBe('Ana MarXa');
        expect(sanitizeClusterText('Ana_María')).toBe('AnaXMarXa');
    });

    it('cuts at 17 characters', () => {
        expect(sanitizeClusterText('12345678901234567890')).toHaveLength(17);
    });

    it('builds the 5B 52 frame with the name and the end byte', () => {
        const packet = decrypt(buildRiderNamePacket('Juan Perez'));

        expect(packet).toHaveLength(20);
        expect(packet[0]).toBe(0x5b);
        expect(packet[1]).toBe(0x52);
        expect(String.fromCharCode(...packet.subarray(2, 12))).toBe('Juan Perez');
        expect(packet[19]).toBe(0xff);
    });
});

describe('mobile data packet', () => {
    const now = new Date(2026, 2, 14, 15, 30, 45);

    it('packs the signal and the battery into one byte', () => {
        const packet = decrypt(
            buildMobileDataPacket({
                batteryPercent: 85,
                signalStrength: 3,
                overspeedLimitKmh: null,
                networkType: 4,
                missedCalls: 0,
                callState: 0xff,
                voiceAssistEnabled: false,
                now,
            }),
        );

        expect(packet[0]).toBe(0x5b);
        expect(packet[1]).toBe(0x4a);
        expect(packet[2]).toBe((3 << 4) | 5);
    });

    it('carries the clock and the date', () => {
        const packet = decrypt(
            buildMobileDataPacket({
                batteryPercent: 50,
                signalStrength: 2,
                overspeedLimitKmh: 80,
                networkType: 4,
                missedCalls: 1,
                callState: 0xff,
                voiceAssistEnabled: false,
                now,
            }),
        );

        expect(packet[3]).toBe(80);
        expect(packet[6]).toBe(3);
        expect(packet[7]).toBe(30);
        expect(packet[8]).toBe(45);
        expect(packet[9]).toBe(1);
        expect(packet[10]).toBe(1);
        expect(packet[11]).toBe(4);
        expect(packet[12]).toBe(14);
        expect(packet[13]).toBe(3);
        expect(packet[14]).toBe(26);
        expect(packet[19]).toBe(0xff);
    });

    it('turns the overspeed limit off with 0xff', () => {
        const packet = decrypt(
            buildMobileDataPacket({
                batteryPercent: 50,
                signalStrength: 2,
                overspeedLimitKmh: null,
                networkType: 4,
                missedCalls: 0,
                callState: 0xff,
                voiceAssistEnabled: false,
                now,
            }),
        );

        expect(packet[3]).toBe(0xff);
    });

    it('maps the battery to the steps the original uses', () => {
        expect(batteryNibble(5)).toBe(0);
        expect(batteryNibble(15)).toBe(1);
        expect(batteryNibble(30)).toBe(2);
        expect(batteryNibble(50)).toBe(3);
        expect(batteryNibble(70)).toBe(4);
        expect(batteryNibble(90)).toBe(5);
    });
});

describe('traffic sequence packet', () => {
    it('builds the 5B 4C frame', () => {
        const packet = decrypt(buildTrafficSequencePacket());

        expect(packet).toHaveLength(20);
        expect(packet[0]).toBe(0x5b);
        expect(packet[1]).toBe(0x4c);
        expect(packet[2]).toBe(0x00);
        expect(packet[3]).toBe(0x00);
        expect(packet[19]).toBe(0xff);
    });
});
