import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  useTheme,
  DataTable,
  Chip,
  SegmentedButtons,
  Divider,
  Button,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import PrintOptionsDialog from '../components/PrintOptionsDialog';
import { ESCPOSBuilder } from '../utils/escpos';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'AccountsReceivableReport'>;
};

interface Customer {
  id: number;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  credit_limit?: number;
  is_active: boolean;
}

interface Transaction {
  id: number;
  invoice_number: string;
  customer_id?: number;
  customer_name?: string;
  transaction_date: string;
  total_amount: number;
  paid_amount: number;
  payment_method: string;
  status: string;
}

interface AgingBucket {
  current: number;    // 0-30 days
  days30: number;     // 31-60 days
  days60: number;     // 61-90 days
  days90Plus: number; // 90+ days
  total: number;
}

interface CustomerAging extends Customer {
  aging: AgingBucket;
  transactions: Transaction[];
}

export default function AccountsReceivableReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [customers, setCustomers] = useState<CustomerAging[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('summary');
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [printDialogVisible, setPrintDialogVisible] = useState(false);

  useEffect(() => {
    loadData(dateRange.startDate, dateRange.endDate);
  }, [dateRange]);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const loadData = async (startDate: Date, endDate: Date) => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      // Load customers
      const customersData = await dbService.getCustomers();

      // Load all credit transactions
      const allTransactions = await dbService.getTransactions();

      // Filter to only credit sales with outstanding balance within date range
      const creditTransactions = allTransactions.filter((t: any) => {
        const transDate = new Date(t.transaction_date);
        const isInDateRange = transDate >= startDate && transDate <= endDate;
        return t.payment_method === 'CHARGE_INVOICE' && t.status === 'COMPLETED' && isInDateRange;
      });

      setTransactions(creditTransactions);

      // Calculate aging for each customer
      const today = new Date();
      const customersWithAging: CustomerAging[] = customersData.map((customer: Customer) => {
        const customerTransactions = creditTransactions.filter(
          (t: any) => t.customer_id === customer.id
        );

        const aging: AgingBucket = {
          current: 0,
          days30: 0,
          days60: 0,
          days90Plus: 0,
          total: 0,
        };

        customerTransactions.forEach((t: Transaction) => {
          const outstanding = (t.total_amount || 0) - (t.paid_amount || 0);
          if (outstanding <= 0) return;

          const transactionDate = new Date(t.transaction_date);
          const daysDiff = Math.floor((today.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff <= 30) {
            aging.current += outstanding;
          } else if (daysDiff <= 60) {
            aging.days30 += outstanding;
          } else if (daysDiff <= 90) {
            aging.days60 += outstanding;
          } else {
            aging.days90Plus += outstanding;
          }
          aging.total += outstanding;
        });

        return {
          ...customer,
          aging,
          transactions: customerTransactions.filter((t: Transaction) =>
            (t.total_amount || 0) - (t.paid_amount || 0) > 0
          ),
        };
      }).filter((c: CustomerAging) => c.aging.total > 0);

      setCustomers(customersWithAging);
    } catch (error) {
      console.error('Error loading AR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals: AgingBucket = customers.reduce(
    (acc, customer) => ({
      current: acc.current + customer.aging.current,
      days30: acc.days30 + customer.aging.days30,
      days60: acc.days60 + customer.aging.days60,
      days90Plus: acc.days90Plus + customer.aging.days90Plus,
      total: acc.total + customer.aging.total,
    }),
    { current: 0, days30: 0, days60: 0, days90Plus: 0, total: 0 }
  );

  const formatCurrency = (amount: number) => {
    return `₱${(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysOld = (dateStr: string) => {
    const today = new Date();
    const transactionDate = new Date(dateStr);
    return Math.floor((today.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getAgingColor = (days: number) => {
    if (days <= 30) return '#4CAF50';
    if (days <= 60) return '#FF9800';
    if (days <= 90) return '#F44336';
    return '#B71C1C';
  };

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('ACCOUNTS RECEIVABLE')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .doubleSeparator()
      .align('left');

    // Date range
    builder
      .leftRight('From:', dateRange.startDate.toLocaleDateString('en-PH'))
      .leftRight('To:', dateRange.endDate.toLocaleDateString('en-PH'))
      .separator();

    // Summary totals
    builder
      .bold(true)
      .println('AGING SUMMARY')
      .bold(false)
      .leftRight('Current (0-30):', formatCurrency(totals.current))
      .leftRight('31-60 Days:', formatCurrency(totals.days30))
      .leftRight('61-90 Days:', formatCurrency(totals.days60))
      .leftRight('90+ Days:', formatCurrency(totals.days90Plus))
      .doubleSeparator()
      .bold(true)
      .leftRight('TOTAL:', formatCurrency(totals.total))
      .bold(false)
      .separator();

    // Statistics
    builder
      .leftRight('Customers:', customers.length.toString())
      .leftRight('Open Invoices:', customers.reduce((sum, c) => sum + c.transactions.length, 0).toString())
      .leftRight('Avg Balance:', formatCurrency(customers.length > 0 ? totals.total / customers.length : 0))
      .separator();

    // Customer balances
    if (customers.length > 0) {
      builder
        .bold(true)
        .println('CUSTOMER BALANCES')
        .bold(false)
        .separator();

      customers.sort((a, b) => b.aging.total - a.aging.total).forEach((customer) => {
        builder.leftRight(customer.name.substring(0, 20), formatCurrency(customer.aging.total));
      });
    }

    builder
      .feed()
      .separator()
      .align('center')
      .println('Report Generated:')
      .println(new Date().toLocaleString('en-PH'))
      .feed(2)
      .cut();

    return builder;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitles}>
              <Title style={styles.pageTitle}>Accounts Receivable Report</Title>
              <Paragraph style={styles.pageSubtitle}>
                Customer balances and aging analysis
              </Paragraph>
            </View>
            <Button mode="contained" icon="printer" onPress={() => setPrintDialogVisible(true)} compact>Print</Button>
          </View>
        </View>

        {/* Date Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <DateRangeFilter
              onDateChange={handleDateChange}
              selectedPreset="this_month"
            />
          </Card.Content>
        </Card>

        {/* View Mode */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <SegmentedButtons
              value={viewMode}
              onValueChange={setViewMode}
              buttons={[
                { value: 'summary', label: 'Summary' },
                { value: 'aging', label: 'Aging Detail' },
                { value: 'transactions', label: 'Transactions' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Summary Totals */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Total Receivables</Title>
            <Title style={[styles.totalAmount, { color: '#9C27B0' }]}>
              {formatCurrency(totals.total)}
            </Title>

            <View style={styles.agingSummary}>
              <View style={styles.agingItem}>
                <View style={[styles.agingDot, { backgroundColor: '#4CAF50' }]} />
                <View>
                  <Paragraph style={styles.agingLabel}>Current (0-30)</Paragraph>
                  <Title style={styles.agingValue}>{formatCurrency(totals.current)}</Title>
                </View>
              </View>

              <View style={styles.agingItem}>
                <View style={[styles.agingDot, { backgroundColor: '#FF9800' }]} />
                <View>
                  <Paragraph style={styles.agingLabel}>31-60 Days</Paragraph>
                  <Title style={styles.agingValue}>{formatCurrency(totals.days30)}</Title>
                </View>
              </View>

              <View style={styles.agingItem}>
                <View style={[styles.agingDot, { backgroundColor: '#F44336' }]} />
                <View>
                  <Paragraph style={styles.agingLabel}>61-90 Days</Paragraph>
                  <Title style={styles.agingValue}>{formatCurrency(totals.days60)}</Title>
                </View>
              </View>

              <View style={styles.agingItem}>
                <View style={[styles.agingDot, { backgroundColor: '#B71C1C' }]} />
                <View>
                  <Paragraph style={styles.agingLabel}>90+ Days</Paragraph>
                  <Title style={styles.agingValue}>{formatCurrency(totals.days90Plus)}</Title>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Customer Count */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Paragraph style={styles.statLabel}>Customers with Balance</Paragraph>
                <Title style={[styles.statValue, { color: '#2196F3' }]}>{customers.length}</Title>
              </View>
              <View style={styles.statItem}>
                <Paragraph style={styles.statLabel}>Open Invoices</Paragraph>
                <Title style={[styles.statValue, { color: '#FF9800' }]}>
                  {customers.reduce((sum, c) => sum + c.transactions.length, 0)}
                </Title>
              </View>
              <View style={styles.statItem}>
                <Paragraph style={styles.statLabel}>Average Balance</Paragraph>
                <Title style={[styles.statValue, { color: '#9C27B0' }]}>
                  {formatCurrency(customers.length > 0 ? totals.total / customers.length : 0)}
                </Title>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Summary View */}
        {viewMode === 'summary' && (
          <Card style={styles.tableCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Customer Balances</Title>

              {customers.length === 0 ? (
                <Paragraph style={styles.emptyText}>No outstanding receivables</Paragraph>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 2 }}>Customer</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>Invoices</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1.5 }}>Balance</DataTable.Title>
                  </DataTable.Header>

                  {customers.sort((a, b) => b.aging.total - a.aging.total).map((customer) => (
                    <DataTable.Row
                      key={customer.id}
                      onPress={() => setSelectedCustomer(
                        selectedCustomer === customer.id ? null : customer.id
                      )}
                    >
                      <DataTable.Cell style={{ flex: 2 }}>{customer.name}</DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        {customer.transactions.length}
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1.5 }}>
                        <Paragraph style={{ color: '#F44336', fontWeight: 'bold' }}>
                          {formatCurrency(customer.aging.total)}
                        </Paragraph>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Aging Detail View */}
        {viewMode === 'aging' && (
          <Card style={styles.tableCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Aging by Customer</Title>

              {customers.length === 0 ? (
                <Paragraph style={styles.emptyText}>No outstanding receivables</Paragraph>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 1.5 }}>Customer</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>Current</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>31-60</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>61-90</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>90+</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1.2 }}>Total</DataTable.Title>
                  </DataTable.Header>

                  {customers.sort((a, b) => b.aging.total - a.aging.total).map((customer) => (
                    <DataTable.Row key={customer.id}>
                      <DataTable.Cell style={{ flex: 1.5 }}>{customer.name}</DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        <Paragraph style={{ color: '#4CAF50', fontSize: 12 }}>
                          {customer.aging.current > 0 ? formatCurrency(customer.aging.current) : '-'}
                        </Paragraph>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        <Paragraph style={{ color: '#FF9800', fontSize: 12 }}>
                          {customer.aging.days30 > 0 ? formatCurrency(customer.aging.days30) : '-'}
                        </Paragraph>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        <Paragraph style={{ color: '#F44336', fontSize: 12 }}>
                          {customer.aging.days60 > 0 ? formatCurrency(customer.aging.days60) : '-'}
                        </Paragraph>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        <Paragraph style={{ color: '#B71C1C', fontSize: 12 }}>
                          {customer.aging.days90Plus > 0 ? formatCurrency(customer.aging.days90Plus) : '-'}
                        </Paragraph>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1.2 }}>
                        <Paragraph style={{ fontWeight: 'bold', fontSize: 12 }}>
                          {formatCurrency(customer.aging.total)}
                        </Paragraph>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}

                  <DataTable.Row style={{ backgroundColor: '#f0f0f0' }}>
                    <DataTable.Cell style={{ flex: 1.5 }}>
                      <Paragraph style={{ fontWeight: 'bold' }}>TOTAL</Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>
                      <Paragraph style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: 12 }}>
                        {formatCurrency(totals.current)}
                      </Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>
                      <Paragraph style={{ color: '#FF9800', fontWeight: 'bold', fontSize: 12 }}>
                        {formatCurrency(totals.days30)}
                      </Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>
                      <Paragraph style={{ color: '#F44336', fontWeight: 'bold', fontSize: 12 }}>
                        {formatCurrency(totals.days60)}
                      </Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>
                      <Paragraph style={{ color: '#B71C1C', fontWeight: 'bold', fontSize: 12 }}>
                        {formatCurrency(totals.days90Plus)}
                      </Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.2 }}>
                      <Paragraph style={{ fontWeight: 'bold', fontSize: 12 }}>
                        {formatCurrency(totals.total)}
                      </Paragraph>
                    </DataTable.Cell>
                  </DataTable.Row>
                </DataTable>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Transactions View */}
        {viewMode === 'transactions' && (
          <Card style={styles.tableCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Open Invoices</Title>

              {customers.length === 0 ? (
                <Paragraph style={styles.emptyText}>No outstanding invoices</Paragraph>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 1.2 }}>Invoice</DataTable.Title>
                    <DataTable.Title style={{ flex: 1.5 }}>Customer</DataTable.Title>
                    <DataTable.Title style={{ flex: 1 }}>Date</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>Balance</DataTable.Title>
                    <DataTable.Title style={{ flex: 0.8 }}>Age</DataTable.Title>
                  </DataTable.Header>

                  {customers.flatMap(customer =>
                    customer.transactions.map(t => ({
                      ...t,
                      customerName: customer.name,
                      balance: (t.total_amount || 0) - (t.paid_amount || 0),
                    }))
                  ).sort((a, b) => getDaysOld(b.transaction_date) - getDaysOld(a.transaction_date))
                    .map((t) => (
                      <DataTable.Row key={t.id}>
                        <DataTable.Cell style={{ flex: 1.2 }}>{t.invoice_number}</DataTable.Cell>
                        <DataTable.Cell style={{ flex: 1.5 }}>{t.customerName}</DataTable.Cell>
                        <DataTable.Cell style={{ flex: 1 }}>{formatDate(t.transaction_date)}</DataTable.Cell>
                        <DataTable.Cell numeric style={{ flex: 1 }}>
                          {formatCurrency(t.balance)}
                        </DataTable.Cell>
                        <DataTable.Cell style={{ flex: 0.8 }}>
                          <Chip
                            compact
                            textStyle={{ fontSize: 9, color: '#fff' }}
                            style={{ backgroundColor: getAgingColor(getDaysOld(t.transaction_date)) }}
                          >
                            {getDaysOld(t.transaction_date)}d
                          </Chip>
                        </DataTable.Cell>
                      </DataTable.Row>
                    ))}
                </DataTable>
              )}
            </Card.Content>
          </Card>
        )}

        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            Report generated on {new Date().toLocaleString('en-PH')}
          </Paragraph>
        </View>
      </ScrollView>

      <PrintOptionsDialog
        visible={printDialogVisible}
        onDismiss={() => setPrintDialogVisible(false)}
        title="Print AR Report"
        onPrint={buildPrintReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...Platform.select({
      web: {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      },
    }),
  },
  scrollView: {
    flex: 1,
    ...Platform.select({
      web: {
        height: '100%',
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  header: {
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitles: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  pageSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  filterCard: {
    marginBottom: 16,
    elevation: 2,
  },
  summaryCard: {
    marginBottom: 16,
    elevation: 2,
  },
  statsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  tableCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  agingSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  agingItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  agingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  agingLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  agingValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    padding: 20,
  },
  footer: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
});
