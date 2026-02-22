/**
 * QuickActionRow - Responsive grid of quick action buttons
 *
 * Uses flex-wrap to automatically adapt column count to any screen width.
 * No breakpoint branching needed — React Native's flex handles it.
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { useResponsive, useResponsiveTheme } from '../../utils/responsive';

export interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  color?: string;
  badge?: number;
}

interface QuickActionRowProps {
  actions: QuickAction[];
  title?: string;
  maxVisible?: number;
  onShowMore?: () => void;
}

export const QuickActionRow: React.FC<QuickActionRowProps> = ({
  actions,
  title,
  maxVisible,
  onShowMore,
}) => {
  const { colors } = useAppTheme();
  const { width } = useResponsive();
  const { fs, lo } = useResponsiveTheme();

  // Auto-calculate columns and button width from screen width
  // React Native flex-wrap handles the rest
  const BUTTON_MIN_WIDTH = 76;
  const gap = spacing.sm;
  const parentPadding = lo.screenPadding * 2; // DashboardScreen wraps us in paddingHorizontal
  const gridPadding = spacing.xs * 2;
  const available = width - parentPadding - gridPadding;
  const columns = Math.min(8, Math.max(3, Math.floor((available + gap) / (BUTTON_MIN_WIDTH + gap))));
  const buttonWidth = Math.floor((available - (columns - 1) * gap) / columns);

  // Icon scales with button
  const iconSize = Math.min(48, Math.max(36, buttonWidth * 0.55));

  // Limit visible actions if maxVisible is set
  const visibleActions = maxVisible ? actions.slice(0, maxVisible) : actions;
  const hasMore = maxVisible && actions.length > maxVisible;

  return (
    <View style={styles.container}>
      {title && (
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text, fontSize: fs.cardTitle }]}>{title}</Text>
          {onShowMore && (
            <TouchableOpacity onPress={onShowMore} style={styles.searchButton}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
              <Text style={[styles.searchButtonText, { color: colors.primary }]}>Search</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={styles.gridContent}>
        {visibleActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            onPress={action.onPress}
            activeOpacity={0.7}
            style={[
              styles.actionButton,
              shadows.card,
              { backgroundColor: colors.surface, width: buttonWidth }
            ]}
          >
            <View style={[
              styles.iconContainer,
              {
                backgroundColor: (action.color || colors.primary) + '15',
                width: iconSize,
                height: iconSize,
              }
            ]}>
              <MaterialCommunityIcons
                name={action.icon}
                size={iconSize * 0.58}
                color={action.color || colors.primary}
              />
              {action.badge !== undefined && action.badge > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>
                    {action.badge > 99 ? '99+' : action.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.actionLabel, { color: colors.text, fontSize: fs.caption }]}
              numberOfLines={2}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
        {/* More button */}
        {hasMore && onShowMore && (
          <TouchableOpacity
            onPress={onShowMore}
            activeOpacity={0.7}
            style={[
              styles.actionButton,
              styles.moreButton,
              { backgroundColor: colors.primary + '10', width: buttonWidth }
            ]}
          >
            <View style={[
              styles.iconContainer,
              {
                backgroundColor: colors.primary + '20',
                width: iconSize,
                height: iconSize,
              }
            ]}>
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={iconSize * 0.58}
                color={colors.primary}
              />
            </View>
            <Text
              style={[styles.actionLabel, { color: colors.primary, fontWeight: '600' }]}
              numberOfLines={1}
            >
              More
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  title: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '600',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  searchButtonText: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '500',
  },
  gridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  moreButton: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderStyle: 'dashed',
  },
  actionButton: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  iconContainer: {
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionLabel: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default QuickActionRow;
