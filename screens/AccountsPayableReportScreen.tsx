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
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'AccountsPayableReport'>;
};

interface Supplier {
  id: number;
  code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  credit_terms?: number;
  is_active: boolean;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  order_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_status: string;
}

interface AgingBucket {
  current: number;    // 0-30 days
  days30: number;     // 31-60 days
  days60: number;     // 61-90 days
  days90Plus: number; // 90+ days
  total: number;
}

interface SupplierAging extends Supplier {
  aging: AgingBucket;
  purchaseOrders: PurchaseOrder[];
}

export default function AccountsPayableReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [suppliers, setSuppliers] = useState<SupplierAging[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('summary');
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

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

      // Load suppliers
      const suppliersData = await dbService.getSuppliers();

      // Load all purchase orders
      const allPurchaseOrders = await dbService.getPurchaseOrders();

      // Filter to only credit purchases with outstanding balance within date range
      const creditPurchases = allPurchaseOrders.filter((po: any) => {
        const orderDate = new Date(po.order_date);
        const isInDateRange = orderDate >= startDate && orderDate <= endDate;
        const isUnpaid = po.payment_status !== 'PAID' && (po.status === 'RECEIVED' || po.status === 'COMPLETED');
        return isInDateRange && isUnpaid;
      });

      setPurchaseOrders(creditPurchases);

      // Calculate aging for each supplier
      const today = new Date();
      const suppliersWithAging: SupplierAging[] = suppliersData.map((supplier: Supplier) => {
        const supplierPOs = creditPurchases.filter(
          (po: any) => po.supplier_id === supplier.id
        );

        const aging: AgingBucket = {
          current: 0,
          days30: 0,
          days60: 0,
          days90Plus: 0,
          total: 0,
        };

        supplierPOs.forEach((po: PurchaseOrder) => {
          const outstanding = (po.total_amount || 0) - (po.paid_amount || 0);
          if (outstanding <= 0) return;

          const orderDate = new Date(po.order_date);
          const daysDiff = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

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
          ...supplier,
          aging,
          purchaseOrders: supplierPOs.filter((po: PurchaseOrder) =>
            (po.total_amount || 0) - (po.paid_amount || 0) > 0
          ),
        };
      }).filter((s: SupplierAging) => s.aging.total > 0);

      setSuppliers(suppliersWithAging);
    } catch (error) {
      console.error('Error loading AP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals: AgingBucket = suppliers.reduce(
    (acc, supplier) => ({
      current: acc.current + supplier.aging.current,
      days30: acc.days30 + supplier.aging.days30,
      days60: acc.days60 + supplier.aging.days60,
      days90Plus: acc.days90Plus + supplier.aging.days90Plus,
      total: acc.total + supplier.aging.total,
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
    const orderDate = new Date(dateStr);
    return Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getAgingColor = (days: number) => {
    if (days <= 30) return '#4CAF50';
    if (days <= 60) return '#FF9800';
    if (days <= 90) return '#F44336';
    return '#B71C1C';
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
          <Title style={styles.pageTitle}>Accounts Payable Report</Title>
          <Paragraph style={styles.pageSubtitle}>
            Supplier balances and aging analysis
          </Paragraph>
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
                { value: 'transactions', label: 'Purchase Orders' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Summary Totals */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Total Payables</Title>
            <Title style={[styles.totalAmount, { color: '#E91E63' }]}>
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

        {/* Supplier Count */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Paragraph style={styles.statLabel}>Suppliers with Balance</Paragraph>
                <Title style={[styles.statValue, { color: '#2196F3' }]}>{suppliers.length}</Title>
              </View>
              <View style={styles.statItem}>
                <Paragraph style={styles.statLabel}>Unpaid POs</Paragraph>
                <Title style={[styles.statValue, { color: '#FF9800' }]}>
                  {suppliers.reduce((sum, s) => sum + s.purchaseOrders.length, 0)}
                </Title>
              </View>
              <View style={styles.statItem}>
                <Paragraph style={styles.statLabel}>Average Balance</Paragraph>
                <Title style={[styles.statValue, { color: '#E91E63' }]}>
                  {formatCurrency(suppliers.length > 0 ? totals.total / suppliers.length : 0)}
                </Title>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Summary View */}
        {viewMode === 'summary' && (
          <Card style={styles.tableCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Supplier Balances</Title>

              {suppliers.length === 0 ? (
                <Paragraph style={styles.emptyText}>No outstanding payables</Paragraph>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 2 }}>Supplier</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>POs</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1.5 }}>Balance</DataTable.Title>
                  </DataTable.Header>

                  {suppliers.sort((a, b) => b.aging.total - a.aging.total).map((supplier) => (
                    <DataTable.Row key={supplier.id}>
                      <DataTable.Cell style={{ flex: 2 }}>{supplier.name}</DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        {supplier.purchaseOrders.length}
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1.5 }}>
                        <Paragraph style={{ color: '#F44336', fontWeight: 'bold' }}>
                          {formatCurrency(supplier.aging.total)}
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
              <Title style={styles.sectionTitle}>Aging by Supplier</Title>

              {suppliers.length === 0 ? (
                <Paragraph style={styles.emptyText}>No outstanding payables</Paragraph>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 1.5 }}>Supplier</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>Current</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>31-60</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>61-90</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>90+</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1.2 }}>Total</DataTable.Title>
                  </DataTable.Header>

                  {suppliers.sort((a, b) => b.aging.total - a.aging.total).map((supplier) => (
                    <DataTable.Row key={supplier.id}>
                      <DataTable.Cell style={{ flex: 1.5 }}>{supplier.name}</DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        <Paragraph style={{ color: '#4CAF50', fontSize: 12 }}>
                          {supplier.aging.current > 0 ? formatCurrency(supplier.aging.current) : '-'}
                        </Paragraph>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        <Paragraph style={{ color: '#FF9800', fontSize: 12 }}>
                          {supplier.aging.days30 > 0 ? formatCurrency(supplier.aging.days30) : '-'}
                        </Paragraph>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        <Paragraph style={{ color: '#F44336', fontSize: 12 }}>
                          {supplier.aging.days60 > 0 ? formatCurrency(supplier.aging.days60) : '-'}
                        </Paragraph>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>
                        <Paragraph style={{ color: '#B71C1C', fontSize: 12 }}>
                          {supplier.aging.days90Plus > 0 ? formatCurrency(supplier.aging.days90Plus) : '-'}
                        </Paragraph>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1.2 }}>
                        <Paragraph style={{ fontWeight: 'bold', fontSize: 12 }}>
                          {formatCurrency(supplier.aging.total)}
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
              <Title style={styles.sectionTitle}>Unpaid Purchase Orders</Title>

              {suppliers.length === 0 ? (
                <Paragraph style={styles.emptyText}>No outstanding purchase orders</Paragraph>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 1.2 }}>PO #</DataTable.Title>
                    <DataTable.Title style={{ flex: 1.5 }}>Supplier</DataTable.Title>
                    <DataTable.Title style={{ flex: 1 }}>Date</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>Balance</DataTable.Title>
                    <DataTable.Title style={{ flex: 0.8 }}>Age</DataTable.Title>
                  </DataTable.Header>

                  {suppliers.flatMap(supplier =>
                    supplier.purchaseOrders.map(po => ({
                      ...po,
                      supplierName: supplier.name,
                      balance: (po.total_amount || 0) - (po.paid_amount || 0),
                    }))
                  ).sort((a, b) => getDaysOld(b.order_date) - getDaysOld(a.order_date))
                    .map((po) => (
                      <DataTable.Row key={po.id}>
                        <DataTable.Cell style={{ flex: 1.2 }}>{po.po_number}</DataTable.Cell>
                        <DataTable.Cell style={{ flex: 1.5 }}>{po.supplierName}</DataTable.Cell>
                        <DataTable.Cell style={{ flex: 1 }}>{formatDate(po.order_date)}</DataTable.Cell>
                        <DataTable.Cell numeric style={{ flex: 1 }}>
                          {formatCurrency(po.balance)}
                        </DataTable.Cell>
                        <DataTable.Cell style={{ flex: 0.8 }}>
                          <Chip
                            compact
                            textStyle={{ fontSize: 9, color: '#fff' }}
                            style={{ backgroundColor: getAgingColor(getDaysOld(po.order_date)) }}
                          >
                            {getDaysOld(po.order_date)}d
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
