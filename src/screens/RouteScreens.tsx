import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PlaceSearchList } from '@components/map';
import { EmptyState } from '@components/feedback';
import { PrimaryButton, TextField } from '@components/controls';
import { useTheme } from '@hooks/useTheme';
import { useMapStore } from '@stores/mapStore';
import { useSettingsStore } from '@stores/settingsStore';
import { Place, RootStackParamList } from '@typings/types';
import { searchPlaces } from '@services/photon.service';
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
            setResults([]);
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
                    <EmptyState
                        description="Try a different name or address."
                        title="No places found"
                    />
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
    const [routes, setRoutes] = useState<
        { id: string; name: string; distanceMeters: number; durationSeconds: number; avoidPoints: unknown[] }[]
    >([]);

    useEffect(() => {
        const load = async () => {
            const { listRoutes } = await import('@services/db/routeRepository');
            setRoutes(await listRoutes());
        };
        void load();
    }, []);

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
                    <Text
                        accessibilityRole="button"
                        key={route.id}
                        onPress={() => navigation.navigate('RoutePreview', { routeId: route.id })}
                        style={[styles.routeRow, { color: colors.foreground }]}
                    >
                        {`${route.name} · ${(route.distanceMeters / 1000).toFixed(1)} km · ${route.avoidPoints.length} avoided`}
                    </Text>
                ))}
            </ScrollView>
        </View>
    );
};

export const RoutePreviewScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const route = useRoute<{ params: { routeId: string } }>();
    const [summary, setSummary] = useState<{ name: string; distanceMeters: number; durationSeconds: number } | null>(null);

    useEffect(() => {
        const load = async () => {
            const { getRoute } = await import('@services/db/routeRepository');
            const found = await getRoute(route.params.routeId);
            if (found) {
                setSummary({
                    name: found.name,
                    distanceMeters: found.distanceMeters,
                    durationSeconds: found.durationSeconds,
                });
            }
        };
        void load();
    }, [route.params.routeId]);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                {summary ? (
                    <>
                        <Text style={[styles.title, { color: colors.foreground }]}>{summary.name}</Text>
                        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                            {`${(summary.distanceMeters / 1000).toFixed(1)} km`}
                        </Text>
                        <View style={styles.footer}>
                            <PrimaryButton label="Back to map" onPress={() => navigation.goBack()} />
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
    screen: {
        flex: 1,
    },
    content: {
        padding: layout.screenPadding,
    },
    title: {
        ...typography.title,
        marginBottom: spacing.sm,
    },
    meta: {
        ...typography.body,
    },
    error: {
        ...typography.caption,
        marginBottom: spacing.md,
    },
    routeRow: {
        ...typography.body,
        borderBottomWidth: StyleSheet.hairlineWidth,
        minHeight: 56,
        paddingVertical: spacing.md,
    },
    footer: {
        marginTop: layout.sectionGap,
    },
});
