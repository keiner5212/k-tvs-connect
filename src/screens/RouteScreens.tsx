import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PlaceSearchList } from '@components/map';
import { EmptyState } from '@components/feedback';
import { PrimaryButton, TextField, showConfirm } from '@components/controls';
import { useTheme } from '@hooks/useTheme';
import { useMapStore } from '@stores/mapStore';
import { useSettingsStore } from '@stores/settingsStore';
import { Place, RootStackParamList, SavedRoute } from '@typings/types';
import { searchPlaces } from '@services/photon.service';
import { deleteRoute, getRoute, listRoutes, renameRoute } from '@services/db/routeRepository';
import { formatDistance, formatDuration } from '@utils/format';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export const PlaceSearchScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const { settings } = useSettingsStore();
    const setDestination = useMapStore((state) => state.setDestination);

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
            searchPlaces(settings.photonBaseUrl, query)
                .then(setResults)
                .catch(() => setError('Place search failed. Check the geocoding url in Settings.'))
                .finally(() => setSearching(false));
        }, 300);

        return () => clearTimeout(timer);
    }, [query, settings.photonBaseUrl]);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
            </ScrollView>
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
            <ScrollView contentContainerStyle={styles.content}>
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
            </ScrollView>
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
            <ScrollView contentContainerStyle={styles.content}>
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
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: layout.screenPadding,
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
    title: {
        ...typography.title,
        marginBottom: spacing.sm,
    },
});
