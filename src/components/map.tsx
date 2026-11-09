import React, { Ref, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    Camera,
    LineLayer,
    MapView,
    MapViewRef,
    MarkerView,
    ShapeSource,
    UserLocation,
    UserLocationRenderMode,
    UserTrackingMode,
} from '@maplibre/maplibre-react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconLabelButton } from '@components/controls';
import { useTheme } from '@hooks/useTheme';
import { AvoidPoint, CameraMarkerData, Place, RouteStep } from '@typings/types';
import { SegmentedControl } from '@components/controls';
import { RouteVariant } from '@stores/mapStore';
import { compassName } from '@utils/cameraSense';
import { decodePolyline } from '@utils/polyline';
import { formatDistance, UnitSystem } from '@utils/format';
import { rgba } from '@utils/hexToRgb';
import { layout, radii, spacing, typography } from '@config/theme';

/** the toolbar column of the map screen, the compass goes under it */
export const TOOLBAR_HEIGHT = 3 * 44 + 2 * spacing.sm;

/** the name of the focused camera goes in a band, not on the marker */

/**
 * The wedge sits outside the body and points the way the camera looks.
 * Bearing 0 is north. The marker is pinned to the screen, so the map heading
 * is taken off or the wedge stays put when the map turns.
 */
const DirectionWedge = ({
    bearing,
    mapHeading,
    bothWays,
    color,
}: {
    bearing: number;
    mapHeading: number;
    bothWays: boolean;
    color: string;
}) => {
    const { colors } = useTheme();
    const side = {
        borderLeftColor: colors.transparent,
        borderRightColor: colors.transparent,
    };
    const screenBearing = bearing - mapHeading;

    return (
        <View
            pointerEvents="none"
            style={[
                styles.cameraOrbit,
                bothWays ? styles.cameraOrbitBoth : null,
                { transform: [{ rotate: `${screenBearing}deg` }] },
            ]}
        >
            <View style={[styles.cameraWedge, side, { borderBottomColor: color }]} />
            {bothWays ? (
                <View style={[styles.cameraWedgeDown, side, { borderTopColor: color }]} />
            ) : null}
        </View>
    );
};

export interface MapCanvasProps {
    style: string | object;
    center: [number, number];
    zoom: number;
    routeGeometry?: string | null;
    /** the other way, drawn behind the one that is selected */
    alternateGeometry?: string | null;
    avoidPoints: AvoidPoint[];
    destination?: Place | null;
    followUser: boolean;
    followKey: number;
    cameras?: CameraMarkerData[];
    mapRef?: Ref<MapViewRef>;
    pinnedPoint?: [number, number] | null;
    focusedCameraId?: string | null;
    onCameraPress?: (cameraId: string) => void;
    onAvoidPointPress?: (point: AvoidPoint) => void;
    onMapPress?: (latitude: number, longitude: number) => void;
    onTilesFail?: () => void;
}

