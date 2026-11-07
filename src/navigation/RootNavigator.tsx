import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '@hooks/useTheme';
import { MainTabParamList, RootStackParamList } from '@typings/types';
import { DashboardScreen } from '@screens/DashboardScreen';
import { GarageScreen } from '@screens/GarageScreen';
import { MapScreen } from '@screens/MapScreen';
import { SettingsScreen } from '@screens/SettingsScreen';
import { AddBikeScreen, EditBikeScreen } from '@screens/BikeFormScreens';
import { BikeDetailsScreen, ConnectionScreen } from '@screens/ConnectionScreen';
import { PlaceSearchScreen, RoutePreviewScreen, SavedRoutesScreen } from '@screens/RouteScreens';
import {
    DeleteDataScreen,
    ExportDataScreen,
    PermissionsScreen,
    PinScreen,
} from '@screens/DataScreens';
import { typography } from '@config/theme';

const Tabs = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
    Garage: 'Garage',
    Dashboard: 'Dashboard',
    Map: 'Map',
    Settings: 'Settings',
};

export const MainNavigator = () => {
    const { colors } = useTheme();

    return (
        <Tabs.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.mutedForeground,
                tabBarLabelStyle: typography.caption,
                tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
                title: TAB_LABELS[route.name],
            })}
        >
            <Tabs.Screen component={GarageScreen} name="Garage" />
            <Tabs.Screen component={DashboardScreen} name="Dashboard" />
            <Tabs.Screen component={MapScreen} name="Map" />
            <Tabs.Screen component={SettingsScreen} name="Settings" />
        </Tabs.Navigator>
    );
};

export const RootNavigator = () => {
    const { colors } = useTheme();

    return (
        <Stack.Navigator
            screenOptions={{
                headerTintColor: colors.foreground,
                headerStyle: { backgroundColor: colors.card },
                headerTitleStyle: typography.subheading,
            }}
        >
            <Stack.Screen component={MainNavigator} name="Main" options={{ headerShown: false }} />
            <Stack.Screen
                component={AddBikeScreen}
                name="AddBike"
                options={{ presentation: 'modal', title: 'Add scooter' }}
            />
            <Stack.Screen component={EditBikeScreen} name="EditBike" options={{ title: 'Edit scooter' }} />
            <Stack.Screen component={BikeDetailsScreen} name="BikeDetails" options={{ title: 'Scooter' }} />
            <Stack.Screen component={ConnectionScreen} name="Connection" options={{ title: 'Connection' }} />
            <Stack.Screen
                component={PlaceSearchScreen}
                name="PlaceSearch"
                options={{ presentation: 'modal', title: 'Where to' }}
            />
            <Stack.Screen component={SavedRoutesScreen} name="SavedRoutes" options={{ title: 'Saved routes' }} />
            <Stack.Screen component={RoutePreviewScreen} name="RoutePreview" options={{ title: 'Route' }} />
            <Stack.Screen component={PinScreen} name="Pin" options={{ title: 'Pin' }} />
            <Stack.Screen component={ExportDataScreen} name="ExportData" options={{ title: 'Export data' }} />
            <Stack.Screen component={DeleteDataScreen} name="DeleteData" options={{ title: 'Delete data' }} />
            <Stack.Screen component={PermissionsScreen} name="Permissions" options={{ title: 'Permissions' }} />
        </Stack.Navigator>
    );
};

export default RootNavigator;
