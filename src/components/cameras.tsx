import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PrimaryButton } from '@components/controls';
import { useTheme } from '@hooks/useTheme';
import { TrafficCamera } from '@typings/types';
import { formatDistance, UnitSystem } from '@utils/format';
import { layout, radii, spacing, typography } from '@config/theme';

const TECHNOLOGY_DESCRIPTIONS: Record<string, string> = {
    'Radar Doppler': 'Speed measured with a Doppler radar',
    'Video Detección (Con Analítica de Video)': 'Video camera with automatic video analytics',
    'Laser (Lidar) / Infrarrojo': 'Laser or infrared measurement',
    'Lazo Inductivo de Piso (Espiras)': 'Inductive loops laid in the road',
    'Semi-Automática (Acción Remota)': 'Recorded by a traffic agent with a device',
    'Otra Tecnología': 'Other technology',
};

const describeTechnology = (technology: string): string => {
    const description = TECHNOLOGY_DESCRIPTIONS[technology];
    return description ? `${description} (${technology})` : technology;
};

interface CameraCardProps {
    camera: TrafficCamera;
    unitSystem: UnitSystem;
    variant?: 'summary' | 'full';
    isAvoided: boolean;
    onToggleAvoid: (cameraId: string) => void;
    onShowOnMap?: (cameraId: string) => void;
    onRemove?: (cameraId: string) => void;
    onOpenDetails?: (cameraId: string) => void;
}

const formatPublishedAt = (timestamp: number | null): string => {
    if (!timestamp) {
        return 'Publication date not published.';
    }
    return `Data published ${new Date(timestamp).toLocaleDateString()}.`;
};

export const CameraCard = ({
    camera,
    unitSystem,
    variant = 'summary',
    isAvoided,
    onToggleAvoid,
    onShowOnMap,
    onRemove,
    onOpenDetails,
}: CameraCardProps) => {
    const { colors } = useTheme();

    const address = camera.address || 'No address reported';
    const place = [camera.municipality, camera.department].filter(Boolean).join(', ');

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.headerRow}>
                <Text style={[styles.address, { color: colors.foreground }]}>{address}</Text>
                {camera.distanceMeters !== null ? (
                    <View style={[styles.chip, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.chipLabel, { color: colors.mutedForeground }]}>
                            {formatDistance(camera.distanceMeters, unitSystem)} away
                        </Text>
                    </View>
                ) : null}
            </View>

            {place ? (
                <Text style={[styles.place, { color: colors.mutedForeground }]}>{place}</Text>
            ) : null}

            <View style={styles.chipRow}>
                {camera.maxSpeedKmh !== null ? (
                    <View style={[styles.chip, { backgroundColor: colors.primarySubtle }]}>
                        <Text style={[styles.speedChip, { color: colors.primary }]}>
                            {`${camera.maxSpeedKmh} km/h`}
                        </Text>
                    </View>
                ) : (
                    <View style={[styles.chip, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.chipLabel, { color: colors.mutedForeground }]}>
                            Speed not published
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Technology</Text>
                <Text style={[styles.fieldValue, { color: colors.foreground }]}>
                    {describeTechnology(camera.technology)}
                </Text>
            </View>

            <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Operating state</Text>
                <View style={styles.stateRow}>
                    <View
                        style={[
                            styles.stateDot,
                            {
                                backgroundColor:
                                    camera.operatingState === 'Operating'
                                        ? colors.success
                                        : colors.mutedForeground,
                            },
                        ]}
                    />
                    <Text style={[styles.fieldValue, { color: colors.foreground }]}>
                        {camera.operatingState}
                    </Text>
                </View>
            </View>

            {variant === 'full' ? (
                <>
                    <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Road type</Text>
                        <Text style={[styles.fieldValue, { color: colors.foreground }]}>
                            {camera.roadType || 'Not reported'}
                        </Text>
                    </View>

                    <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                            Declared infractions
                        </Text>
                        <Text style={[styles.fieldValue, { color: colors.foreground }]}>
                            {camera.infractions.length > 0 ? camera.infractions.join(', ') : 'None published'}
                        </Text>
                    </View>

                    {camera.infractions.length > 0 ? (
                        <Text style={[styles.caveat, { color: colors.mutedForeground }]}>
                            These codes are agency identifiers. The app does not publish what they
                            mean.
                        </Text>
                    ) : null}

                    <Text style={[styles.caveat, { color: colors.mutedForeground }]}>
                        {`${camera.latitude.toFixed(5)}, ${camera.longitude.toFixed(5)}`}
                    </Text>

                    <Text style={[styles.caveat, { color: colors.mutedForeground }]}>
                        This is what the agency published on that date. It is not a live statement of
                        the law, and it does not show any fine amount.
                    </Text>
                </>
            ) : null}

            <Text style={[styles.footer, { color: colors.mutedForeground }]}>
                {`Source: Agencia Nacional de Seguridad Vial (ANSV). ${formatPublishedAt(camera.datasetPublishedAt)}`}
            </Text>

            <PrimaryButton
                label={isAvoided ? 'Stop avoiding' : 'Avoid on route'}
                onPress={() => onToggleAvoid(camera.cameraId)}
            />

            <View style={styles.actionRow}>
                {onShowOnMap ? (
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => onShowOnMap(camera.cameraId)}
                        style={styles.action}
                    >
                        <Text style={[styles.actionLabel, { color: colors.primary }]}>Show on map</Text>
                    </TouchableOpacity>
                ) : null}
                {onOpenDetails ? (
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => onOpenDetails(camera.cameraId)}
                        style={styles.action}
                    >
                        <Text style={[styles.actionLabel, { color: colors.primary }]}>Details</Text>
                    </TouchableOpacity>
                ) : null}
                {onRemove ? (
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => onRemove(camera.cameraId)}
                        style={styles.action}
                    >
                        <Text style={[styles.actionLabel, { color: colors.error }]}>Remove camera</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
};

