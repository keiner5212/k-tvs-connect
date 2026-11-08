import { PermissionsAndroid, Platform } from 'react-native';
import { State } from 'react-native-ble-plx';

import { Bike, BikeTelemetry, ConnectionState } from '@typings/types';
import { startClusterService, stopClusterService } from '@services/cluster.service';
import { logger } from '@utils/logger';
import { bleService, DiscoveredDevice } from './bleService';
import { ensureBlePermissions } from './permissions';
import { DATA_TIMEOUT_MS, RECONNECT_DELAYS_MS, SCAN_WINDOW_MS } from './constants';
import { parseFrame, telemetryFromFrame } from './parser';
import {
    NavigationUpdate,
    buildLocationAddressPacket,
    buildMobileDataPacket,
    buildNavigationControlPacket,
    buildNavigationTextPacket,
    buildRiderNamePacket,
    buildTrafficSequencePacket,
} from './protocol';

export type ConnectionListener = (state: ConnectionState) => void;
export type TelemetryListener = (telemetry: BikeTelemetry) => void;

export interface ConnectionInfo {
    state: ConnectionState;
    attempt: number;
    nextRetryAt: number | null;
}

const CLUSTER_UPDATE_INTERVAL_MS = 2000;

/** the original refreshes the navigation of the cluster every 400 milliseconds */
const NAVIGATION_UPDATE_INTERVAL_MS = 400;

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

const hasNetwork = async (): Promise<boolean> => {
    try {
        const NetInfo = (await import('@react-native-community/netinfo')).default;
        const state = await NetInfo.fetch();
        return state.isConnected !== false;
    } catch {
        return true;
    }
};

const hasGps = async (): Promise<boolean> => {
    try {
        const Location = await import('expo-location');
        return await Location.hasServicesEnabledAsync();
    } catch {
        return true;
    }
};

export class ConnectionController {
    private readonly ble = bleService;

    private state: ConnectionState = 'off';

    private bike: Bike | null = null;

    private telemetry: BikeTelemetry | null = null;

    private lastDataAt: number | null = null;

    private invalidFrames = 0;

    private reconnectAttempt = 0;

    private nextRetryAt: number | null = null;

    private running = false;

    private scanning = false;

    private loopRunning = false;

    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    private retryResolve: (() => void) | null = null;

    private watchdog: ReturnType<typeof setInterval> | null = null;

    private receivedFrames = 0;

    private clusterTimer: ReturnType<typeof setInterval> | null = null;

    private navigationTimer: ReturnType<typeof setInterval> | null = null;

    private navigationUpdate: NavigationUpdate | null = null;

    private lastInstruction = '';

    private gpsEnabled = true;

    private networkAvailable = true;

    private overspeedLimitKmh: number | null = null;

    private readonly stateListeners = new Set<ConnectionListener>();

    private readonly telemetryListeners = new Set<TelemetryListener>();

    private readonly infoListeners = new Set<(info: ConnectionInfo) => void>();

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

    subscribeInfo(listener: (info: ConnectionInfo) => void): () => void {
        this.infoListeners.add(listener);
        listener(this.info);
        return () => this.infoListeners.delete(listener);
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

    get info(): ConnectionInfo {
        return {
            state: this.state,
            attempt: this.reconnectAttempt,
            nextRetryAt: this.nextRetryAt,
        };
    }

    /**
     * Android 13 and later hide the notification of the foreground service
     * without this permission.
     */
    async requestNotificationPermission(): Promise<boolean> {
        if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
            return true;
        }
        try {
            const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            return result === PermissionsAndroid.RESULTS.GRANTED;
        } catch {
            return false;
        }
    }

    async requestPermissions(): Promise<boolean> {
        return ensureBlePermissions();
    }

    async start(bike: Bike): Promise<void> {
        this.bike = bike;
        this.running = true;
        this.reconnectAttempt = 0;
        this.nextRetryAt = null;
        this.receivedFrames = 0;
        logger.info(`looking for the scooter ${bike.nickname}`, {
            service: 'ble',
            event: 'ble_start',
        });
        this.setState('scanning');

        if (!this.watchdog) {
            this.watchdog = setInterval(() => this.checkLiveness(), 1000);
        }

        void this.runConnectionLoop();
    }

