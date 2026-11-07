import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import ErrorBoundary from '@components/ErrorBoundary';
import RootNavigator from '@navigation/RootNavigator';
import { useTheme } from '@hooks/useTheme';
import '@/config/i18n';

function App() {
  const { mode, colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
    </View>
  );
}

export default App;
