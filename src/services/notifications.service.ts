import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@utils/logger';

const CHANNEL_ID = 'turn-by-turn';

let channelReady = false;

/**
 * The channel of the turn by turn notifications. The rider reads them with the
 * phone in the pocket, so they have to make a sound.
 */
const ensureChannel = async (): Promise<void> => {
    if (channelReady || Platform.OS !== 'android') {
        return;
    }
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Turn by turn',
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
export const requestTurnPermission = async (): Promise<boolean> => {
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
 * Posts the indication of the next turn on the phone.
 */
export const notifyTurn = async (title: string, body: string): Promise<void> => {
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
        logger.warn('the turn notification could not be posted', {
            service: 'notifications',
            event: 'notify_failed',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        });
    }
};
