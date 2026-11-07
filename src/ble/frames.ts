import { DATA_ID } from './constants';

export interface FieldSpec {
    name: string;
    start: number;
    length: number;
    scale?: number;
    bits?: number;
}

export interface FrameSpec {
    dataId: number;
    length: number;
    fields: FieldSpec[];
}

/**
 * Offsets are 1 based, the same convention the original parser uses.
 * A field without a scale is an unsigned integer, a field with a scale is a float.
 */
export const FRAMES: FrameSpec[] = [
    {
        dataId: DATA_ID.speedometer5A10,
        length: 20,
        fields: [
            { name: 'speed', start: 3, length: 1 },
            { name: 'odometerRaw', start: 4, length: 3, scale: 0.1 },
            { name: 'fuelLevel', start: 7, length: 1 },
            { name: 'averageSpeed', start: 8, length: 1 },
            { name: 'economyStatus', start: 9, length: 1 },
            { name: 'topSpeed', start: 10, length: 1 },
            { name: 'throttle', start: 11, length: 1 },
            { name: 'switchStatus', start: 12, length: 1 },
            { name: 'timeTo60Kmph', start: 13, length: 1 },
            { name: 'averageMileage', start: 14, length: 1 },
            { name: 'tripFMeter', start: 15, length: 2 },
            { name: 'engineRpm', start: 17, length: 2 },
            { name: 'checksum', start: 19, length: 1 },
        ],
    },
];

export const frameForDataId = (dataId: number): FrameSpec | undefined =>
    FRAMES.find((frame) => frame.dataId === dataId);
