import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AlertBanner, EmptyState, StaleNotice } from '@components/feedback';
import { ConnectionRail, MetricTile, SpeedGauge, WeekBars } from '@components/dashboard';
import { useNow } from '@hooks/useNow';
import { useTheme } from '@hooks/useTheme';
import { useBleStore } from '@stores/bleStore';
import { useGarageStore } from '@stores/garageStore';
import { useSettingsStore } from '@stores/settingsStore';
import { RootStackParamList, RideSummary, VehicleAlert } from '@typings/types';
import { connectionController } from '@ble/connectionController';
import { listRides } from '@services/db/rideRepository';
import { formatAge, formatDistance, formatDuration, isStale, speedUnit } from '@utils/format';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export const DashboardScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const activeBike = useGarageStore((state) => state.bikes.find((bike) => bike.isActive) ?? null);
    const connectionState = useBleStore((state) => state.state);
    const telemetry = useBleStore((state) => state.telemetry);
    const lastUpdateAt = useBleStore((state) => state.lastUpdateAt);
    const { settings } = useSettingsStore();
    const now = useNow();
    const [rides, setRides] = useState<RideSummary[]>([]);

    useEffect(() => {
        const unbind = useBleStore.getState().bind();
        return unbind;
    }, []);

    useEffect(() => {
        const load = async () => {
            setRides(activeBike ? await listRides(activeBike.id) : []);
        };
        void load();
    }, [activeBike, lastUpdateAt]);

    useEffect(() => {
        if (activeBike) {
            void connectionController.requestPermissions().then((granted) => {
                if (granted) {
                    void connectionController.start(activeBike);
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
                <View style={{ paddingTop: insets.top + spacing.lg }}>
                    <EmptyState
                        title="No scooter selected"
                        description="Add a scooter in the Garage to see its live data here."
                    />
                </View>
            </View>
        );
    }

    const stale = isStale(lastUpdateAt, now);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ConnectionRail
                bikeNickname={activeBike.nickname}
                lastSeenAt={lastUpdateAt}
                onPress={() => navigation.navigate('Connection', { bikeId: activeBike.id })}
                state={connectionState}
            />

            <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + layout.screenPadding },
        ]}
      >
                {stale && lastUpdateAt ? (
                    <StaleNotice
                        ageSeconds={Math.round((now - lastUpdateAt) / 1000)}
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

                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>TRIP</Text>
                <View style={styles.grid}>
                    <MetricTile
                        isStale={stale}
                        label="Trip distance"
                        unit="km"
                        value={(telemetry?.tripDistanceKm ?? 0).toFixed(2)}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Trip time"
                        unit="min"
                        value={Math.round((telemetry?.tripTimeSeconds ?? 0) / 60).toString()}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Trip mileage"
                        unit="km/l"
                        value={(telemetry?.tripMileage ?? 0).toFixed(1)}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Range"
                        unit="km"
                        value={Math.round(telemetry?.cruisingRange ?? 0).toString()}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Gear"
                        value={(telemetry?.gearPosition ?? 0).toString()}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Engine temp"
                        unit="C"
                        value={Math.round(telemetry?.engineTemperature ?? 0).toString()}
                    />
                    <MetricTile
                        hint={telemetry?.bestLapMs ? `best ${(telemetry.bestLapMs / 1000).toFixed(1)} s` : undefined}
                        isStale={stale}
                        label="Lap"
                        value={(telemetry?.lapNumber ?? 0).toString()}
                    />
                    <MetricTile
                        isStale={stale}
                        label="Lean angle"
                        unit="deg"
                        value={Math.round(telemetry?.leanAngleDegree ?? 0).toString()}
                    />
                </View>

                {rides.length > 0 ? (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                            RIDES
                        </Text>
                        <WeekBars days={weekDays(rides)} />
                        {rides.slice(0, 5).map((ride) => (
                            <View key={ride.id} style={styles.rideRow}>
                                <Text style={[styles.rideText, { color: colors.foreground }]}>
                                    {`${formatDistance(ride.distanceMeters, settings.unitSystem)} in ${formatDuration(ride.durationSeconds)}`}
                                </Text>
                                <Text style={[styles.rideText, { color: colors.mutedForeground }]}>
                                    {`max ${Math.round(ride.maxSpeedKmh)} ${speedUnit(settings.unitSystem)}`}
                                </Text>
                            </View>
                        ))}
                    </>
                ) : null}

                <Text style={[styles.footer, { color: colors.mutedForeground }]}>
                    {`Last update ${formatAge(lastUpdateAt, now)}`}
                </Text>
            </ScrollView>
        </View>
    );
};

const weekDays = (rides: RideSummary[]): { label: string; distanceKm: number }[] => {
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const days = labels.map((label) => ({ label, distanceKm: 0 }));

    for (const ride of rides) {
        const date = new Date(ride.startedAt);
        const mondayIndex = (date.getDay() + 6) % 7;
        days[mondayIndex].distanceKm += ride.distanceMeters / 1000;
    }

    return days;
};

const styles = StyleSheet.create({
    content: {
        padding: layout.screenPadding,
    },
    footer: {
        ...typography.caption,
        marginTop: spacing.lg,
        textAlign: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    rideRow: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 44,
        paddingVertical: spacing.sm,
    },
    rideText: {
        ...typography.body,
    },
    screen: {
        flex: 1,
    },
    sectionTitle: {
        ...typography.label,
        letterSpacing: 0.08,
        marginBottom: spacing.md,
        marginTop: spacing.lg,
        textTransform: 'uppercase',
    },
});

export default DashboardScreen;
