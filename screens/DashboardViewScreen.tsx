/**
 * DashboardViewScreen - Comprehensive Analytics Dashboard
 *
 * Displays useful business insights including:
 * - Sales trends and comparisons
 * - Top selling products
 * - Low stock alerts
 * - Payment method breakdown
 * - Recent transactions
 * - Daily/Weekly/Monthly performance
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  ProgressBar,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAppTheme } from '../contexts/ThemeContext';
import { useResponsiveTheme } from '../utils/responsive';

type DashboardViewScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'DashboardView'
>;

type Props = {
  navigation: DashboardViewScreenNavigationProp;
};

interface SalesData {
  todaySales: number;
  todayTransactions: number;
  yesterdaySales: number;
  weekSales: number;
  monthSales: number;
  avgTransactionValue: number;
}

interface TopProduct {
  id: number;
  name: string;
  quantity_sold: number;
  total_sales: number;
}

interface LowStockProduct {
  id: number;
  name: string;
  stock_quantity: number;
  reorder_level: number;
}

interface PaymentBreakdown {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

interface RecentTransaction {
  id: number;
  invoice_number: string;
  total_amount: number;
  payment_method: string;
  customer_name: string;
  transaction_date: string;
}

const formatCurrency = (amount: number): string => {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function DashboardViewScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data states
  const [salesData, setSalesData] = useState<SalesData>({
    todaySales: 0,
    todayTransactions: 0,
    yesterdaySales: 0,
    weekSales: 0,
    monthSales: 0,
    avgTransactionValue: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [hourlyData, setHourlyData] = useState<{ hour: number; sales: number }[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      // Use the centralized dashboard analytics method
      const analytics = await dbService.getDashboardAnalytics();

      setSalesData({
        todaySales: analytics.todaySales,
        todayTransactions: analytics.todayTransactions,
        yesterdaySales: analytics.yesterdaySales,
        weekSales: analytics.weekSales,
        monthSales: analytics.monthSales,
        avgTransactionValue: analytics.avgTransactionValue,
      });

      setTopProducts(analytics.topProducts);
      setLowStockProducts(analytics.lowStockProducts);
      setPaymentBreakdown(analytics.paymentBreakdown);
      setRecentTransactions(analytics.recentTransactions);
      setHourlyData(analytics.hourlyData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getPaymentMethodIcon = (method: string): string => {
    switch (method) {
      case 'CASH': return 'cash';
      case 'CARD': return 'credit-card';
      case 'GCASH': return 'cellphone';
      case 'MAYA': return 'cellphone';
      case 'CHECK': return 'checkbook';
      case 'CHARGE_INVOICE': return 'file-document';
      default: return 'cash-multiple';
    }
  };

  const getPaymentMethodColor = (method: string): string => {
    switch (method) {
      case 'CASH': return '#4CAF50';
      case 'CARD': return '#2196F3';
      case 'GCASH': return '#007DFE';
      case 'MAYA': return '#22B573';
      case 'CHECK': return '#FF9800';
      case 'CHARGE_INVOICE': return '#9C27B0';
      default: return colors.primary;
    }
  };

  const salesGrowth = salesData.yesterdaySales > 0
    ? ((salesData.todaySales - salesData.yesterdaySales) / salesData.yesterdaySales) * 100
    : 0;

  const maxHourlySales = Math.max(...hourlyData.map(h => h.sales), 1);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Sales Overview Card */}
        <Card style={[styles.card, { backgroundColor: colors.primary, marginBottom: sp.md }]}>
          <Card.Content style={{ padding: sp.md }}>
            <Text style={[styles.cardTitleWhite, { fontSize: fs.bodySmall }]}>Today's Performance</Text>
            <View style={styles.salesOverview}>
              <View style={styles.salesMainStat}>
                <Text style={styles.salesAmount}>{formatCurrency(salesData.todaySales)}</Text>
                <Text style={styles.salesLabel}>{salesData.todayTransactions} transactions</Text>
              </View>
              <View style={styles.salesGrowthContainer}>
                <View style={[styles.growthBadge, { backgroundColor: salesGrowth >= 0 ? '#4CAF50' : '#F44336' }]}>
                  <MaterialCommunityIcons
                    name={salesGrowth >= 0 ? 'trending-up' : 'trending-down'}
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.growthText}>
                    {salesGrowth >= 0 ? '+' : ''}{salesGrowth.toFixed(1)}%
                  </Text>
                </View>
                <Text style={styles.growthLabel}>vs Yesterday</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Quick Stats Row */}
        <View style={[styles.statsRow, { marginBottom: sp.md }]}>
          <Card style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Card.Content style={[styles.statContent, { padding: sp.md }]}>
              <MaterialCommunityIcons name="calendar-week" size={24} color="#2196F3" />
              <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(salesData.weekSales)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Week</Text>
            </Card.Content>
          </Card>
          <Card style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Card.Content style={[styles.statContent, { padding: sp.md }]}>
              <MaterialCommunityIcons name="calendar-month" size={24} color="#9C27B0" />
              <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(salesData.monthSales)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Month</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Hourly Sales Chart */}
        <Card style={[styles.card, { backgroundColor: colors.surface, marginBottom: sp.md }]}>
          <Card.Content style={{ padding: sp.md }}>
            <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs.cardTitle }]}>Hourly Sales Today</Text>
            <View style={styles.chartContainer}>
              {hourlyData.map((data, index) => (
                <View key={data.hour} style={styles.chartBarContainer}>
                  <View style={styles.chartBarWrapper}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: `${(data.sales / maxHourlySales) * 100}%`,
                          backgroundColor: data.sales > 0 ? colors.primary : colors.border,
                        }
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>
                    {data.hour > 12 ? `${data.hour - 12}p` : data.hour === 12 ? '12p' : `${data.hour}a`}
                  </Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Payment Methods Breakdown */}
        <Card style={[styles.card, { backgroundColor: colors.surface, marginBottom: sp.md }]}>
          <Card.Content style={{ padding: sp.md }}>
            <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs.cardTitle }]}>Payment Methods</Text>
            {paymentBreakdown.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No sales today</Text>
            ) : (
              paymentBreakdown.map((payment, index) => (
                <View key={payment.method} style={styles.paymentRow}>
                  <View style={styles.paymentInfo}>
                    <View style={[styles.paymentIcon, { backgroundColor: getPaymentMethodColor(payment.method) + '20' }]}>
                      <MaterialCommunityIcons
                        name={getPaymentMethodIcon(payment.method) as any}
                        size={20}
                        color={getPaymentMethodColor(payment.method)}
                      />
                    </View>
                    <View style={styles.paymentDetails}>
                      <Text style={[styles.paymentMethod, { color: colors.text }]}>
                        {payment.method.replace('_', ' ')}
                      </Text>
                      <Text style={[styles.paymentCount, { color: colors.textSecondary }]}>
                        {payment.count} transaction{payment.count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.paymentAmountContainer}>
                    <Text style={[styles.paymentAmount, { color: colors.text }]}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <Text style={[styles.paymentPercentage, { color: colors.textSecondary }]}>
                      {payment.percentage.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Top Products */}
        <Card style={[styles.card, { backgroundColor: colors.surface, marginBottom: sp.md }]}>
          <Card.Content style={{ padding: sp.md }}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs.cardTitle }]}>Top Selling Products</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary, fontSize: fs.bodySmall }]}>Today</Text>
            </View>
            {topProducts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No sales today</Text>
            ) : (
              topProducts.map((product, index) => (
                <View key={product.id} style={styles.productRow}>
                  <View style={[styles.rankBadge, { backgroundColor: index < 3 ? colors.primary : colors.border }]}>
                    <Text style={[styles.rankText, { color: index < 3 ? '#fff' : colors.textSecondary }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={[styles.productQuantity, { color: colors.textSecondary }]}>
                      {product.quantity_sold} sold
                    </Text>
                  </View>
                  <Text style={[styles.productSales, { color: colors.primary }]}>
                    {formatCurrency(product.total_sales)}
                  </Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Low Stock Alerts */}
        {lowStockProducts.length > 0 && (
          <Card style={[styles.card, { backgroundColor: '#FFF3E0', marginBottom: sp.md }]}>
            <Card.Content style={{ padding: sp.md }}>
              <View style={styles.cardHeader}>
                <View style={styles.alertHeader}>
                  <MaterialCommunityIcons name="alert" size={20} color="#E65100" />
                  <Text style={[styles.cardTitle, { color: '#E65100', marginLeft: 8, fontSize: fs.cardTitle }]}>Low Stock Alert</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('ZeroInventoryReport')}>
                  <Text style={{ color: '#E65100', fontWeight: '600' }}>View All</Text>
                </TouchableOpacity>
              </View>
              {lowStockProducts.slice(0, 5).map((product) => {
                const stockRatio = product.reorder_level > 0
                  ? product.stock_quantity / product.reorder_level
                  : 0;
                return (
                  <View key={product.id} style={styles.lowStockRow}>
                    <View style={styles.lowStockInfo}>
                      <Text style={[styles.lowStockName, { color: '#424242' }]} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <View style={styles.stockProgress}>
                        <ProgressBar
                          progress={stockRatio}
                          color={stockRatio <= 0.25 ? '#F44336' : stockRatio <= 0.5 ? '#FF9800' : '#4CAF50'}
                          style={styles.progressBar}
                        />
                      </View>
                    </View>
                    <View style={styles.stockNumbers}>
                      <Text style={[styles.stockCurrent, { color: product.stock_quantity === 0 ? '#F44336' : '#E65100' }]}>
                        {product.stock_quantity}
                      </Text>
                      <Text style={{ color: '#9E9E9E' }}> / {product.reorder_level}</Text>
                    </View>
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Recent Transactions */}
        <Card style={[styles.card, { backgroundColor: colors.surface, marginBottom: sp.md }]}>
          <Card.Content style={{ padding: sp.md }}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs.cardTitle }]}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EJournalReport')}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>View All</Text>
              </TouchableOpacity>
            </View>
            {recentTransactions.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions yet</Text>
            ) : (
              recentTransactions.slice(0, 5).map((transaction) => (
                <View key={transaction.id} style={styles.transactionRow}>
                  <View style={styles.transactionInfo}>
                    <Text style={[styles.transactionInvoice, { color: colors.text }]}>
                      {transaction.invoice_number}
                    </Text>
                    <Text style={[styles.transactionCustomer, { color: colors.textSecondary }]}>
                      {transaction.customer_name}
                    </Text>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={[styles.transactionAmount, { color: colors.primary }]}>
                      {formatCurrency(transaction.total_amount)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getPaymentMethodColor(transaction.payment_method) + '20' }]}>
                      <Text style={[styles.statusBadgeText, { color: getPaymentMethodColor(transaction.payment_method) }]}>
                        {transaction.payment_method.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    padding: 16,
    flexGrow: 1,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardTitleWhite: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  salesOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salesMainStat: {
    flex: 1,
  },
  salesAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  salesLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  salesGrowthContainer: {
    alignItems: 'flex-end',
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  growthText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  growthLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    elevation: 2,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarWrapper: {
    flex: 1,
    width: '60%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 9,
    marginTop: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentDetails: {
    marginLeft: 12,
  },
  paymentMethod: {
    fontSize: 14,
    fontWeight: '500',
  },
  paymentCount: {
    fontSize: 12,
  },
  paymentAmountContainer: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentPercentage: {
    fontSize: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
  },
  productQuantity: {
    fontSize: 12,
  },
  productSales: {
    fontSize: 14,
    fontWeight: '600',
  },
  lowStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lowStockInfo: {
    flex: 1,
    marginRight: 12,
  },
  lowStockName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  stockProgress: {
    width: '100%',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  stockNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  stockCurrent: {
    fontSize: 16,
    fontWeight: '700',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  transactionInfo: {
    flex: 1,
    paddingTop: 2,
  },
  transactionInvoice: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionCustomer: {
    fontSize: 12,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 24,
  },
});
