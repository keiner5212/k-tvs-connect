import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { SegmentedControl, TextField, showConfirm } from '@components/controls';
import {
    NumberStepper,
    SettingsBody,
    SettingsChoice,
    SettingsRow,
    SettingsSection,
    SettingsUsageRow,
} from '@components/settings';
import { useTheme } from '@hooks/useTheme';
import { useCameraStore } from '@stores/cameraStore';
import { useSettingsStore } from '@stores/settingsStore';
import { RootStackParamList } from '@typings/types';
import { isAllowedBaseUrl } from '@services/http.service';
import { googleUsage } from '@services/googleUsage.service';
import { formatPlate, isValidPlate, normalizePlate } from '@utils/picoYPlaca';
import { formatMonth } from '@utils/format';
import {
    GOOGLE_CAP_SHARE,
    GOOGLE_FREE_MONTHLY,
    GOOGLE_SERVICES,
    googleMonthKey,
    GoogleSku,
} from '@config/quota';
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
    const { settings, load, update } = useSettingsStore();
    const cameraAvoidEnabled = useCameraStore((state) => state.avoidEnabled);
    const cameraRadiusMeters = useCameraStore((state) => state.radiusMeters);
    const setAvoidEnabledGlobally = useCameraStore((state) => state.setAvoidEnabledGlobally);
    const setRadiusMeters = useCameraStore((state) => state.setRadiusMeters);

    const [valhallaUrl, setValhallaUrl] = useState(settings.valhallaBaseUrl);
    const [styleUrl, setStyleUrl] = useState(settings.mapStyleUrl);
    const [plate, setPlate] = useState(settings.licencePlate);
    const [plateError, setPlateError] = useState<string | null>(null);
    const [routingError, setRoutingError] = useState<string | null>(null);
    const [styleError, setStyleError] = useState<string | null>(null);
    const [usage, setUsage] = useState<Record<GoogleSku, number> | null>(null);
    const [usageFailed, setUsageFailed] = useState(false);

    const readUsage = useCallback(async () => {
        try {
            const skus = Object.keys(GOOGLE_SERVICES) as GoogleSku[];
            const values = await Promise.all(skus.map((sku) => googleUsage(sku)));
            setUsage(
                Object.fromEntries(skus.map((sku, index) => [sku, values[index]])) as Record<
                    GoogleSku,
                    number
                >,
            );
            setUsageFailed(false);
        } catch {
            setUsageFailed(true);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void readUsage();
        }, [readUsage]),
    );

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        setValhallaUrl(settings.valhallaBaseUrl);
        setStyleUrl(settings.mapStyleUrl);
        setPlate(settings.licencePlate);
    }, [settings]);

    const normalizeUrl = (value: string): string => value.trim().replace(/\/+$/, '');

    const saveRoutingUrl = () => {
        if (!isAllowedBaseUrl(valhallaUrl)) {
            setRoutingError('Enter a full URL starting with http:// or https://');
            return;
        }
        setRoutingError(null);
        void update({ valhallaBaseUrl: normalizeUrl(valhallaUrl) });
    };

    const saveStyleUrl = () => {
        if (!isAllowedBaseUrl(styleUrl)) {
            setStyleError('Enter a full URL starting with http:// or https://');
            return;
        }
        setStyleError(null);
        void update({
            mapProvider: 'openfreemap',
            mapStyleUrl: normalizeUrl(styleUrl),
        });
    };

    const onPlateChange = (value: string) => {
        setPlate(formatPlate(value));
    };

    const savePlate = () => {
        const clean = normalizePlate(plate);
        if (clean.length > 0 && !isValidPlate(clean)) {
            setPlateError('A Colombian plate has 3 letters, 2 numbers and a letter, like ABC 12D.');
            return;
        }
        setPlateError(null);
        void update({ licencePlate: formatPlate(plate) });
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingTop: insets.top + spacing.lg },
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

                <SettingsSection
                    title="Map style"
                    footer="Google Maps uses the map tiles api. The OpenFreeMap styles need no account and no key."
                >
                    <SettingsChoice
                        description="The google map, with the traffic cameras on it."
                        label="Google Maps"
                        onSelect={() => void update({ mapProvider: 'google' })}
                        selected={settings.mapProvider === 'google'}
                    />
                    {MAP_STYLES.map((style) => (
                        <SettingsChoice
                            key={style.value}
                            label={style.label}
                            onSelect={() => {
                                setStyleUrl(style.value);
                                void update({
                                    mapProvider: 'openfreemap',
                                    mapStyleUrl: style.value,
                                });
                            }}
                            selected={
                                settings.mapProvider === 'openfreemap' &&
                                settings.mapStyleUrl === style.value
                            }
                        />
                    ))}
                </SettingsSection>

                <SettingsSection title="Custom map style">
                    <SettingsBody>
                        <TextField
                            errorText={styleError ?? undefined}
                            helperText="Any MapLibre style json url."
                            label="Style url"
                            onChangeText={setStyleUrl}
                            value={styleUrl}
                        />
                    </SettingsBody>
                    <SettingsRow label="Save style url" onPress={saveStyleUrl} />
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
                    title="Pico y placa"
                    footer="The plate stays on this device. It is only used to warn you when the plate cannot circulate."
                >
                    <SettingsBody>
                        <TextField
                            autoCapitalize="characters"
                            errorText={plateError ?? undefined}
                            helperText="Three letters, two numbers and a letter, like ABC 12D."
                            label="Licence plate"
                            maxLength={7}
                            onBlur={savePlate}
                            onChangeText={onPlateChange}
                            returnKeyType="done"
                            value={plate}
                        />
                    </SettingsBody>
                </SettingsSection>

                <SettingsSection
                    title="Routing"
                    footer="Valhalla answers the route. Point this to your own instance to leave the public service completely."
                >
                    <SettingsBody>
                        <TextField
                            errorText={routingError ?? undefined}
                            helperText="The base url of the routing service."
                            label="Routing url"
                            onChangeText={setValhallaUrl}
                            value={valhallaUrl}
                        />
                    </SettingsBody>
                    <SettingsRow label="Save routing url" onPress={saveRoutingUrl} />
                </SettingsSection>

                <SettingsSection
                    title="Google usage"
                    footer={`Counted for ${formatMonth(googleMonthKey())}. The counters reset on the first of the month, midnight Pacific time. The app stops at 95% of each cap: Valhalla answers the routes and OpenFreeMap draws the map. The search also stops at 100 requests a day.`}
                >
                    {(Object.keys(GOOGLE_SERVICES) as GoogleSku[]).map((sku) => {
                        const service = GOOGLE_SERVICES[sku];
                        const cap = GOOGLE_FREE_MONTHLY[sku];
                        return (
                            <SettingsUsageRow
                                cap={cap}
                                estimated={service.estimated}
                                failed={usageFailed}
                                fallback={service.fallback}
                                key={sku}
                                label={service.label}
                                loading={usage === null}
                                stopAt={Math.floor(cap * GOOGLE_CAP_SHARE)}
                                used={usage ? usage[sku] : 0}
                            />
                        );
                    })}
                </SettingsSection>

                <SettingsSection title="Privacy">
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
    screen: {
        flex: 1,
    },
    title: {
        ...typography.title,
        marginBottom: layout.sectionGap,
    },
});

export default SettingsScreen;
