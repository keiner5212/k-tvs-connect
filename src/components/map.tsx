import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    Camera,
    LineLayer,
    MapView,
    PointAnnotation,
    ShapeSource,
    UserLocation,
    UserLocationRenderMode,
    UserTrackingMode,
} from '@maplibre/maplibre-react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { IconButton } from '@components/controls';
import { useTheme } from '@hooks/useTheme';
import { AvoidPoint, CameraMarkerData, Place } from '@typings/types';
import { decodePolyline } from '@utils/polyline';
import { layout, radii, spacing, typography } from '@config/theme';

export interface MapCanvasProps {
    styleURL: string;
    center: [number, number];
    zoom: number;
    routeGeometry?: string | null;
    avoidPoints: AvoidPoint[];
    destination?: Place | null;
    followUser: boolean;
    replayPosition?: [number, number] | null;
    cameras?: CameraMarkerData[];
    onCameraPress?: (cameraId: string) => void;
    onLongPress?: (latitude: number, longitude: number) => void;
}

export const MapCanvas = ({
    styleURL,
    center,
    zoom,
    routeGeometry,
    avoidPoints,
    destination,
    followUser,
    replayPosition,
    cameras = [],
    onCameraPress,
    onLongPress,
}: MapCanvasProps) => {
    const { colors } = useTheme();

    const routePoints = routeGeometry ? decodePolyline(routeGeometry) : [];
    const routeShape =
        routePoints.length > 1
            ? {
                type: 'LineString' as const,
                coordinates: routePoints.map((point) => [point.lon, point.lat]),
            }
            : null;

    return (
        <MapView
            style={styles.map}
            mapStyle={styleURL}
            logoEnabled={false}
            attributionEnabled
            onLongPress={
                onLongPress
                    ? (feature: GeoJSON.Feature) => {
                        const geometry = feature.geometry as GeoJSON.Point | undefined;
                        const coordinates = geometry?.coordinates ?? [];
                        if (coordinates.length >= 2) {
                            onLongPress(coordinates[1], coordinates[0]);
                        }
                    }
                    : undefined
            }
        >
            <Camera
                centerCoordinate={center}
                followUserLocation={followUser}
                followUserMode={UserTrackingMode.Follow}
                zoomLevel={zoom}
            />

            <UserLocation visible renderMode={UserLocationRenderMode.Normal} />

            {routeShape ? (
                <ShapeSource id="route-source" shape={routeShape}>
                    <LineLayer id="route-line" style={{ lineColor: colors.primary, lineWidth: 3 }} />
                </ShapeSource>
            ) : null}

            {replayPosition ? (
                <PointAnnotation id="replay" coordinate={[replayPosition[1], replayPosition[0]]}>
                    <View style={[styles.replayPin, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.replayLabel, { color: colors.primaryForeground }]}>R</Text>
                    </View>
                </PointAnnotation>
            ) : null}

            {destination ? (
                <PointAnnotation id="destination" coordinate={[destination.longitude, destination.latitude]}>
                    <View style={[styles.pin, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.pinLabel, { color: colors.primaryForeground }]}>D</Text>
                    </View>
                </PointAnnotation>
            ) : null}

            {cameras.map((camera) => (
                <PointAnnotation
                    id={`camera-${camera.id}`}
                    key={camera.id}
                    coordinate={[camera.longitude, camera.latitude]}
                >
                    <TouchableOpacity
                        accessibilityLabel={
                            camera.maxSpeedKmh !== null
                                ? `Speed camera, ${camera.maxSpeedKmh} kilometres per hour, ${camera.label}`
                                : `Speed camera, speed not published, ${camera.label}`
                        }
                        accessibilityRole="button"
                        onPress={() => onCameraPress?.(camera.id)}
                        style={styles.cameraPin}
                    >
                        <View
                            style={[
                                styles.cameraBody,
                                {
                                    backgroundColor: camera.isAvoided ? colors.error : colors.card,
                                    borderColor: colors.error,
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.cameraLens,
                                    {
                                        backgroundColor: camera.isAvoided
                                            ? colors.errorForeground
                                            : colors.error,
                                    },
                                ]}
                            />
                            <View
                                style={[
                                    styles.cameraFoot,
                                    {
                                        backgroundColor: camera.isAvoided
                                            ? colors.errorForeground
                                            : colors.error,
                                    },
                                ]}
                            />
                        </View>
                        {camera.maxSpeedKmh !== null ? (
                            <View
                                style={[
                                    styles.cameraSpeed,
                                    { backgroundColor: colors.card, borderColor: colors.border },
                                ]}
                            >
                                <Text style={[styles.cameraSpeedLabel, { color: colors.foreground }]}>
                                    {camera.maxSpeedKmh.toString()}
                                </Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                </PointAnnotation>
            ))}

            {avoidPoints.map((point, index) => (
                <PointAnnotation
                    key={point.id}
                    id={point.id}
                    coordinate={[point.longitude, point.latitude]}
                >
                    <View style={styles.avoidPinWrap}>
                        <View style={[styles.avoidPin, { backgroundColor: colors.warning }]}>
                            <Text style={[styles.avoidPinLabel, { color: colors.warningForeground }]}>
                                {(index + 1).toString()}
                            </Text>
                        </View>
                        <View
                            style={[styles.avoidTip, { borderTopColor: colors.warning }]}
                        />
                    </View>
                </PointAnnotation>
            ))}
        </MapView>
    );
};

interface RouteSheetProps {
    distanceLabel: string;
    durationLabel: string;
    arrivalLabel: string | null;
    destinationName: string | null;
    cameraCount: number;
    avoidPointCount: number;
    isComputing: boolean;
    canSendToBike: boolean;
    onSendToBike: () => void;
    onSave: () => void;
    onClear: () => void;
    onOpenDetails: () => void;
    onChooseDestination: () => void;
}

/**
 * The sheet at the bottom of the map. It reads from the top down, so the least
 * important line is first and the arrival time is the last thing the rider sees
 * before the thumb.
 */
export const RouteSheet = ({
    distanceLabel,
    durationLabel,
    arrivalLabel,
    destinationName,
    cameraCount,
    avoidPointCount,
    isComputing,
    canSendToBike,
    onSendToBike,
    onSave,
    onClear,
    onOpenDetails,
    onChooseDestination,
}: RouteSheetProps) => {
    const { colors } = useTheme();

    if (!destinationName) {
        return (
            <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>No destination yet</Text>
                <Text style={[styles.sheetHint, { color: colors.mutedForeground }]}>
                    Search for a place to plan a route.
                </Text>
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={onChooseDestination}
                    style={[styles.sheetPrimary, { backgroundColor: colors.primary }]}
                >
                    <Text style={[styles.sheetPrimaryLabel, { color: colors.primaryForeground }]}>
                        Choose a destination
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {cameraCount > 0 || avoidPointCount > 0 ? (
                <View style={styles.countsRow}>
                    {cameraCount > 0 ? (
                        <View style={styles.countItem}>
                            <MaterialIcons color={colors.mutedForeground} name="videocam" size={14} />
                            <Text style={[styles.countLabel, { color: colors.mutedForeground }]}>
                                {`${cameraCount} camera${cameraCount === 1 ? '' : 's'} avoided`}
                            </Text>
                        </View>
                    ) : null}
                    {avoidPointCount > 0 ? (
                        <View style={styles.countItem}>
                            <MaterialIcons
                                color={colors.mutedForeground}
                                name="add-location-alt"
                                size={14}
                            />
                            <Text style={[styles.countLabel, { color: colors.mutedForeground }]}>
                                {`${avoidPointCount} point${avoidPointCount === 1 ? '' : 's'} to avoid`}
                            </Text>
                        </View>
                    ) : null}
                </View>
            ) : null}

            <View style={styles.destinationRow}>
                <MaterialIcons color={colors.mutedForeground} name="place" size={20} />
                <Text style={[styles.destinationName, { color: colors.foreground }]} numberOfLines={1}>
                    {destinationName}
                </Text>
            </View>

            {isComputing ? (
                <Text style={[styles.sheetHint, { color: colors.mutedForeground }]}>
                    Computing route...
                </Text>
            ) : (
                <View style={styles.metricsRow}>
                    <View style={styles.metric}>
                        <MaterialIcons color={colors.mutedForeground} name="straighten" size={16} />
                        <Text style={[styles.metricValue, { color: colors.foreground }]}>
                            {distanceLabel}
                        </Text>
                    </View>
                    <View style={styles.metric}>
                        <MaterialIcons color={colors.mutedForeground} name="schedule" size={16} />
                        <Text style={[styles.metricValue, { color: colors.foreground }]}>
                            {durationLabel}
                        </Text>
                    </View>
                    <View style={styles.metric}>
                        <MaterialIcons color={colors.mutedForeground} name="flag" size={16} />
                        <Text style={[styles.metricValue, { color: colors.foreground }]}>
                            {arrivalLabel ? `Arrives ${arrivalLabel}` : 'Arrival unknown'}
                        </Text>
                    </View>
                </View>
            )}

            <View style={styles.sheetActions}>
                <TouchableOpacity
                    accessibilityRole="button"
                    disabled={!canSendToBike}
                    onPress={onSendToBike}
                    style={[
                        styles.sheetPrimary,
                        {
                            backgroundColor: canSendToBike ? colors.primary : colors.muted,
                            flex: 1,
                        },
                    ]}
                >
                    <MaterialIcons
                        color={canSendToBike ? colors.primaryForeground : colors.mutedForeground}
                        name="send"
                        size={18}
                    />
                    <Text
                        style={[
                            styles.sheetPrimaryLabel,
                            { color: canSendToBike ? colors.primaryForeground : colors.mutedForeground },
                        ]}
                    >
                        {canSendToBike ? 'Send to bike' : 'Bike not connected'}
                    </Text>
                </TouchableOpacity>

                <IconButton
                    accessibilityLabel="Save route"
                    icon="bookmark-border"
                    onPress={onSave}
                />
                <IconButton accessibilityLabel="Clear route" icon="close" onPress={onClear} />
            </View>

            <TouchableOpacity
                accessibilityLabel="Open route details"
                accessibilityRole="button"
                onPress={onOpenDetails}
                style={[styles.expandRow, { borderTopColor: colors.border }]}
            >
                <MaterialIcons color={colors.primary} name="fullscreen" size={20} />
                <Text style={[styles.expandLabel, { color: colors.primary }]}>Route details</Text>
            </TouchableOpacity>
        </View>
    );
};

interface AvoidPointListProps {
    points: AvoidPoint[];
    onDelete: (id: string) => void;
    onClearAll?: () => void;
}

export const AvoidPointList = ({ points, onDelete, onClearAll }: AvoidPointListProps) => {
    const { colors } = useTheme();

    if (points.length === 0) {
        return null;
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.avoidHeader}>
                <Text style={[styles.avoidTitle, { color: colors.foreground }]}>Points to avoid</Text>
                {onClearAll ? (
                    <TouchableOpacity accessibilityRole="button" onPress={onClearAll}>
                        <Text style={[styles.clearAll, { color: colors.primary }]}>Clear all</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {points.map((point, index) => (
                <View key={point.id} style={styles.avoidRow}>
                    <View style={[styles.avoidBadge, { backgroundColor: colors.warning }]}>
                        <Text style={[styles.avoidBadgeLabel, { color: colors.warningForeground }]}>
                            {(index + 1).toString()}
                        </Text>
                    </View>
                    <Text style={[styles.avoidCoordinate, { color: colors.mutedForeground }]}>
                        {`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
                    </Text>
                    <TouchableOpacity
                        accessibilityLabel={`Remove avoid point ${index + 1}`}
                        accessibilityRole="button"
                        onPress={() => onDelete(point.id)}
                        style={styles.removeButton}
                    >
                        <Text style={[styles.removeLabel, { color: colors.mutedForeground }]}>Remove</Text>
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );
};

interface PlaceSearchListProps {
    results: { id: string; name: string; address: string }[];
    isSearching: boolean;
    onSelect: (index: number) => void;
}

export const PlaceSearchList = ({ results, isSearching, onSelect }: PlaceSearchListProps) => {
    const { colors } = useTheme();

    if (isSearching) {
        return <Text style={[styles.searching, { color: colors.mutedForeground }]}>Searching...</Text>;
    }

    if (results.length === 0) {
        return null;
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {results.map((result, index) => (
                <TouchableOpacity
                    accessibilityRole="button"
                    key={result.id}
                    onPress={() => onSelect(index)}
                    style={styles.placeRow}
                >
                    <Text style={[styles.placeName, { color: colors.foreground }]}>{result.name}</Text>
                    {result.address ? (
                        <Text style={[styles.placeAddress, { color: colors.mutedForeground }]}>
                            {result.address}
                        </Text>
                    ) : null}
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    avoidBadge: {
        alignItems: 'center',
        borderRadius: radii.full,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    avoidBadgeLabel: {
        ...typography.caption,
        fontWeight: '700',
    },
    avoidCoordinate: {
        ...typography.caption,
        flex: 1,
    },
    avoidHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    avoidPin: {
        alignItems: 'center',
        borderRadius: radii.full,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    avoidPinLabel: {
        ...typography.caption,
        fontWeight: '700',
    },
    avoidPinWrap: {
        alignItems: 'center',
    },
    avoidRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: layout.buttonHeight,
    },
    avoidTip: {
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 6,
        height: 0,
        width: 0,
    },
    avoidTitle: {
        ...typography.label,
    },
    cameraBody: {
        alignItems: 'center',
        borderRadius: radii.sm,
        borderWidth: 2,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    cameraFoot: {
        borderRadius: 2,
        height: 4,
        left: 3,
        position: 'absolute',
        top: 3,
        width: 6,
    },
    cameraLens: {
        borderRadius: radii.full,
        height: 8,
        width: 8,
    },
    cameraPin: {
        alignItems: 'center',
        flexDirection: 'row',
        height: 26,
        justifyContent: 'center',
    },
    cameraSpeed: {
        borderRadius: radii.full,
        borderWidth: 1,
        marginLeft: 2,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    cameraSpeedLabel: {
        ...typography.caption,
        fontWeight: '700',
    },
    card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        marginHorizontal: layout.screenPadding,
        marginTop: spacing.sm,
        padding: layout.cardPadding,
    },
    clearAll: {
        ...typography.caption,
    },
    countItem: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
    },
    countLabel: {
        ...typography.caption,
    },
    countsRow: {
        flexDirection: 'row',
        gap: spacing.lg,
    },
    destinationName: {
        ...typography.subheading,
        flex: 1,
    },
    destinationRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    expandLabel: {
        ...typography.label,
    },
    expandRow: {
        alignItems: 'center',
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'center',
        marginTop: spacing.md,
        minHeight: 44,
    },
    map: {
        flex: 1,
    },
    metric: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
    },
    metricValue: {
        ...typography.readout,
    },
    metricsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    pin: {
        alignItems: 'center',
        borderRadius: radii.full,
        height: 28,
        justifyContent: 'center',
        width: 28,
    },
    pinLabel: {
        ...typography.caption,
        fontWeight: '700',
    },
    placeAddress: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    placeName: {
        ...typography.body,
    },
    placeRow: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        minHeight: 56,
        paddingVertical: spacing.sm,
    },
    removeButton: {
        justifyContent: 'center',
        minHeight: layout.buttonHeight,
        paddingHorizontal: spacing.sm,
    },
    removeLabel: {
        ...typography.caption,
    },
    replayLabel: {
        ...typography.caption,
        fontWeight: '700',
    },
    replayPin: {
        alignItems: 'center',
        borderRadius: radii.full,
        height: 28,
        justifyContent: 'center',
        width: 28,
    },
    searching: {
        ...typography.body,
        padding: layout.cardPadding,
    },
    sheet: {
        borderRadius: radii.xl,
        borderWidth: 1,
        marginHorizontal: layout.screenPadding,
        overflow: 'hidden',
    },
    sheetActions: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    sheetHint: {
        ...typography.body,
        marginTop: spacing.xs,
    },
    sheetPrimary: {
        alignItems: 'center',
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: spacing.md,
    },
    sheetPrimaryLabel: {
        ...typography.label,
    },
    sheetTitle: {
        ...typography.subheading,
    },
});
