import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@hooks/useTheme';
import { layout, spacing } from '@config/theme';

interface ScreenContainerProps {
    children: React.ReactNode;
    scroll?: boolean;
    padded?: boolean;
    edges?: ('top' | 'bottom')[];
    keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

/**
 * Every screen goes through this so the safe area is handled in one place.
 * A screen pushed on the stack has a header, so it only needs the bottom edge.
 */
export const ScreenContainer = ({
    children,
    scroll = false,
    padded = true,
    edges = ['top', 'bottom'],
    keyboardShouldPersistTaps,
}: ScreenContainerProps) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const padding = {
        paddingTop: edges.includes('top') ? insets.top + spacing.lg : 0,
        paddingBottom: edges.includes('bottom') ? insets.bottom + layout.screenPadding : 0,
        paddingLeft: padded ? layout.screenPadding : 0,
        paddingRight: padded ? layout.screenPadding : 0,
    };

    if (scroll) {
        return (
            <ScrollView
                contentContainerStyle={[styles.scrollContent, padding]}
                keyboardShouldPersistTaps={keyboardShouldPersistTaps}
                style={[styles.screen, { backgroundColor: colors.background }]}
            >
                {children}
            </ScrollView>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.content, padding]}>{children}</View>
        </View>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
    },
    screen: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
});

export default ScreenContainer;
