import { requireNativeModule } from 'expo-modules-core';

export interface ClusterNotification {
    package: string;
    title: string;
    text: string;
    album: string;
    isCall: boolean;
    isMedia: boolean;
}

export interface KtvsClusterModule {
    startService(title: string, text: string): Promise<void>;
    stopService(): Promise<void>;
    isIgnoringBatteryOptimizations(): Promise<boolean>;
    openBatteryOptimizationSettings(): Promise<boolean>;
    appendLog(line: string): Promise<boolean>;
    readLog(maxLines: number): Promise<string>;
    clearLog(): Promise<boolean>;
    isNotificationAccessGranted(): Promise<boolean>;
    openNotificationAccessSettings(): Promise<boolean>;
    addListener(
        event: 'notification',
        listener: (payload: ClusterNotification) => void,
    ): { remove: () => void };
}

/**
 * The native module is missing when the app runs outside a development build,
 * so every caller has to be ready to get nothing back.
 */
export const getClusterModule = (): KtvsClusterModule | null => {
    try {
        return requireNativeModule<KtvsClusterModule>('KtvsCluster');
    } catch {
        return null;
    }
};
