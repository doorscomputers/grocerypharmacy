import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
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
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import { Transaction } from '../database/schema';
import { useAuth } from '../contexts/AuthContext';
import { RoleGuard } from '../components/RoleGuard';
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
    topProduct: 'N/A',
  });
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const { user, hasPermission, logout } = useAuth();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const dbService = DatabaseService.getInstance();
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
        topProduct: 'Sample Product', // Would calculate from transaction_items
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

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.responsiveHeader}>
          <View>
            <Title style={styles.headerTitle}>
              {user?.role === 'CASHIER' ? 'My Overview' : "Today's Overview"}
            </Title>
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
            value={`₱${todayStats.sales.toFixed(2)}`}
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

          <DashboardCard
            title="Top Product"
            value={todayStats.topProduct}
            subtitle="Best Seller"
            color="#9C27B0"
            onPress={() => navigation.navigate('Products')}
          />
        </View>

        <View style={styles.responsiveQuickActions}>
          <Title style={styles.sectionTitle}>Quick Actions</Title>

          <View style={styles.responsiveActionGrid}>
            {/* All users can create sales */}
            <RoleGuard permission="CREATE_SALE">
              <Card style={styles.responsiveActionCard} onPress={handleQuickSale}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                    💰 New Sale
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    Start a new transaction
                  </Paragraph>
                </Card.Content>
              </Card>
            </RoleGuard>

            {/* Products - view for cashiers, manage for admin/manager */}
            <RoleGuard permission="VIEW_PRODUCTS">
              <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('Products')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                    📦 Products
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    {hasPermission('MANAGE_PRODUCTS') ? 'Manage inventory' : 'View products'}
                  </Paragraph>
                </Card.Content>
              </Card>
            </RoleGuard>

            {/* Reports - Admin and Manager only */}
            <RoleGuard permission="VIEW_REPORTS">
              <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('Reports')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                    📊 Reports
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    View sales reports
                  </Paragraph>
                </Card.Content>
              </Card>
            </RoleGuard>

            {/* Purchase Orders - Admin and Manager only */}
            <RoleGuard permission="MANAGE_PURCHASES">
              <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('Purchase')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                    🛒 Purchase
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    Receive inventory
                  </Paragraph>
                </Card.Content>
              </Card>
            </RoleGuard>

            {/* Settings - Admin only */}
            <RoleGuard permission="VIEW_SETTINGS">
              <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('Settings')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                    ⚙️ Settings
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    System configuration
                  </Paragraph>
                </Card.Content>
              </Card>
            </RoleGuard>

            {/* User Management - Admin only */}
            <RoleGuard permission="MANAGE_USERS">
              <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('UserManagement')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                    👥 Users
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    Manage user accounts
                  </Paragraph>
                </Card.Content>
              </Card>
            </RoleGuard>

            {/* Permission Management - Admin only */}
            <RoleGuard permission="MANAGE_USERS">
              <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('PermissionManagement')}>
                <Card.Content style={styles.responsiveActionContent}>
                  <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                    🔐 Permissions
                  </Title>
                  <Paragraph style={styles.actionSubtitle}>
                    Control role access
                  </Paragraph>
                </Card.Content>
              </Card>
            </RoleGuard>

            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('InitialInventory')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                  📋 Initial Setup
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Set starting inventory
                </Paragraph>
              </Card.Content>
            </Card>

            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('PhysicalInventory')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                  🔢 Physical Count
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Count physical inventory
                </Paragraph>
              </Card.Content>
            </Card>

            <Card style={styles.responsiveActionCard} onPress={() => navigation.navigate('Settings')}>
              <Card.Content style={styles.responsiveActionContent}>
                <Title style={[styles.actionTitle, { color: theme.colors.primary }]}>
                  ⚙️ Settings
                </Title>
                <Paragraph style={styles.actionSubtitle}>
                  Configure system
                </Paragraph>
              </Card.Content>
            </Card>
          </View>
        </View>
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="cash-register"
        label="Quick Sale"
        onPress={handleQuickSale}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
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
});