    async stop(): Promise<void> {
        this.stopClusterUpdates();
        this.stopNavigationLoop();
        this.running = false;
        this.cancelRetry();
        if (this.watchdog) {
            clearInterval(this.watchdog);
            this.watchdog = null;
        }
        this.scanning = false;
        await this.ble.disconnect().catch(() => undefined);
        void stopClusterService();
        this.setState('off');
    }

    /** Sends a packet to the cluster, if the link is up. */
    async sendPacket(packet: Uint8Array): Promise<void> {
        if (this.state !== 'connected') {
            return;
        }
        try {
            await this.ble.write(packet);
        } catch (error) {
            logger.warn('could not write to the cluster', {
                service: 'ble',
                event: 'ble_write',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
        }
    }

    async reconnectNow(): Promise<void> {
        await this.ble.disconnect().catch(() => undefined);
        this.cancelRetry();
        this.reconnectAttempt = 0;
        this.nextRetryAt = null;
        this.setState('scanning');
        void this.runConnectionLoop();
    }

    /**
     * The navigation the cluster shows while riding: the distance to the next
     * turn, the time left and the pictogram. The original writes it every 400
     * milliseconds while the navigation runs, so the cluster never shows a
     * stale distance.
     */
    async startNavigation(update: NavigationUpdate): Promise<boolean> {
        this.navigationUpdate = update;
        const sent = await this.writeNavigation();
        if (sent) {
            this.stopNavigationLoop();
            this.navigationTimer = setInterval(() => {
                void this.writeNavigation();
            }, NAVIGATION_UPDATE_INTERVAL_MS);
        }
        return sent;
    }

    /** The new values of a navigation that is already running. */
    updateNavigation(update: NavigationUpdate): void {
        this.navigationUpdate = update;
    }

    stopNavigation(): void {
        this.stopNavigationLoop();
        this.navigationUpdate = null;
        this.lastInstruction = '';
    }

    /**
     * Sends the destination to the cluster over the write characteristic. The
     * cluster routes with its own map engine on the other families, so only the
     * address text goes over.
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
        const previous = this.state;
        this.state = state;
        logger.info('the connection state changed', {
            service: 'ble',
            event: 'ble_state',
            count: this.reconnectAttempt,
            pathTemplate: `${previous}->${state}`,
        });
        for (const listener of this.stateListeners) {
            listener(state);
        }
        this.notifyInfo();

        /**
         * The original keeps a foreground service with a notification while the
         * cluster is connected, so the app survives with the screen off. The
         * service is not stopped when the link drops, because android does not
         * let an app in the background start a foreground service again.
         */
        if (state === 'connected' || state === 'scanning' || state === 'reconnecting') {
            void startClusterService(
                state === 'connected' ? 'Connected to your scooter' : 'Looking for your scooter',
                this.bike?.nickname ?? '',
            );
        }
    }

    private notifyInfo(): void {
        const info = this.info;
        for (const listener of this.infoListeners) {
            listener(info);
        }
    }

    /**
     * The original gives up after one retry. This one keeps looking with a
     * capped backoff, because the rider turns the bike on and expects the app
     * to find it without touching the phone.
     */
    private async runConnectionLoop(): Promise<void> {
        if (this.loopRunning) {
            return;
        }
        this.loopRunning = true;
        try {
            while (this.running) {
                const connected = await this.connectOnce();
                if (connected || !this.running) {
                    return;
                }
                await this.waitBeforeRetry();
            }
        } finally {
            this.loopRunning = false;
        }
    }

    private async connectOnce(): Promise<boolean> {
        if (!this.running || this.scanning) {
            return false;
        }
        this.scanning = true;

        try {
            if (!(await this.ble.isPoweredOn())) {
                this.setState('off');
                return false;
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
                return false;
            }

            const match = found.device;
            if (!match) {
                logger.info('the cluster was not in the scan', {
                    service: 'ble',
                    event: 'ble_scan_miss',
                    count: this.reconnectAttempt,
                });
                this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'scanning');
                return false;
            }

            this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

            try {
                const device = await this.ble.connect(match.id);
                await this.ble.discover(device, (bytes) => this.handleData(bytes));
                this.reconnectAttempt = 0;
                this.nextRetryAt = null;
                this.setState('connected');
                const { useSettingsStore } = await import('@stores/settingsStore');
                this.overspeedLimitKmh = useSettingsStore.getState().settings.overspeedLimitKmh;
                await this.startClusterUpdates();
                return true;
            } catch (error) {
                logger.warn('connect failed', {
                    event: 'connect',
                    errorName: error instanceof Error ? error.name : 'UnknownError',
                });
                this.setState('failed');
                return false;
            }
        } finally {
            this.scanning = false;
        }
    }

