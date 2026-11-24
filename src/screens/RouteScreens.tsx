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
import { useNow } from '@hooks/useNow';
import { useTheme } from '@hooks/useTheme';
import { useCameraStore } from '@stores/cameraStore';
import { useLocationStore } from '@stores/locationStore';
import { useMapStore } from '@stores/mapStore';
import { useSettingsStore } from '@stores/settingsStore';
import { Place, RootStackParamList, SavedRoute, AchievedTime } from '@typings/types';
import { searchPlaces } from '@services/geocoding.service';
import { MIN_QUERY_LENGTH } from '@config/geocoding';
import { deleteRoute, getRoute, listRoutes, renameRoute } from '@services/db/routeRepository';
import { estimateRoute } from '@services/eta.service';
import { formatClockTime, formatDay, formatDistance, formatDuration } from '@utils/format';
import { layout, radii, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/** the time a saved route is expected to take */
const estimateOf = (route: SavedRoute) =>
    estimateRoute(route.achievedTimes, route.durationSeconds);

/**
 * The times the rider took on a route, the newest first.
 */
const AchievedTimesList = ({ times }: { times: AchievedTime[] }) => {
    const { colors } = useTheme();

    if (times.length === 0) {
        return null;
    }

    return (
        <>
            <View style={styles.sectionHeader}>
                <MaterialIcons color={colors.mutedForeground} name="timer" size={18} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Times you rode it</Text>
            </View>
            {times.map((time, index) => (
                <View
                    accessible
                    accessibilityLabel={`${formatDuration(time.seconds)}, ${formatDay(time.achievedAt)}`}
                    key={`${time.achievedAt}-${index}`}
                    style={styles.timeRow}
                >
                    <Text style={[styles.timeValue, { color: colors.foreground }]}>
                        {formatDuration(time.seconds)}
                    </Text>
                    <Text style={[styles.timeDay, { color: colors.mutedForeground }]}>
                        {formatDay(time.achievedAt)}
                    </Text>
                </View>
            ))}
        </>
    );
};

export const PlaceSearchScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const setDestination = useMapStore((state) => state.setDestination);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Place[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (query.trim().length < MIN_QUERY_LENGTH) {
            return;
        }

        const timer = setTimeout(() => {
            setSearching(true);
            setError(null);
            searchPlaces(query, useLocationStore.getState().position)
                .then((outcome) => {
                    if (outcome.ok) {
                        setResults(outcome.places);
                        return;
                    }
                    setResults([]);
                    setError(outcome.message);
                })
                .catch(() => setError('The search service failed.'))
                .finally(() => setSearching(false));
        }, 600);

        return () => clearTimeout(timer);
    }, [query]);

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
                ) : results.length === 0 && !searching && query.trim().length >= MIN_QUERY_LENGTH ? (
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

                {results.length > 0 ? (
                    <Text style={[styles.attribution, { color: colors.mutedForeground }]}>
                        Results by Google
                    </Text>
                ) : null}

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
                                    accessibilityLabel={`${route.name}. ${formatDistance(route.distanceMeters, 'metric')}. ${formatDuration(estimateOf(route).seconds)}. ${route.avoidPoints.length} avoided${route.achievedTimes.length > 0 ? `. Ridden ${route.achievedTimes.length} time${route.achievedTimes.length === 1 ? '' : 's'}, last ${formatDuration(route.achievedTimes[0].seconds)}` : ''}`}
                                    accessibilityRole="button"
                                    onPress={() => navigation.navigate('RoutePreview', { routeId: route.id })}
                                    style={styles.routeMain}
                                >
                                    <View
                                        style={[
                                            styles.routeBadge,
                                            { backgroundColor: colors.primarySubtle },
                                        ]}
                                    >
                                        <MaterialIcons
                                            color={colors.primary}
                                            name="route"
                                            size={20}
                                        />
                                    </View>
                                    <View style={styles.routeText}>
                                        <Text
                                            numberOfLines={1}
                                            style={[styles.routeName, { color: colors.foreground }]}
                                        >
                                            {route.name}
                                        </Text>
                                        <Text
                                            numberOfLines={1}
                                            style={[styles.routeMeta, { color: colors.mutedForeground }]}
                                        >
                                            {`${formatDistance(route.distanceMeters, 'metric')} · ${formatDuration(estimateOf(route).seconds)} · ${route.avoidPoints.length} avoided`}
                                        </Text>
                                        {route.achievedTimes.length > 0 ? (
                                            <Text
                                                numberOfLines={1}
                                                style={[styles.routeMeta, { color: colors.mutedForeground }]}
                                            >
                                                {`Ridden ${route.achievedTimes.length} time${route.achievedTimes.length === 1 ? '' : 's'} · last ${formatDuration(route.achievedTimes[0].seconds)}`}
                                            </Text>
                                        ) : null}
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    accessibilityLabel={`Rename ${route.name}`}
                                    accessibilityRole="button"
                                    hitSlop={8}
                                    onPress={() => {
                                        setRenaming(route.id);
                                        setDraft(route.name);
                                    }}
                                    style={styles.routeIconButton}
                                >
                                    <MaterialIcons
                                        color={colors.mutedForeground}
                                        name="edit"
                                        size={20}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    accessibilityLabel={`Delete ${route.name}`}
                                    accessibilityRole="button"
                                    hitSlop={8}
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
                                    style={styles.routeIconButton}
                                >
                                    <MaterialIcons color={colors.error} name="delete" size={20} />
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
    const startSavedRoute = useMapStore((state) => state.startSavedRoute);
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

                        <View style={styles.metricRow}>
                            <View style={styles.metric}>
                                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                                    Distance
                                </Text>
                                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                                    {formatDistance(saved.distanceMeters, 'metric')}
                                </Text>
                            </View>
                            <View style={styles.metric}>
                                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                                    Estimate
                                </Text>
                                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                                    {formatDuration(
                                        estimateRoute(saved.achievedTimes, saved.durationSeconds).seconds,
                                    )}
                                </Text>
                            </View>
                        </View>

                        <Text style={[styles.note, { color: colors.mutedForeground }]}>
                            {saved.achievedTimes.length > 0
                                ? `Your average of ${saved.achievedTimes.length} ride${saved.achievedTimes.length === 1 ? '' : 's'}.`
                                : "The map's estimate."}
                        </Text>

                        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                            {`${saved.avoidPoints.length} point${saved.avoidPoints.length === 1 ? '' : 's'} to avoid`}
                        </Text>

                        <AchievedTimesList times={saved.achievedTimes} />

                        <View style={styles.footer}>
                            <PrimaryButton
                                label="Start this route"
                                onPress={() => {
                                    void startSavedRoute(saved);
                                    navigation.navigate('Main', { screen: 'Map' });
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
    actionRow: {
        marginTop: spacing.md,
    },
    attribution: {
        ...typography.caption,
        marginTop: spacing.sm,
    },
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
    routeBadge: {
        alignItems: 'center',
        borderRadius: radii.full,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    routeIconButton: {
        alignItems: 'center',
        height: 44,
        justifyContent: 'center',
        width: 44,
    },
    routeMain: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: spacing.md,
    },
    routeMeta: {
        ...typography.caption,
    },
    routeName: {
        ...typography.subheading,
    },
    routeRow: {
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
    },
    routeText: {
        flex: 1,
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
    timeDay: {
        ...typography.caption,
    },
    timeRow: {
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
    },
    timeValue: {
        ...typography.subheading,
        flex: 1,
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
    const { routeCameras, routeSplit, publishedAt, stale } = useCameraStore();
    const { navigation: progress, startNavigation, stopNavigation } = useMapStore();
    const { estimate, avoidPoints, destination, route } = useMapStore();
    const now = useNow();

    const staleCameraData = stale;

    if (!route || !destination) {
        return (
            <ScreenContainer edges={['bottom']}>
                <EmptyState
                    actionLabel="Back to the map"
                    description="Plan a route on the map first."
                    onAction={() => navigation.navigate('Main', { screen: 'Map' })}
                    title="No route"
                />
            </ScreenContainer>
        );
    }

    const cameras = routeCameras;

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
                        {formatDuration(estimate?.seconds ?? route.durationSeconds)}
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                        Arrival
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.foreground }]}>
                        {estimate
                            ? formatClockTime(now + estimate.seconds * 1000)
                            : 'Unknown'}
                    </Text>
                </View>
            </View>

            {estimate ? (
                <Text style={[styles.note, { color: colors.mutedForeground }]}>
                    {estimate.source === 'history'
                        ? `Your average of ${estimate.achievedTimes.length} ride${estimate.achievedTimes.length === 1 ? '' : 's'}.`
                        : "The map's estimate."}
                </Text>
            ) : null}

            <AchievedTimesList times={estimate?.achievedTimes ?? []} />

            <View style={styles.sectionHeader}>
                <MaterialIcons color={colors.mutedForeground} name="navigation" size={18} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Follow the route
                </Text>
            </View>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
                The app follows your position along the route and shows the distance that is
                left and the time of arrival.
            </Text>
            <View style={styles.actionRow}>
                <PrimaryButton
                    icon={progress.started ? 'stop' : 'navigation'}
                    label={progress.started ? 'Stop following' : 'Follow the route'}
                    onPress={() => {
                        if (progress.started) {
                            stopNavigation();
                            return;
                        }
                        void startNavigation();
                    }}
                />
            </View>

            <View style={styles.sectionHeader}>
                <MaterialIcons color={colors.mutedForeground} name="videocam" size={18} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Cameras on this route
                </Text>
            </View>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
                {routeSplit.leftOut > 0
                    ? `${routeSplit.sent} camera${routeSplit.sent === 1 ? '' : 's'} avoided. ${routeSplit.leftOut} nearby camera${routeSplit.leftOut === 1 ? '' : 's'} watch the other way and do not need avoiding.`
                    : `${routeSplit.sent} camera${routeSplit.sent === 1 ? '' : 's'} avoided.`}
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
