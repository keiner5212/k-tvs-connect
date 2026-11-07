import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AlertBanner, EmptyState, StaleNotice } from '@components/feedback';
import { ConnectionRail, MetricTile, SpeedGauge } from '@components/dashboard';
import { useTheme } from '@hooks/useTheme';
import { useBleStore } from '@stores/bleStore';
import { useGarageStore } from '@stores/garageStore';
import { useSettingsStore } from '@stores/settingsStore';
import { RootStackParamList, VehicleAlert } from '@typings/types';
import { connectionController } from '@ble/connectionController';
import { formatAge, isStale, speedUnit } from '@utils/format';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export const DashboardScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const activeBike = useGarageStore((state) => state.bikes.find((bike) => bike.isActive) ?? null);
    const connectionState = useBleStore((state) => state.state);
    const telemetry = useBleStore((state) => state.telemetry);
    const lastUpdateAt = useBleStore((state) => state.lastUpdateAt);
    const { settings } = useSettingsStore();

    useEffect(() => {
        const unbind = useBleStore.getState().bind();
        return unbind;
    }, []);

    useEffect(() => {
        if (activeBike) {
            void connectionController.requestPermissions().then((granted) => {
                if (granted) {
                    void connectionController.start(activeBike, null);
                }
            });
        }
    }, [activeBike]);

    const alerts = useMemo<VehicleAlert[]>(() => {
        if (!telemetry) {
            return [];
        }
        const raised: VehicleAlert[] = [];

        if (telemetry.fuelLevelPercent > 0 && telemetry.fuelLevelPercent <= 10) {
            raised.push({
                id: 'low_fuel',
                kind: 'low_fuel',
                title: 'Low fuel',
                body: 'Fuel level is low.',
                raisedAt: telemetry.receivedAt,
            });
        }
        if (telemetry.sideStandDown) {
            raised.push({
                id: 'side_stand',
                kind: 'side_stand',
                title: 'Side stand down',
                body: 'The side stand is down. The scooter may cut out.',
                raisedAt: telemetry.receivedAt,
            });
        }
        if (telemetry.turnSignal === 'left') {
            raised.push({
                id: 'turn_left',
                kind: 'turn_signal',
                title: 'Left turn signal on',
                body: '',
                raisedAt: telemetry.receivedAt,
            });
        }
        if (telemetry.turnSignal === 'right') {
            raised.push({
                id: 'turn_right',
                kind: 'turn_signal',
                title: 'Right turn signal on',
                body: '',
                raisedAt: telemetry.receivedAt,
            });
        }
        if (telemetry.speedKmh > settings.overspeedLimitKmh) {
            raised.push({
                id: 'overspeed',
                kind: 'overspeed',
                title: 'Overspeed',
                body: `You are over your ${settings.overspeedLimitKmh} limit.`,
                raisedAt: telemetry.receivedAt,
            });
        }

        return raised;
    }, [telemetry, settings.overspeedLimitKmh]);

    if (!activeBike) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <EmptyState
                    title="No scooter selected"
                    description="Add a scooter in the Garage to see its live data here."
                />
            </View>
        );
    }

    const stale = isStale(lastUpdateAt);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ConnectionRail
                bikeNickname={activeBike.nickname}
                lastSeenAt={lastUpdateAt}
                onPress={() => navigation.navigate('Connection', { bikeId: activeBike.id })}
                state={connectionState}
            />

            <ScrollView contentContainerStyle={styles.content}>
                {stale && lastUpdateAt ? (
                    <StaleNotice
                        ageSeconds={Math.round((Date.now() - lastUpdateAt) / 1000)}
                        onRetry={() => void connectionController.reconnectNow()}
                    />
                ) : null}

                <AlertBanner alerts={alerts} />

                <SpeedGauge
                    isStale={stale}
                    overspeedLimitKmh={settings.overspeedLimitKmh}
                    unit={settings.unitSystem}
                    value={telemetry?.speedKmh ?? 0}
                />

                <View style={styles.grid}>
                    <MetricTile
                        isStale={stale}
                        label="Engine"
                        unit="rpm"
                        value={Math.round(telemetry?.engineRpm ?? 0).toString()}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Fuel"
                        unit="%"
                        value={Math.round(telemetry?.fuelLevelPercent ?? 0).toString()}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Odometer"
                        unit="km"
                        value={(telemetry?.odometerKm ?? 0).toFixed(1)}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Average speed"
                        unit={speedUnit(settings.unitSystem)}
                        value={Math.round(telemetry?.averageSpeedKmh ?? 0).toString()}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Top speed"
                        unit={speedUnit(settings.unitSystem)}
                        value={Math.round(telemetry?.topSpeedKmh ?? 0).toString()}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Throttle"
                        unit="%"
                        value={Math.round(telemetry?.throttlePercent ?? 0).toString()}
                    />
                </View>

                <Text style={[styles.footer, { color: colors.mutedForeground }]}>
                    {`Last update ${formatAge(lastUpdateAt)}`}
                </Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    content: {
        padding: layout.screenPadding,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    footer: {
        ...typography.caption,
        marginTop: spacing.lg,
        textAlign: 'center',
    },
});

export default DashboardScreen;
