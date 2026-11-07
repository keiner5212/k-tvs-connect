import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@hooks/useTheme';
import { ConnectionState } from '@typings/types';
import { layout, radii, spacing, typography } from '@config/theme';

interface StatusDotProps {
    state: ConnectionState;
    size?: number;
}

const stateColor = (state: ConnectionState, colors: ReturnType<typeof useTheme>['colors']) => {
    switch (state) {
        case 'connected':
            return colors.success;
        case 'scanning':
        case 'connecting':
        case 'reconnecting':
            return colors.info;
        case 'failed':
            return colors.error;
        default:
            return colors.mutedForeground;
    }
};

export const StatusDot = ({ state, size = spacing.md }: StatusDotProps) => {
    const { colors } = useTheme();

    return (
        <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.dot, { backgroundColor: stateColor(state, colors), height: size, width: size }]}
        />
    );
};

interface EmptyStateProps {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyState = ({ title, description, actionLabel, onAction }: EmptyStateProps) => {
    const { colors } = useTheme();

    return (
        <View style={styles.centered}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            {description ? (
                <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
            ) : null}
            {actionLabel && onAction ? (
                <Text
                    accessibilityRole="button"
                    onPress={onAction}
                    style={[styles.action, { color: colors.primary }]}
                >
                    {actionLabel}
                </Text>
            ) : null}
        </View>
    );
};

type BannerTone = 'info' | 'warning' | 'error';

interface BannerProps {
    tone: BannerTone;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}

export const Banner = ({ tone, message, actionLabel, onAction }: BannerProps) => {
    const { colors } = useTheme();

    const accent =
        tone === 'error' ? colors.error : tone === 'warning' ? colors.warning : colors.info;

    return (
        <View style={[styles.banner, { backgroundColor: colors.card, borderLeftColor: accent }]}>
            <Text style={[styles.bannerText, { color: colors.foreground }]}>{message}</Text>
            {actionLabel && onAction ? (
                <Text accessibilityRole="button" onPress={onAction} style={[styles.action, { color: colors.primary }]}>
                    {actionLabel}
                </Text>
            ) : null}
        </View>
    );
};

interface StaleNoticeProps {
    ageSeconds: number;
    onRetry?: () => void;
}

export const StaleNotice = ({ ageSeconds, onRetry }: StaleNoticeProps) => {
    const { colors } = useTheme();

    return (
        <View style={[styles.banner, { backgroundColor: colors.card, borderLeftColor: colors.warning }]}>
            <Text style={[styles.bannerText, { color: colors.foreground }]}>
                {`Showing older data. The last values arrived ${ageSeconds} seconds ago.`}
            </Text>
            {onRetry ? (
                <Text accessibilityRole="button" onPress={onRetry} style={[styles.action, { color: colors.primary }]}>
                    Reconnect
                </Text>
            ) : null}
        </View>
    );
};

interface VehicleAlertItem {
    id: string;
    title: string;
    body: string;
}

interface AlertBannerProps {
    alerts: VehicleAlertItem[];
}

export const AlertBanner = ({ alerts }: AlertBannerProps) => {
    const { colors } = useTheme();

    if (alerts.length === 0) {
        return null;
    }

    return (
        <View style={styles.alertList}>
            {alerts.map((alert) => (
                <View
                    key={alert.id}
                    style={[styles.banner, { backgroundColor: colors.card, borderLeftColor: colors.error }]}
                >
                    <Text style={[styles.alertTitle, { color: colors.foreground }]}>{alert.title}</Text>
                    {alert.body ? (
                        <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>{alert.body}</Text>
                    ) : null}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    action: {
        ...typography.label,
        marginTop: spacing.md,
    },
    alertList: {
        marginBottom: spacing.md,
    },
    alertTitle: {
        ...typography.label,
        marginBottom: spacing.xs,
    },
    banner: {
        borderLeftWidth: 3,
        borderRadius: radii.md,
        marginBottom: spacing.sm,
        padding: layout.cardPadding,
    },
    bannerText: {
        ...typography.body,
    },
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    description: {
        ...typography.body,
        textAlign: 'center',
    },
    dot: {
        borderRadius: radii.full,
    },
    title: {
        ...typography.heading,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
});
