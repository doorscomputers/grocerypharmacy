/**
 * HeroSalesCard - Large prominent card for today's sales
 *
 * Displays the most important metric (total sales) prominently
 * Responsive font and padding scaling
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAppTheme } from '../../contexts/ThemeContext';
import { borderRadius, shadows } from '../../utils/theme';
import { useResponsiveTheme } from '../../utils/responsive';

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
  const { sp, fs, lo } = useResponsiveTheme();

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
    <Card style={[styles.card, { backgroundColor: colors.primary, minHeight: lo.heroCardMinHeight }, shadows.card]}>
      <Card.Content style={[styles.content, { padding: sp.lg }]}>
        <Text style={[styles.label, { color: colors.textOnPrimary, fontSize: fs.cardTitle }]}>
          {dateLabel}
        </Text>

        <Text style={[styles.amount, { color: colors.textOnPrimary, fontSize: fs.hero }]}>
          {formatCurrency(totalSales)}
        </Text>

        <View style={[styles.footer, { gap: sp.md }]}>
          <Text style={[styles.transactions, { color: colors.textOnPrimary, fontSize: fs.bodySmall }]}>
            {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}
          </Text>

          {percentChange !== null && (
            <View style={[
              styles.changeBadge,
              { backgroundColor: percentChange >= 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,0,0,0.2)', paddingHorizontal: sp.sm, paddingVertical: sp.xs }
            ]}>
              <Text style={[styles.changeText, { color: colors.textOnPrimary, fontSize: fs.caption }]}>
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
    marginBottom: 16,
  },
  content: {
    alignItems: 'center',
  },
  label: {
    fontWeight: '600',
    opacity: 0.9,
    marginBottom: 8,
  },
  amount: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactions: {
    opacity: 0.9,
  },
  changeBadge: {
    borderRadius: borderRadius.md,
  },
  changeText: {
    fontWeight: '600',
  },
});

export default HeroSalesCard;
