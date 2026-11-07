import { BleError, BleManager, Characteristic, Device, State } from 'react-native-ble-plx';

import {
    BLE_MTU,
    CONNECT_TIMEOUT_MS,
    READ_CHARACTERISTIC_UUID,
    WRITE_CHARACTERISTIC_UUID,
} from './constants';

export type DiscoveredDevice = {
    id: string;
    name: string | null;
    rssi: number;
};

export type TelemetryListener = (bytes: Uint8Array) => void;
export type StateListener = (state: State) => void;

export const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return globalThis.btoa(binary);
};

export const base64ToBytes = (value: string): Uint8Array => {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

export class BleService {
    private readonly manager: BleManager;

    private device: Device | null = null;

    private writeCharacteristic: Characteristic | null = null;

    constructor() {
        this.manager = new BleManager();
    }

    onStateChange(listener: StateListener): void {
        this.manager.onStateChange(listener, true);
    }

    async isPoweredOn(): Promise<boolean> {
        return (await this.manager.state()) === State.PoweredOn;
    }

    async scan(
        onDevice: (device: DiscoveredDevice) => void,
        timeoutMs: number,
    ): Promise<void> {
        this.manager.stopDeviceScan();

        this.manager.startDeviceScan(
            null,
            { allowDuplicates: false },
            (error, device) => {
                if (error || !device) {
                    return;
                }
                onDevice({
                    id: device.id,
                    name: device.name ?? null,
                    rssi: device.rssi ?? -100,
                });
            },
        );

        await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        this.manager.stopDeviceScan();
    }

    async connect(deviceId: string): Promise<Device> {
        this.device = await this.manager.connectToDevice(deviceId, {
            autoConnect: false,
            requestMTU: BLE_MTU,
            timeout: CONNECT_TIMEOUT_MS,
        });
        return this.device;
    }

    async discover(device: Device, onTelemetry: TelemetryListener): Promise<void> {
        await device.discoverAllServicesAndCharacteristics();
        const services = await device.services();

        for (const service of services) {
            const characteristics = await device.characteristicsForService(service.uuid);

            for (const characteristic of characteristics) {
                const uuid = characteristic.uuid.toUpperCase();
                if (uuid === READ_CHARACTERISTIC_UUID) {
                    characteristic.monitor((error: BleError | null, value: Characteristic | null) => {
                        if (error || !value?.value) {
                            return;
                        }
                        onTelemetry(base64ToBytes(value.value));
                    });
                }
                if (uuid === WRITE_CHARACTERISTIC_UUID) {
                    this.writeCharacteristic = characteristic;
                }
            }
        }
    }

    async write(bytes: Uint8Array): Promise<void> {
        if (!this.writeCharacteristic) {
            throw new Error('write characteristic is not available');
        }
        await this.writeCharacteristic.writeWithResponse(bytesToBase64(bytes));
    }

    async disconnect(): Promise<void> {
        this.writeCharacteristic = null;
        if (this.device) {
            await this.manager.cancelDeviceConnection(this.device.id);
            this.device = null;
        }
    }

    get connectedDeviceId(): string | null {
        return this.device?.id ?? null;
    }
}
