import { useColorScheme } from 'react-native';

import { getThemeColors, ThemeMode } from '@config/theme';
import { useThemeStore } from '@stores/themeStore';

export const useTheme = () => {
  const systemScheme = useColorScheme();
  const storedMode = useThemeStore((state) => state.mode);

  const mode: ThemeMode = storedMode ?? (systemScheme === 'dark' ? 'dark' : 'light');

  return {
    mode,
    colors: getThemeColors(mode),
  };
};
