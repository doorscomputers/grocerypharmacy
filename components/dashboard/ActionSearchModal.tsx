/**
 * ActionSearchModal - Searchable grid of all actions
 *
 * Provides quick access to all dashboard actions with search functionality
 * Uses reactive dimensions instead of static Dimensions.get('window')
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { useResponsiveTheme } from '../../utils/responsive';
import { QuickAction } from './QuickActionRow';

interface ActionSearchModalProps {
  visible: boolean;
  onClose: () => void;
  actions: QuickAction[];
  adminActions?: QuickAction[];
  showAdminActions?: boolean;
}

export const ActionSearchModal: React.FC<ActionSearchModalProps> = ({
  visible,
  onClose,
  actions,
  adminActions = [],
  showAdminActions = false,
}) => {
  const { colors } = useAppTheme();
  const { sp, fs, lo, isPhone } = useResponsiveTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const numColumns = isPhone ? 3 : 4;
  const itemWidth = (lo.modalMaxWidth - sp.lg * 2 - sp.sm * (numColumns - 1)) / numColumns;

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
    setTimeout(() => {
      action.onPress();
    }, 100);
  };

  const renderAction = ({ item }: { item: QuickAction }) => (
    <TouchableOpacity
      onPress={() => handleActionPress(item)}
      activeOpacity={0.7}
      style={[styles.actionItem, { backgroundColor: colors.surface, width: itemWidth }, shadows.card]}
    >
      <View style={[styles.iconContainer, { backgroundColor: (item.color || colors.primary) + '15' }]}>
        <MaterialCommunityIcons
          name={item.icon}
          size={28}
          color={item.color || colors.primary}
        />
      </View>
      <Text
        style={[styles.actionLabel, { color: colors.text, fontSize: fs.caption }]}
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
        <View style={[styles.header, { backgroundColor: colors.surface, paddingVertical: sp.md, paddingHorizontal: sp.md }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs.cardTitle }]}>All Actions</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, marginHorizontal: sp.md, marginVertical: sp.sm, paddingHorizontal: sp.md }]}>
          <MaterialCommunityIcons name="magnify" size={24} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontSize: fs.body }]}
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
          key={numColumns}
          data={filteredActions}
          renderItem={renderAction}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={[styles.gridContainer, { padding: sp.md }]}
          columnWrapperStyle={[styles.row, { gap: sp.sm, marginBottom: sp.sm }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="magnify-close" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fs.body }]}>
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
    ...shadows.card,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  gridContainer: {},
  row: {
    justifyContent: 'flex-start',
  },
  actionItem: {
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
    textAlign: 'center',
  },
});

export default ActionSearchModal;
