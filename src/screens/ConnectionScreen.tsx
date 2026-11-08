import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { PrimaryButton, showConfirm } from '@components/controls';
import { EmptyState } from '@components/feedback';
import { ConnectionRail } from '@components/dashboard';
import ScreenContainer from '@components/ScreenContainer';
import { useTheme } from '@hooks/useTheme';
import { catalogLabel } from '@config/bikeCatalog';
import { useNow } from '@hooks/useNow';
import { useBleStore } from '@stores/bleStore';
import { useGarageStore } from '@stores/garageStore';
import { RootStackParamList } from '@typings/types';
import { connectionController } from '@ble/connectionController';
import { isIgnoringBatteryOptimizations, openBatteryOptimizationSettings } from '@services/cluster.service';
import { formatAge } from '@utils/format';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export const ConnectionScreen = () => {
    const navigation = useNavigation<Navigation>();
    const route = useRoute<RouteProp<RootStackParamList, 'Connection'>>();
    const { colors } = useTheme();
    const bike = useGarageStore((state) => state.bikes.find((item) => item.id === route.params.bikeId));
    const state = useBleStore((store) => store.state);
    const info = useBleStore((store) => store.info);
    const lastUpdateAt = useBleStore((store) => store.lastUpdateAt);
    const [permissionGranted, setPermissionGranted] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [batteryRestricted, setBatteryRestricted] = useState(false);
    const now = useNow();

    useEffect(() => {
        const unbind = useBleStore.getState().bind();
        return unbind;
    }, []);

    useEffect(() => {
        void isIgnoringBatteryOptimizations().then((ignored) => setBatteryRestricted(!ignored));
    }, []);

    const retryInSeconds = info.nextRetryAt
        ? Math.max(0, Math.ceil((info.nextRetryAt - now) / 1000))
        : null;

    if (!bike) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <EmptyState description="This bike is no longer saved." title="Not found" />
            </View>
        );
    }

    const connect = async () => {
        setConnecting(true);
        try {
            const granted = await connectionController.requestPermissions();
            setPermissionGranted(granted);
            if (granted) {
                await connectionController.start(bike);
            }
        } finally {
            setConnecting(false);
        }
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ConnectionRail
                bikeNickname={bike.nickname}
                lastSeenAt={lastUpdateAt}
                state={state}
            />

            <ScreenContainer edges={['bottom']} scroll>

                <Text style={[styles.title, { color: colors.foreground }]}>{bike.nickname}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {`${catalogLabel(bike.model)} · ${bike.frameNumber}`}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>{bike.macAddress}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {`Last update ${formatAge(lastUpdateAt)}`}
                </Text>

                {!permissionGranted ? (
                    <Text style={[styles.warning, { color: colors.error }]}>
                        Bluetooth permission is needed to connect to your bike.
                    </Text>
                ) : null}

                {state !== 'connected' && info.attempt > 0 ? (
                    <Text style={[styles.warning, { color: colors.mutedForeground }]}>
                        {`Looking for the scooter. Attempt ${info.attempt}${retryInSeconds !== null ? `, next try in ${retryInSeconds} s` : ''
                            }.`}
                    </Text>
                ) : null}

                {batteryRestricted ? (
                    <View style={styles.battery}>
                        <Text style={[styles.warning, { color: colors.foreground }]}>
                            Android can stop the app while the screen is off. Let the app run
                            without the battery saver so the guidance keeps reaching the scooter.
                        </Text>
                        <PrimaryButton
                            label="Open the battery settings"
                            onPress={() => void openBatteryOptimizationSettings()}
                            variant="secondary"
                        />
                    </View>
                ) : null}

                <View style={styles.actions}>
                    <PrimaryButton
                        label="Connect now"
                        loading={connecting}
                        onPress={() => void connect()}
                    />
                    <PrimaryButton
                        label="Disconnect"
                        onPress={() => void connectionController.stop()}
                        variant="secondary"
                    />
                    <PrimaryButton
                        label="Edit bike"
                        onPress={() => navigation.navigate('EditBike', { bikeId: bike.id })}
                        variant="ghost"
                    />
                    <PrimaryButton
                        label="Delete bike"
                        onPress={() =>
                            showConfirm(
                                `Delete ${bike.nickname}?`,
                                'This removes the bike, its ride history and its saved routes from this device. This cannot be undone.',
                                'Delete',
                                () => {
                                    void useGarageStore.getState().remove(bike.id);
                                    navigation.goBack();
                                },
                                true,
                            )
                        }
                        variant="danger"
                    />
                </View>

            </ScreenContainer>
        </View>
    );
};

export const BikeDetailsScreen = () => {
    const navigation = useNavigation<Navigation>();
    const route = useRoute<RouteProp<RootStackParamList, 'Connection'>>();
    const { colors } = useTheme();
    const bike = useGarageStore((state) => state.bikes.find((item) => item.id === route.params.bikeId));

    if (!bike) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <EmptyState description="This bike is no longer saved." title="Not found" />
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScreenContainer edges={['bottom']} scroll>

                <Text style={[styles.title, { color: colors.foreground }]}>{bike.nickname}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {`${catalogLabel(bike.model)} · ${bike.frameNumber}`}
                </Text>

                <View style={styles.actions}>
                    <PrimaryButton
                        label="Connection"
                        onPress={() => navigation.navigate('Connection', { bikeId: bike.id })}
                    />
                    <PrimaryButton
                        label="Edit"
                        onPress={() => navigation.navigate('EditBike', { bikeId: bike.id })}
                        variant="secondary"
                    />
                    <PrimaryButton
                        label={bike.isActive ? 'Active bike' : 'Set as active'}
                        disabled={bike.isActive}
                        onPress={() => void useGarageStore.getState().activate(bike.id)}
                        variant="ghost"
                    />
                </View>

            </ScreenContainer>
        </View>
    );
};

const styles = StyleSheet.create({
    actions: {
        gap: spacing.md,
        marginTop: layout.sectionGap,
    },
    battery: {
        gap: spacing.md,
        marginTop: layout.sectionGap,
    },
    meta: {
        ...typography.body,
        marginBottom: spacing.xs,
    },
    screen: {
        flex: 1,
    },
    title: {
        ...typography.title,
        marginBottom: spacing.sm,
    },
    warning: {
        ...typography.caption,
        marginTop: spacing.md,
    },
});

export default ConnectionScreen;
