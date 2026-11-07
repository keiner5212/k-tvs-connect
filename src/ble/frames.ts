import { DATA_ID } from './constants';

export interface FieldSpec {
    name: string;
    start: number;
    length: number;
    scale?: number;
}

export interface FrameSpec {
    dataId: number;
    length: number;
    fields: FieldSpec[];
}

/**
 * Offsets are 1 based, the same convention the original parser uses: it takes
 * start minus one and reads that many bytes as a big endian integer.
 * A field with a scale is divided by it, the original getters do the same.
 */
export const FRAMES: FrameSpec[] = [
    {
        dataId: DATA_ID.speedometer5A10,
        length: 20,
        fields: [
            { name: 'speed', start: 3, length: 1 },
            { name: 'odometer', start: 4, length: 3, scale: 10 },
            { name: 'fuelLevel', start: 7, length: 1 },
            { name: 'averageSpeed', start: 8, length: 1 },
            { name: 'economyStatus', start: 9, length: 1 },
            { name: 'topSpeed', start: 10, length: 1 },
            { name: 'throttle', start: 11, length: 1 },
            { name: 'switchStatus', start: 12, length: 1 },
            { name: 'locationTag', start: 12, length: 1 },
            { name: 'timeTo60Kmph', start: 13, length: 1 },
            { name: 'averageMileage', start: 14, length: 1 },
            { name: 'tripFMeter', start: 15, length: 2 },
            { name: 'engineRpm', start: 17, length: 2 },
            { name: 'checksum', start: 19, length: 1 },
        ],
    },
    {
        dataId: DATA_ID.speedometer5A11,
        length: 20,
        fields: [
            { name: 'vehicleState2', start: 3, length: 1 },
            { name: 'vehicleState1', start: 4, length: 1 },
            { name: 'serviceReminder', start: 5, length: 1 },
            { name: 'gearPosition', start: 6, length: 1 },
            { name: 'vehicleState3', start: 7, length: 1 },
            { name: 'softwareVersion', start: 8, length: 1 },
            { name: 'vehicleDiagnostics', start: 11, length: 1 },
            { name: 'turnIndicatorStatus', start: 13, length: 1 },
            { name: 'backlight', start: 18, length: 1 },
            { name: 'checksum', start: 19, length: 1 },
        ],
    },
    {
        dataId: DATA_ID.speedometer5A12,
        length: 20,
        fields: [
            { name: 'leanAngle', start: 3, length: 1 },
            { name: 'cruisingRange', start: 4, length: 2 },
            { name: 'wheelieAngleOffset', start: 6, length: 1 },
            { name: 'acceleration', start: 7, length: 1 },
            { name: 'torque', start: 8, length: 1 },
            { name: 'tripDistance', start: 9, length: 2 },
            { name: 'tripTimeHour', start: 11, length: 1 },
            { name: 'tripTimeMinute', start: 12, length: 1 },
            { name: 'tripMileage', start: 13, length: 1 },
            { name: 'tripFuel', start: 14, length: 2 },
            { name: 'overspeedThreshold', start: 16, length: 1 },
            { name: 'overspeedSetting', start: 17, length: 1 },
            { name: 'checksum', start: 19, length: 1 },
        ],
    },
    {
        dataId: DATA_ID.speedometer5A16,
        length: 20,
        fields: [
            { name: 'lapTimeMinute', start: 3, length: 1 },
            { name: 'lapTimeSecond', start: 4, length: 1 },
            { name: 'lapTimeMilliSecond', start: 5, length: 1 },
            { name: 'lapNumber', start: 6, length: 1 },
            { name: 'bestLapMinute', start: 7, length: 1 },
            { name: 'bestLapSecond', start: 8, length: 1 },
            { name: 'bestLapMilliSecond', start: 9, length: 1 },
            { name: 'bestLapNumber', start: 10, length: 1 },
            { name: 'lapTrigger', start: 11, length: 1 },
            { name: 'checksum', start: 19, length: 1 },
        ],
    },
    {
        dataId: DATA_ID.speedometer5A18,
        length: 20,
        fields: [
            { name: 'engineLoad', start: 3, length: 1 },
            { name: 'accumulatedFuelInjectionTime', start: 4, length: 2 },
            { name: 'manifoldAirPressure', start: 6, length: 1 },
            { name: 'barometricPressure', start: 7, length: 1 },
            { name: 'intakeAirTemperature', start: 8, length: 1 },
            { name: 'engineTemperature', start: 9, length: 1 },
            { name: 'fuelInjectionTime', start: 10, length: 2 },
            { name: 'batteryVoltage', start: 12, length: 1, scale: 10 },
            { name: 'runTimeSinceEngineStart', start: 13, length: 2 },
            { name: 'distanceTraveled', start: 15, length: 2 },
            { name: 'fuelInjectionVolume', start: 17, length: 2 },
            { name: 'checksum', start: 19, length: 1 },
        ],
    },
];

export const frameForDataId = (dataId: number): FrameSpec | undefined =>
    FRAMES.find((frame) => frame.dataId === dataId);
