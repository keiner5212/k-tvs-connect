import { PermissionsAndroid, Platform } from 'react-native';
import { State } from 'react-native-ble-plx';

import { Bike, BikeTelemetry, ConnectionState } from '@typings/types';
import { logger } from '@utils/logger';
import { BleService, DiscoveredDevice } from './bleService';
import { DATA_TIMEOUT_MS, RECONNECT_DELAYS_MS, SCAN_WINDOW_MS } from './constants';
import { parseFrame, telemetryFromFrame } from './parser';
import {
    buildLocationAddressPacket,
    buildMobileDataPacket,
    buildRiderNamePacket,
    buildTrafficSequencePacket,
} from './protocol';

export type ConnectionListener = (state: ConnectionState) => void;
export type TelemetryListener = (telemetry: BikeTelemetry) => void;

const CLUSTER_UPDATE_INTERVAL_MS = 2000;

const getBatteryLevel = async (): Promise<number> => {
    try {
        const { getBatteryLevelAsync } = await import('expo-battery');
        return await getBatteryLevelAsync();
    } catch {
        return 0;
    }
};

const getNetworkType = async (): Promise<number> => {
    try {
        const NetInfo = (await import('@react-native-community/netinfo')).default;
        const state = await NetInfo.fetch();
        return state.type === 'cellular' ? 4 : 0;
    } catch {
        return 0;
    }
};

export class ConnectionController {
    private readonly ble = new BleService();

    private state: ConnectionState = 'off';

    private bike: Bike | null = null;

    private telemetry: BikeTelemetry | null = null;

    private lastDataAt: number | null = null;

    private invalidFrames = 0;

    private reconnectAttempt = 0;

    private running = false;

    private scanning = false;

    private watchdog: ReturnType<typeof setInterval> | null = null;

    private clusterTimer: ReturnType<typeof setInterval> | null = null;

    private overspeedLimitKmh: number | null = null;

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

    async start(bike: Bike): Promise<void> {
        this.bike = bike;
        this.running = true;
        this.reconnectAttempt = 0;
        this.setState('scanning');

        if (!this.watchdog) {
            this.watchdog = setInterval(() => this.checkLiveness(), 1000);
        }

        await this.scanAndConnect();
    }

    async stop(): Promise<void> {
        this.stopClusterUpdates();
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

    /**
     * Sends the destination to the cluster over the write characteristic. The
     * cluster routes with its own map engine, so only the address text goes over.
     */
    async sendDestinationToCluster(address: string): Promise<boolean> {
        if (this.state !== 'connected') {
            return false;
        }

        try {
            await this.ble.write(buildLocationAddressPacket(address));
            await this.ble.write(buildTrafficSequencePacket());
            logger.info('destination sent to the cluster', { event: 'ble_write', count: 1 });
            return true;
        } catch (error) {
            logger.warn('could not write to the cluster', {
                event: 'ble_write',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
            return false;
        }
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
                await this.ble.discover(device, (bytes) => this.handleData(bytes));
                this.reconnectAttempt = 0;
                this.setState('connected');
                const { useSettingsStore } = await import('@stores/settingsStore');
                this.overspeedLimitKmh = useSettingsStore.getState().settings.overspeedLimitKmh;
                await this.startClusterUpdates();
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

        if (!frame.checksumValid) {
            this.invalidFrames += 1;
            logger.warn('frame with a bad checksum', {
                event: 'ble_frame',
                count: this.invalidFrames,
            });
            return;
        }

        this.telemetry = telemetryFromFrame(frame, this.telemetry);
        this.lastDataAt = Date.now();

        for (const listener of this.telemetryListeners) {
            listener(this.telemetry);
        }
    }

    /**
     * The original app writes the rider name once after the connection and then
     * refreshes the mobile data packet every two seconds. The cluster shows the
     * clock, the phone battery, the signal and the overspeed limit from it.
     */
    private async startClusterUpdates(): Promise<void> {
        this.stopClusterUpdates();

        const name = this.bike?.nickname ?? '';
        if (name) {
            await this.ble.write(buildRiderNamePacket(name)).catch(() => undefined);
        }

        await this.writeMobileData();

        this.clusterTimer = setInterval(() => {
            void this.writeMobileData();
        }, CLUSTER_UPDATE_INTERVAL_MS);
    }

    private stopClusterUpdates(): void {
        if (this.clusterTimer) {
            clearInterval(this.clusterTimer);
            this.clusterTimer = null;
        }
    }

    private async writeMobileData(): Promise<void> {
        if (this.state !== 'connected') {
            return;
        }

        const battery = await getBatteryLevel();
        const networkType = await getNetworkType();

        await this.ble
            .write(
                buildMobileDataPacket({
                    batteryPercent: battery,
                    signalStrength: 0,
                    overspeedLimitKmh: this.overspeedLimitKmh,
                    networkType,
                    missedCalls: 0,
                    callState: 0xff,
                    voiceAssistEnabled: false,
                    now: new Date(),
                }),
            )
            .catch(() => undefined);
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
