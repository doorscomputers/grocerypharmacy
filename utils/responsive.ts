/**
 * Responsive Utilities for IgoroTech POS
 *
 * Provides breakpoint system and responsive hooks following Loyverse POS patterns
 * for adaptive layouts across phones (3"x6") to tablets (10"+)
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { spacing as baseSpacing, typography, layout } from './theme';

// Breakpoint definitions based on Loyverse POS research
export const BREAKPOINTS = {
  smallPhone: 320,    // 3-5.5" phones (iPhone SE, small Androids)
  largePhone: 414,    // 5.5-6.5" phones (iPhone 11 Pro Max, Pixel)
  smallTablet: 600,   // 7-8" tablets (iPad Mini)
  largeTablet: 900,   // 9-10"+ tablets (iPad Pro, large Android tablets)
} as const;

/**
 * Hook for responsive device detection and layout decisions
 */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;

  return {
    width,
    height,
    isSmallPhone: width < BREAKPOINTS.largePhone,
    isLargePhone: width >= BREAKPOINTS.largePhone && width < BREAKPOINTS.smallTablet,
    isSmallTablet: width >= BREAKPOINTS.smallTablet && width < BREAKPOINTS.largeTablet,
    isLargeTablet: width >= BREAKPOINTS.largeTablet,
    isPhone: width < BREAKPOINTS.smallTablet,
    isTablet: width >= BREAKPOINTS.smallTablet,
    isLandscape,
    orientation: (isLandscape ? 'landscape' : 'portrait') as 'landscape' | 'portrait',
  };
};

/**
 * Responsive value selector - Returns appropriate value based on screen width
 */
export const responsiveValue = <T,>(
  width: number,
  values: {
    smallPhone?: T;
    largePhone?: T;
    smallTablet?: T;
    largeTablet?: T;
    default: T;
  }
): T => {
  if (width < BREAKPOINTS.largePhone && values.smallPhone !== undefined) {
    return values.smallPhone;
  }
  if (width < BREAKPOINTS.smallTablet && values.largePhone !== undefined) {
    return values.largePhone;
  }
  if (width < BREAKPOINTS.largeTablet && values.smallTablet !== undefined) {
    return values.smallTablet;
  }
  if (values.largeTablet !== undefined) {
    return values.largeTablet;
  }
  return values.default;
};

/**
 * Calculate responsive spacing based on screen width
 */
export const responsiveSpacing = (
  width: number,
  baseSize: number,
  scale?: { phone?: number; tablet?: number }
): number => {
  const isPhone = width < BREAKPOINTS.smallTablet;
  const phoneScale = scale?.phone ?? 1;
  const tabletScale = scale?.tablet ?? 1;

  return baseSize * (isPhone ? phoneScale : tabletScale);
};

/**
 * Get responsive font size based on screen width
 * Scales DOWN on small phones and UP on tablets
 * Maintains minimum 12px for readability (BIR compliance)
 */
export const responsiveFontSize = (
  width: number,
  baseSize: number,
  minSize: number = 12
): number => {
  if (width < BREAKPOINTS.smallPhone) {
    return Math.max(baseSize * 0.85, minSize);
  }
  if (width < BREAKPOINTS.largePhone) {
    return Math.max(baseSize * 0.92, minSize);
  }
  if (width < BREAKPOINTS.smallTablet) {
    // Large phones: base size
    return baseSize;
  }
  if (width < BREAKPOINTS.largeTablet) {
    // Small tablets: scale up slightly
    return baseSize * 1.05;
  }
  // Large tablets: scale up more
  return baseSize * 1.12;
};

// ============================================
// useResponsiveTheme() Hook
// ============================================

function getSpacingFactor(width: number): number {
  if (width < BREAKPOINTS.largePhone) return 0.85;
  if (width < BREAKPOINTS.smallTablet) return 0.95;
  if (width < BREAKPOINTS.largeTablet) return 1.0;
  return 1.1;
}

