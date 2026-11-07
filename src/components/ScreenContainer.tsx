import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { useTheme } from '@hooks/useTheme';
import { layout } from '@config/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
}

export const ScreenContainer = ({ children }: ScreenContainerProps) => {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: layout.screenPadding,
  },
});

export default ScreenContainer;
