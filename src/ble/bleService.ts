import { BleError, BleManager, Characteristic, Device, State } from 'react-native-ble-plx';

import { describeError, logger } from '@utils/logger';
import { bondDevice, isBonded } from '@services/cluster.service';
import { ensureBlePermissions } from './permissions';
import {
    BLE_MTU,
    CLUSTER_SERVICE_MARK,
    CONNECT_TIMEOUT_MS,
    READ_CHARACTERISTIC_UUID,
    READ_PROPERTIES,
    WRITE_CHARACTERISTIC_UUID,
    WRITE_PROPERTIES,
} from './constants';

/** why the link with the cluster is not up */
export type LinkFailure = 'not-a-bike' | 'bond-refused' | 'connect-failed';

export class ClusterLinkError extends Error {
    readonly failure: LinkFailure;

    constructor(failure: LinkFailure, message: string) {
        super(message);
        this.name = 'ClusterLinkError';
        this.failure = failure;
    }
}

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
    localName: string | null;
    serviceUUIDs: string[];
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
                    localName: device.localName ?? null,
                    serviceUUIDs: device.serviceUUIDs ?? [],
                    rssi: device.rssi ?? -100,
                });
            },
        );

        await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        this.manager.stopDeviceScan();
        logger.info('the scan finished', { service: 'ble', event: 'ble_scan_end', count: found });
    }

    async connect(deviceId: string): Promise<Device> {
        await this.ensureBond(deviceId);
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
            logger.error(`the connection failed: ${describeError(error)}`, {
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

    /**
     * The original app pairs with the cluster before it writes to it, and a
     * cluster that is not paired never answers the gatt connect. Android owns
     * the pairing, so the app asks for it and waits for the rider to accept.
     */
    private async ensureBond(deviceId: string): Promise<void> {
        if (await isBonded(deviceId)) {
            return;
        }
        logger.info('the cluster is not paired yet, android is asking for the pairing', {
            service: 'ble',
            event: 'ble_bond_start',
        });
        const bonded = await bondDevice(deviceId);
        if (!bonded) {
            logger.warn('the pairing with the cluster did not happen', {
                service: 'ble',
                event: 'ble_bond_failed',
            });
            throw new ClusterLinkError('bond-refused', 'the pairing with the cluster was refused');
        }
        logger.info('the cluster is paired', {
            service: 'ble',
            event: 'ble_bond_ok',
        });
    }

    async discover(device: Device, onTelemetry: TelemetryListener): Promise<void> {
        await device.discoverAllServicesAndCharacteristics();
        const services = await device.services();

        let read: Characteristic | null = null;
        let write: Characteristic | null = null;
        const found: string[] = [];
        for (const service of services) {
            const characteristics = await device.characteristicsForService(service.uuid);
            found.push(
                `${service.uuid} ${characteristics
                    .map((item) => `${item.uuid}[${item.properties.join('|')}]`)
                    .join(' ')}`,
            );

            for (const characteristic of characteristics) {
                const uuid = characteristic.uuid.toUpperCase();
                if (uuid === READ_CHARACTERISTIC_UUID) {
                    read = characteristic;
                }
                if (uuid === WRITE_CHARACTERISTIC_UUID) {
                    write = characteristic;
                }
            }
        }

        /**
         * The cluster of the older generation has its own service uuid and its
         * own characteristic uuids, so the app takes them from the discovery:
         * the characteristic that notifies is the one that reads, and the one
         * that writes is the one that writes.
         */
        if (!read || !write) {
            const cluster = services.find((service) =>
                service.uuid.toUpperCase().includes(CLUSTER_SERVICE_MARK),
            );
            if (cluster) {
                const characteristics = await device.characteristicsForService(cluster.uuid);
                read =
                    read ??
                    characteristics.find((item) =>
                        item.properties.some((property) => READ_PROPERTIES.includes(property)),
                    ) ??
                    null;
                write =
                    write ??
                    characteristics.find((item) =>
                        item.properties.some((property) => WRITE_PROPERTIES.includes(property)),
                    ) ??
                    null;
            }
        }

        logger.info('the characteristics are ready', {
            service: 'ble',
            event: 'ble_discover',
            count: services.length,
            pathTemplate: found.join(' | '),
        });

        if (read) {
            await read.monitor((error: BleError | null, value: Characteristic | null) => {
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
        this.writeCharacteristic = write;

        /**
         * The original app checks the service of the cluster after the
         * discovery and disconnects when it is not there. A device that
         * answers the gatt connect but has no bike service is not a bike,
         * and the app has to say so instead of pretending it is connected.
         */
        if (!read || !write) {
            logger.warn('the device does not have the bike service', {
                service: 'ble',
                event: 'ble_discover',
                count: services.length,
            });
            throw new ClusterLinkError(
                'not-a-bike',
                'the device does not have the bike service',
            );
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
