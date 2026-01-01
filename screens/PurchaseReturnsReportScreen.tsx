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
  navigation: StackNavigationProp<RootStackParamList, 'PurchaseReturnsReport'>;
};

interface PurchaseReturn {
  id: number;
  return_number: string;
  original_po_id?: number;
  original_po_number?: string;
  supplier_id: number;
  supplier_name?: string;
  return_date: string;
  total_amount: number;
  settlement_method: string;
  reason?: string;
  status: string;
  processed_by?: number;
  notes?: string;
}

export default function PurchaseReturnsReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [selectedSettlementMethod, setSelectedSettlementMethod] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);

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

      // Load suppliers
      const suppliersData = await dbService.getSuppliers();
      setSuppliers(suppliersData);

      // Load purchase returns
      const returnsData = await dbService.getPurchaseReturns();

      // Enrich with supplier names
      const enrichedReturns = (returnsData || []).map((ret: any) => {
        const supplier = suppliersData.find((s: any) => s.id === ret.supplier_id);
        return {
          ...ret,
          supplier_name: supplier?.name || 'Unknown Supplier',
        };
      });

      setReturns(enrichedReturns);
    } catch (error) {
      console.error('Error loading purchase returns:', error);
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

    if (selectedSettlementMethod) {
      filtered = filtered.filter(r => r.settlement_method === selectedSettlementMethod);
    }

    if (selectedSupplier) {
      filtered = filtered.filter(r => r.supplier_id === selectedSupplier);
    }

    return filtered.sort((a, b) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime());
  };

  const filteredReturns = getFilteredReturns();

  const totals = {
    count: filteredReturns.length,
    totalAmount: filteredReturns.reduce((sum, r) => sum + (r.total_amount || 0), 0),
    cashSettlements: filteredReturns.filter(r => r.settlement_method === 'CASH').reduce((sum, r) => sum + (r.total_amount || 0), 0),
    creditSettlements: filteredReturns.filter(r => r.settlement_method === 'CREDIT').reduce((sum, r) => sum + (r.total_amount || 0), 0),
    replacementSettlements: filteredReturns.filter(r => r.settlement_method === 'REPLACEMENT').reduce((sum, r) => sum + (r.total_amount || 0), 0),
  };

  const getSettlementMethodColor = (method: string) => {
    switch (method) {
      case 'CASH': return '#4CAF50';
      case 'CREDIT': return '#2196F3';
      case 'REPLACEMENT': return '#FF9800';
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
          <Title style={styles.pageTitle}>Purchase Returns Report</Title>
          <Paragraph style={styles.pageSubtitle}>
            Returns to suppliers
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

        {/* Other Filters */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Paragraph style={styles.filterLabel}>Settlement Method:</Paragraph>
            <View style={styles.chipContainer}>
              <Chip
                selected={selectedSettlementMethod === null}
                onPress={() => setSelectedSettlementMethod(null)}
                style={styles.chip}
              >
                All
              </Chip>
              <Chip
                selected={selectedSettlementMethod === 'CASH'}
                onPress={() => setSelectedSettlementMethod('CASH')}
                style={styles.chip}
              >
                Cash
              </Chip>
              <Chip
                selected={selectedSettlementMethod === 'CREDIT'}
                onPress={() => setSelectedSettlementMethod('CREDIT')}
                style={styles.chip}
              >
                Credit (AP)
              </Chip>
              <Chip
                selected={selectedSettlementMethod === 'REPLACEMENT'}
                onPress={() => setSelectedSettlementMethod('REPLACEMENT')}
                style={styles.chip}
              >
                Replacement
              </Chip>
            </View>

            <Paragraph style={[styles.filterLabel, { marginTop: 12 }]}>Supplier:</Paragraph>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipContainer}>
                <Chip
                  selected={selectedSupplier === null}
                  onPress={() => setSelectedSupplier(null)}
                  style={styles.chip}
                >
                  All Suppliers
                </Chip>
                {suppliers.map(supplier => (
                  <Chip
                    key={supplier.id}
                    selected={selectedSupplier === supplier.id}
                    onPress={() => setSelectedSupplier(supplier.id)}
                    style={styles.chip}
                  >
                    {supplier.name}
                  </Chip>
                ))}
              </View>
            </ScrollView>
          </Card.Content>
        </Card>

        {/* Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Summary</Title>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Total Returns</Paragraph>
                <Title style={[styles.summaryValue, { color: '#795548' }]}>{totals.count}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Total Value</Paragraph>
                <Title style={[styles.summaryValue, { color: '#795548' }]}>{formatCurrency(totals.totalAmount)}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Cash Refunds</Paragraph>
                <Title style={[styles.summaryValue, { color: '#4CAF50' }]}>{formatCurrency(totals.cashSettlements)}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>AP Reduction</Paragraph>
                <Title style={[styles.summaryValue, { color: '#2196F3' }]}>{formatCurrency(totals.creditSettlements)}</Title>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* By Settlement Method */}
        <Card style={styles.tableCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>By Settlement Method</Title>
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
                  {filteredReturns.filter(r => r.settlement_method === 'CASH').length}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.5 }}>
                  {formatCurrency(totals.cashSettlements)}
                </DataTable.Cell>
              </DataTable.Row>

              <DataTable.Row>
                <DataTable.Cell style={{ flex: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.colorDot, { backgroundColor: '#2196F3' }]} />
                    <Paragraph>Credit (AP Reduction)</Paragraph>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  {filteredReturns.filter(r => r.settlement_method === 'CREDIT').length}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.5 }}>
                  {formatCurrency(totals.creditSettlements)}
                </DataTable.Cell>
              </DataTable.Row>

              <DataTable.Row>
                <DataTable.Cell style={{ flex: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.colorDot, { backgroundColor: '#FF9800' }]} />
                    <Paragraph>Replacement</Paragraph>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  {filteredReturns.filter(r => r.settlement_method === 'REPLACEMENT').length}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.5 }}>
                  {formatCurrency(totals.replacementSettlements)}
                </DataTable.Cell>
              </DataTable.Row>
            </DataTable>
          </Card.Content>
        </Card>

        {/* By Supplier */}
        <Card style={styles.tableCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>By Supplier</Title>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={{ flex: 2 }}>Supplier</DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}>Returns</DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}>Total</DataTable.Title>
              </DataTable.Header>

              {suppliers.map(supplier => {
                const supplierReturns = filteredReturns.filter(r => r.supplier_id === supplier.id);
                if (supplierReturns.length === 0) return null;

                const total = supplierReturns.reduce((sum, r) => sum + (r.total_amount || 0), 0);

                return (
                  <DataTable.Row key={supplier.id}>
                    <DataTable.Cell style={{ flex: 2 }}>{supplier.name}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>{supplierReturns.length}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.5 }}>{formatCurrency(total)}</DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
          </Card.Content>
        </Card>

        {/* Returns List */}
        <Card style={styles.tableCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Returns Details ({filteredReturns.length})</Title>

            {filteredReturns.length === 0 ? (
              <Paragraph style={styles.emptyText}>No purchase returns found</Paragraph>
            ) : (
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={{ flex: 1.3 }}>Return #</DataTable.Title>
                  <DataTable.Title style={{ flex: 1.5 }}>Supplier</DataTable.Title>
                  <DataTable.Title style={{ flex: 1.2 }}>Date</DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1.2 }}>Amount</DataTable.Title>
                  <DataTable.Title style={{ flex: 1 }}>Method</DataTable.Title>
                </DataTable.Header>

                {filteredReturns.map((returnItem) => (
                  <DataTable.Row key={returnItem.id}>
                    <DataTable.Cell style={{ flex: 1.3 }}>{returnItem.return_number}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.5 }}>{returnItem.supplier_name}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.2 }}>{formatDate(returnItem.return_date)}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.2 }}>{formatCurrency(returnItem.total_amount)}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1 }}>
                      <Chip
                        compact
                        textStyle={{ fontSize: 9, color: '#fff' }}
                        style={{ backgroundColor: getSettlementMethodColor(returnItem.settlement_method) }}
                      >
                        {returnItem.settlement_method}
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
