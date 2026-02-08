/**
 * HeroSalesCard - Large prominent card for today's sales
 *
 * Displays the most important metric (total sales) prominently
 * Following research-backed POS UI patterns
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAppTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows, layout } from '../../utils/theme';

interface HeroSalesCardProps {
  totalSales: number;
  transactionCount: number;
  previousPeriodSales?: number;
  dateLabel?: string;
}

export const HeroSalesCard: React.FC<HeroSalesCardProps> = ({
  totalSales,
  transactionCount,
  previousPeriodSales,
  dateLabel = "Today's Sales",
}) => {
  const { colors } = useAppTheme();

  // Calculate percentage change if previous period data available
  const percentChange = previousPeriodSales && previousPeriodSales > 0
    ? ((totalSales - previousPeriodSales) / previousPeriodSales) * 100
    : null;

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <Card style={[styles.card, { backgroundColor: colors.primary }, shadows.card]}>
      <Card.Content style={styles.content}>
        <Text style={[styles.label, { color: colors.textOnPrimary }]}>
          {dateLabel}
        </Text>

        <Text style={[styles.amount, { color: colors.textOnPrimary }]}>
          {formatCurrency(totalSales)}
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.transactions, { color: colors.textOnPrimary }]}>
            {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}
          </Text>

          {percentChange !== null && (
            <View style={[
              styles.changeBadge,
              { backgroundColor: percentChange >= 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,0,0,0.2)' }
            ]}>
              <Text style={[styles.changeText, { color: colors.textOnPrimary }]}>
                {percentChange >= 0 ? '↑' : '↓'} {Math.abs(percentChange).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    minHeight: layout.heroCardMinHeight,
  },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  label: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '600',
    opacity: 0.9,
    marginBottom: spacing.sm,
  },
  amount: {
    fontSize: typography.hero.fontSize,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  transactions: {
    fontSize: typography.bodySmall.fontSize,
    opacity: 0.9,
  },
  changeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  changeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
});

export default HeroSalesCard;
