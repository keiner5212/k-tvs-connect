import { BikeTelemetry } from '@typings/types';
import { START_BYTE_5A, START_BYTE_9B } from './constants';
import { frameForDataId } from './frames';
import { decryptFrame, isValidChecksum } from './protocol';

export interface ParsedFrame {
    dataId: number;
    values: Record<string, number>;
    checksumValid: boolean;
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

export const parseFrame = (raw: Uint8Array, key?: number): ParsedFrame | null => {
    if (raw.length < 4) {
        return null;
    }

    const bytes = decryptFrame(raw, key);
    if (!bytes) {
        return null;
    }

    if (bytes[0] !== START_BYTE_5A && bytes[0] !== START_BYTE_9B) {
        return null;
    }

    const dataId = bytes[1];
    const spec = frameForDataId(dataId);
    if (!spec) {
        return null;
    }

    const values: Record<string, number> = {};
    for (const field of spec.fields) {
        const value = readField(bytes, field.start, field.length);
        values[field.name] = field.scale ? value / field.scale : value;
    }

    return { dataId, values, checksumValid: isValidChecksum(bytes) };
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
    const turnSignalStatus = values.turnIndicatorStatus ?? previous?.turnSignalStatus ?? 0;

    const turnSignal =
        turnSignalStatus & LEFT_SIGNAL_BIT
            ? 'left'
            : turnSignalStatus & RIGHT_SIGNAL_BIT
                ? 'right'
                : switchStatus & LEFT_SIGNAL_BIT
                    ? 'left'
                    : switchStatus & RIGHT_SIGNAL_BIT
                        ? 'right'
                        : 'none';

    return {
        speedKmh: values.speed ?? previous?.speedKmh ?? null,
        engineRpm: values.engineRpm ?? previous?.engineRpm ?? null,
        fuelLevelPercent: values.fuelLevel ?? previous?.fuelLevelPercent ?? null,
        batteryVoltage: values.batteryVoltage ?? previous?.batteryVoltage ?? null,
        odometerKm: values.odometer ?? previous?.odometerKm ?? null,
        tripDistanceKm: values.tripDistance ?? previous?.tripDistanceKm ?? null,
        tripTimeSeconds:
            values.tripTimeHour !== undefined
                ? values.tripTimeHour * 3600 + (values.tripTimeMinute ?? 0) * 60
                : (previous?.tripTimeSeconds ?? null),
        averageSpeedKmh: values.averageSpeed ?? previous?.averageSpeedKmh ?? null,
        topSpeedKmh: values.topSpeed ?? previous?.topSpeedKmh ?? null,
        throttlePercent: values.throttle ?? previous?.throttlePercent ?? null,
        leanAngleDegree: values.leanAngle ?? previous?.leanAngleDegree ?? null,
        gearPosition: values.gearPosition ?? previous?.gearPosition ?? null,
        sideStandDown: (switchStatus & SIDE_STAND_BIT) !== 0,
        turnSignal,
        turnSignalStatus,
        vehicleState: values.vehicleState1 ?? previous?.vehicleState ?? 0,
        switchStatus,
        tripMileage: values.tripMileage ?? previous?.tripMileage ?? null,
        tripFuel: values.tripFuel ?? previous?.tripFuel ?? null,
        overspeedThreshold: values.overspeedThreshold ?? previous?.overspeedThreshold ?? 0,
        engineTemperature: values.engineTemperature ?? previous?.engineTemperature ?? null,
        intakeAirTemperature: values.intakeAirTemperature ?? previous?.intakeAirTemperature ?? null,
        cruisingRange: values.cruisingRange ?? previous?.cruisingRange ?? null,
        lapNumber: values.lapNumber ?? previous?.lapNumber ?? null,
        lapTimeMs:
            values.lapTimeMinute !== undefined
                ? values.lapTimeMinute * 60000 +
                values.lapTimeSecond * 1000 +
                values.lapTimeMilliSecond
                : (previous?.lapTimeMs ?? null),
        bestLapNumber: values.bestLapNumber ?? previous?.bestLapNumber ?? null,
        bestLapMs:
            values.bestLapMinute !== undefined
                ? values.bestLapMinute * 60000 +
                values.bestLapSecond * 1000 +
                values.bestLapMilliSecond
                : (previous?.bestLapMs ?? null),
        latitude: previous?.latitude ?? null,
        longitude: previous?.longitude ?? null,
        receivedAt: Date.now(),
    };
};
