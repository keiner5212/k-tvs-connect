import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ErrorBoundary from '@components/ErrorBoundary';
import { RootNavigator } from '@/navigation/RootNavigator';
import { openDatabase } from '@services/db/database';
import { useCameraStore } from '@stores/cameraStore';
import { useGarageStore } from '@stores/garageStore';
import { useSettingsStore } from '@stores/settingsStore';
import { bindRideTracker, rideTracker } from '@services/rideTracker';
import '@/config/i18n';

export default function App() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const unbind = bindRideTracker();
        const unsubscribe = useGarageStore.subscribe((state, previous) => {
            const active = state.bikes.find((bike) => bike.isActive);
            const before = previous.bikes.find((bike) => bike.isActive);
            if (active?.id !== before?.id) {
                if (active) {
                    rideTracker.start(active.id);
                } else {
                    rideTracker.stop();
                }
            }
        });

        return () => {
            unbind();
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                await openDatabase();
            } catch {
                setReady(false);
                return;
            }
            await useGarageStore.getState().load();
            await useSettingsStore.getState().load();
            setReady(true);
            void useCameraStore.getState().refresh();
        };
        void bootstrap();
    }, []);

    if (!ready) {
        return <View style={{ flex: 1 }} />;
    }

    return (
        <SafeAreaProvider>
            <ErrorBoundary>
                <RootNavigator />
            </ErrorBoundary>
        </SafeAreaProvider>
    );
}
