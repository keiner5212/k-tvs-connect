import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@utils/logger';

const CHANNEL_ID = 'route-alerts';

/**
 * While the app is on the screen the notification is not presented by itself,
 * the handler decides. The rider watches the map and the phone at the same
 * time, so the banner has to show up in both cases.
 */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

let channelReady = false;

/**
 * The channel of the ride notifications. The rider reads them with the phone
 * in the pocket, so they have to make a sound.
 */
const ensureChannel = async (): Promise<void> => {
    if (channelReady || Platform.OS !== 'android') {
        return;
    }
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Route alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 300, 200, 300],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    channelReady = true;
};

/**
 * Android asks for the permission to post notifications. The rider only needs
 * it while the route is running.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return true;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
        return true;
    }
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
};

/**
 * Posts an alert of the ride on the phone.
 */
export const notifyRide = async (title: string, body: string): Promise<void> => {
    try {
        await ensureChannel();
        await Notifications.scheduleNotificationAsync({
            content: {
                body,
                sound: 'default',
                title,
            },
            trigger: null,
        });
    } catch (error) {
        logger.warn('the ride notification could not be posted', {
            service: 'notifications',
            event: 'notify_failed',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
    }
};
