import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { IconButton } from '@components/controls';
import { MapCanvas, RouteSheet } from '@components/map';
import { Banner } from '@components/feedback';
import { useNow } from '@hooks/useNow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@hooks/useTheme';
import { useBleStore } from '@stores/bleStore';
import { useCameraStore } from '@stores/cameraStore';
import { useLocationStore } from '@stores/locationStore';
import { connectionController } from '@ble/connectionController';
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
            setPosition(useLocationStore.getState().position);
        };
        void load();
    }, []);

    useEffect(() => {
        void useCameraStore.getState().load();
        const unsubscribe = useLocationStore.subscribe((state) => {
            setPosition(state.position);
            void useCameraStore.getState().load();
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

    const sendToBike = async () => {
        if (!destination) {
            return;
        }
        const address = destination.address || destination.name;
        const sent = await connectionController.sendDestinationToCluster(address);
        setSentToBike(sent);
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
                <IconButton
                    accessibilityLabel="Search for a place"
                    icon="search"
                    onPress={() => navigation.navigate('PlaceSearch')}
                />
                <IconButton
                    accessibilityLabel="Cameras near you"
                    icon="videocam"
                    onPress={() => navigation.navigate('Cameras')}
                />
                <IconButton
                    accessibilityLabel="Saved routes"
                    icon="route"
                    onPress={() => navigation.navigate('SavedRoutes')}
                />
                <IconButton
                    accessibilityLabel={followUser ? 'Stop following me' : 'Follow me'}
                    icon="my-location"
                    onPress={() => setFollowUser((value) => !value)}
                    selected={followUser}
                />
            </View>

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
                        arrivalLabel={arrival ? formatClockTime(arrival.arrivalAt) : null}
                        avoidPointCount={avoidPoints.length}
                        cameraCount={routeSplit.sent}
                        canSendToBike={connectionState === 'connected'}
                        destinationName={destination?.name ?? null}
                        distanceLabel={formatDistance(route?.distanceMeters ?? 0, settings.unitSystem)}
                        durationLabel={formatDuration(route?.durationSeconds ?? 0)}
                        isComputing={computing}
                        onChooseDestination={() => navigation.navigate('PlaceSearch')}
                        onClear={() => {
                            clearRoute();
                            setDestination(null);
                        }}
                        onOpenDetails={() => navigation.navigate('RouteDetails')}
                        onSave={() => {
                            if (route && destination) {
                                void saveRoute(route, destination);
                            }
                        }}
                        onSendToBike={sendToBike}
                    />
                )}

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
