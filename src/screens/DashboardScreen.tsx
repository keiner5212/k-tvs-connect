import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AlertBanner, Banner, EmptyState, StaleNotice } from '@components/feedback';
import { ConnectionRail, MetricTile, SpeedGauge, WeekBars } from '@components/dashboard';
import { useNow } from '@hooks/useNow';
import { useTheme } from '@hooks/useTheme';
import { useBleStore } from '@stores/bleStore';
import { useGarageStore } from '@stores/garageStore';
import { useSettingsStore } from '@stores/settingsStore';
import { RootStackParamList, RideSummary, VehicleAlert } from '@typings/types';
import { connectionController } from '@ble/connectionController';
import { isIgnoringBatteryOptimizations, openBatteryOptimizationSettings } from '@services/cluster.service';
import { listRides } from '@services/db/rideRepository';
import { formatAge, formatDistance, formatDuration, isStale, speedUnit } from '@utils/format';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

interface MetricTileValue {
    label: string;
    value: string;
    unit?: string;
    hint?: string;
}

export const DashboardScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const activeBike = useGarageStore((state) => state.bikes.find((bike) => bike.isActive) ?? null);
    const connectionState = useBleStore((state) => state.state);
    const connectionInfo = useBleStore((state) => state.info);
    const telemetry = useBleStore((state) => state.telemetry);
    const lastUpdateAt = useBleStore((state) => state.lastUpdateAt);
    const { settings } = useSettingsStore();
    const now = useNow();
    const [rides, setRides] = useState<RideSummary[]>([]);
    const [batteryRestricted, setBatteryRestricted] = useState(false);

    useEffect(() => {
        const unbind = useBleStore.getState().bind();
        return unbind;
    }, []);

    useEffect(() => {
        void isIgnoringBatteryOptimizations().then((ignored) => setBatteryRestricted(!ignored));
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

        if (
            telemetry.fuelLevelPercent !== null &&
            telemetry.fuelLevelPercent > 0 &&
            telemetry.fuelLevelPercent <= 10
        ) {
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
                body: 'The side stand is down. The bike may cut out.',
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
        if (telemetry.speedKmh !== null && telemetry.speedKmh > settings.overspeedLimitKmh) {
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

    /**
     * The dashboard shows only what the bike really sends. A value that the
     * cluster has not sent yet is null, and it does not get a tile.
     */
    const speed = telemetry?.speedKmh ?? null;

    const groups = useMemo<{ title: string | null; tiles: MetricTileValue[] }[]>(() => {
        if (!telemetry) {
            return [];
        }
        const unit = speedUnit(settings.unitSystem);
        const live: MetricTileValue[] = [];
        const trip: MetricTileValue[] = [];
        const add = (
            list: MetricTileValue[],
            label: string,
            value: number | null,
            format: (raw: number) => string,
            tileUnit?: string,
            hint?: string,
        ) => {
            if (value === null) {
                return;
            }
            list.push({ label, value: format(value), unit: tileUnit, hint });
        };

        add(live, 'Engine', telemetry.engineRpm, (v) => Math.round(v).toString(), 'rpm');
        add(live, 'Fuel', telemetry.fuelLevelPercent, (v) => Math.round(v).toString(), '%');
        add(live, 'Odometer', telemetry.odometerKm, (v) => v.toFixed(1), 'km');
        add(live, 'Average speed', telemetry.averageSpeedKmh, (v) => Math.round(v).toString(), unit);
        add(live, 'Top speed', telemetry.topSpeedKmh, (v) => Math.round(v).toString(), unit);
        add(live, 'Throttle', telemetry.throttlePercent, (v) => Math.round(v).toString(), '%');

        add(trip, 'Trip distance', telemetry.tripDistanceKm, (v) => v.toFixed(2), 'km');
        add(trip, 'Trip time', telemetry.tripTimeSeconds, (v) => Math.round(v / 60).toString(), 'min');
        add(trip, 'Trip mileage', telemetry.tripMileage, (v) => v.toFixed(1), 'km/l');
        add(trip, 'Range', telemetry.cruisingRange, (v) => Math.round(v).toString(), 'km');
        add(trip, 'Gear', telemetry.gearPosition, (v) => v.toString());
        add(trip, 'Engine temp', telemetry.engineTemperature, (v) => Math.round(v).toString(), 'C');
        add(
            trip,
            'Lap',
            telemetry.lapNumber,
            (v) => v.toString(),
            undefined,
            telemetry.bestLapMs ? `best ${(telemetry.bestLapMs / 1000).toFixed(1)} s` : undefined,
        );
        add(trip, 'Lean angle', telemetry.leanAngleDegree, (v) => Math.round(v).toString(), 'deg');

        return [
            { title: null, tiles: live },
            { title: 'TRIP', tiles: trip },
        ].filter((group) => group.tiles.length > 0);
    }, [telemetry, settings.unitSystem]);

    if (!activeBike) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={{ paddingTop: insets.top + spacing.lg }}>
                    <EmptyState
                        title="No bike selected"
                        description="Add a bike in the Garage to see its live data here."
                    />
                </View>
            </View>
        );
    }

    const stale = isStale(lastUpdateAt, now);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={{ paddingTop: insets.top }}>
                <ConnectionRail
                    bikeNickname={activeBike.nickname}
                    lastSeenAt={lastUpdateAt}
                    onPress={() => navigation.navigate('Connection', { bikeId: activeBike.id })}
                    reason={connectionInfo.reason}
                    state={connectionState}
                />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {stale && lastUpdateAt ? (
                    <StaleNotice
                        ageSeconds={Math.round((now - lastUpdateAt) / 1000)}
                        onRetry={() => void connectionController.reconnectNow()}
                    />
                ) : null}

                <AlertBanner alerts={alerts} />

                {batteryRestricted ? (
                    <Banner
                        actionLabel="Fix"
                        message="Android can stop the app while the screen is off. Let it run without the battery saver so the guidance keeps reaching the bike."
                        onAction={() => void openBatteryOptimizationSettings()}
                        tone="warning"
                    />
                ) : null}

                {speed !== null ? (
                    <SpeedGauge
                        isStale={stale}
                        overspeedLimitKmh={settings.overspeedLimitKmh}
                        unit={settings.unitSystem}
                        value={speed}
                    />
                ) : null}

                {!telemetry ? (
                    <Text style={[styles.waiting, { color: colors.mutedForeground }]}>
                        Waiting for the bike. It sends its values when it is switched on.
                    </Text>
                ) : null}

                {groups.map((group) => (
                    <View key={group.title ?? 'live'}>
                        {group.title ? (
                            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                                {group.title}
                            </Text>
                        ) : null}
                        <View style={styles.grid}>
                            {group.tiles.map((tile) => (
                                <MetricTile
                                    hint={tile.hint}
                                    isStale={stale}
                                    key={tile.label}
                                    label={tile.label}
                                    unit={tile.unit}
                                    value={tile.value}
                                />
                            ))}
                        </View>
                    </View>
                ))}

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
    waiting: {
        ...typography.body,
        marginBottom: spacing.lg,
    },
});

export default DashboardScreen;
