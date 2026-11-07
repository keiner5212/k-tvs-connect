import React, { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { PinDots, PrimaryButton, TextField, showConfirm } from '@components/controls';
import { EmptyState } from '@components/feedback';
import { useTheme } from '@hooks/useTheme';
import { useSettingsStore } from '@stores/settingsStore';
import { RootStackParamList } from '@typings/types';
import { lockoutRemainingMs, removePin, setPin, verifyPin } from '@services/auth/garageLock';
import { getDatabase } from '@services/db/database';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export const PinScreen = () => {
    const navigation = useNavigation<Navigation>();
    const route = useRoute<RouteProp<RootStackParamList, 'Pin'>>();
    const { colors } = useTheme();
          const insets = useSafeAreaInsets();
    const update = useSettingsStore((state) => state.update);

    const [pin, setPinValue] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [currentPin, setCurrentPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        const check = async () => {
            const remaining = await lockoutRemainingMs();
            setLocked(remaining > 0);
        };
        void check();
    }, []);

    const save = async () => {
        if (pin.length < 4) {
            setError('Use at least four digits.');
            return;
        }
        if (route.params.mode === 'change' && !(await verifyPin(currentPin))) {
            setError('The current pin is not correct.');
            return;
        }
        if (pin !== confirmation) {
            setError('The two pins do not match. Try again.');
            return;
        }

        await setPin(pin);
        await update({ pinEnabled: true });
        navigation.goBack();
    };

    const remove = async () => {
        if (!(await verifyPin(currentPin))) {
            setError('The pin is not correct.');
            return;
        }
        await removePin();
        await update({ pinEnabled: false });
        navigation.goBack();
    };

    if (locked) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <EmptyState
                    description="Too many attempts. Wait a minute and try again."
                    title="Locked"
                />
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.screenPadding },
        ]}
        keyboardShouldPersistTaps="handled"
      >
                <Text style={[styles.title, { color: colors.foreground }]}>
                    {route.params.mode === 'remove' ? 'Remove pin' : 'Set a pin'}
                </Text>
                <Text style={[styles.help, { color: colors.mutedForeground }]}>
                    The pin protects the garage on this device. It cannot be recovered if you forget it.
                </Text>

                {route.params.mode === 'change' ? (
                    <TextField
                        keyboardType="number-pad"
                        label="Current pin"
                        onChangeText={setCurrentPin}
                        secureTextEntry
                        value={currentPin}
                    />
                ) : null}

                {route.params.mode !== 'remove' ? (
                    <>
                        <TextField
                            keyboardType="number-pad"
                            label="New pin"
                            onChangeText={setPinValue}
                            secureTextEntry
                            value={pin}
                        />
                        <TextField
                            errorText={error ?? undefined}
                            keyboardType="number-pad"
                            label="Repeat pin"
                            onChangeText={setConfirmation}
                            secureTextEntry
                            value={confirmation}
                        />
                        <PinDots error={Boolean(error)} filled={pin.length} length={6} />
                        <PrimaryButton label="Save pin" onPress={() => void save()} />
                    </>
                ) : (
                    <>
                        <TextField
                            errorText={error ?? undefined}
                            keyboardType="number-pad"
                            label="Current pin"
                            onChangeText={setCurrentPin}
                            secureTextEntry
                            value={currentPin}
                        />
                        <PrimaryButton
                            label="Remove pin"
                            onPress={() =>
                                showConfirm('Remove pin?', 'The garage will be open without a pin.', 'Remove', () =>
                                    void remove(),
                                )
                            }
                            variant="danger"
                        />
                    </>
                )}
            </ScrollView>
        </View>
    );
};

export const ExportDataScreen = () => {
    const { colors } = useTheme();
          const insets = useSafeAreaInsets();
    const [summary, setSummary] = useState<string | null>(null);

    const exportData = async () => {
        const db = getDatabase();
        const bikes = await db.getAllAsync('SELECT * FROM bikes');
        const routes = await db.getAllAsync('SELECT * FROM routes');
        const rides = await db.getAllAsync('SELECT * FROM rides');

        const payload = JSON.stringify({ bikes, routes, rides }, null, 2);

        try {
            await Share.share({ message: payload, title: 'K Tvs Connect data' });
            setSummary('Shared.');
        } catch {
            setSummary('Export failed. There was not enough space to write the file.');
        }
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.screenPadding },
        ]}
      >
                <Text style={[styles.title, { color: colors.foreground }]}>Export data</Text>
                <Text style={[styles.help, { color: colors.mutedForeground }]}>
                    Shares a copy of the scooters, routes and rides stored on this device.
                </Text>
                <PrimaryButton label="Export" onPress={() => void exportData()} />
                {summary ? <Text style={[styles.help, { color: colors.mutedForeground }]}>{summary}</Text> : null}
            </ScrollView>
        </View>
    );
};

export const DeleteDataScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
          const insets = useSafeAreaInsets();
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState<string | null>(null);

    const deleteAll = async () => {
        if (confirmation !== 'DELETE') {
            setError('Type DELETE to confirm.');
            return;
        }
        const db = getDatabase();
        await db.runAsync('DELETE FROM bikes');
        await db.runAsync('DELETE FROM routes');
        await db.runAsync('DELETE FROM rides');
        await db.runAsync('DELETE FROM settings');
        navigation.goBack();
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.screenPadding },
        ]}
        keyboardShouldPersistTaps="handled"
      >
                <Text style={[styles.title, { color: colors.foreground }]}>Delete all data</Text>
                <Text style={[styles.help, { color: colors.mutedForeground }]}>
                    This permanently removes every scooter, ride, route and setting on this device.
                </Text>
                <TextField
                    autoCapitalize="none"
                    errorText={error ?? undefined}
                    label="Type DELETE to confirm"
                    onChangeText={setConfirmation}
                    value={confirmation}
                />
                <PrimaryButton label="Delete everything" onPress={() => void deleteAll()} variant="danger" />
            </ScrollView>
        </View>
    );
};

export const PermissionsScreen = () => {
    const { colors } = useTheme();
          const insets = useSafeAreaInsets();
    const [status, setStatus] = useState<string>('Checking...');

    const check = async () => {
        const { connectionController } = await import('@ble/connectionController');
        const granted = await connectionController.requestPermissions();
        setStatus(granted ? 'Bluetooth permission granted.' : 'Bluetooth permission is not granted.');
    };

    useEffect(() => {
        void check();
    }, []);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.screenPadding },
        ]}
      >
                <Text style={[styles.title, { color: colors.foreground }]}>Permissions</Text>
                <Text style={[styles.help, { color: colors.mutedForeground }]}>{status}</Text>
                <PrimaryButton label="Request permissions" onPress={() => void check()} />
                <Text style={[styles.help, { color: colors.mutedForeground }]}>
                    If a permission is blocked, turn it on in the system settings for this app.
                </Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: layout.screenPadding,
    },
    help: {
        ...typography.body,
        marginBottom: spacing.lg,
        marginTop: spacing.sm,
    },
    screen: {
        flex: 1,
    },
    title: {
        ...typography.title,
        marginBottom: spacing.sm,
    },
});
