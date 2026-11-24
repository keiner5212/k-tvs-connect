import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemeSwitch } from '@components/controls';
import { useTheme } from '@hooks/useTheme';
import { layout, radii, spacing, typography } from '@config/theme';
import { formatCount } from '@utils/format';

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
                <ThemeSwitch
                    accessibilityLabel={label}
                    accessibilityHint={description}
                    onValueChange={onSwitchChange}
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

interface SettingsUsageRowProps {
    label: string;
    used: number;
    cap: number;
    /** the point where the app stops calling google */
    stopAt: number;
    estimated?: boolean;
    /** what takes over when the cap is reached */
    fallback: string;
    loading?: boolean;
    failed?: boolean;
}

/**
 * How much of the free monthly quota of a google service is left. The tick is
 * the point where the app stops calling google and moves to the free service.
 */
export const SettingsUsageRow = ({
    label,
    used,
    cap,
    stopAt,
    estimated = false,
    fallback,
    loading = false,
    failed = false,
}: SettingsUsageRowProps) => {
    const { colors } = useTheme();
    const left = Math.max(0, stopAt - used);
    const atCap = !loading && !failed && used >= stopAt;
    const near = !atCap && !loading && !failed && used >= stopAt * 0.8;
    const fill = atCap ? colors.error : near ? colors.meterWarning : colors.info;
    const ratio = loading || failed || cap <= 0 ? 0 : Math.min(1, used / cap);
    const value = loading || failed ? '--' : atCap ? '0 left' : `${formatCount(left)} left`;
    const spoken = atCap
        ? `${formatCount(used)} of ${formatCount(cap)} used. Google is off.`
        : `${estimated ? 'Estimated count. ' : ''}${formatCount(used)} of ${formatCount(
            cap,
        )} used. ${formatCount(left)} left before Google stops.`;

    return (
        <View
            accessible
            accessibilityLabel={label}
            accessibilityValue={{ text: loading || failed ? label : spoken }}
            style={[styles.usageRow, { borderBottomColor: colors.border }]}
        >
            <View style={styles.usageHead}>
                <Text style={[styles.usageLabel, { color: colors.foreground }]}>{label}</Text>
                <Text
                    style={[
                        styles.usageValue,
                        { color: atCap ? colors.error : colors.foreground },
                    ]}
                >
                    {value}
                </Text>
            </View>
            <View style={styles.usageMeter}>
                <View
                    style={[
                        styles.usageTrack,
                        { backgroundColor: colors.muted, borderColor: colors.border },
                    ]}
                >
                    <View
                        style={[styles.usageFill, { backgroundColor: fill, width: `${ratio * 100}%` }]}
                    />
                </View>
                <View style={[styles.usageStop, { backgroundColor: colors.foreground }]} />
            </View>
            <Text
                style={[
                    styles.usageCaption,
                    { color: failed ? colors.error : colors.mutedForeground },
                ]}
            >
                {loading
                    ? 'Reading the counters.'
                    : failed
                        ? 'The counters could not be read.'
                        : atCap
                            ? `Used up. Google is off: ${fallback}`
                            : `${estimated ? 'Estimated. ' : ''}${formatCount(used)} of ${formatCount(
                                cap,
                            )} used. ${near ? 'Almost out, ' : ''
                            }Google stops at ${formatCount(stopAt)}.`}
            </Text>
        </View>
    );
};

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
    usageCaption: {
        ...typography.caption,
        marginTop: spacing.xs,
    },
    usageFill: {
        borderRadius: radii.full,
        height: '100%',
    },
    usageHead: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'space-between',
    },
    usageLabel: {
        ...typography.body,
        flex: 1,
    },
    usageMeter: {
        height: 12,
        justifyContent: 'center',
        marginTop: spacing.md,
        position: 'relative',
    },
    usageRow: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: layout.cardPadding,
        paddingVertical: spacing.sm,
    },
    usageStop: {
        height: 12,
        left: '95%',
        position: 'absolute',
        top: 0,
        width: 2,
    },
    usageTrack: {
        borderRadius: radii.full,
        borderWidth: 1,
        height: 8,
        overflow: 'hidden',
    },
    usageValue: {
        ...typography.readout,
        flexShrink: 1,
        textAlign: 'right',
    },
});
