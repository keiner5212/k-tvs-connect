import { getClusterModule } from '@cluster';
import { describeError, logger } from '@utils/logger';

/**
 * The foreground service keeps the app alive with the screen off, so the
 * connection with the cluster and the navigation packets keep flowing while
 * the rider drives.
 */
export const startClusterService = async (title: string, text: string): Promise<void> => {
    const native = getClusterModule();
    if (!native) {
        return;
    }
    try {
        await native.startService(title, text);
    } catch (error) {
        logger.warn(`the foreground service did not start: ${describeError(error)}`, {
            event: 'cluster_service',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
    }
};

export const stopClusterService = async (): Promise<void> => {
    const native = getClusterModule();
    if (!native) {
        return;
    }
    try {
        await native.stopService();
    } catch (error) {
        logger.warn('the foreground service did not stop', {
            event: 'cluster_service',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
    }
};

/** True when the user already let the app run without the battery saver. */
export const isIgnoringBatteryOptimizations = async (): Promise<boolean> => {
    const native = getClusterModule();
    if (!native) {
        return false;
    }
    try {
        return await native.isIgnoringBatteryOptimizations();
    } catch {
        return false;
    }
};

/** Opens the system dialog that asks the user to exempt the app from doze. */
export const openBatteryOptimizationSettings = async (): Promise<void> => {
    const native = getClusterModule();
    if (!native) {
        return;
    }
    try {
        await native.openBatteryOptimizationSettings();
    } catch (error) {
        logger.warn('the battery settings did not open', {
            event: 'cluster_service',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
    }
};

/** True when the phone already shares a key with the cluster. */
export const isBonded = async (macAddress: string): Promise<boolean> => {
    const native = getClusterModule();
    if (!native) {
        return false;
    }
    try {
        return await native.isBonded(macAddress);
    } catch {
        return false;
    }
};

/**
 * Asks android for the pairing with the cluster. The system shows the pairing
 * dialog, so the rider has to accept it before the link can come up.
 */
export const bondDevice = async (macAddress: string): Promise<boolean> => {
    const native = getClusterModule();
    if (!native) {
        return false;
    }
    try {
        return await native.bondDevice(macAddress);
    } catch (error) {
        logger.warn(`the pairing with the cluster failed: ${describeError(error)}`, {
            event: 'ble_bond',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        return false;
    }
};

/** Android 13 and later hide the notification of the service without this. */
export const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';
