import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ThemeMode } from '@config/theme';
import { STORAGE_KEYS } from '@constants/constants';

interface ThemeState {
  mode: ThemeMode | null;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: null,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: STORAGE_KEYS.themeMode,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
