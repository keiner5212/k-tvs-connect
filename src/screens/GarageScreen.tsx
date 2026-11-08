import React, { useCallback, useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { BikeCard } from '@components/garage';
import { EmptyState } from '@components/feedback';
import { PrimaryButton } from '@components/controls';
import { useTheme } from '@hooks/useTheme';
import { useBleStore } from '@stores/bleStore';
import { useGarageStore } from '@stores/garageStore';
import { Bike, RootStackParamList } from '@typings/types';
import { layout, spacing, typography } from '@config/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export const GarageScreen = () => {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { bikes, load } = useGarageStore();
    const connectionState = useBleStore((state) => state.state);
    const connectionInfo = useBleStore((state) => state.info);
    const lastUpdateAt = useBleStore((state) => state.lastUpdateAt);

    useEffect(() => {
        void load();
    }, [load]);

    const renderItem = useCallback(
        ({ item }: { item: Bike }) => (
            <BikeCard
                bike={item}
                isActive={item.isActive}
                lastSeenAt={lastUpdateAt}
                linkState={item.isActive ? connectionState : 'off'}
                onPress={() => navigation.navigate('BikeDetails', { bikeId: item.id })}
                onSetActive={() => void useGarageStore.getState().activate(item.id)}
                reason={item.isActive ? connectionInfo.reason : null}
            />
        ),
        [connectionInfo.reason, connectionState, lastUpdateAt, navigation],
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
                <Text style={[styles.title, { color: colors.foreground }]}>Garage</Text>
                <PrimaryButton
                    label="Add bike"
                    onPress={() => navigation.navigate('AddBike')}
                    variant="primary"
                />
            </View>

            <FlatList
                contentContainerStyle={styles.list}
                data={bikes}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                    <EmptyState
                        title="No bikes yet"
                        description="Add your first bike to see its live dashboard, ride stats and routes."
                    />
                }
                renderItem={renderItem}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: layout.screenPadding,
        paddingTop: spacing.xl,
    },
    list: {
        padding: layout.screenPadding,
    },
    screen: {
        flex: 1,
    },
    title: {
        ...typography.title,
    },
});

export default GarageScreen;
