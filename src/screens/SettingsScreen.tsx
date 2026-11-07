import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { SegmentedControl, TextField, showConfirm } from '@components/controls';
import { NumberStepper, SettingsBody, SettingsChoice, SettingsRow, SettingsSection } from '@components/settings';
import { useTheme } from '@hooks/useTheme';
import { useCameraStore } from '@stores/cameraStore';
import { useSettingsStore } from '@stores/settingsStore';
import { RootStackParamList } from '@typings/types';
import { isAllowedBaseUrl } from '@services/http.service';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const MAP_STYLES = [
    { value: 'https://tiles.openfreemap.org/styles/liberty', label: 'Liberty' },
    { value: 'https://tiles.openfreemap.org/styles/bright', label: 'Bright' },
    { value: 'https://tiles.openfreemap.org/styles/positron', label: 'Positron' },
];

export const SettingsScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();
    const { settings, load, update } = useSettingsStore();
    const cameraAvoidEnabled = useCameraStore((state) => state.avoidEnabled);
    const cameraRadiusMeters = useCameraStore((state) => state.radiusMeters);
    const setAvoidEnabledGlobally = useCameraStore((state) => state.setAvoidEnabledGlobally);
    const setRadiusMeters = useCameraStore((state) => state.setRadiusMeters);

    const [photonUrl, setPhotonUrl] = useState(settings.photonBaseUrl);
    const [valhallaUrl, setValhallaUrl] = useState(settings.valhallaBaseUrl);
    const [styleUrl, setStyleUrl] = useState(settings.mapStyleUrl);
    const [urlError, setUrlError] = useState<string | null>(null);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        setPhotonUrl(settings.photonBaseUrl);
        setValhallaUrl(settings.valhallaBaseUrl);
        setStyleUrl(settings.mapStyleUrl);
    }, [settings]);

    const saveUrls = () => {
        if (!isAllowedBaseUrl(photonUrl) || !isAllowedBaseUrl(valhallaUrl)) {
            setUrlError('Enter a full URL starting with http:// or https://');
            return;
        }
        setUrlError(null);
        void update({ photonBaseUrl: photonUrl, valhallaBaseUrl: valhallaUrl, mapStyleUrl: styleUrl });
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingTop: insets.top + spacing.lg,
                        paddingBottom: insets.bottom + tabBarHeight + layout.screenPadding,
                    },
                ]}
            >
                <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>

                <SettingsSection title="Units">
                    <SettingsBody>
                        <SegmentedControl
                            onChange={(value) => void update({ unitSystem: value as 'metric' | 'imperial' })}
                            options={[
                                { value: 'metric', label: 'Kilometres' },
                                { value: 'imperial', label: 'Miles' },
                            ]}
                            value={settings.unitSystem}
                        />
                    </SettingsBody>
                </SettingsSection>

                <SettingsSection title="Speed alert">
                    <NumberStepper
                        label="Overspeed limit"
                        max={200}
                        min={20}
                        onChange={(value) => void update({ overspeedLimitKmh: value })}
                        step={5}
                        unit="km/h"
                        value={settings.overspeedLimitKmh}
                    />
                </SettingsSection>

                <SettingsSection title="Map style" footer="OpenFreeMap styles, no account and no key needed.">
                    {MAP_STYLES.map((style) => (
                        <SettingsChoice
                            key={style.value}
                            label={style.label}
                            onSelect={() => {
                                setStyleUrl(style.value);
                                void update({ mapStyleUrl: style.value });
                            }}
                            selected={settings.mapStyleUrl === style.value}
                        />
                    ))}
                </SettingsSection>

                <SettingsSection title="Custom map style">
                    <SettingsBody>
                        <TextField
                            errorText={urlError ?? undefined}
                            helperText="Any MapLibre style json url."
                            label="Style url"
                            onChangeText={setStyleUrl}
                            value={styleUrl}
                        />
                    </SettingsBody>
                    <SettingsRow label="Save style url" onPress={saveUrls} />
                </SettingsSection>

                <SettingsSection
                    title="Cameras"
                    footer="Photo detection cameras published by the road safety agency become automatic points to avoid."
                >
                    <SettingsRow
                        description="Send the nearby cameras with every route."
                        label="Avoid cameras on routes"
                        onSwitchChange={(value) => void setAvoidEnabledGlobally(value)}
                        switchValue={cameraAvoidEnabled}
                    />
                    <NumberStepper
                        label="Search radius"
                        max={20000}
                        min={1000}
                        onChange={(value) => void setRadiusMeters(value)}
                        step={1000}
                        unit="m"
                        value={cameraRadiusMeters}
                    />
                </SettingsSection>

                <SettingsSection
                    title="Free services"
                    footer="Point these to your own Docker instance to leave the public services completely."
                >
                    <View style={styles.padded}>
                        <TextField
                            label="Geocoding url"
                            onChangeText={setPhotonUrl}
                            value={photonUrl}
                        />
                        <TextField
                            label="Routing url"
                            onChangeText={setValhallaUrl}
                            value={valhallaUrl}
                        />
                    </View>
                    <SettingsRow label="Save service urls" onPress={saveUrls} />
                </SettingsSection>

                <SettingsSection title="Privacy">
                    <SettingsRow
                        description="Keep a track of every ride on this device."
                        label="Save ride tracks"
                        onSwitchChange={(value) => void update({ saveTracks: value })}
                        switchValue={settings.saveTracks}
                    />
                    <SettingsRow
                        description="Ask for a pin when the app opens."
                        label="Pin lock"
                        onPress={() => navigation.navigate('Pin', { mode: settings.pinEnabled ? 'change' : 'create' })}
                        value={settings.pinEnabled ? 'On' : 'Off'}
                    />
                </SettingsSection>

                <SettingsSection title="Data">
                    <SettingsRow label="Permissions" onPress={() => navigation.navigate('Permissions')} />
                    <SettingsRow label="Export data" onPress={() => navigation.navigate('ExportData')} />
                    <SettingsRow
                        destructive
                        label="Delete all data"
                        onPress={() =>
                            showConfirm(
                                'Delete all data?',
                                'This permanently removes every bike, ride, route and setting on this device.',
                                'Delete everything',
                                () => navigation.navigate('DeleteData'),
                                true,
                            )
                        }
                    />
                </SettingsSection>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: layout.screenPadding,
    },
    padded: {
        paddingTop: spacing.md,
    },
    screen: {
        flex: 1,
    },
    title: {
        ...typography.title,
        marginBottom: layout.sectionGap,
    },
});

export default SettingsScreen;
