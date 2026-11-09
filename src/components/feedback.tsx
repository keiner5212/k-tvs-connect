import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@hooks/useTheme';
import { layout, radii, spacing, typography } from '@config/theme';

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

const styles = StyleSheet.create({
    action: {
        ...typography.label,
        marginTop: spacing.md,
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
    title: {
        ...typography.heading,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
});
