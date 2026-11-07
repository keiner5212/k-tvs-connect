import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AvoidPointList, MapCanvas, RoutePreviewCard } from '@components/map';
import { Banner } from '@components/feedback';
import { useTheme } from '@hooks/useTheme';
import { useMapStore } from '@stores/mapStore';
import { useSettingsStore } from '@stores/settingsStore';
import { RootStackParamList } from '@typings/types';
import { formatDistance, formatDuration } from '@utils/format';
import { layout, radii, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const FALLBACK_CENTER: [number, number] = [4.5709, -74.2973];

export const MapScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const { settings } = useSettingsStore();
    const {
        addAvoidPoint,
        avoidPoints,
        clearAvoidPoints,
        clearRoute,
        compute,
        computing,
        destination,
        error,
        removeAvoidPoint,
        route,
        setDestination,
    } = useMapStore();

    const [position, setPosition] = useState<[number, number] | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

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
        if (destination && position) {
            void compute(position[0], position[1]);
        }
    }, [destination, position, compute]);

    const onLongPress = useCallback(
        (latitude: number, longitude: number) => {
            addAvoidPoint(latitude, longitude);
            if (position) {
                void compute(position[0], position[1]);
            }
        },
        [addAvoidPoint, compute, position],
    );

    const onRemoveAvoid = (id: string) => {
        removeAvoidPoint(id);
        if (position) {
            void compute(position[0], position[1]);
        }
    };

    const onSave = () => {
        if (!route || !destination) {
            return;
        }
        void saveRoute(route, destination.name);
    };

    const saveRoute = async (
        result: NonNullable<typeof route>,
        destinationName: string,
    ) => {
        const { insertRoute } = await import('@services/db/routeRepository');
        await insertRoute({
            name: destinationName,
            originName: position ? 'Current position' : 'Start',
            destinationName,
            originLat: position?.[0] ?? destination.latitude,
            originLon: position?.[1] ?? destination.longitude,
            destinationLat: destination.latitude,
            destinationLon: destination.longitude,
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
            geometry: result.geometry,
            avoidPoints,
        });
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <MapCanvas
                avoidPoints={avoidPoints}
                center={position ?? FALLBACK_CENTER}
                destination={destination}
                onLongPress={onLongPress}
                routeGeometry={route?.geometry}
                styleURL={settings.mapStyleUrl}
                userLocation={position}
                zoom={13}
            />

            <View style={styles.toolbar}>
                <TouchableOpacity
                    accessibilityLabel="Search for a place"
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('PlaceSearch')}
                    style={[styles.tool, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                    <Text style={[styles.toolLabel, { color: colors.foreground }]}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    accessibilityLabel="Saved routes"
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('SavedRoutes')}
                    style={[styles.tool, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                    <Text style={[styles.toolLabel, { color: colors.foreground }]}>Routes</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.bottom}>
                {locationError ? <Banner tone="warning" message={locationError} /> : null}
                {error ? (
                    <Banner
                        tone="error"
                        actionLabel="Open settings"
                        message={error}
                        onAction={() => navigation.navigate('Main')}
                    />
                ) : null}

                <RoutePreviewCard
                    distanceLabel={formatDistance(route?.distanceMeters ?? 0, settings.unitSystem)}
                    distanceMeters={route?.distanceMeters ?? 0}
                    durationLabel={formatDuration(route?.durationSeconds ?? 0)}
                    durationSeconds={route?.durationSeconds ?? 0}
                    error={error}
                    isComputing={computing}
                    onClear={() => {
                        clearRoute();
                        setDestination(null);
                    }}
                    onGo={() => navigation.navigate('SavedRoutes')}
                    onSave={onSave}
                />

                <AvoidPointList
                    onClearAll={() => {
                        clearAvoidPoints();
                        if (position) {
                            void compute(position[0], position[1]);
                        }
                    }}
                    onDelete={onRemoveAvoid}
                    points={avoidPoints}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    toolbar: {
        gap: spacing.sm,
        position: 'absolute',
        right: layout.screenPadding,
        top: spacing.xl,
    },
    tool: {
        alignItems: 'center',
        borderRadius: radii.md,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: spacing.md,
    },
    toolLabel: {
        ...typography.label,
    },
    bottom: {
        bottom: 0,
        left: 0,
        paddingBottom: spacing.md,
        position: 'absolute',
        right: 0,
    },
});

export default MapScreen;
