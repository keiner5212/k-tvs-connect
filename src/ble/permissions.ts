import { PermissionsAndroid, Platform } from 'react-native';

import { logger } from '@utils/logger';

/**
 * Android 12 and later ask for the bluetooth permissions at runtime. Without
 * them the scan fails with the error 101, BluetoothUnauthorized, and the app
 * does not see a single device.
 */
export const ensureBlePermissions = async (): Promise<boolean> => {
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
