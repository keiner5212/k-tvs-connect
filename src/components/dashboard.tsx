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
    onPress?: () => void;
}

const stateTitle = (state: ConnectionState, nickname?: string): string => {
    switch (state) {
        case 'scanning':
            return 'Scanning for scooters...';
        case 'connecting':
            return `Connecting to ${nickname ?? 'scooter'}...`;
        case 'connected':
            return 'Connected';
        case 'reconnecting':
            return `Reconnecting to ${nickname ?? 'scooter'}...`;
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
                {state === 'off' ? (
                    <Text style={[styles.railCaption, { color: colors.mutedForeground }]}>
                        Turn the scooter on. It connects automatically when the scooter is switched on.
                    </Text>
                ) : (
                    <Text style={[styles.railCaption, { color: colors.mutedForeground }]}>
                        {`Last update ${formatAge(lastSeenAt)}`}
                    </Text>
                )}
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

const styles = StyleSheet.create({
    rail: {
        alignItems: 'center',
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: layout.buttonHeight,
        paddingHorizontal: layout.screenPadding,
        paddingVertical: spacing.md,
    },
    railText: {
        flex: 1,
    },
    railTitle: {
        ...typography.label,
    },
    railCaption: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    tile: {
        borderRadius: radii.lg,
        borderWidth: 1,
        flexGrow: 1,
        flexBasis: '46%',
        minHeight: 88,
        padding: layout.cardPadding,
    },
    tileLabel: {
        ...typography.caption,
    },
    tileValueRow: {
        alignItems: 'baseline',
        flexDirection: 'row',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    tileValue: {
        ...typography.readout,
    },
    tileUnit: {
        ...typography.caption,
    },
    tileHint: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    stale: {
        opacity: 0.6,
    },
    gauge: {
        marginBottom: spacing.lg,
    },
    gaugeValueRow: {
        alignItems: 'baseline',
        flexDirection: 'row',
        gap: spacing.sm,
    },
    gaugeValue: {
        ...typography.metric,
    },
    gaugeUnit: {
        ...typography.label,
    },
    gaugeTrack: {
        borderRadius: radii.full,
        height: spacing.xs,
        marginTop: spacing.md,
        overflow: 'hidden',
    },
    gaugeFill: {
        height: spacing.xs,
    },
    gaugeWarning: {
        ...typography.caption,
        marginTop: spacing.sm,
    },
});
