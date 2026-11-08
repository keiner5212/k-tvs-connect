import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { CameraAttribution, CameraCard } from '@components/cameras';
import { PrimaryButton, showConfirm } from '@components/controls';
import { Banner, EmptyState } from '@components/feedback';
import ScreenContainer from '@components/ScreenContainer';
import { useTheme } from '@hooks/useTheme';
import { useCameraStore } from '@stores/cameraStore';
import { useLocationStore } from '@stores/locationStore';
import { useSettingsStore } from '@stores/settingsStore';
import { RootStackParamList } from '@typings/types';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export const CamerasScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const { unitSystem } = useSettingsStore((state) => state.settings);
    const {
        nearby,
        loading,
        error,
        publishedAt,
        refresh,
        setAvoidEnabled,
        removedCount,
        restoreRemovedCameras,
    } = useCameraStore();

    const position = useLocationStore((state) => state.position);

    useEffect(() => {
        const load = async () => {
            const store = useLocationStore.getState();
            if (store.permission === 'unknown') {
                await store.request();
            }
            await useCameraStore.getState().load();
        };
        void load();
    }, []);

    useEffect(() => {
        void useCameraStore.getState().load();
    }, [position]);

    const radiusMeters = useCameraStore((state) => state.radiusMeters);

    return (
        <ScreenContainer edges={['bottom']} scroll>
            <Text style={[styles.title, { color: colors.foreground }]}>Cameras near you</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {nearby.length === 1
                    ? '1 camera within 5 km, nearest first'
                    : `${nearby.length} cameras within ${Math.round(radiusMeters / 1000)} km, nearest first`}
            </Text>

            {error ? <Banner message={error} tone="warning" /> : null}

            {removedCount > 0 ? (
                <PrimaryButton
                    label={`Restore ${removedCount} removed camera${removedCount === 1 ? '' : 's'}`}
                    onPress={() => void restoreRemovedCameras()}
                    variant="secondary"
                />
            ) : null}

            {loading ? (
                <Text style={[styles.loading, { color: colors.mutedForeground }]}>Loading cameras...</Text>
            ) : null}

            {!loading && nearby.length === 0 && !error ? (
                <EmptyState
                    actionLabel="Refresh"
                    description={`No photo-detection cameras are published within ${Math.round(radiusMeters / 1000)} km of your position.`}
                    onAction={() => void refresh(true)}
                    title="No cameras nearby"
                />
            ) : null}

            {nearby.map((camera) => (
                <CameraCard
                    camera={camera}
                    isAvoided={camera.avoidEnabled}
                    key={camera.cameraId}
                    onOpenDetails={(cameraId) => navigation.navigate('CameraDetail', { cameraId })}
                    onRemove={(cameraId) =>
                        showConfirm(
                            'Remove this camera?',
                            'It will be hidden from the map and the list, and it will no longer be added to routes. You can restore it later.',
                            'Remove camera',
                            () => void setAvoidEnabled(cameraId, false),
                            true,
                        )
                    }
                    onShowOnMap={() => navigation.navigate('Main')}
                    onToggleAvoid={(cameraId) =>
                        void setAvoidEnabled(cameraId, !camera.avoidEnabled)
                    }
                    unitSystem={unitSystem}
                />
            ))}

            <View style={styles.footer}>
                <CameraAttribution publishedAt={publishedAt} />
                <PrimaryButton
                    label="Update now"
                    onPress={() => void refresh(true)}
                    variant="secondary"
                />
            </View>
        </ScreenContainer>
    );
};

export const CameraDetailScreen = () => {
    const navigation = useNavigation<Navigation>();
    const route = useRoute<RouteProp<RootStackParamList, 'CameraDetail'>>();
    const { unitSystem } = useSettingsStore((state) => state.settings);
    const camera = useCameraStore((state) =>
        state.cameras.find((item) => item.cameraId === route.params.cameraId),
    );
    const { setAvoidEnabled } = useCameraStore();

    if (!camera) {
        return (
            <ScreenContainer edges={['bottom']}>
                <EmptyState
                    description="This camera is no longer in the published set."
                    title="Not found"
                />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer edges={['bottom']} scroll>
            <CameraCard
                camera={camera}
                isAvoided={camera.avoidEnabled}
                onOpenDetails={() => navigation.navigate('CameraDetail', { cameraId: camera.cameraId })}
                onRemove={(cameraId) =>
                    showConfirm(
                        'Remove this camera?',
                        'It will be hidden from the map and the list, and it will no longer be added to routes. You can restore it later.',
                        'Remove camera',
                        () => void setAvoidEnabled(cameraId, false),
                        true,
                    )
                }
                onShowOnMap={() => navigation.navigate('Main')}
                onToggleAvoid={(cameraId) =>
                    void setAvoidEnabled(cameraId, !camera.avoidEnabled)
                }
                unitSystem={unitSystem}
                variant="full"
            />
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    footer: {
        marginBottom: layout.screenPadding,
        marginTop: spacing.lg,
    },
    loading: {
        ...typography.body,
        paddingVertical: spacing.md,
    },
    subtitle: {
        ...typography.body,
        marginBottom: spacing.md,
        marginTop: spacing.xs,
    },
    title: {
        ...typography.title,
    },
});
