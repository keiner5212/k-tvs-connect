import { ClusterNotification, getClusterModule } from '@cluster';
import { connectionController } from '@ble/connectionController';
import {
    buildCallerInfoPacket,
    buildMusicPacket,
    buildMusicStatePacket,
} from '@ble/protocol';
import { logger } from '@utils/logger';

/**
 * The cluster shows the name of the caller and the title of the song. The
 * original app reads the notifications of the phone for that, and so does this
 * one, but only when the user gives the app the access to the notifications.
 */
class NotificationBridge {
    private subscription: { remove: () => void } | null = null;

    private lastMusicTitle = '';

    start(): void {
        if (this.subscription) {
            return;
        }
        const native = getClusterModule();
        if (!native) {
            return;
        }
        try {
            this.subscription = native.addListener('notification', (payload) => {
                void this.handle(payload);
            });
            logger.info('the app is listening to the notifications', {
                service: 'ble',
                event: 'ble_notifications',
            });
        } catch (error) {
            logger.warn('the notifications could not be read', {
                service: 'ble',
                event: 'ble_notifications',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
        }
    }

    private async handle(payload: ClusterNotification): Promise<void> {
        if (!payload.title && !payload.text) {
            return;
        }

        if (payload.isCall) {
            const name = payload.title.trim();
            const number = payload.text.trim();
            await connectionController.sendPacket(
                buildCallerInfoPacket(name || number, name ? 2 : 1),
            );
            logger.info('the caller went to the cluster', {
                service: 'ble',
                event: 'ble_caller',
                count: (name || number).length,
            });
            return;
        }

        if (payload.isMedia) {
            const title = payload.title.trim();
            const artist = payload.text.trim();
            if (title && title !== this.lastMusicTitle) {
                this.lastMusicTitle = title;
                await connectionController.sendPacket(buildMusicPacket('song', title));
                if (artist) {
                    await connectionController.sendPacket(buildMusicPacket('artist', artist));
                }
                if (payload.album) {
                    await connectionController.sendPacket(buildMusicPacket('album', payload.album));
                }
                logger.info('the song went to the cluster', {
                    service: 'ble',
                    event: 'ble_music',
                    count: title.length,
                });
            }
            await connectionController.sendPacket(buildMusicStatePacket(0, 0, 0, 60));
        }
    }

    stop(): void {
        this.subscription?.remove();
        this.subscription = null;
    }
}

export const notificationBridge = new NotificationBridge();
