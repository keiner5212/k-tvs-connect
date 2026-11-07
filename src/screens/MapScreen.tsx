import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { CameraAttribution, CameraAvoidList } from '@components/cameras';
import { AvoidPointList, MapCanvas, RoutePreviewCard } from '@components/map';
import { Banner } from '@components/feedback';
import { useNow } from '@hooks/useNow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@hooks/useTheme';
import { useCameraStore } from '@stores/cameraStore';
import { useMapStore } from '@stores/mapStore';
import { useSettingsStore } from '@stores/settingsStore';
import { Place, RootStackParamList } from '@typings/types';
import { distanceAlongPath, decodePolyline, pointAtDistance } from '@utils/polyline';
import { rgba } from '@utils/hexToRgb';
import { formatDistance, formatDuration } from '@utils/format';
import { layout, radii, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const FALLBACK_CENTER: [number, number] = [4.5709, -74.2973];

export const MapScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const { settings } = useSettingsStore();
    const now = useNow();
    const insets = useSafeAreaInsets();
    const {
        addAvoidPoint,
        avoidPoints,
        clearAvoidPoints,
        clearRoute,
        compute,
        computing,
        destination,
        error,
        loadAvoidPoints,
        removeAvoidPoint,
        replayRoute,
        setReplayRoute,
        route,
        setDestination,
    } = useMapStore();

    const { nearby: nearbyCameras, routeSplit, publishedAt } = useCameraStore();
    const cameraMarkers = useMemo(
        () =>
            nearbyCameras.map((camera) => ({
                id: camera.cameraId,
                latitude: camera.latitude,
                longitude: camera.longitude,
                maxSpeedKmh: camera.maxSpeedKmh,
                isAvoided: camera.avoidEnabled,
                label: camera.address || 'ANSV camera',
            })),
        [nearbyCameras],
    );
    const [position, setPosition] = useState<[number, number] | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [followUser, setFollowUser] = useState(true);
    const [replay, setReplay] = useState<{
        points: { lat: number; lon: number }[];
        distance: number;
        duration: number;
        startedAt: number;
    } | null>(null);

    useEffect(() => {
        const load = async () => {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                setLocationError('Location permission needed to plan routes from your position.');
                return;
            }
            const current = await Location.getCurrentPositionAsync({});
            setPosition([current.coords.latitude, current.coords.longitude]);
        };
        void load();
    }, []);

    useEffect(() => {
        void loadAvoidPoints();
    }, [loadAvoidPoints]);

    useEffect(() => {
        if (destination && position) {
            void compute(position[0], position[1]);
        }
    }, [destination, position, compute]);

    const recompute = useCallback(() => {
        if (position) {
            void compute(position[0], position[1]);
        }
    }, [compute, position]);

    const onLongPress = useCallback(
        (latitude: number, longitude: number) => {
            void addAvoidPoint(latitude, longitude);
            recompute();
        },
        [addAvoidPoint, recompute],
    );

    const onRemoveAvoid = (id: string) => {
        void removeAvoidPoint(id);
        recompute();
    };

    const saveRoute = async (result: NonNullable<typeof route>, target: Place) => {
        const { insertRoute } = await import('@services/db/routeRepository');
        await insertRoute({
            name: target.name,
            originName: position ? 'Current position' : 'Start',
            destinationName: target.name,
            originLat: position?.[0] ?? target.latitude,
            originLon: position?.[1] ?? target.longitude,
            destinationLat: target.latitude,
            destinationLon: target.longitude,
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
            geometry: result.geometry,
            avoidPoints,
        });
    };

    const replayState = useMemo(() => {
        if (!replay || replay.points.length < 2) {
            return null;
        }
        const cumulative = distanceAlongPath(replay.points);
        const total = cumulative[cumulative.length - 1];
        const speed = replay.duration > 0 ? total / replay.duration : 0;
        const elapsed = (now - (replay.startedAt ?? now)) / 1000;
        const travelled = Math.min(total, elapsed * speed);
        const point = pointAtDistance(replay.points, cumulative, travelled);

        return {
            position: point ? ([point.lat, point.lon] as [number, number]) : null,
            remaining: Math.max(0, total - travelled),
            etaSeconds: speed > 0 ? Math.max(0, (total - travelled) / speed) : 0,
        };
    }, [replay, now]);

    useEffect(() => {
        if (!replayRoute) {
            return;
        }
        setReplay({
            points: decodePolyline(replayRoute.geometry),
            distance: replayRoute.distanceMeters,
            duration: replayRoute.durationSeconds,
            startedAt: Date.now(),
        });
        setReplayRoute(null);
    }, [replayRoute, setReplayRoute]);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <MapCanvas
                avoidPoints={avoidPoints}
                cameras={cameraMarkers}
                center={position ?? FALLBACK_CENTER}
                destination={destination}
                followUser={followUser}
                onCameraPress={(cameraId) => navigation.navigate('CameraDetail', { cameraId })}
                onLongPress={onLongPress}
                replayPosition={replayState?.position ?? null}
                routeGeometry={route?.geometry}
                styleURL={settings.mapStyleUrl}
                zoom={13}
            />

            <View style={[styles.toolbar, { top: insets.top + spacing.sm }]}>
                <TouchableOpacity
                    accessibilityLabel="Search for a place"
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('PlaceSearch')}
                    style={[styles.tool, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                    <Text style={[styles.toolLabel, { color: colors.foreground }]}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    accessibilityLabel="Cameras near you"
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('Cameras')}
                    style={[
                        styles.tool,
                        { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                >
                    <Text style={[styles.toolLabel, { color: colors.foreground }]}>Cameras</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    accessibilityLabel="Saved routes"
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('SavedRoutes')}
                    style={[styles.tool, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                    <Text style={[styles.toolLabel, { color: colors.foreground }]}>Routes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    accessibilityLabel={followUser ? 'Stop following me' : 'Follow me'}
                    accessibilityRole="button"
                    onPress={() => setFollowUser((value) => !value)}
                    style={[
                        styles.tool,
                        {
                            backgroundColor: followUser ? colors.primary : colors.card,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.toolLabel,
                            { color: followUser ? colors.primaryForeground : colors.foreground },
                        ]}
                    >
                        Me
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
                {locationError ? <Banner tone="warning" message={locationError} /> : null}
                {error ? (
                    <Banner
                        actionLabel="Retry"
                        message={error}
                        onAction={recompute}
                        tone="error"
                    />
                ) : null}

                {replayState && replay ? (
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.replayTitle, { color: colors.mutedForeground }]}>REPLAY</Text>
                        <Text style={[styles.replayDistance, { color: colors.foreground }]}>
                            {formatDistance(replayState.remaining, settings.unitSystem)}
                        </Text>
                        <Text style={[styles.replayEta, { color: colors.mutedForeground }]}>
                            {`${formatDuration(replayState.etaSeconds)} left`}
                        </Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => {
                                setReplay(null);
                                setFollowUser(false);
                            }}
                            style={[styles.replayStop, { backgroundColor: colors.secondary }]}
                        >
                            <Text style={[styles.replayStopLabel, { color: colors.secondaryForeground }]}>
                                Stop
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <RoutePreviewCard
                        distanceLabel={formatDistance(route?.distanceMeters ?? 0, settings.unitSystem)}
                        distanceMeters={route?.distanceMeters ?? 0}
                        durationLabel={formatDuration(route?.durationSeconds ?? 0)}
                        error={error}
                        isComputing={computing}
                        onClear={() => {
                            clearRoute();
                            setDestination(null);
                        }}
                        onGo={() => navigation.navigate('SavedRoutes')}
                        onSave={() => {
                            if (route && destination) {
                                void saveRoute(route, destination);
                            }
                        }}
                    />
                )}

                {routeSplit.sent > 0 ? (
                    <Banner
                        message={
                            routeSplit.leftOut > 0
                                ? `This route avoids ${routeSplit.sent} cameras. ${routeSplit.leftOut} nearby cameras were left out of the request.`
                                : `This route avoids ${routeSplit.sent} cameras. Every nearby camera was sent with the request.`
                        }
                        tone="info"
                    />
                ) : null}

                <CameraAvoidList
                    cameras={nearbyCameras.filter((camera) => camera.avoidEnabled)}
                    onStopAvoiding={(cameraId) =>
                        void useCameraStore.getState().setAvoidEnabled(cameraId, false)
                    }
                />

                <AvoidPointList
                    onClearAll={() => {
                        void clearAvoidPoints();
                        recompute();
                    }}
                    onDelete={onRemoveAvoid}
                    points={avoidPoints}
                />

                <CameraAttribution publishedAt={publishedAt} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    bottom: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
    },
    card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        marginHorizontal: layout.screenPadding,
        marginTop: spacing.sm,
        padding: layout.cardPadding,
    },
    replayDistance: {
        ...typography.readout,
        marginTop: spacing.xs,
    },
    replayEta: {
        ...typography.body,
    },
    replayStop: {
        alignItems: 'center',
        borderRadius: radii.md,
        justifyContent: 'center',
        marginTop: spacing.md,
        minHeight: layout.buttonHeight,
    },
    replayStopLabel: {
        ...typography.button,
    },
    replayTitle: {
        ...typography.caption,
        letterSpacing: 0.08,
    },
    screen: {
        flex: 1,
    },
    tool: {
        alignItems: 'center',
        borderRadius: radii.md,
        borderWidth: 1,
        elevation: 3,
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: spacing.md,
        shadowColor: rgba('#000000', 0.18),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
    },
    toolLabel: {
        ...typography.label,
    },
    toolbar: {
        gap: spacing.sm,
        position: 'absolute',
        right: layout.screenPadding,
    },
});

export default MapScreen;
