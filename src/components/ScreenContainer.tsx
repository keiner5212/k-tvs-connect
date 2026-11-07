import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@hooks/useTheme';
import { layout } from '@config/theme';

interface ScreenContainerProps {
    children: React.ReactNode;
    scroll?: boolean;
    padded?: boolean;
    edges?: ('top' | 'bottom')[];
}

export const ScreenContainer = ({
    children,
    scroll = false,
    padded = true,
    edges = ['top', 'bottom'],
}: ScreenContainerProps) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const padding = {
        paddingTop: edges.includes('top') ? insets.top : 0,
        paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        paddingLeft: padded ? layout.screenPadding : 0,
        paddingRight: padded ? layout.screenPadding : 0,
    };

    if (scroll) {
        return (
            <ScrollView
                contentContainerStyle={[styles.scrollContent, padding]}
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
