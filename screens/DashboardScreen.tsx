/**
 * DashboardScreen - Modern POS Dashboard
 *
 * Redesigned based on research from Square, Toast, Clover, and Filipino POS systems
 * Features: Hero Sales Card, Large Primary Actions, Horizontal Quick Actions
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import {
  Text,
  Divider,
  IconButton,
  Avatar,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { PermissionService } from '../utils/permissions';
import { spacing, typography, borderRadius, shadows, layout } from '../utils/theme';
import { useResponsive, responsiveValue, useResponsiveTheme, useLandscapeLayout } from '../utils/responsive';
import { toLocalDateString } from '../utils/dateTime';
import { DatabaseBackupService } from '../utils/DatabaseBackupService';
import * as Sharing from 'expo-sharing';

// Dashboard Components
import { HeroSalesCard } from '../components/dashboard/HeroSalesCard';
import { PrimaryActionButton } from '../components/dashboard/PrimaryActionButton';
import { MetricCard } from '../components/dashboard/MetricCard';
import { QuickActionRow, QuickAction } from '../components/dashboard/QuickActionRow';
import { ActionSearchModal } from '../components/dashboard/ActionSearchModal';

type DashboardScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Dashboard'
>;

type Props = {
  navigation: DashboardScreenNavigationProp;
};

type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Helper function to get date range based on preset
const getDateRange = (preset: DatePreset, customStart?: Date, customEnd?: Date): DateRange => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    case 'yesterday':
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return {
        startDate: yesterday,
        endDate: new Date(today.getTime() - 1),
      };
    case 'this_week':
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      return {
        startDate: startOfWeek,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    case 'last_week':
      const lastWeekEnd = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000 - 1);
      const lastWeekStart = new Date(lastWeekEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
      return {
        startDate: new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate()),
        endDate: lastWeekEnd,
      };
    case 'this_month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: startOfMonth,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    case 'last_month':
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return {
        startDate: startOfLastMonth,
        endDate: endOfLastMonth,
      };
    case 'custom':
      return {
        startDate: customStart || today,
        endDate: customEnd || new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    default:
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
  }
};

const getPresetLabel = (preset: DatePreset): string => {
  switch (preset) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case 'this_week': return 'This Week';
    case 'last_week': return 'Last Week';
    case 'this_month': return 'This Month';
    case 'last_month': return 'Last Month';
    case 'custom': return 'Custom Range';
    default: return 'Today';
  }
};

export default function DashboardScreen({ navigation }: Props) {
  const { width } = useResponsive();
  const { sp, fs, lo } = useResponsiveTheme();
  const { canSplit } = useLandscapeLayout();
  const [stats, setStats] = useState({
    sales: 0,
    transactions: 0,
    customers: 0,
    salesReturns: 0,
    customerPayments: 0,
    supplierPayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [showActionSearch, setShowActionSearch] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [unseededCount, setUnseededCount] = useState(0);

  const { colors } = useAppTheme();
  const { user, logout } = useAuth();

  // Refresh data every time the screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [datePreset, customStartDate, customEndDate])
  );

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const { startDate, endDate } = getDateRange(datePreset, customStartDate, customEndDate);

      // Get all transactions
      let allTransactions: any[];
      if (user?.role === 'CASHIER') {
        allTransactions = await dbService.getTransactionsByCashier(user.id);
      } else {
        allTransactions = await dbService.getTransactions(1000);
      }

      // Filter transactions by date range
      const filteredTransactions = allTransactions.filter((t: any) => {
        const txDate = new Date(t.created_at || t.transaction_date);
        return txDate >= startDate && txDate <= endDate;
      });

      const totalSales = filteredTransactions
        .filter((t: any) => t.status === 'COMPLETED')
        .reduce((sum: number, t: any) => sum + (t.total_amount as number), 0);

      // Get sales returns
      let salesReturnsTotal = 0;
      try {
        const allReturns = await dbService.getSalesReturns(1000);
        const filteredReturns = allReturns.filter((r: any) => {
          const returnDate = new Date(r.return_date || r.created_at);
          return returnDate >= startDate && returnDate <= endDate;
        });
        salesReturnsTotal = filteredReturns.reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);
      } catch (e) {
        console.log('No sales returns data:', e);
      }

      // Get customer payments
      let customerPaymentsTotal = 0;
      try {
        const allPayments = await dbService.getCustomerPayments();
        const filteredPayments = allPayments.filter((p: any) => {
          const paymentDate = new Date(p.payment_date || p.created_at);
          return paymentDate >= startDate && paymentDate <= endDate;
        });
        customerPaymentsTotal = filteredPayments.reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
      } catch (e) {
        console.log('No customer payments data:', e);
      }

      // Get supplier payments
      let supplierPaymentsTotal = 0;
      try {
        const allSupplierPayments = await dbService.getSupplierPayments();
        const filteredSupplierPayments = allSupplierPayments.filter((p: any) => {
          const paymentDate = new Date(p.payment_date || p.created_at);
          return paymentDate >= startDate && paymentDate <= endDate;
        });
        supplierPaymentsTotal = filteredSupplierPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      } catch (e) {
        console.log('No supplier payments data:', e);
      }

      setStats({
        sales: totalSales,
        transactions: filteredTransactions.filter((t: any) => t.status === 'COMPLETED').length,
        customers: new Set(filteredTransactions.map((t: any) => t.customer_name).filter(Boolean)).size,
        salesReturns: salesReturnsTotal,
        customerPayments: customerPaymentsTotal,
        supplierPayments: supplierPaymentsTotal,
      });

      // AVCO seed check: count products with stock but no cost seeded.
      try {
        const c = await dbService.getUnseededInventoryCount();
        setUnseededCount(c);
      } catch (e) {
        setUnseededCount(0);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const handlePresetSelect = (preset: DatePreset) => {
    if (preset === 'custom') {
      const { startDate, endDate } = getDateRange(datePreset, customStartDate, customEndDate);
      setTempStartDate(formatDateForInput(startDate));
      setTempEndDate(formatDateForInput(endDate));
      setShowCustomDateModal(true);
    } else {
      setDatePreset(preset);
    }
    setShowDatePicker(false);
  };

  const formatDateForInput = (date: Date): string => {
    return toLocalDateString(date);
  };

  const handleCustomDateApply = () => {
    const start = new Date(tempStartDate);
    const end = new Date(tempEndDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      setCustomStartDate(start);
      setCustomEndDate(new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1));
      setDatePreset('custom');
    }
    setShowCustomDateModal(false);
  };

  const getDateRangeDisplay = (): string => {
    const { startDate, endDate } = getDateRange(datePreset, customStartDate, customEndDate);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (datePreset === 'today' || datePreset === 'yesterday') {
      return startDate.toLocaleDateString('en-PH', { ...options, year: 'numeric' });
    }
    return `${startDate.toLocaleDateString('en-PH', options)} - ${endDate.toLocaleDateString('en-PH', { ...options, year: 'numeric' })}`;
  };

  // Quick Actions for horizontal scroll
  const quickActions: QuickAction[] = [
    {
      id: 'catalog',
      label: 'Catalog',
      icon: 'folder-multiple',
      color: '#6200EE',
      onPress: () => navigation.navigate('MasterData'),
    },
    {
      id: 'purchase',
      label: 'Purchase',
      icon: 'truck-delivery',
      color: '#2196F3',
      onPress: () => navigation.navigate('PurchaseOrder'),
    },
    {
      id: 'receivables',
      label: 'Receivables',
      icon: 'cash-multiple',
      color: colors.accent,
      onPress: () => navigation.navigate('CustomerPayments'),
    },
    {
      id: 'payables',
      label: 'Payables',
      icon: 'cash-minus',
      color: '#9C27B0',
      onPress: () => navigation.navigate('SupplierPayments'),
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: 'chart-bar',
      color: '#E91E63',
      onPress: () => navigation.navigate('ReportsHub'),
    },
    {
      id: 'po_returns',
      label: 'PO Returns',
      icon: 'truck-minus',
      color: '#795548',
      onPress: () => navigation.navigate('PurchaseReturns'),
    },
    {
      id: 'damaged',
      label: 'Damaged',
      icon: 'package-variant-remove',
      color: colors.error,
      onPress: () => navigation.navigate('DamagedItems'),
    },
    {
      id: 'physical_count',
      label: 'Count',
      icon: 'clipboard-list',
      color: colors.accent,
      onPress: () => navigation.navigate('PhysicalInventory'),
    },
    {
      id: 'item_ledger',
      label: 'Ledger',
      icon: 'book-open-page-variant',
      color: '#673AB7',
      onPress: () => navigation.navigate('InventoryMovements'),
    },
    {
      id: 'end_of_day',
      label: 'End of Day',
      icon: 'calendar-check',
      color: colors.success,
      onPress: () => navigation.navigate('EndOfDay'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'cog',
      color: '#455A64',
      onPress: () => navigation.navigate('Settings'),
    },
    ...((user?.role === 'ADMIN' || user?.role === 'MANAGER') ? [{
      id: 'users',
      label: 'Users',
      icon: 'account-group',
      color: '#3F51B5',
      onPress: () => navigation.navigate('UserManagement'),
    }] : []),
    {
      id: 'help',
      label: 'Help',
      icon: 'help-circle',
      color: '#1976D2',
      onPress: () => navigation.navigate('UserManual'),
    },
  ];

  const handleBackupNow = async () => {
    try {
      setBackingUp(true);
      const backupService = DatabaseBackupService.getInstance();
      const backupPath = await backupService.createBackup();

      if (Platform.OS === 'web') {
        Alert.alert('Success', 'Backup downloaded successfully!');
      } else {
        Alert.alert(
          'Backup Created',
          'Your database backup has been saved successfully.',
          [
            { text: 'OK' },
            {
              text: 'Share Copy',
              onPress: async () => {
                try {
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(backupPath, {
                      mimeType: 'application/x-sqlite3',
                      dialogTitle: 'Share Database Backup',
                    });
                  }
                } catch (e) {
                  console.error('Share failed:', e);
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Backup failed:', error);
      Alert.alert('Backup Failed', `${error}`);
    } finally {
      setBackingUp(false);
    }
  };

  // Admin-only quick actions
  const adminQuickActions: QuickAction[] = [
    {
      id: 'backup',
      label: 'Backup',
      icon: 'backup-restore',
      color: '#4CAF50',
      onPress: handleBackupNow,
    },
    {
      id: 'permissions',
      label: 'Permissions',
      icon: 'shield-account',
      color: '#009688',
      onPress: () => navigation.navigate('PermissionManagement'),
    },
    {
      id: 'reset',
      label: 'Reset Data',
      icon: 'delete-forever',
      color: colors.error,
      onPress: () => navigation.navigate('ResetData'),
    },
    {
      id: 'database',
      label: 'Database',
      icon: 'database-eye',
      color: '#607D8B',
      onPress: () => navigation.navigate('DatabaseViewer'),
    },
  ];

  const APP_VERSION = 'v1.3.5';

  const webContainerStyle = {};
  const webScrollStyle = {};

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, webContainerStyle]}>
      <ScrollView
        style={[styles.scrollView, webScrollStyle]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Top Bar */}
        <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
          <View style={styles.topBarLeft}>
            <Text style={[styles.brandText, { color: colors.primary }]}>IgoroTech POS</Text>
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>{APP_VERSION}</Text>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.userButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Avatar.Text
                size={36}
                label={user?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                style={{ backgroundColor: colors.primary }}
              />
            </TouchableOpacity>
            <IconButton
              icon="logout"
              iconColor="#fff"
              size={28}
              onPress={handleLogout}
              style={{ backgroundColor: colors.error, borderRadius: 10 }}
            />
          </View>
        </View>

        {/* Date Filter */}
        <TouchableOpacity
          style={[styles.dateFilter, { backgroundColor: colors.surface }, shadows.card]}
          onPress={() => setShowDatePicker(true)}
        >
          <MaterialCommunityIcons name="calendar" size={24} color={colors.primary} />
          <View style={styles.dateFilterText}>
            <Text style={[styles.dateFilterLabel, { color: colors.primary }]}>
              {getPresetLabel(datePreset)}
            </Text>
            <Text style={[styles.dateFilterValue, { color: colors.textSecondary }]}>
              {getDateRangeDisplay()}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {unseededCount > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('InitialInventory')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFF3CD',
              borderLeftWidth: 4,
              borderLeftColor: '#F57C00',
              padding: 12,
              marginHorizontal: lo.screenPadding,
              marginBottom: sp.sm,
              borderRadius: 6,
              gap: 10,
            }}
          >
            <MaterialCommunityIcons name="alert" size={22} color="#F57C00" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', color: '#5d4037', fontSize: 13 }}>
                Set Beginning Inventory ({unseededCount} {unseededCount === 1 ? 'product' : 'products'} need cost)
              </Text>
              <Text style={{ fontSize: 11, color: '#6d4c41', marginTop: 2 }}>
                AVCO cost tracking requires beginning inventory cost. Tap to set it now.
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#F57C00" />
          </TouchableOpacity>
        )}

        {canSplit ? (
          /* Landscape: Hero + Primary Actions side-by-side */
          <View style={[styles.landscapeDashRow, { paddingHorizontal: lo.screenPadding, gap: sp.md }]}>
            <View style={{ flex: 1 }}>
              <HeroSalesCard
                totalSales={stats.sales}
                transactionCount={stats.transactions}
                dateLabel={`${getPresetLabel(datePreset)}'s Sales`}
              />
            </View>
            <View style={[styles.primaryActions, { flex: 1, gap: sp.sm, paddingHorizontal: 0, marginBottom: 0 }]}>
              <View style={{ flex: 1 }}>
                <PrimaryActionButton
                  label="New Sale"
                  icon="cart-plus"
                  variant="success"
                  onPress={() => navigation.navigate('Sales')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryActionButton
                  label="Tablet POS"
                  icon="monitor"
                  variant="warning"
                  onPress={() => navigation.navigate('TabletSales')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryActionButton
                  label="Dashboard"
                  icon="view-dashboard"
                  variant="primary"
                  onPress={() => navigation.navigate('DashboardView')}
                />
              </View>
            </View>
          </View>
        ) : (
          /* Portrait: stacked layout (unchanged) */
          <>
            <View style={[styles.section, { paddingHorizontal: lo.screenPadding }]}>
              <HeroSalesCard
                totalSales={stats.sales}
                transactionCount={stats.transactions}
                dateLabel={`${getPresetLabel(datePreset)}'s Sales`}
              />
            </View>
            <View style={[styles.primaryActions, { gap: sp.lg, paddingHorizontal: lo.screenPadding }]}>
              <View style={{ flex: 1 }}>
                <PrimaryActionButton
                  label="New Sale"
                  icon="cart-plus"
                  variant="success"
                  onPress={() => navigation.navigate('Sales')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryActionButton
                  label="Tablet POS"
                  icon="monitor"
                  variant="warning"
                  onPress={() => navigation.navigate('TabletSales')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryActionButton
                  label="Dashboard"
                  icon="view-dashboard"
                  variant="primary"
                  onPress={() => navigation.navigate('DashboardView')}
                />
              </View>
            </View>
          </>
        )}

        {/* Metrics Row */}
        <View style={[styles.metricsRow, { gap: sp.sm, paddingHorizontal: lo.screenPadding }]}>
          <MetricCard
            label="Sales Returns"
            value={stats.salesReturns}
            icon="cash-minus"
            color={colors.error}
            isCurrency
            onPress={() => navigation.navigate('SalesReturnsReport')}
          />
          <MetricCard
            label="Receivables"
            value={stats.customerPayments}
            icon="cash-multiple"
            color={colors.accent}
            isCurrency
            onPress={() => navigation.navigate('CustomerPayments')}
          />
          <MetricCard
            label="Payables"
            value={stats.supplierPayments}
            icon="cash-refund"
            color="#9C27B0"
            isCurrency
            onPress={() => navigation.navigate('SupplierPayments')}
          />
        </View>

        {/* Quick Actions */}
        <View style={[styles.section, { paddingHorizontal: lo.screenPadding }]}>
          <QuickActionRow
            title="Quick Actions"
            actions={quickActions}
            maxVisible={5}
            onShowMore={() => setShowActionSearch(true)}
          />
        </View>

        {/* Admin Tools (if admin) */}
        {user?.role === 'ADMIN' && (
          <View style={[styles.section, { paddingHorizontal: lo.screenPadding }]}>
            <QuickActionRow
              title="Admin Tools"
              actions={adminQuickActions}
              maxVisible={5}
              onShowMore={() => setShowActionSearch(true)}
            />
          </View>
        )}

        {/* Spacer for bottom nav */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View style={[styles.datePickerModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.datePickerTitle, { color: colors.text }]}>Select Date Range</Text>
            <Divider style={styles.datePickerDivider} />

            {(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom'] as DatePreset[]).map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.datePickerOption,
                  datePreset === preset && { backgroundColor: colors.primary + '15' },
                ]}
                onPress={() => handlePresetSelect(preset)}
              >
                <Text style={[
                  styles.datePickerOptionText,
                  { color: colors.text },
                  datePreset === preset && { color: colors.primary, fontWeight: '600' },
                ]}>
                  {getPresetLabel(preset)}
                </Text>
                {datePreset === preset && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Date Range Modal */}
      <Modal
        visible={showCustomDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.customDateModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.customDateTitle, { color: colors.text }]}>Custom Date Range</Text>
            <Divider style={styles.datePickerDivider} />

            <View style={styles.customDateInputGroup}>
              <Text style={[styles.customDateLabel, { color: colors.textSecondary }]}>Start Date</Text>
              <TextInput
                style={[styles.customDateInput, { backgroundColor: colors.background, color: colors.text }]}
                value={tempStartDate}
                onChangeText={setTempStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.customDateInputGroup}>
              <Text style={[styles.customDateLabel, { color: colors.textSecondary }]}>End Date</Text>
              <TextInput
                style={[styles.customDateInput, { backgroundColor: colors.background, color: colors.text }]}
                value={tempEndDate}
                onChangeText={setTempEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.customDateButtons}>
              <TouchableOpacity
                style={[styles.customDateButton, { backgroundColor: colors.background }]}
                onPress={() => setShowCustomDateModal(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.customDateButton, { backgroundColor: colors.primary }]}
                onPress={handleCustomDateApply}
              >
                <Text style={{ color: '#FFFFFF' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Action Search Modal */}
      <ActionSearchModal
        visible={showActionSearch}
        onClose={() => setShowActionSearch(false)}
        actions={quickActions}
        adminActions={adminQuickActions}
        showAdminActions={user?.role === 'ADMIN'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },

  // Landscape dashboard row
  landscapeDashRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.md,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  brandText: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: 'bold',
  },
  versionText: {
    fontSize: typography.caption.fontSize,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userButton: {
    marginRight: spacing.xs,
  },

  // Date Filter
  dateFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  dateFilterText: {
    flex: 1,
  },
  dateFilterLabel: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  dateFilterValue: {
    fontSize: typography.caption.fontSize,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.md,
  },

  // Primary Actions
  primaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },

  // Metrics Row - Responsive wrapping for small screens
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },

  // Bottom spacer
  bottomSpacer: {
    height: spacing.xxl,
  },

  // Date Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModal: {
    borderRadius: borderRadius.lg,
    width: '80%',
    maxWidth: 320,
    paddingVertical: spacing.sm,
  },
  datePickerTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  datePickerDivider: {
    marginBottom: spacing.sm,
  },
  datePickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  datePickerOptionText: {
    fontSize: typography.body.fontSize,
  },

  // Custom Date Modal
  customDateModal: {
    borderRadius: borderRadius.lg,
    width: '85%',
    maxWidth: 360,
    padding: spacing.lg,
  },
  customDateTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  customDateInputGroup: {
    marginTop: spacing.md,
  },
  customDateLabel: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  customDateInput: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
  },
  customDateButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  customDateButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
});
