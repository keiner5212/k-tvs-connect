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

export const parseFrame = (raw: Uint8Array): ParsedFrame | null => {
    if (raw.length < 4) {
        return null;
    }

    const bytes = decryptFrame(raw);
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
        speedKmh: values.speed ?? previous?.speedKmh ?? 0,
        engineRpm: values.engineRpm ?? previous?.engineRpm ?? 0,
        fuelLevelPercent: values.fuelLevel ?? previous?.fuelLevelPercent ?? 0,
        batteryVoltage: values.batteryVoltage ?? previous?.batteryVoltage ?? 0,
        odometerKm: values.odometer ?? previous?.odometerKm ?? 0,
        tripDistanceKm: values.tripDistance ?? previous?.tripDistanceKm ?? 0,
        tripTimeSeconds:
            values.tripTimeHour !== undefined
                ? values.tripTimeHour * 3600 + (values.tripTimeMinute ?? 0) * 60
                : (previous?.tripTimeSeconds ?? 0),
        averageSpeedKmh: values.averageSpeed ?? previous?.averageSpeedKmh ?? 0,
        topSpeedKmh: values.topSpeed ?? previous?.topSpeedKmh ?? 0,
        throttlePercent: values.throttle ?? previous?.throttlePercent ?? 0,
        leanAngleDegree: values.leanAngle ?? previous?.leanAngleDegree ?? 0,
        gearPosition: values.gearPosition ?? previous?.gearPosition ?? 0,
        sideStandDown: (switchStatus & SIDE_STAND_BIT) !== 0,
        turnSignal,
        turnSignalStatus,
        vehicleState: values.vehicleState1 ?? previous?.vehicleState ?? 0,
        switchStatus,
        tripMileage: values.tripMileage ?? previous?.tripMileage ?? 0,
        tripFuel: values.tripFuel ?? previous?.tripFuel ?? 0,
        overspeedThreshold: values.overspeedThreshold ?? previous?.overspeedThreshold ?? 0,
        engineTemperature: values.engineTemperature ?? previous?.engineTemperature ?? 0,
        intakeAirTemperature: values.intakeAirTemperature ?? previous?.intakeAirTemperature ?? 0,
        cruisingRange: values.cruisingRange ?? previous?.cruisingRange ?? 0,
        lapNumber: values.lapNumber ?? previous?.lapNumber ?? 0,
        lapTimeMs:
            values.lapTimeMinute !== undefined
                ? values.lapTimeMinute * 60000 +
                  values.lapTimeSecond * 1000 +
                  values.lapTimeMilliSecond
                : (previous?.lapTimeMs ?? 0),
        bestLapNumber: values.bestLapNumber ?? previous?.bestLapNumber ?? 0,
        bestLapMs:
            values.bestLapMinute !== undefined
                ? values.bestLapMinute * 60000 +
                  values.bestLapSecond * 1000 +
                  values.bestLapMilliSecond
                : (previous?.bestLapMs ?? 0),
        latitude: previous?.latitude ?? null,
        longitude: previous?.longitude ?? null,
        frameNumber: previous?.frameNumber ?? null,
        receivedAt: Date.now(),
    };
};
