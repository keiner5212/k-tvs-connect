import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { useTheme } from '@hooks/useTheme';
import { layout, typography } from '@config/theme';

export const LoadingScreen = () => {
  const { colors } = useTheme();

  return (
    <ActivityIndicator
      size="large"
      color={colors.primary}
      style={{ flex: 1, justifyContent: 'center' }}
    />
  );
};

export const EmptyState = ({ title }: { title: string }) => {
  const { colors } = useTheme();

  return (
    <Text style={[styles.title, { color: colors.mutedForeground }]}>{title}</Text>
  );
};

const styles = StyleSheet.create({
  title: {
    ...typography.body,
    marginTop: layout.containerGap,
    textAlign: 'center',
  },
});
