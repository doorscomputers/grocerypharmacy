/**
 * Theme Context for IgoroTech POS
 *
 * Provides theme state management with AsyncStorage persistence
 * Allows users to switch between Teal, Blue, and Green themes
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeName,
  ColorPalette,
  themes,
  themeDisplayNames,
  getPaperTheme,
} from '../utils/theme';

// Storage key for persisting theme choice
const THEME_STORAGE_KEY = '@igorotech_pos_theme';

// Context Interface
interface ThemeContextType {
  themeName: ThemeName;
  colors: ColorPalette;
  paperTheme: ReturnType<typeof getPaperTheme>;
  setTheme: (theme: ThemeName) => Promise<void>;
  availableThemes: { name: ThemeName; displayName: string }[];
}

// Create Context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider Props
interface ThemeProviderProps {
  children: ReactNode;
}

// Theme Provider Component
export const AppThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeName>('teal');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && (savedTheme === 'teal' || savedTheme === 'blue' || savedTheme === 'green')) {
        setThemeName(savedTheme as ThemeName);
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setTheme = async (theme: ThemeName) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      setThemeName(theme);
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  // Get current theme colors
  const colors = themes[themeName];

  // Get React Native Paper compatible theme
  const paperTheme = getPaperTheme(themeName);

  // Available themes for Settings UI
  const availableThemes = Object.entries(themeDisplayNames).map(([name, displayName]) => ({
    name: name as ThemeName,
    displayName,
  }));

  const value: ThemeContextType = {
    themeName,
    colors,
    paperTheme,
    setTheme,
    availableThemes,
  };

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom Hook for accessing theme
export const useAppTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
};

// Export context for edge cases
export { ThemeContext };
