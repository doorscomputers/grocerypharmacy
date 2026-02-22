/**
 * MetricCard - Compact metric display card
 *
 * Used for secondary metrics like Sales Returns, Cash Fund, Stock Alerts
 * Responsive icon and font scaling
 */

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { borderRadius, shadows, layout } from '../../utils/theme';
import { useResponsiveTheme } from '../../utils/responsive';

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
  const { sp, fs } = useResponsiveTheme();
  const displayColor = color || colors.primary;

  const iconSize = Math.round(fs.cardValue * 0.9);

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
      <Card.Content style={[styles.content, { paddingVertical: sp.md, paddingHorizontal: sp.sm }]}>
        <MaterialCommunityIcons
          name={icon}
          size={iconSize}
          color={displayColor}
          style={styles.icon}
        />
        <Text style={[styles.value, { color: displayColor, fontSize: fs.cardValue - 4 }]} numberOfLines={1}>
          {formatValue()}
        </Text>
        <Text style={[styles.label, { color: colors.textSecondary, fontSize: fs.caption }]} numberOfLines={1}>
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
  },
  icon: {
    marginBottom: 4,
  },
  value: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  label: {
    textAlign: 'center',
    marginTop: 4,
  },
});

export default MetricCard;
