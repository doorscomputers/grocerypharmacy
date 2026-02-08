import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  useTheme,
  Chip,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'CustomerReportDetail'>;
  route: RouteProp<RootStackParamList, 'CustomerReportDetail'>;
};

export default function CustomerReportDetailScreen({ navigation, route }: Props) {
  const { customerId, customerName, reportType } = route.params as any;

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerBalance, setCustomerBalance] = useState(0);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  const theme = useTheme();

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      // Get outstanding balance
      const receivables = await dbService.getAccountsReceivable(customerId);
      const outstandingBalance = receivables
        .filter((r: any) => r.status !== 'PAID')
        .reduce((sum: number, r: any) => sum + (r.balance_amount || 0), 0);
      setCustomerBalance(outstandingBalance);

      // Load report-specific data
      let reportData: any[] = [];

      if (reportType === 'INVOICES') {
        const transactions = await dbService.getTransactions();
        reportData = transactions.filter((t: any) => {
          if (t.customer_id !== customerId) return false;
          const txDate = new Date(t.created_at);
          return txDate >= dateRange.startDate && txDate <= dateRange.endDate;
        });
      } else if (reportType === 'RETURNS') {
        const returns = await dbService.getSalesReturns(500);
        reportData = returns.filter((r: any) => {
          if (r.customer_id !== customerId) return false;
          const rDate = new Date(r.return_date);
          return rDate >= dateRange.startDate && rDate <= dateRange.endDate;
        });
      } else if (reportType === 'PAYMENTS') {
        const payments = await dbService.getCustomerPayments(customerId);
        reportData = payments.filter((p: any) => {
          const pDate = new Date(p.payment_date);
          return pDate >= dateRange.startDate && pDate <= dateRange.endDate;
        });
      }

      setData(reportData);
    } catch (error) {
      console.error('Error loading customer report detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'INVOICES': return 'Sales / Invoices';
      case 'RETURNS': return 'Sales Returns';
      case 'PAYMENTS': return 'Payments';
      default: return 'Report';
    }
  };

  const getTotalAmount = () => {
    if (reportType === 'INVOICES') {
      return data.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    } else if (reportType === 'RETURNS') {
      return data.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    } else if (reportType === 'PAYMENTS') {
      return data.reduce((sum, item) => sum + (item.amount_paid || 0), 0);
    }
    return 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#4CAF50';
      case 'VOID': return '#F44336';
      case 'OUTSTANDING': return '#FF9800';
      case 'PARTIALLY_PAID': return '#FF9800';
      case 'PAID': return '#4CAF50';
      case 'OVERDUE': return '#D32F2F';
      case 'APPROVED': return '#4CAF50';
      case 'PENDING': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'CASH': return '#4CAF50';
      case 'CARD': return '#2196F3';
      case 'CHECK': return '#FF9800';
      case 'BANK_TRANSFER': return '#9C27B0';
      case 'ONLINE': return '#607D8B';
      case 'CHARGE_INVOICE': return '#E91E63';
      default: return '#9E9E9E';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const renderInvoiceItem = ({ item }: { item: any }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Paragraph style={styles.itemTitle}>{item.invoice_number}</Paragraph>
            <Paragraph style={styles.itemDate}>{formatDate(item.created_at)}</Paragraph>
            {item.payment_method && (
              <Chip
                style={[styles.methodChip, { backgroundColor: getPaymentMethodColor(item.payment_method) }]}
                textStyle={{ color: 'white', fontSize: 9 }}
                compact
              >
                {item.payment_method}
              </Chip>
            )}
          </View>
          <View style={styles.itemAmountContainer}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={{ color: 'white', fontSize: 9 }}
              compact
            >
              {item.status}
            </Chip>
            <Paragraph style={styles.itemAmount}>
              {'\u20B1'}{(item.total_amount || 0).toFixed(2)}
            </Paragraph>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderReturnItem = ({ item }: { item: any }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Paragraph style={styles.itemTitle}>{item.return_number}</Paragraph>
            <Paragraph style={styles.itemDate}>{formatDate(item.return_date)}</Paragraph>
            <Paragraph style={styles.itemSubtext}>Reason: {item.reason}</Paragraph>
            {item.refund_method && (
              <Chip
                style={[styles.methodChip, { backgroundColor: '#FF9800' }]}
                textStyle={{ color: 'white', fontSize: 9 }}
                compact
              >
                {item.refund_method}
              </Chip>
            )}
          </View>
          <View style={styles.itemAmountContainer}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={{ color: 'white', fontSize: 9 }}
              compact
            >
              {item.status}
            </Chip>
            <Paragraph style={[styles.itemAmount, { color: '#F44336' }]}>
              -{'\u20B1'}{(item.total_amount || 0).toFixed(2)}
            </Paragraph>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderPaymentItem = ({ item }: { item: any }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Paragraph style={styles.itemTitle}>{item.payment_number}</Paragraph>
            <Paragraph style={styles.itemDate}>{formatDate(item.payment_date)}</Paragraph>
            <Paragraph style={styles.itemSubtext}>Invoice: {item.invoice_number}</Paragraph>
            {item.reference_number && (
              <Paragraph style={styles.itemSubtext}>Ref: {item.reference_number}</Paragraph>
            )}
          </View>
          <View style={styles.itemAmountContainer}>
            <Chip
              style={[styles.methodChip, { backgroundColor: getPaymentMethodColor(item.payment_method) }]}
              textStyle={{ color: 'white', fontSize: 9 }}
              compact
            >
              {item.payment_method}
            </Chip>
            <Paragraph style={[styles.itemAmount, { color: '#4CAF50' }]}>
              {'\u20B1'}{(item.amount_paid || 0).toFixed(2)}
            </Paragraph>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderItem = ({ item }: { item: any }) => {
    if (reportType === 'INVOICES') return renderInvoiceItem({ item });
    if (reportType === 'RETURNS') return renderReturnItem({ item });
    if (reportType === 'PAYMENTS') return renderPaymentItem({ item });
    return null;
  };

  const totalAmount = getTotalAmount();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Customer Header */}
      <Card style={styles.customerHeader}>
        <Card.Content>
          <View style={styles.customerRow}>
            <View>
              <Title style={styles.customerName}>{customerName}</Title>
              <Paragraph style={styles.reportTypeLabel}>{getReportTitle()}</Paragraph>
            </View>
            <View style={styles.balanceBox}>
              <Paragraph style={styles.balanceLabel}>Outstanding Balance</Paragraph>
              <Paragraph
                style={[
                  styles.balanceAmount,
                  { color: customerBalance > 0 ? '#F44336' : customerBalance < 0 ? '#2196F3' : '#4CAF50' },
                ]}
              >
                {'\u20B1'}{customerBalance.toFixed(2)}
              </Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Date Filter */}
      <Card style={styles.dateFilterCard}>
        <Card.Content>
          <DateRangeFilter
            onDateChange={handleDateChange}
            selectedPreset="this_month"
          />
        </Card.Content>
      </Card>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
          <Card.Content style={styles.summaryContent}>
            <Paragraph style={styles.summaryLabel}>Records</Paragraph>
            <Title style={styles.summaryValue}>{data.length}</Title>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
          <Card.Content style={styles.summaryContent}>
            <Paragraph style={styles.summaryLabel}>Total Amount</Paragraph>
            <Title style={styles.summaryValue}>{'\u20B1'}{totalAmount.toFixed(2)}</Title>
          </Card.Content>
        </Card>
      </View>

      <Divider />

      {/* Data List */}
      <FlatList
        data={data}
        keyExtractor={(item, index) => (item.id || index).toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              No {getReportTitle().toLowerCase()} found for the selected date range.
            </Paragraph>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customerHeader: {
    margin: 16,
    marginBottom: 8,
    elevation: 3,
    backgroundColor: '#F5F5F5',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  reportTypeLabel: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '600',
  },
  balanceBox: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 11,
    opacity: 0.6,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dateFilterCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    elevation: 1,
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -4,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  itemCard: {
    marginBottom: 10,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 2,
  },
  itemDate: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  itemSubtext: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  itemAmountContainer: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statusChip: {
    marginBottom: 2,
  },
  methodChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
});