export const MapCanvas = ({
    style,
    center,
    zoom,
    routeGeometry,
    alternateGeometry,
    avoidPoints,
    destination,
    followUser,
    followKey,
    cameras = [],
    mapRef,
    pinnedPoint,
    focusedCameraId = null,
    onCameraPress,
    onAvoidPointPress,
    onMapPress,
    onTilesFail,
}: MapCanvasProps) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const headingRef = useRef(0);
    const [mapHeading, setMapHeading] = useState(0);
    const rememberHeading = useCallback((feature: GeoJSON.Feature) => {
        const heading = (feature.properties as { heading?: number } | null)?.heading;
        if (typeof heading !== 'number' || !Number.isFinite(heading)) {
            return;
        }
        const normalized = ((heading % 360) + 360) % 360;
        const delta = Math.abs(((normalized - headingRef.current + 540) % 360) - 180);
        if (delta < 0.5) {
            return;
        }
        headingRef.current = normalized;
        setMapHeading(normalized);
    }, []);

    const centerLatitude = center[0];
    const centerLongitude = center[1];
    const centerCoordinate = useMemo(
        () =>
            followUser
                ? undefined
                : ([centerLongitude, centerLatitude] as [number, number]),
        [centerLatitude, centerLongitude, followUser],
    );

    const routePoints = routeGeometry ? decodePolyline(routeGeometry) : [];
    const alternatePoints = alternateGeometry ? decodePolyline(alternateGeometry) : [];
    const alternateShape =
        alternatePoints.length > 1
            ? {
                type: 'LineString' as const,
                coordinates: alternatePoints.map((point) => [point.lon, point.lat]),
            }
            : null;
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
            mapStyle={style}
            logoEnabled={false}
            attributionEnabled
            attributionPosition={{ top: insets.top + spacing.sm, left: layout.screenPadding }}
            onDidFailLoadingMap={onTilesFail}
            onRegionDidChange={rememberHeading}
            onRegionIsChanging={rememberHeading}
            compassViewPosition={1}
            compassViewMargins={{
                x: layout.screenPadding,
                y: insets.top + spacing.sm + TOOLBAR_HEIGHT + spacing.sm,
            }}
            ref={mapRef}
            onPress={
                onMapPress
                    ? (feature: GeoJSON.Feature) => {
                        const geometry = feature.geometry as GeoJSON.Point | undefined;
                        const coordinates = geometry?.coordinates ?? [];
                        if (coordinates.length >= 2) {
                            onMapPress(coordinates[1], coordinates[0]);
                        }
                    }
                    : undefined
            }
        >
            <Camera
                centerCoordinate={centerCoordinate}
                followUserLocation={followUser}
                followUserMode={UserTrackingMode.Follow}
                key={followKey}
                zoomLevel={zoom}
            />

            <UserLocation visible renderMode={UserLocationRenderMode.Normal} />

            {alternateShape ? (
                <ShapeSource id="route-alternate-source" shape={alternateShape}>
                    <LineLayer
                        id="route-alternate-line"
                        style={{
                            lineColor: colors.primary,
                            lineOpacity: 0.3,
                            lineWidth: 3,
                        }}
                    />
                </ShapeSource>
            ) : null}

            {routeShape ? (
                <ShapeSource id="route-source" shape={routeShape}>
                    <LineLayer
                        id="route-line"
                        style={{
                            lineColor: colors.primary,
                            lineOpacity: 0.95,
                            lineWidth: 4,
                        }}
                    />
                </ShapeSource>
            ) : null}

            {destination ? (
                <MarkerView allowOverlap coordinate={[destination.longitude, destination.latitude]}>
                    <View style={[styles.pin, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.pinLabel, { color: colors.primaryForeground }]}>D</Text>
                    </View>
                </MarkerView>
            ) : null}

            {pinnedPoint ? (
                <MarkerView allowOverlap coordinate={[pinnedPoint[1], pinnedPoint[0]]}>
                    <View
                        importantForAccessibility="no-hide-descendants"
                        style={[styles.pinnedDot, { backgroundColor: colors.primary, borderColor: colors.card }]}
                    />
                </MarkerView>
            ) : null}

            {cameras.map((camera) => {
                const focused = camera.id === focusedCameraId;
                const accent = camera.isExpired ? colors.warning : colors.primary;
                const speedLabel =
                    camera.maxSpeedKmh !== null
                        ? `Speed camera, ${camera.maxSpeedKmh} kilometres per hour, ${camera.label}`
                        : `Speed camera, speed not published, ${camera.label}`;
                const stateLabel = camera.isExpired ? ', expired but still on the road' : '';
                const bearing = camera.bothWays ? camera.axisBearing : camera.watchBearing;
                const directionLabel = camera.bothWays
                    ? ', both directions'
                    : camera.watchBearing !== null
                        ? `, looks ${compassName(camera.watchBearing)}`
                        : '';

                return (
                    <MarkerView
                        allowOverlap
                        coordinate={[camera.longitude, camera.latitude]}
                        key={camera.id}
                    >
                        <View style={styles.cameraMarker}>
                            <TouchableOpacity
                                accessibilityLabel={
                                    focused
                                        ? `Selected camera, ${speedLabel}${stateLabel}${directionLabel}`
                                        : `${speedLabel}${stateLabel}${directionLabel}`
                                }
                                accessibilityRole="button"
                                onPress={() => onCameraPress?.(camera.id)}
                                style={styles.cameraHit}
                            >
                                {bearing !== null ? (
                                    <DirectionWedge
                                        bearing={bearing}
                                        bothWays={camera.bothWays}
                                        color={accent}
                                        mapHeading={mapHeading}
                                    />
                                ) : null}
                                <View
                                    style={[
                                        styles.cameraBody,
                                        {
                                            backgroundColor: camera.isAvoided ? accent : colors.card,
                                            borderColor: focused ? colors.foreground : accent,
                                            borderWidth: focused ? 3 : 2,
                                        },
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.cameraLens,
                                            {
                                                backgroundColor: camera.isAvoided
                                                    ? colors.primaryForeground
                                                    : accent,
                                            },
                                        ]}
                                    />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </MarkerView>
                );
            })}

            {avoidPoints.map((point, index) => (
                <MarkerView
                    allowOverlap
                    coordinate={[point.longitude, point.latitude]}
                    key={point.id}
                >
                    <View style={styles.avoidPinWrap}>
                        <TouchableOpacity
                            accessibilityHint="Opens the menu to remove this point"
                            accessibilityLabel={`Avoid point ${index + 1}`}
                            accessibilityRole="button"
                            onPress={() => onAvoidPointPress?.(point)}
                            style={[styles.avoidPin, { backgroundColor: colors.warning }]}
                        >
                            <Text style={[styles.avoidPinLabel, { color: colors.warningForeground }]}>
                                {(index + 1).toString()}
                            </Text>
                        </TouchableOpacity>
                        <View style={[styles.avoidTip, { borderTopColor: colors.warning }]} />
                    </View>
                </MarkerView>
            ))}
        </MapView>
    );
};

