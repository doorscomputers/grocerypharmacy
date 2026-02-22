/**
 * QuickActionRow - Horizontal scrollable quick action buttons
 *
 * Used for secondary actions like Purchase, Receivables, etc.
 * Scrollable to accommodate many options without cluttering the screen
 */

import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows, layout } from '../../utils/theme';
import { useResponsive, responsiveValue, useResponsiveTheme } from '../../utils/responsive';

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
  maxVisible?: number; // Limit visible items, show "More" button for the rest
  onShowMore?: () => void; // Callback when "More" button is pressed
}

export const QuickActionRow: React.FC<QuickActionRowProps> = ({
  actions,
  title,
  maxVisible,
  onShowMore,
}) => {
  const { colors } = useAppTheme();
  const { width } = useResponsive();
  const { fs } = useResponsiveTheme();

  // Calculate responsive action button size
  const actionSize = useMemo(() => responsiveValue(width, {
    smallPhone: 60,
    largePhone: 64,
    smallTablet: 68,
    largeTablet: 72,
    default: 72,
  }), [width]);

  // Calculate responsive icon container size
  const iconSize = useMemo(() => responsiveValue(width, {
    smallPhone: 44,
    largePhone: 46,
    smallTablet: 48,
    largeTablet: 48,
    default: 48,
  }), [width]);

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            onPress={action.onPress}
            activeOpacity={0.7}
            style={[
              styles.actionButton,
              shadows.card,
              { backgroundColor: colors.surface, width: actionSize }
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
        {/* More button at the end */}
        {hasMore && onShowMore && (
          <TouchableOpacity
            onPress={onShowMore}
            activeOpacity={0.7}
            style={[
              styles.actionButton,
              styles.moreButton,
              { backgroundColor: colors.primary + '10', width: actionSize }
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
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  moreButton: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderStyle: 'dashed',
  },
  actionButton: {
    // Width now set dynamically via inline styles
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  iconContainer: {
    // Width and height now set dynamically via inline styles
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
