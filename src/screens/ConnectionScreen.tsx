import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { PrimaryButton, showConfirm } from '@components/controls';
import { EmptyState } from '@components/feedback';
import { ConnectionRail } from '@components/dashboard';
import { useTheme } from '@hooks/useTheme';
import { useBleStore } from '@stores/bleStore';
import { useGarageStore } from '@stores/garageStore';
import { RootStackParamList } from '@typings/types';
import { connectionController } from '@ble/connectionController';
import { formatAge } from '@utils/format';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export const ConnectionScreen = () => {
    const navigation = useNavigation<Navigation>();
    const route = useRoute<RouteProp<RootStackParamList, 'Connection'>>();
    const { colors } = useTheme();
        const insets = useSafeAreaInsets();
    const bike = useGarageStore((state) => state.bikes.find((item) => item.id === route.params.bikeId));
    const state = useBleStore((store) => store.state);
    const lastUpdateAt = useBleStore((store) => store.lastUpdateAt);
    const [permissionGranted, setPermissionGranted] = useState(true);

    useEffect(() => {
        const unbind = useBleStore.getState().bind();
        return unbind;
    }, []);

    if (!bike) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <EmptyState description="This scooter is no longer saved." title="Not found" />
            </View>
        );
    }

    const connect = async () => {
        const granted = await connectionController.requestPermissions();
        setPermissionGranted(granted);
        if (granted) {
            await connectionController.start(bike);
        }
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ConnectionRail
                bikeNickname={bike.nickname}
                lastSeenAt={lastUpdateAt}
                state={state}
            />

            <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + layout.screenPadding }]}
      >
                <Text style={[styles.title, { color: colors.foreground }]}>{bike.nickname}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {`${bike.model} · ${bike.frameNumber}`}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>{bike.macAddress}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {`Last update ${formatAge(lastUpdateAt)}`}
                </Text>

                {!permissionGranted ? (
                    <Text style={[styles.warning, { color: colors.error }]}>
                        Bluetooth permission is needed to connect to your scooter.
                    </Text>
                ) : null}

                <View style={styles.actions}>
                    <PrimaryButton label="Connect now" onPress={() => void connect()} />
                    <PrimaryButton
                        label="Disconnect"
                        onPress={() => void connectionController.stop()}
                        variant="secondary"
                    />
                    <PrimaryButton
                        label="Edit scooter"
                        onPress={() => navigation.navigate('EditBike', { bikeId: bike.id })}
                        variant="ghost"
                    />
                    <PrimaryButton
                        label="Delete scooter"
                        onPress={() =>
                            showConfirm(
                                `Delete ${bike.nickname}?`,
                                'This removes the scooter, its ride history and its saved routes from this device. This cannot be undone.',
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
            </ScrollView>
        </View>
    );
};

export const BikeDetailsScreen = () => {
    const navigation = useNavigation<Navigation>();
    const route = useRoute<RouteProp<RootStackParamList, 'Connection'>>();
    const { colors } = useTheme();
        const insets = useSafeAreaInsets();
    const bike = useGarageStore((state) => state.bikes.find((item) => item.id === route.params.bikeId));

    if (!bike) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <EmptyState description="This scooter is no longer saved." title="Not found" />
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + layout.screenPadding }]}
      >
                <Text style={[styles.title, { color: colors.foreground }]}>{bike.nickname}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {`${bike.model} · ${bike.frameNumber}`}
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
                        label={bike.isActive ? 'Active scooter' : 'Set as active'}
                        disabled={bike.isActive}
                        onPress={() => void useGarageStore.getState().activate(bike.id)}
                        variant="ghost"
                    />
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    actions: {
        gap: spacing.md,
        marginTop: layout.sectionGap,
    },
    content: {
        padding: layout.screenPadding,
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
