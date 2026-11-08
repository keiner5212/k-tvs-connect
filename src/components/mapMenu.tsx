import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useTheme } from '@hooks/useTheme';
import { rgba } from '@utils/hexToRgb';
import { layout, radii, spacing, typography } from '@config/theme';

const MENU_WIDTH = 200;
const AVOID_MENU_WIDTH = 176;
export const CAMERA_MENU_WIDTH = 220;

export const POINT_MENU_WIDTH = MENU_WIDTH;
export const AVOID_POINT_MENU_WIDTH = AVOID_MENU_WIDTH;

interface PointMenuProps {
    latitude: number;
    longitude: number;
    onAvoid: () => void;
    onRoute: () => void;
    onCancel: () => void;
    onMeasure?: (height: number) => void;
    style?: StyleProp<ViewStyle>;
}

export const PointMenu = ({
    latitude,
    longitude,
    onAvoid,
    onRoute,
    onCancel,
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
            <TouchableOpacity
                accessibilityHint="Closes the menu"
                accessibilityRole="button"
                onPress={onCancel}
                style={styles.row}
            >
                <MaterialIcons color={colors.mutedForeground} name="close" size={20} />
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
        </View>
    );
};

interface CameraMenuProps {
    label: string;
    watchText: string | null;
    isAvoided: boolean;
    onToggleAvoid: () => void;
    onDetails: () => void;
    onCancel: () => void;
    onMeasure?: (height: number) => void;
    style?: StyleProp<ViewStyle>;
}

/**
 * The menu of a camera on the map: what it watches, whether the route avoids it
 * and the way to its full card.
 */
export const CameraMenu = ({
    label,
    watchText,
    isAvoided,
    onToggleAvoid,
    onDetails,
    onCancel,
    onMeasure,
    style,
}: CameraMenuProps) => {
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
                    width: CAMERA_MENU_WIDTH,
                },
                style,
            ]}
        >
            <Text numberOfLines={2} style={[styles.cameraLabel, { color: colors.foreground }]}>
                {label}
            </Text>
            {watchText ? (
                <Text style={[styles.cameraWatch, { color: colors.mutedForeground }]}>
                    {watchText}
                </Text>
            ) : null}
            <View style={[styles.hairline, { backgroundColor: colors.border }]} />
            <TouchableOpacity
                accessibilityHint={
                    isAvoided
                        ? 'The route stops avoiding this camera'
                        : 'The route avoids this camera'
                }
                accessibilityRole="button"
                onPress={onToggleAvoid}
                style={styles.row}
            >
                <MaterialIcons color={colors.foreground} name="videocam" size={20} />
                <Text style={[styles.label, { color: colors.foreground }]}>
                    {isAvoided ? 'Stop avoiding' : 'Avoid on route'}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                accessibilityHint="Opens the full card of the camera"
                accessibilityRole="button"
                onPress={onDetails}
                style={styles.row}
            >
                <MaterialIcons color={colors.foreground} name="info-outline" size={20} />
                <Text style={[styles.label, { color: colors.foreground }]}>Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
                accessibilityHint="Closes the menu"
                accessibilityRole="button"
                onPress={onCancel}
                style={styles.row}
            >
                <MaterialIcons color={colors.mutedForeground} name="close" size={20} />
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Cancel</Text>
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
    cameraLabel: {
        ...typography.label,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
    },
    cameraWatch: {
        ...typography.caption,
        paddingBottom: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
    },
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
