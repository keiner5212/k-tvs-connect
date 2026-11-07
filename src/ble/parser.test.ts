import { parseFrame, telemetryFromFrame } from './parser';
import {
  addChecksum,
  buildPacket,
  computeChecksum,
  decryptFrame,
  encryptFrame,
  isValidChecksum,
} from './protocol';

const buildPlainFrame = (fields: { offset: number; value: number; length?: number }[]): Uint8Array => {
    const bytes = new Uint8Array(20);
    bytes[0] = 0x5a;
    bytes[1] = 16;
    bytes[19] = 0xff;

    for (const field of fields) {
        const length = field.length ?? 1;
        const hex = field.value.toString(16).toUpperCase().padStart(length * 2, '0');
        for (let index = 0; index < length; index += 1) {
            bytes[field.offset - 1 + index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
        }
    }

    bytes[18] = computeChecksum(bytes);
    return bytes;
};

describe('protocol', () => {
    it('xors the payload with 0xea and keeps the start byte and the data id', () => {
        const plain = new Uint8Array([0x5a, 16, 0x01, 0x02, 0x03, 0x04]);
        const encrypted = encryptFrame(plain);

        expect(encrypted[0]).toBe(0x5a);
        expect(encrypted[1]).toBe(16);
        expect(encrypted[2]).toBe(0x01 ^ 0xea);
        expect(encrypted[3]).toBe(0x02 ^ 0xea);
        expect(encrypted[4]).toBe(0x03 ^ 0xea);
    });

    it('round trips through the decryption', () => {
        const plain = new Uint8Array(20);
        plain[0] = 0x5a;
        plain[1] = 18;
        plain[2] = 42;
        plain[18] = computeChecksum(plain);
        plain[19] = 0xff;

        const decrypted = decryptFrame(encryptFrame(plain));

        expect(decrypted).not.toBeNull();
        expect(Array.from(decrypted!)).toEqual(Array.from(plain));
    });

    it('replaces the tail byte with the end byte', () => {
        const plain = new Uint8Array(20);
        plain[0] = 0x5a;
        plain[1] = 16;
        plain[19] = 0x11;

        const decrypted = decryptFrame(encryptFrame(plain));

        expect(decrypted![19]).toBe(0xff);
    });

    it('puts the checksum in the second to last slot and the end byte in the last', () => {
    const payload = new Uint8Array(20);
    payload[0] = 0x5a;
    payload[1] = 16;
    payload[2] = 9;

    const framed = addChecksum(payload);

    expect(framed[18]).toBe(computeChecksum(payload));
    expect(framed[19]).toBe(0xff);
    expect(isValidChecksum(framed)).toBe(true);
  });

  it('builds an outbound packet the cluster can read back', () => {
    const payload = new Uint8Array(20);
    payload[0] = 0x5a;
    payload[1] = 16;
    payload[2] = 9;

    const packet = buildPacket(payload);
    const readBack = decryptFrame(packet);

    expect(readBack![0]).toBe(0x5a);
    expect(readBack![1]).toBe(16);
    expect(readBack![2]).toBe(9);
    expect(isValidChecksum(readBack!)).toBe(true);
  });

  it('validates the checksum the way the original does', () => {
        const plain = new Uint8Array(20);
        plain[0] = 0x5a;
        plain[1] = 16;
        plain[2] = 10;
        plain[18] = computeChecksum(plain);

        expect(isValidChecksum(plain)).toBe(true);

        plain[2] = 11;
        expect(isValidChecksum(plain)).toBe(false);
    });
});

describe('parseFrame', () => {
    it('reads the speedometer frame with the original offsets', () => {
        const plain = buildPlainFrame([
            { offset: 3, value: 42 },
            { offset: 4, value: 123456, length: 3 },
            { offset: 7, value: 65 },
            { offset: 8, value: 31 },
            { offset: 9, value: 45 },
            { offset: 10, value: 88 },
            { offset: 11, value: 12 },
            { offset: 12, value: 0 },
            { offset: 13, value: 6 },
            { offset: 14, value: 38 },
            { offset: 15, value: 1234, length: 2 },
            { offset: 17, value: 7500, length: 2 },
        ]);

        const frame = parseFrame(encryptFrame(plain));

        expect(frame).not.toBeNull();
        expect(frame?.dataId).toBe(16);
        expect(frame?.values.speed).toBe(42);
        expect(frame?.values.odometer).toBe(12345.6);
        expect(frame?.values.fuelLevel).toBe(65);
        expect(frame?.values.averageSpeed).toBe(31);
        expect(frame?.values.topSpeed).toBe(88);
        expect(frame?.values.throttle).toBe(12);
        expect(frame?.values.timeTo60Kmph).toBe(6);
        expect(frame?.values.engineRpm).toBe(7500);
        expect(frame?.checksumValid).toBe(true);
    });

    it('does not read the same values from an unencrypted frame', () => {
        const plain = buildPlainFrame([{ offset: 3, value: 42 }]);

        const encrypted = parseFrame(encryptFrame(plain));
        const unencrypted = parseFrame(plain);

        expect(encrypted?.values.speed).toBe(42);
        expect(unencrypted?.values.speed).not.toBe(42);
    });

    it('rejects a frame with a wrong start byte', () => {
        const bytes = buildPlainFrame([{ offset: 3, value: 10 }]);
        bytes[0] = 0x11;
        expect(parseFrame(encryptFrame(bytes))).toBeNull();
    });

    it('rejects a frame with an unknown data id', () => {
        const bytes = buildPlainFrame([{ offset: 3, value: 10 }]);
        bytes[1] = 200;
        expect(parseFrame(encryptFrame(bytes))).toBeNull();
    });

    it('accepts the second start byte of the original parser', () => {
        const bytes = buildPlainFrame([{ offset: 3, value: 10 }]);
        bytes[0] = 0x9b;
        expect(parseFrame(encryptFrame(bytes))).not.toBeNull();
    });

    it('maps the switch status to the side stand and the turn signal', () => {
        const plain = buildPlainFrame([
            { offset: 3, value: 20 },
            { offset: 12, value: 0x01 },
        ]);
        const frame = parseFrame(encryptFrame(plain));
        const telemetry = telemetryFromFrame(frame!, null);

        expect(telemetry.speedKmh).toBe(20);
        expect(telemetry.sideStandDown).toBe(true);
        expect(telemetry.turnSignal).toBe('none');
    });

    it('reads the trip block of the third frame', () => {
        const plain = new Uint8Array(20);
        plain[0] = 0x5a;
        plain[1] = 18;
        plain[8] = 0x00;
        plain[9] = 0x0a;
        plain[10] = 0x01;
        plain[18] = computeChecksum(plain);

        const frame = parseFrame(encryptFrame(plain));

        expect(frame?.values.tripTimeHour).toBe(1);
        expect(frame?.values.tripDistance).toBe(10);
    });
});
