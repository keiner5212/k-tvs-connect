import { BleError, BleManager, Characteristic, Device, State } from 'react-native-ble-plx';

import { describeError, logger } from '@utils/logger';
import { bondDevice, isBonded } from '@services/cluster.service';
import { ensureBlePermissions } from './permissions';
import {
    BLE_MTU,
    CLUSTER_SERVICE_MARK,
    CONNECT_TIMEOUT_MS,
    READ_CHARACTERISTIC_UUID,
    WRITE_CHARACTERISTIC_UUID,
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

/**
 * Which family of the cluster the phone is talking to. Both speak the same
 * frames; the RTR 160 IoT V2 family xors its payload with 0xEB instead of
 * 0xEA and answers on its own service.
 */
export type ClusterKind = 'modern' | 'rtr160';

export type TelemetryListener = (bytes: Uint8Array) => void;
export type StateListener = (state: State) => void;

/** what a characteristic can do, for the log */
const propertiesOf = (characteristic: Characteristic): string =>
    [
        characteristic.isReadable ? 'Read' : null,
        characteristic.isWritableWithResponse ? 'Write' : null,
        characteristic.isWritableWithoutResponse ? 'WriteNoResponse' : null,
        characteristic.isNotifiable ? 'Notify' : null,
        characteristic.isIndicatable ? 'Indicate' : null,
    ]
        .filter((value) => value !== null)
        .join('|');

/** the characteristic that carries the telemetry of the cluster */
const canNotify = (characteristic: Characteristic): boolean =>
    characteristic.isNotifiable || characteristic.isIndicatable;

/** the characteristic the cluster accepts the commands in */
const canWrite = (characteristic: Characteristic): boolean =>
    characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse;

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

    private writeCharacteristics: Characteristic[] = [];

    private writtenFrames = 0;

    private receivedFrames = 0;

    private clusterKind: ClusterKind = 'modern';

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

    async connect(
        deviceId: string,
        onBonding?: () => void,
        timeoutMs: number = CONNECT_TIMEOUT_MS,
    ): Promise<Device> {
        const bondedNow = await this.ensureBond(deviceId, onBonding);
        if (bondedNow) {
            /**
             * The link that carried the pairing is not the link that carries
             * the traffic. Android has to bring the encryption up on a fresh
             * connection, and the cluster refuses a write with response on an
             * unencrypted link, so the old one is dropped before the new one
             * is opened.
             */
            try {
                this.manager.cancelDeviceConnection(deviceId);
            } catch {
                // the link was never opened, there is nothing to drop
            }
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        const started = Date.now();
        logger.info('connecting to the cluster', {
            service: 'ble',
            event: 'ble_connect_start',
        });
        try {
            this.device = await this.manager.connectToDevice(deviceId, {
                autoConnect: false,
                requestMTU: BLE_MTU,
                timeout: timeoutMs,
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
        logger.info('the link to the cluster is open', {
            service: 'ble',
            event: 'ble_mtu',
            count: this.device.mtu,
        });
        return this.device;
    }

    /**
     * The original app pairs with the cluster before it writes to it, and a
     * cluster that is not paired never answers the gatt connect. Android owns
     * the pairing, so the app asks for it and waits for the rider to accept.
     */
    private async ensureBond(deviceId: string, onBonding?: () => void): Promise<boolean> {
        if (await isBonded(deviceId)) {
            return false;
        }
        logger.info('the cluster is not paired yet, android is asking for the pairing', {
            service: 'ble',
            event: 'ble_bond_start',
        });
        onBonding?.();
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
        return true;
    }

    async discover(
        device: Device,
        onTelemetry: TelemetryListener,
    ): Promise<ClusterKind> {
        await device.discoverAllServicesAndCharacteristics();
        const services = await device.services();

        const readCharacteristics: Characteristic[] = [];
        const writeCharacteristics: Characteristic[] = [];
        const found: string[] = [];

        for (const service of services) {
            const characteristics = await device.characteristicsForService(service.uuid);
            found.push(
                `${service.uuid} ${characteristics
                    .map((item) => `${item.uuid}[${propertiesOf(item)}]`)
                    .join(' ')}`,
            );

            for (const characteristic of characteristics) {
                const uuid = characteristic.uuid.toUpperCase();
                if (uuid === READ_CHARACTERISTIC_UUID || uuid === WRITE_CHARACTERISTIC_UUID) {
                    if (canNotify(characteristic) && !readCharacteristics.includes(characteristic)) {
                        readCharacteristics.push(characteristic);
                    }
                    if (canWrite(characteristic) && !writeCharacteristics.includes(characteristic)) {
                        writeCharacteristics.push(characteristic);
                    }
                    continue;
                }
                /**
                 * The cluster of the RTR 160 IoT V2 answers on its own
                 * service with its own characteristic uuids, so the app takes
                 * the endpoints it can talk to from the discovery.
                 */
                if (service.uuid.toUpperCase().includes(CLUSTER_SERVICE_MARK)) {
                    if (canNotify(characteristic) && !readCharacteristics.includes(characteristic)) {
                        readCharacteristics.push(characteristic);
                    }
                    if (canWrite(characteristic) && !writeCharacteristics.includes(characteristic)) {
                        writeCharacteristics.push(characteristic);
                    }
                }
            }
        }

        const kind: ClusterKind = readCharacteristics.length > 0 && writeCharacteristics.length > 0
            ? 'modern'
            : 'rtr160';

        logger.info('the characteristics are ready', {
            service: 'ble',
            event: 'ble_discover',
            count: services.length,
            pathTemplate: found.join(' | '),
        });

        this.clusterKind = kind;

        /**
         * The cluster notifies on more than one endpoint, so the app listens
         * to all of them and takes the frames from whichever answers.
         */
        for (const characteristic of readCharacteristics) {
            await characteristic.monitor((error: BleError | null, value: Characteristic | null) => {
                if (error || !value?.value) {
                    if (error) {
                        logger.warn(
                            `the telemetry stream reported an error: ${describeError(error)}`,
                            {
                                service: 'ble',
                                event: 'ble_monitor_error',
                                errorName: String(error.errorCode),
                            },
                        );
                    }
                    return;
                }
                const raw = base64ToBytes(value.value);
                this.receivedFrames += 1;
                if (this.receivedFrames <= 3) {
                    logger.info('a frame came from the cluster', {
                        service: 'ble',
                        event: 'ble_frame',
                        count: this.receivedFrames,
                        pathTemplate: Array.from(raw)
                            .map((byte) => byte.toString(16).padStart(2, '0'))
                            .join(''),
                    });
                }
                onTelemetry(raw);
            });
        }
        this.writeCharacteristics = writeCharacteristics;

        /**
         * The original app checks the service of the cluster after the
         * discovery and disconnects when it is not there. A device that
         * answers the gatt connect but has no bike service is not a bike,
         * and the app has to say so instead of pretending it is connected.
         */
        if (readCharacteristics.length === 0 || writeCharacteristics.length === 0) {
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

        return kind;
    }

    async write(bytes: Uint8Array): Promise<void> {
        const characteristics = this.writeCharacteristics;
        if (characteristics.length === 0) {
            throw new Error('write characteristic is not available');
        }
        /**
         * The write has to use the method the endpoint supports: a write with
         * a response to an endpoint that only takes a write without one is
         * dropped by the stack, and the cluster never answers. The cluster of
         * the RTR 160 has two endpoints that take commands, so the app writes
         * to both.
         */
        const payload = bytesToBase64(bytes);
        this.writtenFrames += 1;
        if (this.writtenFrames <= 3) {
            logger.info('a frame was written to the cluster', {
                service: 'ble',
                event: 'ble_write',
                count: this.writtenFrames,
                pathTemplate: Array.from(bytes)
                    .map((byte) => byte.toString(16).padStart(2, '0'))
                    .join(''),
            });
        }
        for (const characteristic of characteristics) {
            const method = characteristic.isWritableWithResponse ? 'with response' : 'without response';
            try {
                if (characteristic.isWritableWithResponse) {
                    await characteristic.writeWithResponse(payload);
                } else {
                    await characteristic.writeWithoutResponse(payload);
                }
            } catch (error) {
                const failures = (this.writeFailures.get(characteristic.uuid) ?? 0) + 1;
                this.writeFailures.set(characteristic.uuid, failures);
                if (failures > 3) {
                    continue;
                }
                logger.warn(
                    `could not write to ${characteristic.uuid} (${method}): ${this.describeBleError(error)}`,
                    {
                        service: 'ble',
                        event: 'ble_write_error',
                        errorName: error instanceof Error ? error.name : 'UnknownError',
                    },
                );
            }
        }
    }

    private writeFailures = new Map<string, number>();

    /**
     * The library keeps the android gatt status and the att error in fields
     * that the logger drops, so they go in the message of the log line.
     */
    private describeBleError(error: unknown): string {
        if (error instanceof Error) {
            const ble = error as BleError;
            const android = ble.androidErrorCode ?? 'none';
            const att = ble.attErrorCode ?? 'none';
            return `${describeError(error)} android=${android} att=${att}`;
        }
        return describeError(error);
    }

    get kind(): ClusterKind {
        return this.clusterKind;
    }

    async disconnect(): Promise<void> {
        this.writeCharacteristics = [];
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
