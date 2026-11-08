import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { CameraAttribution, CameraAvoidList } from '@components/cameras';
import { AvoidPointList, PlaceSearchList } from '@components/map';
import { EmptyState } from '@components/feedback';
import { PrimaryButton, TextField, showConfirm } from '@components/controls';
import ScreenContainer from '@components/ScreenContainer';
import { useTheme } from '@hooks/useTheme';
import { connectionController } from '@ble/connectionController';
import { useBleStore } from '@stores/bleStore';
import { useCameraStore } from '@stores/cameraStore';
import { useLocationStore } from '@stores/locationStore';
import { useMapStore } from '@stores/mapStore';
import { useSettingsStore } from '@stores/settingsStore';
import { Place, RootStackParamList, SavedRoute } from '@typings/types';
import { searchPlaces } from '@services/photon.service';
import { deleteRoute, getRoute, listRoutes, renameRoute } from '@services/db/routeRepository';
import { formatClockTime, formatDistance, formatDuration } from '@utils/format';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export const PlaceSearchScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const { settings } = useSettingsStore();
    const setDestination = useMapStore((state) => state.setDestination);
    const position = useLocationStore((state) => state.position);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Place[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (query.trim().length < 3) {
            return;
        }

        const timer = setTimeout(() => {
            setSearching(true);
            setError(null);
            searchPlaces(settings.photonBaseUrl, query, 10, position)
                .then(setResults)
                .catch(() => setError('Place search failed. Check the geocoding url in Settings.'))
                .finally(() => setSearching(false));
        }, 300);

        return () => clearTimeout(timer);
    }, [query, settings.photonBaseUrl, position]);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScreenContainer edges={['bottom']} scroll keyboardShouldPersistTaps="handled">

            <TextField
                autoCapitalize="words"
                label="Where to"
                onChangeText={setQuery}
                placeholder="Street, neighbourhood or city"
                value={query}
            />

            {error ? (
                <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
            ) : results.length === 0 && !searching && query.trim().length >= 3 ? (
                <EmptyState description="Try a different name or address." title="No places found" />
            ) : null}

            <PlaceSearchList
                isSearching={searching}
                onSelect={(index) => {
                    const place = results[index];
                    if (place) {
                        setDestination(place);
                        navigation.goBack();
                    }
                }}
                results={results}
            />

            <View style={styles.footer}>
                <PrimaryButton
                    disabled={!results.length}
                    label="Close"
                    onPress={() => navigation.goBack()}
                    variant="secondary"
                />
            </View>
        
            </ScreenContainer>
        </View>
    );
};

export const SavedRoutesScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const [routes, setRoutes] = useState<SavedRoute[]>([]);
    const [renaming, setRenaming] = useState<string | null>(null);
    const [draft, setDraft] = useState('');

    const load = useCallback(async () => {
        setRoutes(await listRoutes());
    }, []);

    useEffect(() => {
        const run = async () => {
            setRoutes(await listRoutes());
        };
        void run();
    }, []);

    const saveRename = async (id: string) => {
        await renameRoute(id, draft);
        setRenaming(null);
        setDraft('');
        await load();
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScreenContainer edges={['bottom']} scroll>

            <Text style={[styles.title, { color: colors.foreground }]}>Saved routes</Text>

            {routes.length === 0 ? (
                <EmptyState
                    description="Plan a route on the map and save it to ride it again."
                    title="No saved routes"
                />
            ) : null}

            {routes.map((route) => (
                <View key={route.id} style={styles.routeRow}>
                    {renaming === route.id ? (
                        <>
                            <TextField
                                label="Name"
                                onChangeText={setDraft}
                                value={draft}
                            />
                            <View style={styles.routeActions}>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() => void saveRename(route.id)}
                                    style={styles.routeAction}
                                >
                                    <Text style={[styles.routeActionLabel, { color: colors.primary }]}>
                                        Save
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() => setRenaming(null)}
                                    style={styles.routeAction}
                                >
                                    <Text
                                        style={[styles.routeActionLabel, { color: colors.mutedForeground }]}
                                    >
                                        Cancel
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                accessibilityRole="button"
                                onPress={() => navigation.navigate('RoutePreview', { routeId: route.id })}
                                style={styles.routeMain}
                            >
                                <Text style={[styles.routeName, { color: colors.foreground }]}>
                                    {route.name}
                                </Text>
                                <Text style={[styles.routeMeta, { color: colors.mutedForeground }]}>
                                    {`${formatDistance(route.distanceMeters, 'metric')} · ${formatDuration(route.durationSeconds)} · ${route.avoidPoints.length} avoided`}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                accessibilityLabel={`Rename ${route.name}`}
                                accessibilityRole="button"
                                onPress={() => {
                                    setRenaming(route.id);
                                    setDraft(route.name);
                                }}
                                style={styles.routeAction}
                            >
                                <Text style={[styles.routeActionLabel, { color: colors.primary }]}>
                                    Rename
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                accessibilityLabel={`Delete ${route.name}`}
                                accessibilityRole="button"
                                onPress={() =>
                                    showConfirm(
                                        `Delete ${route.name}?`,
                                        'The route and its avoid points are removed from this device.',
                                        'Delete',
                                        () => {
                                            void deleteRoute(route.id).then(load);
                                        },
                                        true,
                                    )
                                }
                                style={styles.routeAction}
                            >
                                <Text style={[styles.routeActionLabel, { color: colors.error }]}>
                                    Delete
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            ))}
        
            </ScreenContainer>
        </View>
    );
};

