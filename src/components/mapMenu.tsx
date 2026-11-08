import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useTheme } from '@hooks/useTheme';
import { rgba } from '@utils/hexToRgb';
import { layout, radii, spacing, typography } from '@config/theme';

const MENU_WIDTH = 200;
const AVOID_MENU_WIDTH = 176;

export const POINT_MENU_WIDTH = MENU_WIDTH;
export const AVOID_POINT_MENU_WIDTH = AVOID_MENU_WIDTH;

interface PointMenuProps {
    latitude: number;
    longitude: number;
    onAvoid: () => void;
    onRoute: () => void;
    onMeasure?: (height: number) => void;
    style?: StyleProp<ViewStyle>;
}

export const PointMenu = ({
    latitude,
    longitude,
    onAvoid,
    onRoute,
    onMeasure,
    style,
}: PointMenuProps) => {
    const { colors } = useTheme();
    const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

    return (
        <View
            onLayout={(event) => onMeasure?.(event.nativeEvent.layout.height)}
            style={[
                styles.card,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    shadowColor: rgba(colors.foreground, 0.18),
                    width: MENU_WIDTH,
                },
                style,
            ]}
        >
            <Text
                accessibilityLabel={`Point at ${coordinates}`}
                style={[styles.header, { color: colors.mutedForeground }]}
            >
                {coordinates}
            </Text>
            <View style={[styles.hairline, { backgroundColor: colors.border }]} />
            <TouchableOpacity
                accessibilityHint="The route will avoid this point"
                accessibilityRole="button"
                onPress={onAvoid}
                style={styles.row}
            >
                <MaterialIcons color={colors.foreground} name="add-location-alt" size={20} />
                <Text style={[styles.label, { color: colors.foreground }]}>Avoid this point</Text>
            </TouchableOpacity>
            <TouchableOpacity
                accessibilityHint="This point becomes the destination"
                accessibilityRole="button"
                onPress={onRoute}
                style={styles.row}
            >
                <MaterialIcons color={colors.foreground} name="route" size={20} />
                <Text style={[styles.label, { color: colors.foreground }]}>Route to this point</Text>
            </TouchableOpacity>
        </View>
    );
};

interface AvoidPointMenuProps {
    number: number;
    onRemove: () => void;
    onMeasure?: (height: number) => void;
    style?: StyleProp<ViewStyle>;
}

export const AvoidPointMenu = ({ number, onRemove, onMeasure, style }: AvoidPointMenuProps) => {
    const { colors } = useTheme();

    return (
        <View
            onLayout={(event) => onMeasure?.(event.nativeEvent.layout.height)}
            style={[
                styles.card,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    shadowColor: rgba(colors.foreground, 0.18),
                    width: AVOID_MENU_WIDTH,
                },
                style,
            ]}
        >
            <TouchableOpacity
                accessibilityHint="This point is no longer avoided"
                accessibilityRole="button"
                onPress={onRemove}
                style={styles.row}
            >
                <MaterialIcons color={colors.error} name="delete-outline" size={20} />
                <Text style={[styles.label, { color: colors.error }]}>
                    {`Remove point ${number}`}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        elevation: 3,
        overflow: 'hidden',
        position: 'absolute',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
    },
    hairline: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: spacing.md,
    },
    header: {
        ...typography.caption,
        paddingBottom: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
    },
    label: {
        ...typography.label,
    },
    row: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        minHeight: layout.buttonHeight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
});
