/**
 * PrimaryActionButton - Large touch-friendly action button
 *
 * Responsive size based on device width for optimal POS touch targets
 */

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, shadows } from '../../utils/theme';
import { useResponsiveTheme } from '../../utils/responsive';

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
  const { fs, lo } = useResponsiveTheme();

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
        {
          backgroundColor: getBackgroundColor(),
          width: lo.primaryActionSize,
          height: lo.primaryActionSize,
        },
        disabled && styles.disabled,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={lo.primaryActionIcon}
        color={colors.textOnPrimary}
        style={styles.icon}
      />
      <Text style={[styles.label, { color: colors.textOnPrimary, fontSize: fs.button }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
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
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PrimaryActionButton;
