import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    BackHandler,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MapViewRef } from '@maplibre/maplibre-react-native';

import { IconLabelButton } from '@components/controls';
import { GoogleAttribution, MapCanvas, RecenterButton, RouteSheet, TOOLBAR_HEIGHT } from '@components/map';
import {
    AvoidPointMenu,
    AVOID_POINT_MENU_WIDTH,
    CAMERA_MENU_WIDTH,
    CameraMenu,
    POINT_MENU_WIDTH,
    PointMenu,
} from '@components/mapMenu';
import { Banner } from '@components/feedback';
import { useNow } from '@hooks/useNow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@hooks/useTheme';
import { useBleStore } from '@stores/bleStore';
import { useCameraStore } from '@stores/cameraStore';
import { useLocationStore } from '@stores/locationStore';
import { useMapStore } from '@stores/mapStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useTilesStore } from '@stores/tilesStore';
import { AvoidPoint, Place, RootStackParamList, TrafficCamera } from '@typings/types';
import { distanceAlongPath, decodePolyline, pointAtDistance } from '@utils/polyline';
import { distanceMeters } from '@utils/geo';
import { formatClockTime, formatDistance, formatDuration } from '@utils/format';
import { compassName } from '@utils/cameraSense';
import { GEOCODE_COUNTRY } from '@config/geocoding';
import { layout, radii, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const FALLBACK_CENTER: [number, number] = [11.2407, -74.1947];

/**
 * The route is asked again when the rider has moved this far. Without it the
 * route was asked again on every position update, which is every couple of
 * seconds while riding.
 */
const RECOMPUTE_MIN_METERS = 200;

/** the zoom when the map points at one camera, close enough to tell them apart */
const FOCUS_ZOOM = 18;

/** a tap on the map that lands this close to an avoid point opens its menu */
const AVOID_TAP_METERS = 15;

/** the gap between the point and the menu that opens on it */
const MENU_GAP = 16;

interface MenuPoint {
    latitude: number;
    longitude: number;
    x: number;
    y: number;
}

/** what the menu of a camera says about the direction it watches */
const watchTextOf = (camera: TrafficCamera): string | null => {
    const sense = camera.sense;
    if (!sense) {
        return null;
    }
    if (sense.bothWays) {
        return 'Watches both directions of the street';
    }
    if (sense.riskyBearing !== null) {
        return `Looks towards the ${compassName(sense.riskyBearing)}`;
    }
    return 'The agency did not publish the side it watches';
};

export const MapScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const { settings } = useSettingsStore();
    const now = useNow();
    const insets = useSafeAreaInsets();
    const {
        addAvoidPoint,
        arrival,
        routes,
        variant,
        setVariant,
        avoidPoints,
        cameraKey,
        clearRoute,
        compute,
        computing,
        destination,
        error,
        focus,
        loadAvoidPoints,
        recenter,
        removeAvoidPoint,
        replayRoute,
        setReplayRoute,
        route,
        setDestination,
    } = useMapStore();

    const { cameras: allCameras, nearby: nearbyCameras, routeSplit } = useCameraStore();
    const {
        googleStyle,
        unavailable: tilesUnavailable,
        load: loadTiles,
        useOpenFreeMap,
    } = useTilesStore();
    const {
        navigation: progress,
        startNavigation: startNavigationAction,
        stopNavigation: stopNavigationAction,
    } = useMapStore();
    const focusedCamera = useMemo(() => {
        const cameraId = focus?.cameraId;
        if (!cameraId) {
            return null;
        }
        return allCameras.find((camera) => camera.cameraId === cameraId) ?? null;
    }, [allCameras, focus?.cameraId]);

    const cameraMarkers = useMemo(() => {
        const markers = nearbyCameras.map((camera) => ({
            id: camera.cameraId,
            latitude: camera.latitude,
            longitude: camera.longitude,
            maxSpeedKmh: camera.maxSpeedKmh,
            isAvoided: camera.avoidEnabled,
            isExpired: camera.operatingState === 'Expired',
            watchBearing: camera.sense?.riskyBearing ?? null,
            label: camera.address || 'ANSV camera',
        }));
        if (focusedCamera && !markers.some((marker) => marker.id === focusedCamera.cameraId)) {
            markers.push({
                id: focusedCamera.cameraId,
                latitude: focusedCamera.latitude,
                longitude: focusedCamera.longitude,
                maxSpeedKmh: focusedCamera.maxSpeedKmh,
                isAvoided: focusedCamera.avoidEnabled,
                isExpired: focusedCamera.operatingState === 'Expired',
                watchBearing: focusedCamera.sense?.riskyBearing ?? null,
                label: focusedCamera.address || 'ANSV camera',
            });
        }
        return markers;
    }, [focusedCamera, nearbyCameras]);
    const position = useLocationStore((state) => state.position);
    const [sentToBike, setSentToBike] = useState<boolean | null>(null);
    const [startingNavigation, setStartingNavigation] = useState(false);
    const connectionState = useBleStore((state) => state.state);
    const [locationError, setLocationError] = useState<string | null>(null);
    const mapRef = useRef<MapViewRef>(null);
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const [pointMenu, setPointMenu] = useState<MenuPoint | null>(null);
    const [cameraMenu, setCameraMenu] = useState<(MenuPoint & { camera: TrafficCamera }) | null>(
        null,
    );
    const [avoidMenu, setAvoidMenu] = useState<(MenuPoint & { id: string; number: number }) | null>(
        null,
    );
    const [menuHeight, setMenuHeight] = useState(0);
    const [bottomStackTop, setBottomStackTop] = useState(screenHeight);
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
            await useLocationStore.getState().startWatching('map');
        };
        void load();
        return () => useLocationStore.getState().stopWatching('map');
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
        if (settings.mapProvider === 'google') {
            void loadTiles();
        }
    }, [loadTiles, settings.mapProvider]);

    const lastComputed = useRef<{
        destinationId: string;
        latitude: number;
        longitude: number;
    } | null>(null);

    useEffect(() => {
        if (!destination || !position) {
            return;
        }
        const last = lastComputed.current;
        if (last && last.destinationId === destination.id) {
            const moved = distanceMeters(
                { lat: last.latitude, lon: last.longitude },
                { lat: position[0], lon: position[1] },
            );
            if (moved < RECOMPUTE_MIN_METERS) {
                return;
            }
        }
        lastComputed.current = {
            destinationId: destination.id,
            latitude: position[0],
            longitude: position[1],
        };
        void compute(position[0], position[1]);
    }, [destination, position, compute]);

    /**
     * A new destination puts the camera back on the rider. The maplibre
     * camera drops the tracking when the rider drags the map and it never
     * picks it up again on its own.
     */
    const recompute = useCallback(() => {
        if (position) {
            void compute(position[0], position[1]);
        }
    }, [compute, position]);

    const openAvoidMenu = useCallback(
        async (point: AvoidPoint) => {
            const screen = await mapRef.current?.getPointInView([
                point.longitude,
                point.latitude,
            ]);
            if (!screen) {
                return;
            }
            const index = avoidPoints.findIndex((item) => item.id === point.id);
            setPointMenu(null);
            setAvoidMenu({
                id: point.id,
                latitude: point.latitude,
                longitude: point.longitude,
                number: index + 1,
                x: screen[0],
                y: screen[1],
            });
        },
        [avoidPoints],
    );

    const onMapPress = useCallback(
        async (latitude: number, longitude: number) => {
            const screen = await mapRef.current?.getPointInView([longitude, latitude]);
            if (!screen) {
                return;
            }
            const near = avoidPoints.find(
                (point) =>
                    distanceMeters(
                        { lat: point.latitude, lon: point.longitude },
                        { lat: latitude, lon: longitude },
                    ) < AVOID_TAP_METERS,
            );
            if (near) {
                await openAvoidMenu(near);
                return;
            }
            setAvoidMenu(null);
            setCameraMenu(null);
            setPointMenu({ latitude, longitude, x: screen[0], y: screen[1] });
        },
        [avoidPoints, openAvoidMenu],
    );

    const avoidTappedPoint = useCallback(() => {
        if (!pointMenu) {
            return;
        }
        void addAvoidPoint(pointMenu.latitude, pointMenu.longitude);
        setPointMenu(null);
        recompute();
    }, [addAvoidPoint, pointMenu, recompute]);

    const routeToTappedPoint = useCallback(() => {
        if (!pointMenu) {
            return;
        }
        const { latitude, longitude } = pointMenu;
        setPointMenu(null);
        setDestination({
            id: `pinned-${latitude}-${longitude}`,
            name: 'Pinned point',
            address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            latitude,
            longitude,
            countryCode: GEOCODE_COUNTRY,
        });
    }, [pointMenu, setDestination]);

    const removeAvoidedPoint = useCallback(() => {
        if (!avoidMenu) {
            return;
        }
        void removeAvoidPoint(avoidMenu.id);
        setAvoidMenu(null);
        recompute();
    }, [avoidMenu, recompute, removeAvoidPoint]);

    const openCameraMenu = useCallback(
        async (cameraId: string) => {
            const camera = allCameras.find((item) => item.cameraId === cameraId);
            if (!camera) {
                return;
            }
            const screen = await mapRef.current?.getPointInView([
                camera.longitude,
                camera.latitude,
            ]);
            if (!screen) {
                return;
            }
            setPointMenu(null);
            setAvoidMenu(null);
            setCameraMenu({
                camera,
                latitude: camera.latitude,
                longitude: camera.longitude,
                x: screen[0],
                y: screen[1],
            });
        },
        [allCameras],
    );

    const menuStyle = useCallback((x: number, y: number, width: number) => {
        const left = Math.min(
            Math.max(x - width / 2, layout.screenPadding),
            screenWidth - width - layout.screenPadding,
        );
        const topLimit = insets.top + spacing.sm + TOOLBAR_HEIGHT;
        const above = y - MENU_GAP - menuHeight;
        const below = y + MENU_GAP;
        const top =
            above >= topLimit
                ? above
                : below + menuHeight <= bottomStackTop
                    ? below
                    : Math.max(topLimit, bottomStackTop - menuHeight);
        return { left, top };
    },
        [bottomStackTop, insets.top, menuHeight, screenWidth],
    );

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!pointMenu && !avoidMenu && !cameraMenu) {
                return false;
            }
            setPointMenu(null);
            setAvoidMenu(null);
            setCameraMenu(null);
            return true;
        });
        return () => subscription.remove();
    }, [avoidMenu, cameraMenu, pointMenu]);

    const startNavigation = async () => {
        setStartingNavigation(true);
        try {
            const sent = await startNavigationAction();
            setSentToBike(sent);
        } finally {
            setStartingNavigation(false);
        }
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
                center={focus ? [focus.latitude, focus.longitude] : position ?? FALLBACK_CENTER}
                destination={destination}
                followKey={cameraKey}
                followUser={position !== null && !focus}
                focusedCameraId={focus?.cameraId ?? null}
                mapRef={mapRef}
                pinnedPoint={pointMenu ? [pointMenu.latitude, pointMenu.longitude] : null}
                onAvoidPointPress={openAvoidMenu}
                onCameraPress={(cameraId) => void openCameraMenu(cameraId)}
                onMapPress={onMapPress}
                onTilesFail={useOpenFreeMap}
                replayPosition={replayState?.position ?? null}
                alternateGeometry={
                    variant === 'safe' ? routes.short?.geometry : routes.safe?.geometry
                }
                routeGeometry={route?.geometry}
                style={
                    settings.mapProvider === 'google' && googleStyle
                        ? googleStyle
                        : settings.mapStyleUrl
                }
                zoom={focus ? FOCUS_ZOOM : 13}
            />

            {pointMenu ? (
                <PointMenu
                    latitude={pointMenu.latitude}
                    longitude={pointMenu.longitude}
                    onAvoid={avoidTappedPoint}
                    onCancel={() => setPointMenu(null)}
                    onMeasure={setMenuHeight}
                    onRoute={routeToTappedPoint}
                    style={menuStyle(pointMenu.x, pointMenu.y, POINT_MENU_WIDTH)}
                />
            ) : null}

            {cameraMenu ? (
                <CameraMenu
                    isAvoided={cameraMenu.camera.avoidEnabled}
                    label={cameraMenu.camera.address || 'ANSV camera'}
                    onCancel={() => setCameraMenu(null)}
                    onDetails={() => {
                        const { camera } = cameraMenu;
                        setCameraMenu(null);
                        navigation.navigate('CameraDetail', { cameraId: camera.cameraId });
                    }}
                    onMeasure={setMenuHeight}
                    onToggleAvoid={() => {
                        const { camera } = cameraMenu;
                        setCameraMenu(null);
                        void useCameraStore
                            .getState()
                            .setAvoidEnabled(camera.cameraId, !camera.avoidEnabled);
                        recompute();
                    }}
                    style={menuStyle(cameraMenu.x, cameraMenu.y, CAMERA_MENU_WIDTH)}
                    watchText={watchTextOf(cameraMenu.camera)}
                />
            ) : null}

            {avoidMenu ? (
                <AvoidPointMenu
                    number={avoidMenu.number}
                    onMeasure={setMenuHeight}
                    onRemove={removeAvoidedPoint}
                    style={menuStyle(avoidMenu.x, avoidMenu.y, AVOID_POINT_MENU_WIDTH)}
                />
            ) : null}

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
            </View>

            <View
                onLayout={(event) => setBottomStackTop(event.nativeEvent.layout.y)}
                style={[styles.bottom, { paddingBottom: spacing.md }]}
            >
                {focusedCamera ? (
                    <Banner
                        message={`Camera: ${focusedCamera.address || 'ANSV camera'}${focusedCamera.maxSpeedKmh !== null
                            ? `, ${focusedCamera.maxSpeedKmh} km/h`
                            : ''
                            }`}
                        tone="info"
                    />
                ) : null}
                {tilesUnavailable ? (
                    <Banner message="Google map unavailable, using OpenFreeMap instead." tone="info" />
                ) : null}
                {locationError ? <Banner tone="warning" message={locationError} /> : null}
                {error ? (
                    <Banner
                        actionLabel="Retry"
                        message={error}
                        onAction={recompute}
                        tone="error"
                    />
                ) : null}

                <View style={styles.mapControlsRow}>
                    <View style={styles.mapControlsSlot}>
                        <GoogleAttribution
                            visible={
                                settings.mapProvider === 'google' &&
                                googleStyle !== null &&
                                !tilesUnavailable
                            }
                        />
                    </View>
                    <RecenterButton disabled={!position} onPress={recenter} />
                </View>

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
                                recenter();
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
                        isStarting={startingNavigation}
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
                        hasSafeRoute={routes.safe !== null}
                        onStart={startNavigation}
                        onStop={stopNavigation}
                        onVariantChange={(next) => setVariant(next)}
                        variant={variant}
                    />
                )}

                {route?.avoidOutcome?.relaxed ? (
                    <Banner
                        message="The router could not avoid every camera on this route, some of them are still on the way."
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
    mapControlsRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
        marginHorizontal: layout.screenPadding,
    },
    mapControlsSlot: {
        flex: 1,
        pointerEvents: 'box-none',
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