export const RoutePreviewScreen = () => {
    const navigation = useNavigation<Navigation>();
    const route = useRoute<RouteProp<RootStackParamList, 'RoutePreview'>>();
    const { colors } = useTheme();
    const setReplayRoute = useMapStore((state) => state.setReplayRoute);
    const [saved, setSaved] = useState<SavedRoute | null>(null);

    useEffect(() => {
        const load = async () => {
            setSaved((await getRoute(route.params.routeId)) ?? null);
        };
        void load();
    }, [route.params.routeId]);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScreenContainer edges={['bottom']} scroll>

            {saved ? (
                <>
                    <Text style={[styles.title, { color: colors.foreground }]}>{saved.name}</Text>
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                        {`${formatDistance(saved.distanceMeters, 'metric')} · ${formatDuration(saved.durationSeconds)}`}
                    </Text>
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                        {`${saved.avoidPoints.length} points to avoid`}
                    </Text>

                    <View style={styles.footer}>
                        <PrimaryButton
                            label="Replay this route"
                            onPress={() => {
                                setReplayRoute({
                                    geometry: saved.geometry,
                                    distanceMeters: saved.distanceMeters,
                                    durationSeconds: saved.durationSeconds,
                                });
                                navigation.navigate('Main');
                            }}
                        />
                    </View>
                </>
            ) : (
                <EmptyState description="This route is no longer saved." title="Not found" />
            )}
        
            </ScreenContainer>
        </View>
    );
};

const styles = StyleSheet.create({
    error: {
        ...typography.caption,
        marginBottom: spacing.md,
    },
    footer: {
        marginTop: layout.sectionGap,
    },
    meta: {
        ...typography.body,
    },
    metric: {
        flex: 1,
    },
    metricLabel: {
        ...typography.caption,
    },
    metricRow: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginTop: spacing.md,
    },
    metricValue: {
        ...typography.readout,
    },
    note: {
        ...typography.body,
        marginTop: spacing.sm,
    },
    routeAction: {
        justifyContent: 'center',
        minHeight: layout.buttonHeight,
        paddingRight: spacing.md,
    },
    routeActionLabel: {
        ...typography.label,
    },
    routeActions: {
        flexDirection: 'row',
        gap: spacing.lg,
    },
    routeMain: {
        marginBottom: spacing.sm,
    },
    routeMeta: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    routeName: {
        ...typography.subheading,
    },
    routeRow: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingVertical: spacing.md,
    },
    screen: {
        flex: 1,
    },
    sectionHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: layout.sectionGap,
    },
    sectionTitle: {
        ...typography.subheading,
    },
    subtitle: {
        ...typography.body,
        marginTop: spacing.xs,
    },
    title: {
        ...typography.title,
        marginBottom: spacing.sm,
    },
});


/**
 * Everything about the current route on one screen, so the map sheet can stay
 * short.
 */
