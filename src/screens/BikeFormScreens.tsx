import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ChipGroup, PrimaryButton, TextField, showConfirm } from '@components/controls';
import { EmptyState } from '@components/feedback';
import ScreenContainer from '@components/ScreenContainer';
import { useTheme } from '@hooks/useTheme';
import { useGarageStore } from '@stores/garageStore';
import { BikeModel, RootStackParamList } from '@typings/types';
import { bleService, DiscoveredDevice } from '@ble/bleService';
import { findBikeByMac, isValidMac, normalizeMac } from '@services/db/bikeRepository';
import { BIKE_CATALOG, catalogFamily } from '@config/bikeCatalog';
import type { BikeFamily } from '@config/bikeCatalog';
import { spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const FAMILIES = ['Apache', 'Ntorq', 'Jupiter', 'IQUBE', 'Other'] as const;

export const BikeForm = ({
    initialNickname,
    initialModel,
    initialFrameNumber,
    initialMac,
    submitLabel,
    onSubmit,
}: {
    initialNickname?: string;
    initialModel?: BikeModel;
    initialFrameNumber?: string;
    initialMac?: string;
    submitLabel: string;
    onSubmit: (values: {
        nickname: string;
        model: BikeModel;
        frameNumber: string;
        macAddress: string;
    }) => Promise<void>;
}) => {
    const { colors } = useTheme();
    const [nickname, setNickname] = useState(initialNickname ?? '');
    const [model, setModel] = useState<BikeModel>(initialModel ?? 'apache-rtr-160-4v-xc-fi');
    const [family, setFamily] = useState<BikeFamily>(
        catalogFamily(initialModel ?? 'apache-rtr-160-4v-xc-fi'),
    );
    const [frameNumber, setFrameNumber] = useState(initialFrameNumber ?? '');
    const [mac, setMac] = useState(initialMac ?? '');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [found, setFound] = useState<DiscoveredDevice[]>([]);

    const scan = async () => {
        setScanning(true);
        setFound([]);
        setError(null);

        try {
            await bleService.scan((device) => {
                setFound((current) => {
                    if (current.some((entry) => entry.id === device.id)) {
                        return current;
                    }
                    return [...current, device].sort((a, b) => b.rssi - a.rssi);
                });
            }, 5000);
        } catch {
            setError(
                'The app needs the bluetooth permission to find your bike. Enable it in the app settings.',
            );
        } finally {
            setScanning(false);
        }
    };

    const submit = async () => {
        if (!nickname.trim()) {
            setError('Enter a name for your bike.');
            return;
        }
        const normalizedMac = normalizeMac(mac);
        if (!isValidMac(normalizedMac)) {
            setError('Scan for your bike and pick it from the list.');
            return;
        }

        const existing = await findBikeByMac(normalizedMac);
        if (existing) {
            setError(`This MAC address is already saved as ${existing.nickname}.`);
            return;
        }

        setError(null);
        setSaving(true);
        try {
            await onSubmit({
                nickname: nickname.trim(),
                model,
                frameNumber: frameNumber.trim(),
                macAddress: normalizedMac,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScreenContainer edges={['bottom']} scroll keyboardShouldPersistTaps="handled">

        <TextField
            autoCapitalize="words"
            label="Name"
            onChangeText={setNickname}
            placeholder="My Apache"
            value={nickname}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Family</Text>
        <View style={styles.modelWrap}>
            <ChipGroup
                onChange={(value) => {
                    const next = value as BikeFamily;
                    setFamily(next);
                    const first = BIKE_CATALOG.find((entry) => entry.family === next);
                    if (first) {
                        setModel(first.value);
                    }
                }}
                options={FAMILIES.map((entry) => ({ value: entry, label: entry }))}
                value={family}
            />
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Model</Text>
        <View style={styles.modelWrap}>
            <ChipGroup
                onChange={(value) => setModel(value)}
                options={BIKE_CATALOG.filter((entry) => entry.family === family).map((entry) => ({
                    value: entry.value,
                    label: entry.label,
                }))}
                value={model}
            />
        </View>

        <TextField
            autoCapitalize="sentences"
            helperText="The number stamped on the frame of the bike, seventeen characters. It is not your ID number."
            label="Chassis number"
            onChangeText={setFrameNumber}
            placeholder="MD6AB25XX5J000000"
            value={frameNumber}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Bluetooth address</Text>
        <Text style={[styles.help, { color: colors.mutedForeground }]}>
            The app finds the bike by itself. Switch the bike on and pick it from the list below.
        </Text>

        <PrimaryButton
            disabled={scanning}
            label={scanning ? 'Scanning...' : 'Scan for bikes'}
            onPress={() => void scan()}
            variant="secondary"
        />

        {found.length > 0 ? (
            <View style={styles.found}>
                {found.map((device) => (
                    <TouchableOpacity
                        accessibilityRole="button"
                        key={device.id}
                        onPress={() => setMac(device.id)}
                        style={[styles.foundRow, { borderColor: colors.border }]}
                    >
                        <Text style={[styles.foundName, { color: colors.foreground }]}>
                            {device.name ?? 'Device without name'}
                        </Text>
                        <Text style={[styles.foundMac, { color: colors.mutedForeground }]}>
                            {device.id} · signal {device.rssi}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        ) : null}

        {error ? (
            <Text style={[styles.help, { color: colors.error }]}>{error}</Text>
        ) : null}

        {scanning && found.length === 0 ? (
            <EmptyState
                description="Make sure the bike is switched on and close to your phone, then scan again."
                title="No bike found"
            />
        ) : null}

        <View style={styles.submit}>
            <PrimaryButton label={submitLabel} loading={saving} onPress={() => void submit()} />
        </View>
    
            </ScreenContainer>
    );
};

export const AddBikeScreen = () => {
    const navigation = useNavigation<Navigation>();
    const add = useGarageStore((state) => state.add);

    return (
        <View style={styles.screen}>
            <BikeForm
                onSubmit={async (values) => {
                    const bike = await add(values);
                    showConfirm('Scooter added', `${bike.nickname} is ready to connect.`, 'Close', () =>
                        navigation.goBack(),
                    );
                    navigation.goBack();
                }}
                submitLabel="Add bike"
            />
        </View>
    );
};

export const EditBikeScreen = ({ route }: { route: { params: { bikeId: string } } }) => {
    const navigation = useNavigation<Navigation>();
    const bike = useGarageStore((state) => state.bikes.find((item) => item.id === route.params.bikeId));
    const edit = useGarageStore((state) => state.edit);

    if (!bike) {
        return (
            <View style={styles.screen}>
                <EmptyState description="This bike is no longer saved." title="Not found" />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <BikeForm
                initialFrameNumber={bike.frameNumber}
                initialMac={bike.macAddress}
                initialModel={bike.model}
                initialNickname={bike.nickname}
                onSubmit={async (values) => {
                    await edit(bike.id, values);
                    navigation.goBack();
                }}
                submitLabel="Save changes"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    found: {
        marginTop: spacing.md,
    },
    foundMac: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    foundName: {
        ...typography.body,
    },
    foundRow: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingVertical: spacing.md,
    },
    help: {
        ...typography.body,
        marginBottom: spacing.sm,
        marginTop: spacing.xs,
    },
    label: {
        ...typography.label,
        marginBottom: spacing.sm,
    },
    modelWrap: {
        marginBottom: spacing.lg,
    },
    screen: {
        flex: 1,
    },
    submit: {
        marginTop: spacing.xl,
    },
});

export default AddBikeScreen;
