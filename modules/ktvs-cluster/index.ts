import { requireNativeModule } from 'expo-modules-core';

export interface KtvsClusterModule {
    startService(title: string, text: string): Promise<void>;
    stopService(): Promise<void>;
    isIgnoringBatteryOptimizations(): Promise<boolean>;
    openBatteryOptimizationSettings(): Promise<boolean>;
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
