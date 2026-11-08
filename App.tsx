import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ErrorBoundary from '@components/ErrorBoundary';
import { RootNavigator, navigationRef } from '@/navigation/RootNavigator';
import { openDatabase } from '@services/db/database';
import { useCameraStore } from '@stores/cameraStore';
import { useGarageStore } from '@stores/garageStore';
import { useSettingsStore } from '@stores/settingsStore';
import { bindRideTracker, rideTracker } from '@services/rideTracker';
import { connectionController } from '@ble/connectionController';
import { parseSharedLocation } from '@services/sharedLocation';
import { useLocationStore } from '@stores/locationStore';
import { useMapStore } from '@stores/mapStore';
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
        /**
         * While the navigation runs, every new position refreshes what is left on
         * the route and what the bike shows.
         */
        const unsubscribe = useLocationStore.subscribe((state, previous) => {
            if (!state.position || state.position === previous.position) {
                return;
            }

            const map = useMapStore.getState();
            if (!map.navigation.started) {
                return;
            }

            map.updateNavigation(state.position[0], state.position[1]);
            const progress = useMapStore.getState().navigation;

            void connectionController.sendNavigationUpdate({
                distanceToNextManeuverMeters: Math.round(progress.distanceToManeuverMeters),
                timeLeftMinutes: Math.round(progress.timeLeftSeconds / 60),
                totalDistanceLeftMeters: Math.round(progress.distanceLeftMeters),
                pictogramId: 0,
                navigationOn: !progress.arrived,
                instruction: progress.instruction,
            });
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        /**
         * A place shared from another map app becomes the destination and the
         * route is computed from where the rider is right now.
         */
        const handleUrl = async (url: string | null) => {
            if (!url) {
                return;
            }

            const place = parseSharedLocation(url);
            if (!place) {
                return;
            }

            const { setDestination, compute } = useMapStore.getState();
            setDestination({
                id: `shared-${place.latitude}-${place.longitude}`,
                name: place.name ?? 'Shared place',
                address: place.name ?? `${place.latitude}, ${place.longitude}`,
                latitude: place.latitude,
                longitude: place.longitude,
            });

            if (navigationRef.isReady()) {
                navigationRef.navigate('Main', { screen: 'Map' });
            }

            const position = useLocationStore.getState().position;
            if (position) {
                await compute(position[0], position[1]);
            } else {
                void useLocationStore.getState().request();
            }
        };

        void Linking.getInitialURL().then(handleUrl);
        const subscription = Linking.addEventListener('url', (event) => {
            void handleUrl(event.url);
        });

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

        return () => {
            subscription.remove();
        };
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
