import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { IconLabelButton } from '@components/controls';
import { MapCanvas, RouteSheet } from '@components/map';
import { Banner } from '@components/feedback';
import { useNow } from '@hooks/useNow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@hooks/useTheme';
import { useBleStore } from '@stores/bleStore';
import { useCameraStore } from '@stores/cameraStore';
import { useLocationStore } from '@stores/locationStore';
import { useMapStore } from '@stores/mapStore';
import { useSettingsStore } from '@stores/settingsStore';
import { Place, RootStackParamList } from '@typings/types';
import { distanceAlongPath, decodePolyline, pointAtDistance } from '@utils/polyline';
import { formatClockTime, formatDistance, formatDuration } from '@utils/format';
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
        arrival,
        avoidPoints,
        clearRoute,
        compute,
        computing,
        destination,
        error,
        loadAvoidPoints,
        replayRoute,
        setReplayRoute,
        route,
        setDestination,
    } = useMapStore();

    const { nearby: nearbyCameras, routeSplit } = useCameraStore();
    const {
        navigation: progress,
        startNavigation: startNavigationAction,
        stopNavigation: stopNavigationAction,
    } = useMapStore();
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
    const position = useLocationStore((state) => state.position);
    const [sentToBike, setSentToBike] = useState<boolean | null>(null);
    const connectionState = useBleStore((state) => state.state);
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
            const store = useLocationStore.getState();
            if (store.permission === 'unknown') {
                await store.request();
            }
            if (useLocationStore.getState().permission !== 'granted') {
                setLocationError('Location permission needed to plan routes from your position.');
                return;
            }
            await useLocationStore.getState().startWatching();
        };
        void load();
    }, []);

    useEffect(() => {
        void useCameraStore.getState().load();
        const unsubscribe = useLocationStore.subscribe((state) => {
            void useCameraStore.getState().load();
            if (state.position) {
                useMapStore.getState().updateNavigation(state.position[0], state.position[1]);
            }
        });
        return unsubscribe;
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

    const startNavigation = async () => {
        const sent = await startNavigationAction();
        setSentToBike(sent);
    };

    const stopNavigation = () => {
        stopNavigationAction();
        setSentToBike(null);
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
                <IconLabelButton
                    accessibilityLabel="Search for a place"
                    icon="search"
                    label="Search"
                    onPress={() => navigation.navigate('PlaceSearch')}
                />
                <IconLabelButton
                    accessibilityLabel="Cameras near you"
                    icon="videocam"
                    label="Cameras"
                    onPress={() => navigation.navigate('Cameras')}
                />
                <IconLabelButton
                    accessibilityLabel="Saved routes"
                    icon="route"
                    label="Routes"
                    onPress={() => navigation.navigate('SavedRoutes')}
                />
                <IconLabelButton
                    accessibilityLabel={followUser ? 'Stop following me' : 'Follow me'}
                    icon="my-location"
                    label="Me"
                    onPress={() => setFollowUser((value) => !value)}
                    selected={followUser}
                />
            </View>

            <TouchableOpacity
                accessibilityLabel="Go to my position"
                accessibilityRole="button"
                onPress={() => {
                    setFollowUser(true);
                }}
                style={[
                    styles.recenter,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        bottom: insets.bottom + 200,
                    },
                ]}
            >
                <MaterialIcons color={colors.primary} name="my-location" size={22} />
            </TouchableOpacity>

            <View
                style={[styles.bottom, { paddingBottom: spacing.md }]}
            >
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
                    <RouteSheet
                        arrivalLabel={
                            progress.started
                                ? formatClockTime(now + progress.timeLeftSeconds * 1000)
                                : arrival
                                  ? formatClockTime(arrival.arrivalAt)
                                  : null
                        }
                        avoidPointCount={avoidPoints.length}
                        cameraCount={routeSplit.sent}
                        canStart={connectionState === 'connected'}
                        destinationName={destination?.name ?? null}
                        distanceLabel={formatDistance(
                            progress.started ? progress.distanceLeftMeters : route?.distanceMeters ?? 0,
                            settings.unitSystem,
                        )}
                        distanceToManeuverLabel={
                            progress.started
                                ? formatDistance(progress.distanceToManeuverMeters, settings.unitSystem)
                                : null
                        }
                        durationLabel={formatDuration(
                            progress.started ? progress.timeLeftSeconds : route?.durationSeconds ?? 0,
                        )}
                        instruction={progress.instruction}
                        isComputing={computing}
                        isNavigating={progress.started}
                        onChooseDestination={() => navigation.navigate('PlaceSearch')}
                        onClear={() => {
                            clearRoute();
                            setDestination(null);
                            stopNavigation();
                        }}
                        onOpenDetails={() => navigation.navigate('RouteDetails')}
                        onSave={() => {
                            if (route && destination) {
                                void saveRoute(route, destination);
                            }
                        }}
                        onStart={startNavigation}
                        onStop={stopNavigation}
                    />
                )}

                {routeSplit.leftOut > 0 && routeSplit.sent === 0 && nearbyCameras.length > 0 ? (
                    <Banner
                        message="The cameras on this route could not be avoided, the destination is inside an avoided area."
                        tone="warning"
                    />
                ) : null}

                {sentToBike === true ? (
                    <Banner message="Destination sent to the bike." tone="info" />
                ) : null}
                {sentToBike === false ? (
                    <Banner message="Could not write to the bike. Check the connection." tone="error" />
                ) : null}
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
    recenter: {
        alignItems: 'center',
        borderRadius: radii.full,
        borderWidth: 1,
        elevation: 3,
        height: 48,
        justifyContent: 'center',
        position: 'absolute',
        right: layout.screenPadding,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        width: 48,
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
    toolbar: {
        gap: spacing.sm,
        position: 'absolute',
        right: layout.screenPadding,
    },
});

export default MapScreen;
