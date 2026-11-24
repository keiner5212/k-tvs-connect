import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ErrorBoundary from '@components/ErrorBoundary';
import { RootNavigator, navigationRef } from '@/navigation/RootNavigator';
import { openDatabase } from '@services/db/database';
import { useCameraStore } from '@stores/cameraStore';
import { useSettingsStore } from '@stores/settingsStore';
import { parseSharedLocation } from '@services/sharedLocation';
import { useLocationStore } from '@stores/locationStore';
import { useMapStore } from '@stores/mapStore';
import { notifyRide } from '@services/notifications.service';
import { formatDuration } from '@utils/format';
import '@/config/i18n';
import { darkTheme, typography } from '@config/theme';

export default function App() {
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        /**
         * While a route is on screen, every new position refreshes what is
         * left of it.
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
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        /**
         * The ride has two alerts: it starts and it ends. The rider reads them
         * with the phone in the pocket, not on the screen.
         */
        let started = false;
        let arrived = false;

        const unsubscribe = useMapStore.subscribe((state) => {
            const navigation = state.navigation;
            if (!navigation.started) {
                started = false;
                arrived = false;
                return;
            }

            if (!started && navigation.ridingSince) {
                started = true;
                const destination = state.destination?.name ?? 'your destination';
                const seconds = state.estimate?.seconds ?? 0;
                void notifyRide(
                    'Route started',
                    seconds > 0
                        ? `To ${destination}. ${formatDuration(seconds)} to the destination.`
                        : `To ${destination}.`,
                );
            }

            if (!arrived && navigation.arrived) {
                arrived = true;
                const seconds = navigation.ridingSince
                    ? Math.round((Date.now() - navigation.ridingSince) / 1000)
                    : 0;
                void notifyRide(
                    'You have arrived',
                    seconds > 0
                        ? `End of the route. Park safely. You rode it in ${formatDuration(seconds)}.`
                        : 'End of the route. Park safely.',
                );
            }
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
                setFailed(true);
                return;
            }
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
        return (
            <View style={[styles.center, { backgroundColor: darkTheme.background }]}>
                <Text style={styles.failed}>
                    {failed
                        ? 'The local database could not be opened. Restart the app.'
                        : 'Opening the local database...'}
                </Text>
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <ErrorBoundary>
                <RootNavigator />
            </ErrorBoundary>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    center: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    failed: {
        ...typography.body,
        color: darkTheme.mutedForeground,
        textAlign: 'center',
    },
});
