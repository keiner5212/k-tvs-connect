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
    background: '#F5F6F8',
    foreground: '#12161C',
    card: '#FFFFFF',
    cardForeground: '#12161C',
    primary: '#1363DF',
    primaryForeground: '#FFFFFF',
    primarySubtle: 'rgba(19,99,223,0.12)',
    secondary: '#E8ECF3',
    secondaryForeground: '#12161C',
    muted: '#EDEFF3',
    mutedForeground: '#5B6472',
    accent: '#00A98F',
    accentForeground: '#FFFFFF',
    success: '#1F9D55',
    successForeground: '#FFFFFF',
    error: '#D92D20',
    errorForeground: '#FFFFFF',
    warning: '#F79009',
    warningForeground: '#12161C',
    info: '#7A8699',
    infoForeground: '#FFFFFF',
    border: '#DCE0E6',
    destructive: '#D92D20',
    overlay: 'rgba(18,22,28,0.85)',
    transparent: 'transparent',
};

export const darkTheme: ThemeColors = {
    background: '#0E1116',
    foreground: '#F2F4F7',
    card: '#161B22',
    cardForeground: '#F2F4F7',
    primary: '#5B8DEF',
    primaryForeground: '#0E1116',
    primarySubtle: 'rgba(91,141,239,0.16)',
    secondary: '#1C222B',
    secondaryForeground: '#F2F4F7',
    muted: '#1C222B',
    mutedForeground: '#9AA4B2',
    accent: '#33C2B0',
    accentForeground: '#0E1116',
    success: '#3DBE7B',
    successForeground: '#0E1116',
    error: '#F97066',
    errorForeground: '#0E1116',
    warning: '#FDB022',
    warningForeground: '#0E1116',
    info: '#98A2B3',
    infoForeground: '#0E1116',
    border: '#262C36',
    destructive: '#F97066',
    overlay: 'rgba(14,17,22,0.9)',
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
