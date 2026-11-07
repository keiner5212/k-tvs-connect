import { parseFrame, telemetryFromFrame } from './parser';

const buildFrame = (fields: { offset: number; value: number; length?: number }[]): Uint8Array => {
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

    return bytes;
};

describe('parseFrame', () => {
    it('reads the speedometer frame with the original offsets', () => {
        const bytes = buildFrame([
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
            { offset: 19, value: 99 },
        ]);

        const frame = parseFrame(bytes);

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
        expect(frame?.values.checksum).toBe(99);
    });

    it('rejects a frame with a wrong start byte', () => {
        const bytes = buildFrame([{ offset: 3, value: 10 }]);
        bytes[0] = 0x11;
        expect(parseFrame(bytes)).toBeNull();
    });

    it('rejects a frame with an unknown data id', () => {
        const bytes = buildFrame([{ offset: 3, value: 10 }]);
        bytes[1] = 200;
        expect(parseFrame(bytes)).toBeNull();
    });

    it('accepts the second start byte of the original parser', () => {
        const bytes = buildFrame([{ offset: 3, value: 10 }]);
        bytes[0] = 0x9b;
        expect(parseFrame(bytes)).not.toBeNull();
    });

    it('maps the switch status to the side stand and the turn signal', () => {
        const bytes = buildFrame([
            { offset: 3, value: 20 },
            { offset: 12, value: 0x01 },
        ]);
        const frame = parseFrame(bytes);
        const telemetry = telemetryFromFrame(frame!, null);

        expect(telemetry.speedKmh).toBe(20);
        expect(telemetry.sideStandDown).toBe(true);
        expect(telemetry.turnSignal).toBe('none');
    });

    it('reads the trip block of the third frame', () => {
        const bytes = new Uint8Array(20);
        bytes[0] = 0x5a;
        bytes[1] = 18;
        bytes[8] = 0x00;
        bytes[9] = 0x0a;
        bytes[10] = 0x01;

        const frame = parseFrame(bytes);

        expect(frame?.values.tripTimeHour).toBe(1);
        expect(frame?.values.tripDistance).toBe(10);
    });
});