function getFontFactor(width: number): number {
  if (width < BREAKPOINTS.smallPhone) return 0.85;
  if (width < BREAKPOINTS.largePhone) return 0.92;
  if (width < BREAKPOINTS.smallTablet) return 1.0;
  if (width < BREAKPOINTS.largeTablet) return 1.05;
  return 1.12;
}

function scale(base: number, factor: number): number {
  return Math.round(base * factor);
}

/**
 * All-in-one responsive theme hook.
 * Returns scaled spacing (sp), font sizes (fs), layout values (lo),
 * plus device flags.
 *
 * Usage:
 *   const { sp, fs, lo, isPhone, isTablet, width } = useResponsiveTheme();
 *   <Text style={[styles.title, { fontSize: fs.h2 }]}>
 *   <View style={[styles.content, { padding: lo.screenPadding }]}>
 */
export const useResponsiveTheme = () => {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const sf = getSpacingFactor(width);
    const ff = getFontFactor(width);
    const isPhone = width < BREAKPOINTS.smallTablet;
    const isTablet = width >= BREAKPOINTS.smallTablet;

    const sp = {
      xs: scale(baseSpacing.xs, sf),
      sm: scale(baseSpacing.sm, sf),
      md: scale(baseSpacing.md, sf),
      lg: scale(baseSpacing.lg, sf),
      xl: scale(baseSpacing.xl, sf),
      xxl: scale(baseSpacing.xxl, sf),
    };

    const fs = {
      hero: scale(typography.hero.fontSize, ff),
      h1: scale(typography.h1.fontSize, ff),
      h2: scale(typography.h2.fontSize, ff),
      h3: scale(typography.h3.fontSize, ff),
      cardTitle: scale(typography.cardTitle.fontSize, ff),
      cardValue: scale(typography.cardValue.fontSize, ff),
      body: Math.max(scale(typography.body.fontSize, ff), 12),
      bodySmall: Math.max(scale(typography.bodySmall.fontSize, ff), 12),
      button: Math.max(scale(typography.button.fontSize, ff), 12),
      caption: Math.max(scale(typography.caption.fontSize, ff), 10),
    };

    const lo = {
      screenPadding: scale(layout.screenPadding, sf),
      primaryActionSize: isPhone
        ? (width < BREAKPOINTS.largePhone ? 90 : 100)
        : (width < BREAKPOINTS.largeTablet ? 120 : 140),
      primaryActionIcon: isPhone
        ? (width < BREAKPOINTS.largePhone ? 28 : 32)
        : (width < BREAKPOINTS.largeTablet ? 40 : 48),
      heroCardMinHeight: scale(layout.heroCardMinHeight, sf),
      modalMaxWidth: isPhone ? width * 0.92 : Math.min(600, width * 0.8),
      gridColumns: isPhone ? 2 : (width < BREAKPOINTS.largeTablet ? 3 : 4),
      cardGutter: scale(layout.cardGutter, sf),
    };

    const isLandscape = width > height;

    return { sp, fs, lo, width, height, isPhone, isTablet, isLandscape };
  }, [width, height]);
};

/**
 * Hook for landscape split-panel layouts.
 * Returns whether a two-column split is appropriate and the panel widths.
 */
export const useLandscapeLayout = (options?: {
  leftRatio?: number;
  minWidthForSplit?: number;
}) => {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const leftRatio = options?.leftRatio ?? 0.55;
    const minWidth = options?.minWidthForSplit ?? 600;
    const isLandscape = width > height;
    const canSplit = isLandscape && width >= minWidth;
    const leftPanelWidth = canSplit ? Math.round(width * leftRatio) : width;
    const rightPanelWidth = canSplit ? width - leftPanelWidth : width;

    return { isLandscape, canSplit, leftPanelWidth, rightPanelWidth, width, height };
  }, [width, height, options?.leftRatio, options?.minWidthForSplit]);
};