interface GoogleAttributionProps {
    visible: boolean;
}

/**
 * The google rules ask for the google maps mark and for the name of the data
 * provider. The words are enough when the space is tight, which it is here.
 */
export const GoogleAttribution = ({ visible }: GoogleAttributionProps) => {
    const { colors } = useTheme();

    if (!visible) {
        return null;
    }

    return (
        <View
            style={[
                styles.attributionChip,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    shadowColor: rgba(colors.foreground, 0.18),
                },
            ]}
        >
            <Text style={[styles.attributionBrand, { color: colors.foreground }]}>Google Maps</Text>
            <Text style={[styles.attributionData, { color: colors.mutedForeground }]}>
                Map data: Google, Maxar Technologies
            </Text>
        </View>
    );
};

interface RecenterButtonProps {
    disabled: boolean;
    onPress: () => void;
}

export const RecenterButton = ({ disabled, onPress }: RecenterButtonProps) => {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            accessibilityHint={
                disabled ? 'Your position is not known yet' : 'Moves the map back to your position'
            }
            accessibilityLabel="Center on me"
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            activeOpacity={0.8}
            disabled={disabled}
            onPress={onPress}
            style={[
                styles.recenterButton,
                {
                    backgroundColor: disabled ? colors.muted : colors.card,
                    borderColor: colors.border,
                    shadowColor: rgba(colors.foreground, 0.18),
                },
            ]}
        >
            <MaterialIcons
                color={disabled ? colors.mutedForeground : colors.primary}
                name={disabled ? 'location-disabled' : 'my-location'}
                size={24}
            />
        </TouchableOpacity>
    );
};

/** how many turns after the next one are shown in the band */
const MAX_COMPACT_STEPS = 2;

const stepIcon = (step: RouteStep): 'place' | 'turn-left' | 'turn-right' | 'arrow-upward' =>
    step.isArrival
        ? 'place'
        : step.turnDirection === 'left'
            ? 'turn-left'
            : step.turnDirection === 'right'
                ? 'turn-right'
                : 'arrow-upward';

