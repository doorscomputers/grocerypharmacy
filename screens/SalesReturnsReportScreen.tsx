import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  useTheme,
  DataTable,
  Chip,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'SalesReturnsReport'>;
};

interface SalesReturn {
  id: number;
  return_number: string;
  original_transaction_id?: number;
  original_invoice_number?: string;
  customer_id?: number;
  customer_name?: string;
  return_date: string;
  total_amount: number;
  refund_method: string;
  reason?: string;
  status: string;
  processed_by?: number;
  notes?: string;
}

export default function SalesReturnsReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [selectedRefundMethod, setSelectedRefundMethod] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const returnsData = await dbService.getSalesReturns();
      setReturns(returnsData || []);
    } catch (error) {
      console.error('Error loading sales returns:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredReturns = () => {
    let filtered = [...returns];

    // Date filter using dateRange
    filtered = filtered.filter(r => {
      const rDate = new Date(r.return_date);
      return rDate >= dateRange.startDate && rDate <= dateRange.endDate;
    });

    if (selectedRefundMethod) {
      filtered = filtered.filter(r => r.refund_method === selectedRefundMethod);
    }

    return filtered.sort((a, b) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime());
  };

  const filteredReturns = getFilteredReturns();

  const totals = {
    count: filteredReturns.length,
    totalAmount: filteredReturns.reduce((sum, r) => sum + (r.total_amount || 0), 0),
    cashRefunds: filteredReturns.filter(r => r.refund_method === 'CASH').reduce((sum, r) => sum + (r.total_amount || 0), 0),
    creditRefunds: filteredReturns.filter(r => r.refund_method === 'CREDIT').reduce((sum, r) => sum + (r.total_amount || 0), 0),
    storeCreditRefunds: filteredReturns.filter(r => r.refund_method === 'STORE_CREDIT').reduce((sum, r) => sum + (r.total_amount || 0), 0),
  };

  const getRefundMethodColor = (method: string) => {
    switch (method) {
      case 'CASH': return '#4CAF50';
      case 'CREDIT': return '#2196F3';
      case 'STORE_CREDIT': return '#FF9800';
      default: return '#757575';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `₱${(amount || 0).toFixed(2)}`;
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
          <Title style={styles.pageTitle}>Sales Returns Report</Title>
          <Paragraph style={styles.pageSubtitle}>
            Customer returns and refunds
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

        {/* Method Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Paragraph style={styles.filterLabel}>Refund Method:</Paragraph>
            <View style={styles.chipContainer}>
              <Chip
                selected={selectedRefundMethod === null}
                onPress={() => setSelectedRefundMethod(null)}
                style={styles.chip}
              >
                All
              </Chip>
              <Chip
                selected={selectedRefundMethod === 'CASH'}
                onPress={() => setSelectedRefundMethod('CASH')}
                style={styles.chip}
              >
                Cash
              </Chip>
              <Chip
                selected={selectedRefundMethod === 'CREDIT'}
                onPress={() => setSelectedRefundMethod('CREDIT')}
                style={styles.chip}
              >
                Credit (AR)
              </Chip>
              <Chip
                selected={selectedRefundMethod === 'STORE_CREDIT'}
                onPress={() => setSelectedRefundMethod('STORE_CREDIT')}
                style={styles.chip}
              >
                Store Credit
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Summary</Title>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Total Returns</Paragraph>
                <Title style={[styles.summaryValue, { color: '#F44336' }]}>{totals.count}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Total Amount</Paragraph>
                <Title style={[styles.summaryValue, { color: '#F44336' }]}>{formatCurrency(totals.totalAmount)}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Cash Refunds</Paragraph>
                <Title style={[styles.summaryValue, { color: '#4CAF50' }]}>{formatCurrency(totals.cashRefunds)}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Credit Adjustments</Paragraph>
                <Title style={[styles.summaryValue, { color: '#2196F3' }]}>{formatCurrency(totals.creditRefunds)}</Title>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* By Refund Method */}
        <Card style={styles.tableCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>By Refund Method</Title>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={{ flex: 2 }}>Method</DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}>Count</DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}>Amount</DataTable.Title>
              </DataTable.Header>

              <DataTable.Row>
                <DataTable.Cell style={{ flex: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.colorDot, { backgroundColor: '#4CAF50' }]} />
                    <Paragraph>Cash Refund</Paragraph>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  {filteredReturns.filter(r => r.refund_method === 'CASH').length}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.5 }}>
                  {formatCurrency(totals.cashRefunds)}
                </DataTable.Cell>
              </DataTable.Row>

              <DataTable.Row>
                <DataTable.Cell style={{ flex: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.colorDot, { backgroundColor: '#2196F3' }]} />
                    <Paragraph>Credit (AR Reduction)</Paragraph>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  {filteredReturns.filter(r => r.refund_method === 'CREDIT').length}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.5 }}>
                  {formatCurrency(totals.creditRefunds)}
                </DataTable.Cell>
              </DataTable.Row>

              <DataTable.Row>
                <DataTable.Cell style={{ flex: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.colorDot, { backgroundColor: '#FF9800' }]} />
                    <Paragraph>Store Credit</Paragraph>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  {filteredReturns.filter(r => r.refund_method === 'STORE_CREDIT').length}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.5 }}>
                  {formatCurrency(totals.storeCreditRefunds)}
                </DataTable.Cell>
              </DataTable.Row>
            </DataTable>
          </Card.Content>
        </Card>

        {/* Returns List */}
        <Card style={styles.tableCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Returns Details ({filteredReturns.length})</Title>

            {filteredReturns.length === 0 ? (
              <Paragraph style={styles.emptyText}>No sales returns found</Paragraph>
            ) : (
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={{ flex: 1.5 }}>Return #</DataTable.Title>
                  <DataTable.Title style={{ flex: 1.5 }}>Orig. Invoice</DataTable.Title>
                  <DataTable.Title style={{ flex: 1.2 }}>Date</DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1.2 }}>Amount</DataTable.Title>
                  <DataTable.Title style={{ flex: 1 }}>Method</DataTable.Title>
                </DataTable.Header>

                {filteredReturns.map((returnItem) => (
                  <DataTable.Row key={returnItem.id}>
                    <DataTable.Cell style={{ flex: 1.5 }}>{returnItem.return_number}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.5 }}>{returnItem.original_invoice_number || '-'}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.2 }}>{formatDate(returnItem.return_date)}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.2 }}>{formatCurrency(returnItem.total_amount)}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1 }}>
                      <Chip
                        compact
                        textStyle={{ fontSize: 9, color: '#fff' }}
                        style={{ backgroundColor: getRefundMethodColor(returnItem.refund_method) }}
                      >
                        {returnItem.refund_method}
                      </Chip>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            )}
          </Card.Content>
        </Card>

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
  tableCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  dateInputs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dateInput: {
    flex: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginRight: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
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
