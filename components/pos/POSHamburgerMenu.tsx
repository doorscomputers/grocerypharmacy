import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { useResponsiveTheme } from '../../utils/responsive';

export interface POSMenuAction {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface POSHamburgerMenuProps {
  visible: boolean;
  onClose: () => void;
  onReprint: () => void;
  onReprintHistory: () => void;
  onXReading: () => void;
  onZReading: () => void;
  onCashFund: () => void;
  onPettyCash: () => void;
  onRefund: () => void;
  onExchange: () => void;
  onVoid: () => void;
  onQuickAddCustomer: () => void;
  hasLastTransaction?: boolean;
}

export default function POSHamburgerMenu({
  visible,
  onClose,
  onReprint,
  onReprintHistory,
  onXReading,
  onZReading,
  onCashFund,
  onPettyCash,
  onRefund,
  onExchange,
  onVoid,
  onQuickAddCustomer,
  hasLastTransaction = false,
}: POSHamburgerMenuProps) {
  const { sp, fs, lo } = useResponsiveTheme();
  const menuSections = [
    {
      title: 'Receipt',
      items: [
        {
          id: 'reprint',
          label: 'Reprint Last Receipt',
          icon: '🖨️',
          onPress: onReprint,
          disabled: !hasLastTransaction,
        },
        {
          id: 'reprint-history',
          label: 'Reprint Receipt',
          icon: '📄',
          onPress: onReprintHistory,
          disabled: false,
        },
      ],
    },
    {
      title: 'Reports',
      items: [
        {
          id: 'x-reading',
          label: 'X-Reading (Mid-day)',
          icon: '📋',
          onPress: onXReading,
          disabled: false,
        },
        {
          id: 'z-reading',
          label: 'Z-Reading (End of Day)',
          icon: '📊',
          onPress: onZReading,
          disabled: false,
        },
      ],
    },
    {
      title: 'Cash Management',
      items: [
        {
          id: 'cash-fund',
          label: 'Add Cash Fund',
          icon: '💵',
          onPress: onCashFund,
          disabled: false,
        },
        {
          id: 'petty-cash',
          label: 'Petty Cash Withdrawal',
          icon: '💸',
          onPress: onPettyCash,
          disabled: false,
        },
      ],
    },
    {
      title: 'Transactions',
      items: [
        {
          id: 'refund',
          label: 'Process Refund',
          icon: '↩️',
          onPress: onRefund,
          disabled: false,
        },
        {
          id: 'exchange',
          label: 'Exchange Item',
          icon: '🔄',
          onPress: onExchange,
          disabled: false,
        },
        {
          id: 'void',
          label: 'Void Transaction',
          icon: '❌',
          onPress: onVoid,
          destructive: true,
          disabled: false,
        },
      ],
    },
    {
      title: 'Customer',
      items: [
        {
          id: 'quick-add-customer',
          label: 'Quick Add Customer',
          icon: '👤',
          onPress: onQuickAddCustomer,
          disabled: false,
        },
      ],
    },
  ];

  const handleItemPress = (item: POSMenuAction) => {
    if (item.disabled) return;
    onClose();
    // Small delay to allow menu to close smoothly
    setTimeout(() => {
      item.onPress();
    }, 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.menuContainer} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { fontSize: fs.h3 }]}>☰ POS Menu</Text>
            <IconButton icon="close" size={24} onPress={onClose} />
          </View>

          {/* Menu Items */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {menuSections.map((section, sectionIndex) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.menuItem}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.menuItemIcon}>{item.icon}</Text>
                    <Text style={[styles.menuItemLabel, { fontSize: fs.body }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                {sectionIndex < menuSections.length - 1 && (
                  <View style={styles.sectionDivider} />
                )}
              </View>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Tap outside to close
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: 280,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  scrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  section: {
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E9E9E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemDestructive: {
    backgroundColor: '#FFF5F5',
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#212121',
    flex: 1,
  },
  menuItemLabelDisabled: {
    color: '#9E9E9E',
  },
  menuItemLabelDestructive: {
    color: '#D32F2F',
  },
  disabledBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9E9E9E',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginTop: 8,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
});
