import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  FAB,
  useTheme,
  Badge,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Transaction } from '../database/schema';
import { useAuth } from '../contexts/AuthContext';
import { PermissionService } from '../utils/permissions';

type DashboardScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Dashboard'
>;

type Props = {
  navigation: DashboardScreenNavigationProp;
};

// Using responsive percentage-based design instead of fixed dimensions

export default function DashboardScreen({ navigation }: Props) {
  const [todayStats, setTodayStats] = useState({
    sales: 0,
    transactions: 0,
    customers: 0,
  });
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const { user, logout } = useAuth();


  // Refresh data every time the screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      const dbService = getDatabase();
      let transactions: Transaction[];

      // Cashiers can only see their own transactions
      if (user?.role === 'CASHIER') {
        const rawTransactions = await dbService.getTransactionsByCashier(user.id);
        transactions = rawTransactions as Transaction[];
      } else {
        // Admin and Manager can see all transactions
        const rawTransactions = await dbService.getTodaysTransactions();
        transactions = rawTransactions as Transaction[];
      }

      const totalSales = transactions
        .filter(t => t.status === 'COMPLETED')
        .reduce((sum, t) => sum + (t.total_amount as number), 0);

      setTodayStats({
        sales: totalSales,
        transactions: transactions.filter(t => t.status === 'COMPLETED').length,
        customers: new Set(transactions.map(t => t.customer_name).filter(Boolean)).size,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSale = () => {
    navigation.navigate('Sales');
  };

  const DashboardCard = ({ title, value, subtitle, onPress, color = theme.colors.primary }) => (
    <Card style={styles.responsiveCard} onPress={onPress}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Title style={[styles.cardValue, { color }]}>{value}</Title>
        </View>
        <Paragraph style={styles.cardTitle}>{title}</Paragraph>
        {subtitle && (
          <Paragraph style={styles.cardSubtitle}>{subtitle}</Paragraph>
        )}
      </Card.Content>
    </Card>
  );

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

  const APP_VERSION = 'v1.3.4'; // Added standard business reports: Purchase, Sales Returns, Purchase Returns, AR Aging, AP Aging

  // Web needs explicit height constraints for scrolling
  const webContainerStyle = Platform.OS === 'web'
    ? { height: 'calc(100vh - 64px)', maxHeight: 'calc(100vh - 64px)', overflow: 'hidden' as const }
    : {};

  const webScrollStyle = Platform.OS === 'web'
    ? { flex: 1, overflow: 'auto' as const }
    : {};

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }, webContainerStyle]}>
      <ScrollView
        style={[styles.scrollView, webScrollStyle]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.responsiveHeader}>
          <View>
            <Title style={styles.headerTitle}>
              {user?.role === 'CASHIER' ? 'My Overview' : "Today's Overview"}
            </Title>
            <Paragraph style={{ fontSize: 10, color: '#999' }}>{APP_VERSION}</Paragraph>
            <Paragraph style={styles.headerDate}>
              Welcome, {user?.full_name} ({PermissionService.getRoleDisplayName(user?.role as any)})
            </Paragraph>
            <Paragraph style={styles.headerDate}>
              {new Date().toLocaleDateString('en-PH', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Paragraph>
          </View>
          <Button
            mode="outlined"
            onPress={handleLogout}
            compact
            style={styles.responsiveLogoutButton}
            contentStyle={styles.responsiveLogoutContent}
          >
            Logout
          </Button>
        </View>

        <View style={styles.responsiveStatsGrid}>
          <DashboardCard
            title="Total Sales"
            value={`₱${todayStats.sales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Today"
            color="#4CAF50"
            onPress={() => navigation.navigate('Reports')}
          />

          <DashboardCard
            title="Transactions"
            value={todayStats.transactions.toString()}
            subtitle="Completed"
            color="#2196F3"
            onPress={() => navigation.navigate('Reports')}
          />

          <DashboardCard
            title="Customers"
            value={todayStats.customers.toString()}
            subtitle="Unique"
            color="#FF9800"
            onPress={() => navigation.navigate('Reports')}
          />
        </View>

        <View style={styles.responsiveQuickActions}>
          <Title style={styles.sectionTitle}>Quick Actions</Title>

          <View style={styles.responsiveActionGrid}>
            {/* ========== ALL USERS ========== */}

            {/* New Sale - All users */}
            <Card style={styles.responsiveActionCard} onPress={handleQuickSale}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#4CAF50' }]}>
                  New Sale
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Start a new transaction
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Sales Returns - All users */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('SalesReturns')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#F44336' }]}>
                  Returns
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Process customer returns
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Purchase - All users */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('PurchaseOrder')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#2196F3' }]}>
                  Purchase
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Receive inventory
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Purchase Returns - All users */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('PurchaseReturns')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#795548' }]}>
                  PO Returns
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Return to suppliers
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Accounts Receivable (Customer Payments) - All users */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('CustomerPayments')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#FF9800' }]}>
                  Receivables
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Collect customer payments
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Accounts Payable (Supplier Payments) - All users */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('SupplierPayments')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#9C27B0' }]}>
                  Payables
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Pay supplier invoices
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Master Data - All users can view, CRUD based on role inside */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('MasterData')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#6200EE' }]}>
                  Master Data
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Products, Categories, Suppliers...
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Reports Hub - All users */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('ReportsHub')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#E91E63' }]}>
                  Reports
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  All business reports
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Inventory Section */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('DamagedItems')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#F44336' }]}>
                  Damaged Items
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Record damaged inventory
                </Paragraph>
              </Card.Content>
            </Card>

            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('PhysicalInventory')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#FF9800' }]}>
                  Physical Count
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Count physical inventory
                </Paragraph>
              </Card.Content>
            </Card>

            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('InventoryMovements')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#673AB7' }]}>
                  Item Ledger
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  View transaction history
                </Paragraph>
              </Card.Content>
            </Card>

            {/* End of Day - Z-Reading with cash accountability */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('EndOfDay')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#00695C' }]}>
                  End of Day
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Z-Reading & Cash Count
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Settings - All users */}
            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('Settings')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: '#455A64' }]}>
                  Settings
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  System configuration
                </Paragraph>
              </Card.Content>
            </Card>
          </View>
        </View>

        {/* Admin Only Section */}
        {user?.role === 'ADMIN' && (
          <View style={styles.responsiveQuickActions}>
            <Title style={[styles.sectionTitle, { color: '#F44336' }]}>Admin Tools</Title>

            <View style={styles.responsiveActionGrid}>
              {/* User Management */}
              <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('UserManagement')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: '#3F51B5' }]}>
                    Users
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    Manage user accounts
                  </Paragraph>
                </Card.Content>
              </Card>

              {/* Permission Management */}
              <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('PermissionManagement')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: '#009688' }]}>
                    Permissions
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    Configure role access
                  </Paragraph>
                </Card.Content>
              </Card>

              {/* Reset Transactional Data */}
              <Card style={[styles.responsiveActionCard, styles.dangerCard]} onPress={() => navigation.navigate('ResetData')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: '#F44336' }]}>
                    Reset Data
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    Clear all transactions
                  </Paragraph>
                </Card.Content>
              </Card>

              {/* Database Viewer */}
              <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('DatabaseViewer')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: '#607D8B' }]}>
                    Database
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    View raw data
                  </Paragraph>
                </Card.Content>
              </Card>
            </View>
          </View>
        )}
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="cash-register"
        label="Quick Sale"
        onPress={handleQuickSale}
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
  responsiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: '6%',
    paddingVertical: '4%',
    paddingBottom: '3%',
  },
  responsiveLogoutButton: {
    marginTop: '2%',
    minHeight: 36,
  },
  responsiveLogoutContent: {
    minHeight: 36,
    paddingVertical: '2%',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerDate: {
    fontSize: 14,
    opacity: 0.7,
  },
  responsiveStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: '6%',
    marginBottom: '6%',
    gap: '2%',
  },
  responsiveCard: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    marginBottom: '4%',
    elevation: 4,
  },
  cardContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cardHeader: {
    alignItems: 'center',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  cardTitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  cardSubtitle: {
    fontSize: 10,
    opacity: 0.7,
    textAlign: 'center',
  },
  responsiveQuickActions: {
    paddingHorizontal: '6%',
    marginBottom: '25%', // Space for FAB - responsive
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  responsiveActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '3%',
  },
  responsiveActionCard: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    marginBottom: '4%',
    elevation: 2,
  },
  responsiveActionContent: {
    alignItems: 'center',
    paddingVertical: '5%',
    paddingHorizontal: '3%',
    position: 'relative',
    minHeight: 80,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF5722',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: '#F44336',
    backgroundColor: '#FFEBEE',
  },
});