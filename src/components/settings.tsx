import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@hooks/useTheme';
import { layout, radii, spacing, typography } from '@config/theme';

interface SettingsSectionProps {
    title: string;
    children: React.ReactNode;
    footer?: string;
}

export const SettingsSection = ({ title, children, footer }: SettingsSectionProps) => {
    const { colors } = useTheme();

    return (
        <View style={styles.section}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.header, { color: colors.mutedForeground }]}>{title}</Text>
                {children}
            </View>
            {footer ? <Text style={[styles.footer, { color: colors.mutedForeground }]}>{footer}</Text> : null}
        </View>
    );
};

interface SettingsBodyProps {
    children: React.ReactNode;
}

/**
 * Wrapper for free form content inside a section, so every control shares the
 * same left edge as the rows.
 */
export const SettingsBody = ({ children }: SettingsBodyProps) => <View style={styles.body}>{children}</View>;

interface SettingsRowProps {
    label: string;
    value?: string;
    description?: string;
    onPress?: () => void;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    destructive?: boolean;
}

export const SettingsRow = ({
    label,
    value,
    description,
    onPress,
    switchValue,
    onSwitchChange,
    destructive = false,
}: SettingsRowProps) => {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            accessibilityRole={onPress ? 'button' : undefined}
            disabled={!onPress}
            onPress={onPress}
            style={styles.row}
        >
            <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: destructive ? colors.error : colors.foreground }]}>
                    {label}
                </Text>
                {description ? (
                    <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>{description}</Text>
                ) : null}
            </View>
            {value ? <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
            {switchValue !== undefined && onSwitchChange ? (
                <Switch
                    accessibilityLabel={label}
                    onValueChange={onSwitchChange}
                    trackColor={{ true: colors.primary, false: colors.muted }}
                    value={switchValue}
                />
            ) : null}
        </TouchableOpacity>
    );
};

interface SettingsChoiceProps {
    label: string;
    description?: string;
    selected: boolean;
    onSelect: () => void;
}

export const SettingsChoice = ({ label, description, selected, onSelect }: SettingsChoiceProps) => {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={onSelect}
            style={[styles.row, selected ? { backgroundColor: colors.primarySubtle } : null]}
        >
            <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
                {description ? (
                    <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>{description}</Text>
                ) : null}
            </View>
            <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
            </View>
        </TouchableOpacity>
    );
};

interface NumberStepperProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (value: number) => void;
}

export const NumberStepper = ({
    label,
    value,
    min,
    max,
    step,
    unit,
    onChange,
}: NumberStepperProps) => {
    const { colors } = useTheme();

    const stepBy = (delta: number) => {
        const next = Math.min(max, Math.max(min, value + delta));
        onChange(next);
    };

    return (
        <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
            <View style={styles.stepperControls}>
                <TouchableOpacity
                    accessibilityLabel={`Decrease ${label}`}
                    accessibilityRole="button"
                    onPress={() => stepBy(-step)}
                    style={[styles.stepperButton, { backgroundColor: colors.secondary }]}
                >
                    <Text style={[styles.stepperSymbol, { color: colors.foreground }]}>-</Text>
                </TouchableOpacity>
                <Text style={[styles.stepperValue, { color: colors.foreground }]}>
                    {`${value} ${unit}`}
                </Text>
                <TouchableOpacity
                    accessibilityLabel={`Increase ${label}`}
                    accessibilityRole="button"
                    onPress={() => stepBy(step)}
                    style={[styles.stepperButton, { backgroundColor: colors.secondary }]}
                >
                    <Text style={[styles.stepperSymbol, { color: colors.foreground }]}>+</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    body: {
        paddingHorizontal: layout.cardPadding,
        paddingVertical: spacing.xs,
    },
    card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        overflow: 'hidden',
        paddingVertical: spacing.sm,
    },
    footer: {
        ...typography.caption,
        marginTop: spacing.sm,
        paddingHorizontal: layout.screenPadding,
    },
    header: {
        ...typography.label,
        letterSpacing: 0.08,
        paddingBottom: spacing.sm,
        paddingHorizontal: layout.cardPadding,
        paddingTop: spacing.xs,
        textTransform: 'uppercase',
    },
    radio: {
        alignItems: 'center',
        borderRadius: radii.full,
        borderWidth: 2,
        height: 20,
        justifyContent: 'center',
        width: 20,
    },
    radioDot: {
        borderRadius: radii.full,
        height: 10,
        width: 10,
    },
    row: {
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'space-between',
        minHeight: 52,
        paddingHorizontal: layout.cardPadding,
        paddingVertical: spacing.sm,
    },
    rowDescription: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    rowLabel: {
        ...typography.body,
    },
    rowText: {
        flex: 1,
    },
    rowValue: {
        ...typography.body,
    },
    section: {
        marginBottom: layout.sectionGap,
    },
    stepperButton: {
        alignItems: 'center',
        borderRadius: radii.md,
        height: 44,
        justifyContent: 'center',
        width: 44,
    },
    stepperControls: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
    },
    stepperSymbol: {
        ...typography.heading,
    },
    stepperValue: {
        ...typography.subheading,
        minWidth: 72,
        textAlign: 'center',
    },
});
