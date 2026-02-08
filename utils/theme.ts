/**
 * Centralized Theme System for IgoroTech POS
 *
 * Based on research from Square, Toast, Clover, and Filipino POS systems (UTAK, StoreHub)
 * Optimized for touch-based mobile POS on tablets and phones
 */

// Theme Names
export type ThemeName = 'teal' | 'blue' | 'green';

// Color Palette Interface
export interface ColorPalette {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  textOnPrimary: string;
  border: string;
  disabled: string;
}

// Theme 1: Professional Teal (Default) - Popular with Filipino SME apps
export const tealTheme: ColorPalette = {
  primary: '#00796B',
  primaryDark: '#004D40',
  primaryLight: '#4DB6AC',
  secondary: '#455A64',
  accent: '#F57C00',
  success: '#2E7D32',
  error: '#C62828',
  warning: '#F9A825',
  info: '#0288D1',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceVariant: '#ECEFF1',
  text: '#212121',
  textSecondary: '#757575',
  textOnPrimary: '#FFFFFF',
  border: '#E0E0E0',
  disabled: '#BDBDBD',
};

// Theme 2: Classic Blue - Professional, corporate feel
export const blueTheme: ColorPalette = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#42A5F5',
  secondary: '#37474F',
  accent: '#FF9800',
  success: '#2E7D32',
  error: '#C62828',
  warning: '#F9A825',
  info: '#0288D1',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceVariant: '#ECEFF1',
  text: '#212121',
  textSecondary: '#757575',
  textOnPrimary: '#FFFFFF',
  border: '#E0E0E0',
  disabled: '#BDBDBD',
};

// Theme 3: Money Green - Associates with success/money
export const greenTheme: ColorPalette = {
  primary: '#2E7D32',
  primaryDark: '#1B5E20',
  primaryLight: '#66BB6A',
  secondary: '#455A64',
  accent: '#F9A825',
  success: '#1B5E20',
  error: '#C62828',
  warning: '#FF8F00',
  info: '#0288D1',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceVariant: '#E8F5E9',
  text: '#212121',
  textSecondary: '#757575',
  textOnPrimary: '#FFFFFF',
  border: '#E0E0E0',
  disabled: '#BDBDBD',
};

// Theme Map
export const themes: Record<ThemeName, ColorPalette> = {
  teal: tealTheme,
  blue: blueTheme,
  green: greenTheme,
};

// Theme Display Names (for Settings UI)
export const themeDisplayNames: Record<ThemeName, string> = {
  teal: 'Professional Teal',
  blue: 'Classic Blue',
  green: 'Money Green',
};

// ============================================
// SPACING SYSTEM (8dp grid)
// ============================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ============================================
// TYPOGRAPHY SCALE
// ============================================
export const typography = {
  hero: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    lineHeight: 40,
  },
  h1: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    lineHeight: 36,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: 'normal' as const,
    lineHeight: 20,
  },
  button: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  buttonLarge: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 12,
    fontWeight: 'normal' as const,
    lineHeight: 16,
  },
} as const;

// ============================================
// TOUCH TARGET SPECIFICATIONS
// Research-backed optimal sizes for POS
// ============================================
export const touchTargets = {
  minimum: 48,      // Absolute minimum (WCAG)
  optimal: 60,      // Research-backed optimal size
  large: 80,        // For primary actions
  extraLarge: 120,  // For hero action buttons
} as const;

// ============================================
// BORDER RADIUS
// ============================================
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

// ============================================
// ELEVATION / SHADOWS
// ============================================
export const elevation = {
  none: 0,
  sm: 1,
  card: 2,
  button: 4,
  buttonPressed: 8,
  bottomNav: 8,
  modal: 16,
  dropdown: 24,
} as const;

// Platform-specific shadows
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomNav: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
} as const;

// ============================================
// LAYOUT CONSTANTS
// ============================================
export const layout = {
  topBarHeight: 64,
  bottomNavHeight: 64,
  cardGutter: 16,
  screenPadding: 16,
  heroCardMinHeight: 120,
  primaryActionSize: 120,
  metricCardMinWidth: 100,
  quickActionSize: 72,
} as const;

// ============================================
// HELPER FUNCTION: Get React Native Paper Theme
// ============================================
export const getPaperTheme = (themeName: ThemeName) => {
  const colors = themes[themeName];

  return {
    colors: {
      primary: colors.primary,
      accent: colors.accent,
      background: colors.background,
      surface: colors.surface,
      text: colors.text,
      onSurface: colors.textSecondary,
      placeholder: colors.textSecondary,
      disabled: colors.disabled,
      error: colors.error,
    },
  };
};
