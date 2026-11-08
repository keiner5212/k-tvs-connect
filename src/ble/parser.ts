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

/** A telemetry with nothing in it, for the values the bike has not sent. */
export const emptyTelemetry = (): BikeTelemetry => ({
    speedKmh: null,
    engineRpm: null,
    fuelLevelPercent: null,
    batteryVoltage: null,
    odometerKm: null,
    tripDistanceKm: null,
    tripTimeSeconds: null,
    tripMileage: null,
    tripFuel: null,
    averageSpeedKmh: null,
    topSpeedKmh: null,
    throttlePercent: null,
    leanAngleDegree: null,
    gearPosition: null,
    sideStandDown: false,
    turnSignal: 'none',
    turnSignalStatus: 0,
    vehicleState: 0,
    switchStatus: 0,
    overspeedThreshold: 0,
    engineTemperature: null,
    intakeAirTemperature: null,
    cruisingRange: null,
    lapNumber: null,
    lapTimeMs: null,
    bestLapNumber: null,
    bestLapMs: null,
    latitude: null,
    longitude: null,
    receivedAt: Date.now(),
});

const SIDE_STAND_BIT = 0x01;
const LEFT_SIGNAL_BIT = 0x02;
const RIGHT_SIGNAL_BIT = 0x04;

/**
 * The older family of the cluster (the RTR 160 IoT V2 and the families that
 * share its protocol) sends a stream of letter frames: a prefix byte, the
 * value and a couple of extra bytes. The data arrives without encryption.
 */
export interface LegacyFrame {
    speedKmh: number | null;
    fuelLevelPercent: number | null;
    /** the raw bytes, so the rest of the frames can be read from the log */
    raw: string;
}

const LEGACY_SPEED = 0x41; // A
const LEGACY_FUEL = 0x46; // F

export const parseLegacyFrame = (bytes: Uint8Array): LegacyFrame => {
    let speedKmh: number | null = null;
    let fuelLevelPercent: number | null = null;

    for (let index = 0; index < bytes.length - 1; index += 1) {
        const prefix = bytes[index];
        if (prefix === LEGACY_SPEED) {
            const value = bytes[index + 1];
            const unit = bytes[index + 2];
            if (unit === 0) {
                speedKmh = value;
            } else if (unit === 1) {
                speedKmh = Math.round(value * 1.60934);
            }
        }
        if (prefix === LEGACY_FUEL) {
            const value = bytes[index + 1];
            if (value !== 255) {
                fuelLevelPercent = value;
            }
        }
    }

    const raw = Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

    return { speedKmh, fuelLevelPercent, raw };
};

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
