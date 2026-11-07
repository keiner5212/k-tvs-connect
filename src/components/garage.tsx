import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { StatusDot } from '@components/feedback';
import { useTheme } from '@hooks/useTheme';
import { Bike, ConnectionState } from '@typings/types';
import { formatAge } from '@utils/format';
import { layout, radii, spacing, typography } from '@config/theme';

interface BikeCardProps {
    bike: Bike;
    isActive: boolean;
    linkState: ConnectionState;
    lastSeenAt: number | null;
    onPress: () => void;
    onSetActive: () => void;
}

export const BikeCard = ({
    bike,
    isActive,
    linkState,
    lastSeenAt,
    onPress,
    onSetActive,
}: BikeCardProps) => {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${bike.nickname}, ${linkState}`}
            activeOpacity={0.8}
            onPress={onPress}
            style={[
                styles.card,
                {
                    backgroundColor: colors.card,
                    borderColor: isActive ? colors.primary : colors.border,
                },
            ]}
        >
            <View style={styles.header}>
                <Text style={[styles.nickname, { color: colors.foreground }]}>{bike.nickname}</Text>
                {isActive ? (
                    <View style={[styles.activeBadge, { backgroundColor: colors.primarySubtle }]}>
                        <Text style={[styles.activeLabel, { color: colors.primary }]}>Active</Text>
                    </View>
                ) : null}
            </View>

            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {`${bike.model} · ${bike.frameNumber}`}
            </Text>

            <View style={styles.statusRow}>
                <StatusDot state={linkState} />
                <Text style={[styles.status, { color: colors.mutedForeground }]}>
                    {linkState === 'connected'
                        ? 'Connected'
                        : linkState === 'off'
                            ? 'Not connected'
                            : linkState === 'failed'
                                ? 'Could not connect'
                                : linkState.charAt(0).toUpperCase() + linkState.slice(1)}
                </Text>
                {linkState !== 'connected' && lastSeenAt ? (
                    <Text style={[styles.status, { color: colors.mutedForeground }]}>
                        {`Last seen ${formatAge(lastSeenAt)}`}
                    </Text>
                ) : null}
            </View>

            {!isActive ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${bike.nickname} as active`}
                    onPress={onSetActive}
                    style={styles.setActive}
                >
                    <Text style={[styles.setActiveLabel, { color: colors.primary }]}>Set as active</Text>
                </TouchableOpacity>
            ) : null}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    activeBadge: {
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    activeLabel: {
        ...typography.caption,
    },
    card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        marginBottom: layout.cardMargin,
        padding: layout.cardPadding,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    meta: {
        ...typography.body,
        marginTop: spacing.xs,
    },
    nickname: {
        ...typography.subheading,
    },
    setActive: {
        justifyContent: 'center',
        marginTop: spacing.md,
        minHeight: layout.buttonHeight,
    },
    setActiveLabel: {
        ...typography.label,
    },
    status: {
        ...typography.caption,
    },
    statusRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
});
