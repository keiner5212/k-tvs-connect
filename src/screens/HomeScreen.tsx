import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import ScreenContainer from '@components/ScreenContainer';
import { useTheme } from '@hooks/useTheme';
import { layout, radii, typography } from '@config/theme';

export const HomeScreen = () => {
    const { t } = useTranslation();
    const { colors } = useTheme();

    return (
        <ScreenContainer>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.foreground }]}>{t('home.title')}</Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                    {t('home.subtitle')}
                </Text>
            </View>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    header: {
        marginTop: layout.sectionGap,
    },
    subtitle: {
        ...typography.body,
        borderRadius: radii.md,
    },
    title: {
        ...typography.title,
        marginBottom: layout.containerGap,
    },
});

export default HomeScreen;