interface CameraAvoidListProps {
    cameras: TrafficCamera[];
    onStopAvoiding: (cameraId: string) => void;
}

export const CameraAvoidList = ({ cameras, onStopAvoiding }: CameraAvoidListProps) => {
    const { colors } = useTheme();

    if (cameras.length === 0) {
        return null;
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.headerRow}>
                <Text style={[styles.listTitle, { color: colors.foreground }]}>Cameras on this route</Text>
                <Text style={[styles.chipLabel, { color: colors.mutedForeground }]}>
                    {cameras.length.toString()}
                </Text>
            </View>

            {cameras.map((camera) => (
                <View key={camera.cameraId} style={styles.cameraRow}>
                    <View style={[styles.cameraBadge, { backgroundColor: colors.error }]}>
                        <Text style={[styles.cameraBadgeLabel, { color: colors.errorForeground }]}>
                            C
                        </Text>
                    </View>
                    <Text style={[styles.cameraAddress, { color: colors.foreground }]}>
                        {camera.address || 'ANSV camera'}
                    </Text>
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => onStopAvoiding(camera.cameraId)}
                        style={styles.action}
                    >
                        <Text style={[styles.actionLabel, { color: colors.primary }]}>Stop</Text>
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );
};

interface CameraAttributionProps {
    publishedAt: number | null;
}

export const CameraAttribution = ({ publishedAt }: CameraAttributionProps) => {
    const { colors } = useTheme();

    return (
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
            {`Source: Agencia Nacional de Seguridad Vial (ANSV), open data. ${formatPublishedAt(publishedAt)}`}
        </Text>
    );
};

const styles = StyleSheet.create({
    action: {
        justifyContent: 'center',
        minHeight: 44,
    },
    actionLabel: {
        ...typography.label,
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginTop: spacing.sm,
    },
    address: {
        ...typography.subheading,
        flex: 1,
    },
    cameraAddress: {
        ...typography.body,
        flex: 1,
    },
    cameraBadge: {
        alignItems: 'center',
        borderRadius: radii.sm,
        height: 20,
        justifyContent: 'center',
        width: 20,
    },
    cameraBadgeLabel: {
        ...typography.caption,
        fontWeight: '700',
    },
    cameraRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: 48,
    },
    card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        marginHorizontal: layout.screenPadding,
        marginTop: spacing.sm,
        padding: layout.cardPadding,
    },
    caveat: {
        ...typography.caption,
        marginTop: spacing.md,
    },
    chip: {
        borderRadius: radii.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    chipLabel: {
        ...typography.caption,
    },
    chipRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    fieldLabel: {
        ...typography.caption,
        width: 130,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    fieldValue: {
        ...typography.body,
        flex: 1,
    },
    footer: {
        ...typography.caption,
        marginBottom: spacing.md,
        marginTop: spacing.md,
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'space-between',
    },
    listTitle: {
        ...typography.label,
    },
    place: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    speedChip: {
        ...typography.label,
    },
    stateDot: {
        borderRadius: radii.full,
        height: 8,
        width: 8,
    },
    stateRow: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: spacing.sm,
    },
});