export const RouteDetailsScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors } = useTheme();
    const { settings } = useSettingsStore();
    const connectionState = useBleStore((state) => state.state);
    const { nearby: nearbyCameras, routeSplit, publishedAt, stale } = useCameraStore();
    const { arrival, avoidPoints, destination, route } = useMapStore();
    const [sent, setSent] = useState<boolean | null>(null);

    const staleCameraData = stale;

    if (!route || !destination) {
        return (
            <ScreenContainer edges={['bottom']}>
                <EmptyState
                    actionLabel="Back to the map"
                    description="Plan a route on the map first."
                    onAction={() => navigation.navigate('Main')}
                    title="No route"
                />
            </ScreenContainer>
        );
    }

    const cameras = nearbyCameras.filter((camera) => camera.avoidEnabled);

    return (
        <ScreenContainer edges={['bottom']} scroll>
            <Text style={[styles.title, { color: colors.foreground }]}>{destination.name}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                From: Current position
            </Text>

            <View style={styles.metricRow}>
                <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                        Distance
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.foreground }]}>
                        {formatDistance(route.distanceMeters, settings.unitSystem)}
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                        Duration
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.foreground }]}>
                        {formatDuration(route.durationSeconds)}
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                        Arrival
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.foreground }]}>
                        {arrival ? formatClockTime(arrival.arrivalAt) : 'Unknown'}
                    </Text>
                </View>
            </View>

            {arrival ? (
                <Text style={[styles.note, { color: colors.mutedForeground }]}>
                    {arrival.explanation}
                </Text>
            ) : null}

            <View style={styles.sectionHeader}>
                <MaterialIcons color={colors.mutedForeground} name="send" size={18} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Send to the bike
                </Text>
            </View>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
                The app sends the destination address to the bike as text. It does not send the
                route.
            </Text>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
                {connectionState === 'connected'
                    ? 'The bike is connected.'
                    : 'The bike is not connected. Turn the bike on to send the destination.'}
            </Text>
            <PrimaryButton
                disabled={connectionState !== 'connected'}
                icon="send"
                label="Send destination to bike"
                onPress={() => {
                    void connectionController
                        .sendDestinationToCluster(destination.address || destination.name)
                        .then(setSent);
                }}
            />
            {sent === true ? (
                <Text style={[styles.note, { color: colors.success }]}>
                    Destination sent to the bike.
                </Text>
            ) : null}
            {sent === false ? (
                <Text style={[styles.note, { color: colors.error }]}>
                    Could not write to the bike. Check the connection.
                </Text>
            ) : null}

            <View style={styles.sectionHeader}>
                <MaterialIcons color={colors.mutedForeground} name="videocam" size={18} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Cameras on this route
                </Text>
            </View>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
                {routeSplit.leftOut > 0
                    ? `${routeSplit.sent} cameras sent with the route. ${routeSplit.leftOut} nearby cameras were left out.`
                    : `${routeSplit.sent} cameras sent with the route.`}
            </Text>
            {cameras.length === 0 ? (
                <Text style={[styles.note, { color: colors.mutedForeground }]}>
                    No cameras on this route.
                </Text>
            ) : (
                <CameraAvoidList
                    cameras={cameras}
                    onStopAvoiding={(cameraId) =>
                        void useCameraStore.getState().setAvoidEnabled(cameraId, false)
                    }
                />
            )}

            <View style={styles.sectionHeader}>
                <MaterialIcons color={colors.mutedForeground} name="add-location-alt" size={18} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Points to avoid
                </Text>
            </View>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
                Long press the map to add a point to avoid.
            </Text>
            <AvoidPointList
                onDelete={(id) => void useMapStore.getState().removeAvoidPoint(id)}
                points={avoidPoints}
            />

            <View style={styles.sectionHeader}>
                <MaterialIcons color={colors.mutedForeground} name="info" size={18} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Data sources</Text>
            </View>
            <CameraAttribution publishedAt={publishedAt} />
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
                Route computed by Valhalla. Map data by OpenStreetMap contributors.
            </Text>
            {staleCameraData ? (
                <Text style={[styles.note, { color: colors.warning }]}>
                    Camera data may be out of date.
                </Text>
            ) : null}
        </ScreenContainer>
    );
};
