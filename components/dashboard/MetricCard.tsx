/**
 * MetricCard - Compact metric display card
 *
 * Used for secondary metrics like Sales Returns, Cash Fund, Stock Alerts
 * 3-column layout on dashboard
 */

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows, layout } from '../../utils/theme';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color?: string;
  onPress?: () => void;
  isCurrency?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  color,
  onPress,
  isCurrency = false,
}) => {
  const { colors } = useAppTheme();
  const displayColor = color || colors.primary;

  const formatValue = () => {
    if (isCurrency && typeof value === 'number') {
      return `₱${value.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return value.toString();
  };

  const CardContent = (
    <Card style={[styles.card, shadows.card]}>
      <Card.Content style={styles.content}>
        <MaterialCommunityIcons
          name={icon}
          size={24}
          color={displayColor}
          style={styles.icon}
        />
        <Text style={[styles.value, { color: displayColor }]} numberOfLines={1}>
          {formatValue()}
        </Text>
        <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </Card.Content>
    </Card>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.touchable}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return <>{CardContent}</>;
};

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
    minWidth: layout.metricCardMinWidth,
  },
  card: {
    flex: 1,
    borderRadius: borderRadius.lg,
    minWidth: layout.metricCardMinWidth,
  },
  content: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  icon: {
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.cardValue.fontSize - 4, // Slightly smaller for compact card
    fontWeight: 'bold',
    textAlign: 'center',
  },
  label: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default MetricCard;
