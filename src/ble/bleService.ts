import { BleError, BleManager, Characteristic, Device, State } from 'react-native-ble-plx';

import { logger } from '@utils/logger';
import { ensureBlePermissions } from './permissions';
import {
    BLE_MTU,
    CONNECT_TIMEOUT_MS,
    READ_CHARACTERISTIC_UUID,
    WRITE_CHARACTERISTIC_UUID,
} from './constants';

/** the address of a device never goes to the log, only its last bytes */
export const maskAddress = (id: string): string => {
    if (id.length <= 5) {
        return '****';
    }
    return `****:${id.slice(-5)}`;
};

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
        const granted = await ensureBlePermissions();
        if (!granted) {
            throw new Error('the bluetooth permission is missing');
        }

        this.manager.stopDeviceScan();
        let found = 0;

        this.manager.startDeviceScan(
            null,
            { allowDuplicates: false },
            (error, device) => {
                if (error || !device) {
                    if (error) {
                        logger.warn('the scan reported an error', {
                            event: 'ble_scan',
                            errorName: error ? String(error.errorCode) : 'UnknownError',
                        });
                    }
                    return;
                }
                found += 1;
                logger.info(
                    `a device was found: ${device.name ?? 'no name'} ${maskAddress(device.id)} signal ${device.rssi ?? -100}`,
                    {
                        service: 'ble',
                        event: 'ble_scan_device',
                        count: found,
                    },
                );
                onDevice({
                    id: device.id,
                    name: device.name ?? null,
                    rssi: device.rssi ?? -100,
                });
            },
        );

        await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        this.manager.stopDeviceScan();
        logger.info('the scan finished', { service: 'ble', event: 'ble_scan_end', count: found });
    }

    async connect(deviceId: string): Promise<Device> {
        const started = Date.now();
        logger.info('connecting to the cluster', {
            service: 'ble',
            event: 'ble_connect_start',
        });
        try {
            this.device = await this.manager.connectToDevice(deviceId, {
                autoConnect: false,
                requestMTU: BLE_MTU,
                timeout: CONNECT_TIMEOUT_MS,
            });
        } catch (error) {
            logger.error('the connection failed', {
                service: 'ble',
                event: 'ble_connect_failed',
                durationMs: Date.now() - started,
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
            throw error;
        }
        logger.info('the cluster is connected', {
            service: 'ble',
            event: 'ble_connect_ok',
            durationMs: Date.now() - started,
        });
        return this.device;
    }

    async discover(device: Device, onTelemetry: TelemetryListener): Promise<void> {
        await device.discoverAllServicesAndCharacteristics();
        const services = await device.services();

        let read = false;
        let write = false;
        for (const service of services) {
            const characteristics = await device.characteristicsForService(service.uuid);

            for (const characteristic of characteristics) {
                const uuid = characteristic.uuid.toUpperCase();
                if (uuid === READ_CHARACTERISTIC_UUID) {
                    read = true;
                    characteristic.monitor((error: BleError | null, value: Characteristic | null) => {
                        if (error || !value?.value) {
                            if (error) {
                                logger.warn('the telemetry stream reported an error', {
                                    service: 'ble',
                                    event: 'ble_monitor_error',
                                    errorName: String(error.errorCode),
                                });
                            }
                            return;
                        }
                        onTelemetry(base64ToBytes(value.value));
                    });
                }
                if (uuid === WRITE_CHARACTERISTIC_UUID) {
                    write = true;
                    this.writeCharacteristic = characteristic;
                }
            }
        }

        logger.info('the characteristics are ready', {
            service: 'ble',
            event: 'ble_discover',
            count: services.length,
        });
        if (!read) {
            logger.warn('the read characteristic was not found', {
                service: 'ble',
                event: 'ble_discover',
            });
        }
        if (!write) {
            logger.warn('the write characteristic was not found', {
                service: 'ble',
                event: 'ble_discover',
            });
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

/** the manager has to be one for the whole app, the library says so */
export const bleService = new BleService();
