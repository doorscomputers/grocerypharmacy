/**
 * ActionSearchModal - Searchable grid of all actions
 *
 * Provides quick access to all dashboard actions with search functionality
 * Much better UX than horizontal scrolling for many items
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { QuickAction } from './QuickActionRow';

interface ActionSearchModalProps {
  visible: boolean;
  onClose: () => void;
  actions: QuickAction[];
  adminActions?: QuickAction[];
  showAdminActions?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 4;
const ITEM_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export const ActionSearchModal: React.FC<ActionSearchModalProps> = ({
  visible,
  onClose,
  actions,
  adminActions = [],
  showAdminActions = false,
}) => {
  const { colors } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Combine and filter actions based on search
  const filteredActions = useMemo(() => {
    const allActions = showAdminActions ? [...actions, ...adminActions] : actions;

    if (!searchQuery.trim()) {
      return allActions;
    }

    const query = searchQuery.toLowerCase().trim();
    return allActions.filter(action =>
      action.label.toLowerCase().includes(query) ||
      action.id.toLowerCase().includes(query)
    );
  }, [actions, adminActions, showAdminActions, searchQuery]);

  const handleActionPress = (action: QuickAction) => {
    onClose();
    // Small delay to allow modal to close smoothly
    setTimeout(() => {
      action.onPress();
    }, 100);
  };

  const renderAction = ({ item }: { item: QuickAction }) => (
    <TouchableOpacity
      onPress={() => handleActionPress(item)}
      activeOpacity={0.7}
      style={[styles.actionItem, { backgroundColor: colors.surface }, shadows.card]}
    >
      <View style={[styles.iconContainer, { backgroundColor: (item.color || colors.primary) + '15' }]}>
        <MaterialCommunityIcons
          name={item.icon}
          size={28}
          color={item.color || colors.primary}
        />
      </View>
      <Text
        style={[styles.actionLabel, { color: colors.text }]}
        numberOfLines={2}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>All Actions</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="magnify" size={24} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search actions..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Actions Grid */}
        <FlatList
          data={filteredActions}
          renderItem={renderAction}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="magnify-close" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No actions found for "{searchQuery}"
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...shadows.card,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    paddingVertical: spacing.xs,
  },
  gridContainer: {
    padding: spacing.md,
  },
  row: {
    justifyContent: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionItem: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  actionLabel: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    lineHeight: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    textAlign: 'center',
  },
});

export default ActionSearchModal;
