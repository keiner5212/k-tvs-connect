export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    primarySubtle: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    success: string;
    successForeground: string;
    error: string;
    errorForeground: string;
    warning: string;
    warningForeground: string;
    info: string;
    infoForeground: string;
    border: string;
    destructive: string;
    overlay: string;
    transparent: string;
}

export const lightTheme: ThemeColors = {
    background: '#F4F4F5',
    foreground: '#121214',
    card: '#FFFFFF',
    cardForeground: '#121214',
    primary: '#E4002B',
    primaryForeground: '#FFFFFF',
    primarySubtle: 'rgba(228,0,43,0.10)',
    secondary: '#ECECEE',
    secondaryForeground: '#121214',
    muted: '#F0F0F2',
    mutedForeground: '#5B5B66',
    accent: '#121214',
    accentForeground: '#FFFFFF',
    success: '#1F9D55',
    successForeground: '#FFFFFF',
    error: '#D92D20',
    errorForeground: '#FFFFFF',
    warning: '#F79009',
    warningForeground: '#121214',
    info: '#6B6B78',
    infoForeground: '#FFFFFF',
    border: '#E2E2E6',
    destructive: '#E4002B',
    overlay: 'rgba(18,18,20,0.85)',
    transparent: 'transparent',
};

export const darkTheme: ThemeColors = {
    background: '#0B0B0D',
    foreground: '#F4F4F5',
    card: '#17171A',
    cardForeground: '#F4F4F5',
    primary: '#FF2743',
    primaryForeground: '#0B0B0D',
    primarySubtle: 'rgba(255,39,67,0.16)',
    secondary: '#1E1E22',
    secondaryForeground: '#F4F4F5',
    muted: '#1E1E22',
    mutedForeground: '#9A9AA6',
    accent: '#F4F4F5',
    accentForeground: '#0B0B0D',
    success: '#3DBE7B',
    successForeground: '#0B0B0D',
    error: '#F97066',
    errorForeground: '#0B0B0D',
    warning: '#FDB022',
    warningForeground: '#0B0B0D',
    info: '#98A2B3',
    infoForeground: '#0B0B0D',
    border: '#26262C',
    destructive: '#FF2743',
    overlay: 'rgba(11,11,13,0.9)',
    transparent: 'transparent',
};

export const getThemeColors = (mode: ThemeMode): ThemeColors =>
    mode === 'light' ? lightTheme : darkTheme;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
} as const;

export const typography = {
    title: { fontSize: 28, fontWeight: '800' as const },
    heading: { fontSize: 20, fontWeight: '700' as const },
    subheading: { fontSize: 16, fontWeight: '600' as const },
    body: { fontSize: 15, lineHeight: 22 },
    caption: { fontSize: 12, lineHeight: 16 },
    label: { fontSize: 14, fontWeight: '600' as const },
    button: { fontSize: 15, fontWeight: '700' as const },
    metric: { fontSize: 52, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
    readout: { fontSize: 22, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
} as const;

export const radii = {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    full: 9999,
} as const;

export const layout = {
    screenPadding: 20,
    cardPadding: 16,
    cardMargin: 12,
    cardRadius: 14,
    inputHeight: 48,
    inputRadius: 12,
    buttonHeight: 48,
    buttonRadius: 12,
    containerGap: 12,
    sectionGap: 24,
    iconContainerSize: 34,
    avatarSize: 44,
} as const;
