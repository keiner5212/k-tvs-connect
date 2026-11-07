import { PermissionsAndroid, Platform } from 'react-native';
import { State } from 'react-native-ble-plx';

import { Bike, BikeTelemetry, ConnectionState } from '@typings/types';
import { logger } from '@utils/logger';
import { BleService, DiscoveredDevice } from './bleService';
import {
    BLE_SERVICE_UUIDS,
    DATA_TIMEOUT_MS,
    RECONNECT_DELAYS_MS,
    SCAN_WINDOW_MS,
} from './constants';
import { parseFrame, telemetryFromFrame } from './parser';
import { serviceUuidCandidates } from './serviceUuid';

export type ConnectionListener = (state: ConnectionState) => void;
export type TelemetryListener = (telemetry: BikeTelemetry) => void;

export class ConnectionController {
    private readonly ble = new BleService();

    private state: ConnectionState = 'off';

    private bike: Bike | null = null;

    private imei: string | null = null;

    private telemetry: BikeTelemetry | null = null;

    private lastDataAt: number | null = null;

    private reconnectAttempt = 0;

    private running = false;

    private scanning = false;

    private watchdog: ReturnType<typeof setInterval> | null = null;

    private readonly stateListeners = new Set<ConnectionListener>();

    private readonly telemetryListeners = new Set<TelemetryListener>();

    constructor() {
        this.ble.onStateChange((state) => {
            if (state !== State.PoweredOn && this.state !== 'off') {
                this.setState('off');
            }
        });
    }

    subscribeState(listener: ConnectionListener): () => void {
        this.stateListeners.add(listener);
        listener(this.state);
        return () => this.stateListeners.delete(listener);
    }

    subscribeTelemetry(listener: TelemetryListener): () => void {
        this.telemetryListeners.add(listener);
        if (this.telemetry) {
            listener(this.telemetry);
        }
        return () => this.telemetryListeners.delete(listener);
    }

    get currentState(): ConnectionState {
        return this.state;
    }

    get currentTelemetry(): BikeTelemetry | null {
        return this.telemetry;
    }

    async requestPermissions(): Promise<boolean> {
        if (Platform.OS !== 'android') {
            return true;
        }

        const permissions =
            Platform.Version >= 31
                ? [
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                ]
                : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

        const result = await PermissionsAndroid.requestMultiple(permissions);
        return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
    }

    async start(bike: Bike, imei: string | null): Promise<void> {
        this.bike = bike;
        this.imei = imei;
        this.running = true;
        this.reconnectAttempt = 0;
        this.setState('scanning');

        if (!this.watchdog) {
            this.watchdog = setInterval(() => this.checkLiveness(), 1000);
        }

        await this.scanAndConnect();
    }

    async stop(): Promise<void> {
        this.running = false;
        if (this.watchdog) {
            clearInterval(this.watchdog);
            this.watchdog = null;
        }
        this.scanning = false;
        await this.ble.disconnect().catch(() => undefined);
        this.setState('off');
    }

    async reconnectNow(): Promise<void> {
        await this.ble.disconnect().catch(() => undefined);
        this.reconnectAttempt = 0;
        this.setState('scanning');
        await this.scanAndConnect();
    }

    private setState(state: ConnectionState): void {
        if (this.state === state) {
            return;
        }
        this.state = state;
        for (const listener of this.stateListeners) {
            listener(state);
        }
    }

    private serviceUuids(): string[] {
        const known = Object.values(BLE_SERVICE_UUIDS);
        return Array.from(new Set([...serviceUuidCandidates(this.imei), ...known]));
    }

    private async scanAndConnect(): Promise<void> {
        if (!this.running || this.scanning) {
            return;
        }
        this.scanning = true;

        try {
            if (!(await this.ble.isPoweredOn())) {
                this.setState('off');
                return;
            }

            const target = this.bike;
            const found: { device: DiscoveredDevice | null } = { device: null };

            await this.ble.scan(
                this.serviceUuids(),
                (device) => {
                    if (target && device.id.toUpperCase() === target.macAddress.toUpperCase()) {
                        found.device = device;
                    }
                },
                SCAN_WINDOW_MS,
            );

            if (!this.running) {
                return;
            }

            const match = found.device;
            if (!match) {
                this.setState('scanning');
                await this.scheduleNextScan();
                return;
            }

            this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

            try {
                const device = await this.ble.connect(match.id);
                const serviceUuid = this.serviceUuids().find(
                    (uuid) => uuid.toUpperCase() === '5456534D-5647-5341-5342-454E544F5251'.toUpperCase(),
                );
                await this.ble.discover(device, serviceUuid ?? BLE_SERVICE_UUIDS.apache, (bytes) =>
                    this.handleData(bytes),
                );
                this.reconnectAttempt = 0;
                this.setState('connected');
            } catch (error) {
                logger.warn('connect failed', {
                    event: 'connect',
                    errorName: error instanceof Error ? error.name : 'UnknownError',
                });
                this.setState('failed');
                await this.scheduleNextScan();
            }
        } finally {
            this.scanning = false;
        }
    }

    private async scheduleNextScan(): Promise<void> {
        if (!this.running) {
            return;
        }
        const delay =
            RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
        this.reconnectAttempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (this.running) {
            await this.scanAndConnect();
        }
    }

    private handleData(bytes: Uint8Array): void {
        const frame = parseFrame(bytes);
        if (!frame) {
            return;
        }

        this.telemetry = telemetryFromFrame(frame, this.telemetry);
        this.lastDataAt = Date.now();

        for (const listener of this.telemetryListeners) {
            listener(this.telemetry);
        }
    }

    private checkLiveness(): void {
        if (!this.running || this.state !== 'connected') {
            return;
        }
        if (this.lastDataAt === null) {
            return;
        }
        if (Date.now() - this.lastDataAt > DATA_TIMEOUT_MS) {
            void this.reconnectNow();
        }
    }
}

export const connectionController = new ConnectionController();