    private waitBeforeRetry(): Promise<void> {
        const delay =
            RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
        this.reconnectAttempt += 1;
        this.nextRetryAt = Date.now() + delay;
        logger.info('waiting before the next attempt', {
            service: 'ble',
            event: 'ble_retry',
            durationMs: delay,
            count: this.reconnectAttempt,
        });
        this.notifyInfo();

        return new Promise((resolve) => {
            this.retryResolve = () => {
                this.retryTimer = null;
                this.retryResolve = null;
                this.nextRetryAt = null;
                resolve();
            };
            this.retryTimer = setTimeout(() => this.retryResolve?.(), delay);
        });
    }

    private cancelRetry(): void {
        this.retryResolve?.();
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
        }

        this.telemetry = telemetryFromFrame(frame, this.telemetry);
        this.lastDataAt = Date.now();
        this.receivedFrames += 1;
        if (this.receivedFrames % 10 === 0) {
            logger.info('the cluster is sending data', {
                service: 'ble',
                event: 'ble_frame',
                count: this.receivedFrames,
            });
        }

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

        /**
         * The scooter greets the rider with this name. The original app sends
         * the name of the account, and this app has no account, so the name the
         * rider wrote in the settings goes, and the nickname of the bike is the
         * fallback.
         */
        const { useSettingsStore } = await import('@stores/settingsStore');
        const riderName = useSettingsStore.getState().settings.riderName.trim();
        const name = riderName || this.bike?.nickname || '';
        if (name) {
            await this.ble.write(buildRiderNamePacket(name)).catch(() => undefined);
            logger.info('the rider name was sent to the scooter', {
                service: 'ble',
                event: 'ble_rider_name',
                count: name.length,
            });
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

    private stopNavigationLoop(): void {
        if (this.navigationTimer) {
            clearInterval(this.navigationTimer);
            this.navigationTimer = null;
        }
    }

    private async writeNavigation(): Promise<boolean> {
        const update = this.navigationUpdate;
        if (!update || this.state !== 'connected') {
            return false;
        }

        try {
            await this.ble.write(buildNavigationControlPacket(update));
            if (update.instruction && update.instruction !== this.lastInstruction) {
                await this.ble.write(buildNavigationTextPacket(update.instruction));
                this.lastInstruction = update.instruction;
            }
            return true;
        } catch (error) {
            logger.warn('could not write the navigation to the cluster', {
                event: 'ble_write',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
            return false;
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
                    callState: 0,
                    voiceAssistEnabled: false,
                    now: new Date(),
                }),
            )
            .catch(() => undefined);
    }

    /** The gps and the network state travel in the navigation frame of the cluster. */
    async refreshEnvironment(): Promise<void> {
        this.gpsEnabled = await hasGps();
        this.networkAvailable = await hasNetwork();
    }

    get environment(): { gpsEnabled: boolean; networkAvailable: boolean } {
        return { gpsEnabled: this.gpsEnabled, networkAvailable: this.networkAvailable };
    }

    private checkLiveness(): void {
        if (!this.running || this.state !== 'connected') {
            return;
        }
        if (this.lastDataAt === null) {
            return;
        }
        if (Date.now() - this.lastDataAt > DATA_TIMEOUT_MS) {
            logger.warn('the cluster stopped sending data', {
                service: 'ble',
                event: 'ble_timeout',
                durationMs: Date.now() - this.lastDataAt,
                count: this.receivedFrames,
            });
            void this.reconnectNow();
        }
    }
}

export const connectionController = new ConnectionController();
