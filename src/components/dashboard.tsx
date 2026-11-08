import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { StatusDot } from '@components/feedback';
import { useTheme } from '@hooks/useTheme';
import { ConnectionState } from '@typings/types';
import { formatAge, speedUnit, UnitSystem } from '@utils/format';
import { layout, radii, spacing, typography } from '@config/theme';

interface ConnectionRailProps {
    state: ConnectionState;
    lastSeenAt: number | null;
    bikeNickname?: string;
    reason?: string | null;
    onPress?: () => void;
}

const stateTitle = (state: ConnectionState, nickname?: string): string => {
    switch (state) {
        case 'scanning':
            return 'Scanning for bikes...';
        case 'connecting':
            return `Connecting to ${nickname ?? 'bike'}...`;
        case 'pairing':
            return 'Pairing with the bike...';
        case 'connected':
            return 'Connected';
        case 'reconnecting':
            return `Reconnecting to ${nickname ?? 'bike'}...`;
        case 'failed':
            return 'Could not connect';
        default:
            return 'Not connected';
    }
};

export const ConnectionRail = ({
    state,
    lastSeenAt,
    bikeNickname,
    reason,
    onPress,
}: ConnectionRailProps) => {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={stateTitle(state, bikeNickname)}
            accessibilityLiveRegion="polite"
            disabled={!onPress}
            onPress={onPress}
            style={[styles.rail, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        >
            <StatusDot state={state} />
            <View style={styles.railText}>
                <Text style={[styles.railTitle, { color: colors.foreground }]}>
                    {stateTitle(state, bikeNickname)}
                </Text>
                <Text style={[styles.railCaption, { color: colors.mutedForeground }]}>
                    {reason ?? (state === 'off'
                        ? 'Turn the bike on. It connects automatically when the bike is switched on.'
                        : `Last update ${formatAge(lastSeenAt)}`)}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

type MetricTone = 'default' | 'muted' | 'warning' | 'error' | 'success';

interface MetricTileProps {
    label: string;
    value: string;
    unit?: string;
    hint?: string;
    tone?: MetricTone;
    isStale?: boolean;
}

export const MetricTile = ({
    label,
    value,
    unit,
    hint,
    tone = 'default',
    isStale = false,
}: MetricTileProps) => {
    const { colors } = useTheme();

    const valueColor =
        tone === 'error' ? colors.error : tone === 'muted' ? colors.mutedForeground : colors.foreground;

    return (
        <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>{label}</Text>
            <View style={styles.tileValueRow}>
                <Text style={[styles.tileValue, { color: valueColor }, isStale ? styles.stale : null]}>
                    {value}
                </Text>
                {unit ? <Text style={[styles.tileUnit, { color: colors.mutedForeground }]}>{unit}</Text> : null}
            </View>
            {hint ? <Text style={[styles.tileHint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
        </View>
    );
};

interface SpeedGaugeProps {
    value: number;
    unit: UnitSystem;
    overspeedLimitKmh: number;
    isStale: boolean;
}

export const SpeedGauge = ({ value, unit, overspeedLimitKmh, isStale }: SpeedGaugeProps) => {
    const { colors } = useTheme();

    const displayValue = unit === 'imperial' ? Math.round(value * 0.621371) : Math.round(value);
    const overLimit = value > overspeedLimitKmh;
    const ratio = Math.min(1, value / Math.max(overspeedLimitKmh, 1));

    return (
        <View style={styles.gauge}>
            <View style={styles.gaugeValueRow}>
                <Text
                    accessibilityLabel={`Speed ${displayValue} ${speedUnit(unit)}`}
                    style={[styles.gaugeValue, { color: colors.foreground }, isStale ? styles.stale : null]}
                >
                    {displayValue.toString()}
                </Text>
                <Text style={[styles.gaugeUnit, { color: colors.mutedForeground }]}>{speedUnit(unit)}</Text>
            </View>
            <View style={[styles.gaugeTrack, { backgroundColor: colors.muted }]}>
                <View
                    style={[
                        styles.gaugeFill,
                        { backgroundColor: overLimit ? colors.error : colors.primary, width: `${ratio * 100}%` },
                    ]}
                />
            </View>
            {overLimit ? (
                <Text style={[styles.gaugeWarning, { color: colors.error }]}>
                    {`You are over your ${overspeedLimitKmh} limit.`}
                </Text>
            ) : null}
        </View>
    );
};

interface WeekBarsProps {
    days: { label: string; distanceKm: number }[];
}

export const WeekBars = ({ days }: WeekBarsProps) => {
    const { colors } = useTheme();
    const max = Math.max(1, ...days.map((day) => day.distanceKm));

    return (
        <View style={styles.week}>
            {days.map((day) => (
                <View key={day.label} style={styles.weekColumn}>
                    <View style={[styles.weekTrack, { backgroundColor: colors.muted }]}>
                        <View
                            style={[
                                styles.weekBar,
                                {
                                    backgroundColor: colors.primary,
                                    height: `${Math.max(4, (day.distanceKm / max) * 100)}%`,
                                },
                            ]}
                        />
                    </View>
                    <Text style={[styles.weekLabel, { color: colors.mutedForeground }]}>
                        {day.label}
                    </Text>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    gauge: {
        marginBottom: spacing.lg,
    },
    gaugeFill: {
        height: spacing.xs,
    },
    gaugeTrack: {
        borderRadius: radii.full,
        height: spacing.xs,
        marginTop: spacing.md,
        overflow: 'hidden',
    },
    gaugeUnit: {
        ...typography.label,
    },
    gaugeValue: {
        ...typography.metric,
    },
    gaugeValueRow: {
        alignItems: 'baseline',
        flexDirection: 'row',
        gap: spacing.sm,
    },
    gaugeWarning: {
        ...typography.caption,
        marginTop: spacing.sm,
    },
    rail: {
        alignItems: 'center',
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: layout.buttonHeight,
        paddingHorizontal: layout.screenPadding,
        paddingVertical: spacing.md,
    },
    railCaption: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    railText: {
        flex: 1,
    },
    railTitle: {
        ...typography.label,
    },
    stale: {
        opacity: 0.6,
    },
    tile: {
        borderRadius: radii.lg,
        borderWidth: 1,
        flexBasis: '46%',
        flexGrow: 1,
        minHeight: 88,
        padding: layout.cardPadding,
    },
    tileHint: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    tileLabel: {
        ...typography.caption,
    },
    tileUnit: {
        ...typography.caption,
    },
    tileValue: {
        ...typography.readout,
    },
    tileValueRow: {
        alignItems: 'baseline',
        flexDirection: 'row',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    week: {
        flexDirection: 'row',
        gap: spacing.sm,
        height: 120,
        marginBottom: spacing.lg,
    },
    weekBar: {
        borderRadius: radii.sm,
        width: '100%',
    },
    weekColumn: {
        alignItems: 'center',
        flex: 1,
        gap: spacing.xs,
    },
    weekLabel: {
        ...typography.caption,
    },
    weekTrack: {
        borderRadius: radii.sm,
        flex: 1,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        width: '100%',
    },
});
