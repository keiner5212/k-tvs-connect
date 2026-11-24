import React from 'react';
import {
    Alert,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

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
    icon?: keyof typeof MaterialIcons.glyphMap;
}

interface IconButtonProps {
    icon: keyof typeof MaterialIcons.glyphMap;
    accessibilityLabel: string;
    onPress: () => void;
    selected?: boolean;
    disabled?: boolean;
    size?: number;
    label?: string;
    variant?: 'plain' | 'pill';
}

/**
 * An icon with its text next to it. The text is always there, the icon only
 * repeats it, so nothing depends on the glyph alone.
 */
export const IconLabelButton = ({
    icon,
    accessibilityLabel,
    onPress,
    selected = false,
    disabled = false,
    size = 18,
    label,
    variant = 'pill',
}: IconButtonProps) => {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            activeOpacity={0.8}
            disabled={disabled}
            onPress={onPress}
            style={[
                variant === 'pill' ? styles.iconPill : styles.iconButton,
                {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                },
                disabled ? styles.disabled : null,
            ]}
        >
            <MaterialIcons
                color={selected ? colors.primaryForeground : colors.foreground}
                name={icon}
                size={size}
            />
            {label ? (
                <Text
                    style={[
                        styles.iconPillLabel,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                    ]}
                >
                    {label}
                </Text>
            ) : null}
        </TouchableOpacity>
    );
};

export const PrimaryButton = ({
    label,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    fullWidth = false,
    icon,
}: PrimaryButtonProps) => {
    const { colors } = useTheme();

    const background = disabled
        ? colors.muted
        : variant === 'primary'
            ? colors.primary
            : variant === 'secondary'
                ? colors.secondary
                : variant === 'danger'
                    ? colors.destructive
                    : colors.transparent;

    const foreground = disabled
        ? colors.mutedForeground
        : variant === 'primary'
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
            {icon ? (
                <MaterialIcons
                    color={foreground}
                    name={icon}
                    size={18}
                    style={styles.buttonIcon}
                />
            ) : null}
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
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    secureTextEntry?: boolean;
    editable?: boolean;
    maxLength?: number;
    onBlur?: () => void;
    returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
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
    onBlur,
    returnKeyType,
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
                onBlur={onBlur}
                placeholder={placeholder}
                placeholderTextColor={colors.mutedForeground}
                returnKeyType={returnKeyType}
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

interface ThemeSwitchProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
    accessibilityLabel: string;
    accessibilityHint?: string;
    disabled?: boolean;
}

/**
 * The switch of the app. The platform colors the thumb blue, so the thumb and
 * the track come from the theme and the thumb keeps a 44 by 44 target.
 */
export const ThemeSwitch = ({
    value,
    onValueChange,
    accessibilityLabel,
    accessibilityHint,
    disabled = false,
}: ThemeSwitchProps) => {
    const { colors } = useTheme();

    return (
        <View style={styles.switchTarget}>
            <Switch
                accessibilityHint={accessibilityHint}
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="switch"
                accessibilityState={{ checked: value, disabled }}
                disabled={disabled}
                ios_backgroundColor={colors.border}
                onValueChange={onValueChange}
                thumbColor={
                    disabled
                        ? colors.mutedForeground
                        : value
                            ? colors.primaryForeground
                            : colors.mutedForeground
                }
                trackColor={{
                    true: disabled ? colors.muted : colors.primary,
                    false: disabled ? colors.muted : colors.border,
                }}
                value={value}
            />
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
    buttonIcon: {
        marginRight: spacing.sm,
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
    iconButton: {
        alignItems: 'center',
        borderRadius: radii.md,
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
        width: 44,
    },
    iconPill: {
        alignItems: 'center',
        borderRadius: radii.full,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.xs,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: spacing.md,
    },
    iconPillLabel: {
        ...typography.label,
    },
    input: {
        ...typography.body,
        borderRadius: layout.inputRadius,
        borderWidth: 1,
        height: layout.inputHeight,
        paddingHorizontal: layout.cardPadding,
    },
    pinDot: {
        borderRadius: radii.full,
        borderWidth: 1,
        height: 12,
        marginHorizontal: spacing.xs,
        width: 12,
    },
    pinRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: spacing.lg,
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
    segmentTrack: {
        borderRadius: radii.full,
        flexDirection: 'row',
        padding: spacing.xs,
    },
    switchTarget: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 44,
    },
});
