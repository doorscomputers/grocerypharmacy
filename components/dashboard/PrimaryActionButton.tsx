/**
 * PrimaryActionButton - Large touch-friendly action button
 *
 * 120x120dp size based on research for optimal POS touch targets
 * Used for primary actions like "New Sale" and "Returns"
 */

import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows, layout, touchTargets } from '../../utils/theme';

interface PrimaryActionButtonProps {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
  disabled?: boolean;
}

export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled = false,
}) => {
  const { colors } = useAppTheme();

  const getBackgroundColor = () => {
    if (disabled) return colors.disabled;
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.secondary;
      case 'success':
        return colors.success;
      case 'warning':
        return colors.accent;
      default:
        return colors.primary;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.button,
        shadows.button,
        { backgroundColor: getBackgroundColor() },
        disabled && styles.disabled,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={40}
        color={colors.textOnPrimary}
        style={styles.icon}
      />
      <Text style={[styles.label, { color: colors.textOnPrimary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: layout.primaryActionSize,
    height: layout.primaryActionSize,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.button.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PrimaryActionButton;
