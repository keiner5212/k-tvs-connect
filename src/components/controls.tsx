import React from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';

import { useTheme } from '@hooks/useTheme';
import { layout, radii, spacing, typography } from '@config/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface PrimaryButtonProps {
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
}

export const PrimaryButton = ({
    label,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    fullWidth = false,
}: PrimaryButtonProps) => {
    const { colors } = useTheme();

    const background =
        variant === 'primary'
            ? colors.primary
            : variant === 'secondary'
                ? colors.secondary
                : variant === 'danger'
                    ? colors.destructive
                    : colors.transparent;

    const foreground =
        variant === 'primary'
            ? colors.primaryForeground
            : variant === 'secondary'
                ? colors.secondaryForeground
                : variant === 'danger'
                    ? colors.errorForeground
                    : colors.primary;

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: disabled || loading }}
            activeOpacity={0.8}
            disabled={disabled || loading}
            onPress={onPress}
            style={[
                styles.button,
                { backgroundColor: background },
                fullWidth ? styles.fullWidth : null,
                disabled ? styles.disabled : null,
            ]}
        >
            <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
        </TouchableOpacity>
    );
};

interface TextFieldProps {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    helperText?: string;
    errorText?: string;
    keyboardType?: KeyboardTypeOptions;
    autoCapitalize?: 'none' | 'sentences' | 'words';
    secureTextEntry?: boolean;
    editable?: boolean;
    maxLength?: number;
}

export const TextField = ({
    label,
    value,
    onChangeText,
    placeholder,
    helperText,
    errorText,
    keyboardType,
    autoCapitalize = 'none',
    secureTextEntry = false,
    editable = true,
    maxLength,
}: TextFieldProps) => {
    const { colors } = useTheme();

    return (
        <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
            <TextInput
                accessibilityLabel={label}
                autoCapitalize={autoCapitalize}
                editable={editable}
                keyboardType={keyboardType}
                maxLength={maxLength}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={secureTextEntry}
                value={value}
                style={[
                    styles.input,
                    {
                        backgroundColor: editable ? colors.card : colors.muted,
                        borderColor: errorText ? colors.error : colors.border,
                        color: colors.foreground,
                    },
                ]}
            />
            {errorText ? (
                <Text accessibilityLiveRegion="assertive" style={[styles.helper, { color: colors.error }]}>
                    {errorText}
                </Text>
            ) : helperText ? (
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>{helperText}</Text>
            ) : null}
        </View>
    );
};

interface SegmentedControlProps {
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
}

export const SegmentedControl = ({ options, value, onChange }: SegmentedControlProps) => {
    const { colors } = useTheme();

    return (
        <View style={[styles.segmentTrack, { backgroundColor: colors.muted }]}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        style={[styles.segment, selected ? { backgroundColor: colors.primary } : null]}
                    >
                        <Text
                            style={[
                                styles.segmentLabel,
                                { color: selected ? colors.primaryForeground : colors.mutedForeground },
                            ]}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

interface PinDotsProps {
    length: number;
    filled: number;
    error?: boolean;
}

export const PinDots = ({ length, filled, error = false }: PinDotsProps) => {
    const { colors } = useTheme();

    return (
        <View style={styles.pinRow}>
            {Array.from({ length }).map((_, index) => (
                <View
                    key={`pin-dot-${index}`}
                    style={[
                        styles.pinDot,
                        {
                            backgroundColor: index < filled ? colors.primary : colors.transparent,
                            borderColor: error ? colors.error : colors.border,
                        },
                    ]}
                />
            ))}
        </View>
    );
};

export const showConfirm = (
    title: string,
    message: string,
    confirmLabel: string,
    onConfirm: () => void,
    destructive = false,
) => {
    Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
};

const styles = StyleSheet.create({
    button: {
        alignItems: 'center',
        borderRadius: layout.buttonRadius,
        height: layout.buttonHeight,
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    buttonLabel: {
        ...typography.button,
    },
    disabled: {
        opacity: 0.5,
    },
    field: {
        marginBottom: spacing.lg,
    },
    fieldLabel: {
        ...typography.label,
        marginBottom: spacing.sm,
    },
    fullWidth: {
        alignSelf: 'stretch',
    },
    helper: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    input: {
        ...typography.body,
        borderRadius: layout.inputRadius,
        borderWidth: 1,
        height: layout.inputHeight,
        paddingHorizontal: layout.cardPadding,
    },
    segmentTrack: {
        borderRadius: radii.full,
        flexDirection: 'row',
        padding: spacing.xs,
    },
    segment: {
        alignItems: 'center',
        borderRadius: radii.full,
        flex: 1,
        paddingVertical: spacing.sm,
    },
    segmentLabel: {
        ...typography.label,
    },
    pinRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: spacing.lg,
    },
    pinDot: {
        borderRadius: radii.full,
        borderWidth: 1,
        height: 12,
        marginHorizontal: spacing.xs,
        width: 12,
    },
});
