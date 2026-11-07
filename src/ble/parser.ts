import { BikeTelemetry } from '@typings/types';
import { START_BYTE_5A, START_BYTE_5B } from './constants';
import { frameForDataId } from './frames';

export interface ParsedFrame {
    dataId: number;
    values: Record<string, number>;
}

const readField = (bytes: Uint8Array, start: number, length: number): number => {
    let hex = '';
    for (let index = 0; index < length; index += 1) {
        hex += bytes[start - 1 + index].toString(16).padStart(2, '0').toUpperCase();
    }
    if (hex.length === 0) {
        return 0;
    }
    const parsed = parseInt(hex, 16);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const parseFrame = (bytes: Uint8Array): ParsedFrame | null => {
    if (bytes.length < 4) {
        return null;
    }
    if (bytes[0] !== START_BYTE_5A && bytes[0] !== START_BYTE_5B) {
        return null;
    }

    const dataId = bytes[1];
    const spec = frameForDataId(dataId);
    if (!spec) {
        return null;
    }

    const values: Record<string, number> = {};
    for (const field of spec.fields) {
        const raw = readField(bytes, field.start, field.length);
        values[field.name] = field.scale ? raw * field.scale : raw;
    }

    return { dataId, values };
};

const SIDE_STAND_BIT = 0x01;
const LEFT_SIGNAL_BIT = 0x02;
const RIGHT_SIGNAL_BIT = 0x04;

export const telemetryFromFrame = (
    frame: ParsedFrame,
    previous: BikeTelemetry | null,
): BikeTelemetry => {
    const values = frame.values;
    const switchStatus = values.switchStatus ?? previous?.switchStatus ?? 0;

    const turnSignal =
        switchStatus & LEFT_SIGNAL_BIT
            ? 'left'
            : switchStatus & RIGHT_SIGNAL_BIT
                ? 'right'
                : 'none';

    return {
        speedKmh: values.speed ?? previous?.speedKmh ?? 0,
        engineRpm: values.engineRpm ?? previous?.engineRpm ?? 0,
        fuelLevelPercent: values.fuelLevel ?? previous?.fuelLevelPercent ?? 0,
        batteryVoltage: previous?.batteryVoltage ?? 0,
        odometerKm: values.odometerRaw ?? previous?.odometerKm ?? 0,
        tripDistanceKm: previous?.tripDistanceKm ?? 0,
        tripTimeSeconds: previous?.tripTimeSeconds ?? 0,
        averageSpeedKmh: values.averageSpeed ?? previous?.averageSpeedKmh ?? 0,
        topSpeedKmh: values.topSpeed ?? previous?.topSpeedKmh ?? 0,
        throttlePercent: values.throttle ?? previous?.throttlePercent ?? 0,
        leanAngleDegree: previous?.leanAngleDegree ?? 0,
        gearPosition: previous?.gearPosition ?? 0,
        sideStandDown: (switchStatus & SIDE_STAND_BIT) !== 0,
        turnSignal,
        vehicleState: previous?.vehicleState ?? 0,
        switchStatus,
        latitude: previous?.latitude ?? null,
        longitude: previous?.longitude ?? null,
        frameNumber: previous?.frameNumber ?? null,
        receivedAt: Date.now(),
    };
};
