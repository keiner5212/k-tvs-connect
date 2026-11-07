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
import { BleService, DiscoveredDevice } from '@ble/bleService';
import { findBikeByMac, isValidMac, normalizeMac } from '@services/db/bikeRepository';
import { spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const MODELS: { value: BikeModel; label: string }[] = [
    { value: 'apache', label: 'Apache' },
    { value: 'ntorq', label: 'Ntorq' },
    { value: 'jupiter', label: 'Jupiter' },
    { value: 'iqube', label: 'IQUBE' },
    { value: 'u388', label: 'U388' },
    { value: 'other', label: 'Other' },
];

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
    const [model, setModel] = useState<BikeModel>(initialModel ?? 'apache');
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

        const service = new BleService();
        try {
            await service.scan((device) => {
                setFound((current) =>
                    current.some((entry) => entry.id === device.id) ? current : [...current, device],
                );
            }, 5000);
        } catch {
            setError('Bluetooth permission is needed to scan for your scooter.');
        } finally {
            setScanning(false);
        }
    };

    const submit = async () => {
        if (!nickname.trim()) {
            setError('Enter a name for your scooter.');
            return;
        }
        if (!frameNumber.trim()) {
            setError('Enter the frame number.');
            return;
        }
        const normalizedMac = normalizeMac(mac);
        if (!isValidMac(normalizedMac)) {
            setError('Enter a MAC address as AA:BB:CC:DD:EE:FF.');
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

        <Text style={[styles.label, { color: colors.foreground }]}>Model</Text>
        <View style={styles.modelWrap}>
            <ChipGroup
                onChange={(value) => setModel(value as BikeModel)}
                options={MODELS}
                value={model}
            />
        </View>

        <TextField
            autoCapitalize="none"
            label="Frame number"
            onChangeText={setFrameNumber}
            value={frameNumber}
        />

        <TextField
            autoCapitalize="none"
            errorText={error ?? undefined}
            label="Bluetooth address"
            onChangeText={setMac}
            placeholder="AA:BB:CC:DD:EE:FF"
            value={mac}
        />

        <PrimaryButton
            disabled={scanning}
            label={scanning ? 'Scanning...' : 'Scan for scooters'}
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
                            {device.name ?? 'Scooter'}
                        </Text>
                        <Text style={[styles.foundMac, { color: colors.mutedForeground }]}>{device.id}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        ) : null}

        {scanning && found.length === 0 ? (
            <EmptyState
                description="Make sure the scooter is switched on and close to your phone, then scan again."
                title="No scooter found"
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
                submitLabel="Add scooter"
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
                <EmptyState description="This scooter is no longer saved." title="Not found" />
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
