import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import ScreenContainer from '@components/ScreenContainer';
import { useTheme } from '@hooks/useTheme';
import { layout, typography } from '@config/theme';

export const LoginScreen = () => {
    const { t } = useTranslation();
    const { colors } = useTheme();

    return (
        <ScreenContainer>
            <View style={styles.form}>
                <Text style={[styles.title, { color: colors.foreground }]}>{t('login.title')}</Text>
                <TextInput
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                    placeholder={t('login.phonePlaceholder')}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                />
                <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.buttonLabel, { color: colors.primaryForeground }]}>
                        {t('login.submit')}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    button: {
        alignItems: 'center',
        borderRadius: layout.buttonRadius,
        height: layout.buttonHeight,
        justifyContent: 'center',
    },
    buttonLabel: {
        ...typography.button,
    },
    form: {
        flex: 1,
        justifyContent: 'center',
    },
    input: {
        ...typography.body,
        borderRadius: layout.inputRadius,
        borderWidth: 1,
        height: layout.inputHeight,
        marginBottom: layout.containerGap,
        paddingHorizontal: layout.cardPadding,
    },
    title: {
        ...typography.title,
        marginBottom: layout.sectionGap,
    },
});

export default LoginScreen;
