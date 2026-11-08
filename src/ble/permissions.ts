import { PermissionsAndroid, Platform } from 'react-native';
import type { Permission } from 'react-native/Libraries/PermissionsAndroid/PermissionsAndroid';

import { logger } from '@utils/logger';

const blePermissions = (): Permission[] =>
    Platform.OS !== 'android'
        ? []
        : Platform.Version >= 31
            ? [
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]
            : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

/** True when the permissions are already there, without asking for them. */
export const hasBlePermissions = async (): Promise<boolean> => {
    const permissions = blePermissions();
    if (permissions.length === 0) {
        return true;
    }
    const already = await Promise.all(
        permissions.map((permission) => PermissionsAndroid.check(permission)),
    );
    return already.every((value) => value === true);
};

/**
 * Android 12 and later ask for the bluetooth permissions at runtime. Without
 * them the scan fails with the error 101, BluetoothUnauthorized, and the app
 * does not see a single device.
 */
export const ensureBlePermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return true;
    }

    const permissions = blePermissions();

    const already = await Promise.all(
        permissions.map((permission) => PermissionsAndroid.check(permission)),
    );
    if (already.every((value) => value === true)) {
        return true;
    }

    logger.info('the bluetooth permissions were asked for', {
        service: 'ble',
        event: 'ble_permissions',
    });

    const result = await PermissionsAndroid.requestMultiple(permissions);
    const granted = Object.values(result).every(
        (value) => value === PermissionsAndroid.RESULTS.GRANTED,
    );
    if (!granted) {
        logger.warn('the bluetooth permissions were refused', {
            service: 'ble',
            event: 'ble_permissions',
        });
    }
    return granted;
};