interface RouteSheetProps {
    distanceLabel: string;
    durationLabel: string;
    arrivalLabel: string | null;
    destinationName: string | null;
    cameraCount: number;
    avoidPointCount: number;
    isComputing: boolean;
    isNavigating: boolean;
    isSaved: boolean;
    isStarting?: boolean;
    steps: RouteStep[];
    unitSystem: UnitSystem;
    arrived: boolean;
    variant: RouteVariant;
    hasSafeRoute: boolean;
    onVariantChange: (variant: RouteVariant) => void;
    onStart: () => void;
    onStop: () => void;
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
    isNavigating,
    isSaved,
    isStarting,
    steps,
    unitSystem,
    arrived,
    variant,
    hasSafeRoute,
    onVariantChange,
    onStart,
    onStop,
    onSave,
    onClear,
    onOpenDetails,
    onChooseDestination,
}: RouteSheetProps) => {
    const { colors } = useTheme();

    const following = steps.slice(1).filter((step) => !step.isArrival);
    const arrivalStep = steps.slice(1).find((step) => step.isArrival) ?? null;
    const visible = following.slice(0, MAX_COMPACT_STEPS);
    const hidden = following.length - visible.length;

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

            {isNavigating ? (
                <View
                    style={[styles.indicationBand, { backgroundColor: colors.muted, borderColor: colors.border }]}
                >
                    {arrived ? (
                        <View
                            accessible
                            accessibilityLabel="You have arrived at your destination. End of the route. Park safely."
                            style={styles.indicationHero}
                        >
                            <View style={[styles.indicationDisc, { backgroundColor: colors.success }]}>
                                <MaterialIcons color={colors.successForeground} name="place" size={28} />
                            </View>
                            <View style={styles.indicationText}>
                                <Text style={[styles.indicationTitle, { color: colors.foreground }]}>
                                    You have arrived at your destination.
                                </Text>
                                <Text style={[styles.indicationBody, { color: colors.mutedForeground }]}>
                                    End of the route. Park safely.
                                </Text>
                            </View>
                        </View>
                    ) : steps.length === 0 ? (
                        <View
                            accessible
                            accessibilityLabel="No turn information. Follow the highlighted line and the road signs."
                            style={styles.indicationHero}
                        >
                            <View style={[styles.indicationDisc, { backgroundColor: colors.secondary }]}>
                                <MaterialIcons
                                    color={colors.secondaryForeground}
                                    name="arrow-upward"
                                    size={28}
                                />
                            </View>
                            <View style={styles.indicationText}>
                                <Text style={[styles.indicationTitle, { color: colors.foreground }]}>
                                    No turn information
                                </Text>
                                <Text style={[styles.indicationBody, { color: colors.mutedForeground }]}>
                                    Follow the highlighted line and the road signs.
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <>
                            <View
                                accessible
                                accessibilityLabel={`In ${formatDistance(
                                    steps[0].distanceMeters,
                                    unitSystem,
                                )}. ${steps[0].instruction}`}
                                style={styles.indicationHero}
                            >
                                <View style={[styles.indicationDisc, { backgroundColor: colors.primary }]}>
                                    <MaterialIcons
                                        color={colors.primaryForeground}
                                        name={stepIcon(steps[0])}
                                        size={28}
                                    />
                                </View>
                                <View style={styles.indicationText}>
                                    <Text style={[styles.indicationValue, { color: colors.foreground }]}>
                                        <Text
                                            style={[styles.indicationIn, { color: colors.mutedForeground }]}
                                        >
                                            in{' '}
                                        </Text>
                                        {formatDistance(steps[0].distanceMeters, unitSystem)}
                                    </Text>
                                    <Text style={[styles.indicationBody, { color: colors.foreground }]}>
                                        {steps[0].instruction}
                                    </Text>
                                </View>
                            </View>

                            {following.length > 0 ? (
                                <View style={[styles.indicationSteps, { borderTopColor: colors.border }]}>
                                    {visible.map((step, index) => (
                                        <View
                                            accessible
                                            accessibilityLabel={`In ${formatDistance(
                                                step.distanceMeters,
                                                unitSystem,
                                            )}. ${step.instruction}`}
                                            key={`${step.instruction}-${index}`}
                                            style={styles.indicationStep}
                                        >
                                            <Text
                                                style={[
                                                    styles.indicationStepDistance,
                                                    { color: colors.foreground },
                                                ]}
                                            >
                                                {formatDistance(step.distanceMeters, unitSystem)}
                                            </Text>
                                            <MaterialIcons
                                                color={colors.mutedForeground}
                                                name={stepIcon(step)}
                                                size={18}
                                            />
                                            <Text
                                                numberOfLines={2}
                                                style={[
                                                    styles.indicationStepText,
                                                    { color: colors.foreground },
                                                ]}
                                            >
                                                {step.instruction}
                                            </Text>
                                        </View>
                                    ))}

                                    {hidden > 0 ? (
                                        <View
                                            accessible
                                            accessibilityLabel={`${hidden} more turn${hidden === 1 ? '' : 's'
                                                } ahead`}
                                            style={styles.indicationStep}
                                        >
                                            <Text style={styles.indicationStepDistance}>{''}</Text>
                                            <MaterialIcons
                                                color={colors.mutedForeground}
                                                name="more-horiz"
                                                size={18}
                                            />
                                            <Text
                                                style={[
                                                    styles.indicationMore,
                                                    { color: colors.mutedForeground },
                                                ]}
                                            >
                                                {`${hidden} more turn${hidden === 1 ? '' : 's'} ahead`}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {arrivalStep ? (
                                        <View
                                            accessible
                                            accessibilityLabel={`${arrivalStep.instruction} Last step.`}
                                            style={[
                                                styles.indicationStep,
                                                styles.indicationStepArrival,
                                                { borderTopColor: colors.border },
                                            ]}
                                        >
                                            <Text style={styles.indicationStepDistance}>{''}</Text>
                                            <MaterialIcons
                                                color={colors.mutedForeground}
                                                name="place"
                                                size={18}
                                            />
                                            <Text
                                                numberOfLines={2}
                                                style={[
                                                    styles.indicationStepText,
                                                    { color: colors.foreground },
                                                ]}
                                            >
                                                {arrivalStep.instruction}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            ) : null}
                        </>
                    )}
                </View>
            ) : null}

            {isComputing ? (
                <Text style={[styles.sheetHint, { color: colors.mutedForeground }]}>
                    Computing route...
                </Text>
            ) : (
                <View style={styles.metricsRow}>
                    <View
                        accessible
                        accessibilityLabel={`${isNavigating ? 'To the destination' : 'Distance'}, ${distanceLabel}`}
                        style={styles.metric}
                    >
                        <Text style={[styles.metricCaption, { color: colors.mutedForeground }]}>
                            {isNavigating ? 'to destination' : 'distance'}
                        </Text>
                        <Text style={[styles.metricValue, { color: colors.foreground }]}>
                            {distanceLabel}
                        </Text>
                    </View>
                    <View
                        accessible
                        accessibilityLabel={`${isNavigating ? 'Time left' : 'Duration'}, ${durationLabel}`}
                        style={styles.metric}
                    >
                        <Text style={[styles.metricCaption, { color: colors.mutedForeground }]}>
                            {isNavigating ? 'time left' : 'duration'}
                        </Text>
                        <Text style={[styles.metricValue, { color: colors.foreground }]}>
                            {durationLabel}
                        </Text>
                    </View>
                    <View
                        accessible
                        accessibilityLabel={`Arrival, ${arrivalLabel ?? 'unknown'}`}
                        style={styles.metric}
                    >
                        <Text style={[styles.metricCaption, { color: colors.mutedForeground }]}>
                            arrival
                        </Text>
                        <Text style={[styles.metricValue, { color: colors.foreground }]}>
                            {arrivalLabel ?? 'Unknown'}
                        </Text>
                    </View>
                </View>
            )}

            {hasSafeRoute ? (
                <View style={styles.variantRow}>
                    <SegmentedControl
                        onChange={(value) => onVariantChange(value as RouteVariant)}
                        options={[
                            { value: 'short', label: 'Shortest' },
                            { value: 'safe', label: 'Safest' },
                        ]}
                        value={variant}
                    />
                    <Text style={[styles.variantHint, { color: colors.mutedForeground }]}>
                        {variant === 'safe'
                            ? 'Stays on the main roads.'
                            : 'Cuts between neighbourhoods when it can.'}
                    </Text>
                </View>
            ) : null}

            <View style={styles.sheetActions}>
                <IconLabelButton
                    accessibilityLabel={isNavigating ? 'Stop the navigation' : 'Start the navigation'}
                    disabled={isStarting}
                    icon={isNavigating ? 'stop' : 'navigation'}
                    label={isStarting ? 'Sending...' : isNavigating ? 'Stop' : 'Start'}
                    onPress={isNavigating ? onStop : onStart}
                    variant="pill"
                />

                <IconLabelButton
                    accessibilityLabel={isSaved ? 'Route saved' : 'Save route'}
                    disabled={isSaved}
                    icon={isSaved ? 'bookmark' : 'bookmark-border'}
                    label={isSaved ? 'Saved' : 'Save'}
                    onPress={onSave}
                    selected={isSaved}
                    variant="pill"
                />
                <IconLabelButton
                    accessibilityLabel="Clear route"
                    icon="close"
                    label="Clear"
                    onPress={onClear}
                    variant="pill"
                />
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
}

export const AvoidPointList = ({ points, onDelete }: AvoidPointListProps) => {
    const { colors } = useTheme();

    if (points.length === 0) {
        return null;
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.avoidHeader}>
                <Text style={[styles.avoidTitle, { color: colors.foreground }]}>Points to avoid</Text>
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
            <Text style={[styles.placeAttribution, { color: colors.mutedForeground }]}>Google Maps</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    attributionBrand: {
        ...typography.subheading,
    },
    attributionChip: {
        alignSelf: 'flex-start',
        borderRadius: radii.sm,
        borderWidth: 1,
        elevation: 2,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 4,
    },
    attributionData: {
        ...typography.caption,
    },
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
        height: 22,
        justifyContent: 'center',
        width: 22,
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
        borderTopWidth: 4,
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
        height: 18,
        justifyContent: 'center',
        width: 18,
        zIndex: 1,
    },
    cameraHit: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    cameraLens: {
        borderRadius: radii.full,
        height: 7,
        width: 7,
    },
    cameraMarker: {
        height: 44,
        width: 44,
    },
    cameraOrbit: {
        alignItems: 'center',
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
    },
    cameraOrbitBoth: {
        justifyContent: 'space-between',
    },
    cameraWedge: {
        borderBottomWidth: 7,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        height: 0,
        marginTop: 1,
        width: 0,
    },
    cameraWedgeDown: {
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 7,
        height: 0,
        marginBottom: 1,
        width: 0,
    },
    card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        marginHorizontal: layout.screenPadding,
        marginTop: spacing.sm,
        padding: layout.cardPadding,
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
        marginHorizontal: -layout.cardPadding,
        marginTop: spacing.md,
        minHeight: 44,
        paddingHorizontal: layout.cardPadding,
    },
    indicationBand: {
        borderRadius: radii.lg,
        borderWidth: 1,
        gap: spacing.md,
        marginTop: spacing.md,
        padding: spacing.md,
    },
    indicationBody: {
        ...typography.body,
    },
    indicationDisc: {
        alignItems: 'center',
        borderRadius: radii.full,
        height: 44,
        justifyContent: 'center',
        width: 44,
    },
    indicationHero: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
    },
    indicationIn: {
        ...typography.caption,
        fontWeight: '700',
    },
    indicationMore: {
        ...typography.caption,
    },
    indicationStep: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
    },
    indicationStepArrival: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: spacing.sm,
    },
    indicationStepDistance: {
        ...typography.label,
        fontVariant: ['tabular-nums'] as ('tabular-nums')[],
        textAlign: 'right',
        width: 52,
    },
    indicationStepText: {
        ...typography.body,
        flex: 1,
        minWidth: 0,
    },
    indicationSteps: {
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: spacing.xs,
        marginTop: spacing.md,
        paddingTop: spacing.md,
    },
    indicationText: {
        flex: 1,
        gap: spacing.xs,
        minWidth: 0,
    },
    indicationTitle: {
        ...typography.heading,
    },
    indicationValue: {
        ...typography.readout,
    },
    map: {
        flex: 1,
    },
    metric: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
    },
    metricCaption: {
        ...typography.caption,
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
    pinnedDot: {
        borderRadius: radii.full,
        borderWidth: 2,
        elevation: 2,
        height: 14,
        width: 14,
    },
    placeAddress: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    placeAttribution: {
        ...typography.caption,
        marginTop: spacing.sm,
    },
    placeName: {
        ...typography.body,
    },
    placeRow: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        minHeight: 56,
        paddingVertical: spacing.sm,
    },
    recenterButton: {
        alignItems: 'center',
        borderRadius: radii.full,
        borderWidth: 1,
        elevation: 3,
        height: layout.buttonHeight,
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        width: layout.buttonHeight,
    },
    removeButton: {
        justifyContent: 'center',
        minHeight: layout.buttonHeight,
        paddingHorizontal: spacing.sm,
    },
    removeLabel: {
        ...typography.caption,
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
        paddingBottom: layout.cardPadding,
        paddingHorizontal: layout.cardPadding,
        paddingTop: layout.cardPadding,
    },
    sheetActions: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        justifyContent: 'center',
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
    variantHint: {
        ...typography.caption,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    variantRow: {
        marginBottom: spacing.md,
    },
});
