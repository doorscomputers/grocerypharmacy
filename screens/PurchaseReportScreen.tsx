import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, Text } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  DataTable,
  Divider,
  Chip,
  Menu,
  TextInput,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import PrintOptionsDialog from '../components/PrintOptionsDialog';
import { ESCPOSBuilder } from '../utils/escpos';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'PurchaseReport'>;
};

interface PurchaseOrder {
  id: number;
  purchase_number: string;
  supplier_id: number;
  supplier_name?: string;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_status: string;
  notes?: string;
  created_at: string;
}

export default function PurchaseReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierMenuVisible, setSupplierMenuVisible] = useState(false);
  const [printDialogVisible, setPrintDialogVisible] = useState(false);

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

      // Load purchases
      const purchasesData = await dbService.getPurchaseOrders();

      // Enrich with supplier names
      const enrichedPurchases = purchasesData.map((po: any) => {
        const supplier = suppliersData.find((s: any) => s.id === po.supplier_id);
        return {
          ...po,
          supplier_name: supplier?.name || 'Unknown Supplier',
        };
      });

      setPurchases(enrichedPurchases);
    } catch (error) {
      console.error('Error loading purchase data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredPurchases = () => {
    let filtered = [...purchases];

    // Date filter using dateRange
    filtered = filtered.filter(p => {
      const pDate = new Date(p.purchase_date || p.created_at);
      return pDate >= dateRange.startDate && pDate <= dateRange.endDate;
    });

    // Supplier filter
    if (selectedSupplier) {
      filtered = filtered.filter(p => p.supplier_id === selectedSupplier);
    }

    return filtered.sort((a, b) => new Date(b.purchase_date || b.created_at).getTime() - new Date(a.purchase_date || a.created_at).getTime());
  };

  const filteredPurchases = getFilteredPurchases();

  const totals = {
    count: filteredPurchases.length,
    totalAmount: filteredPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0),
    paidAmount: filteredPurchases.reduce((sum, p) => sum + (p.paid_amount || 0), 0),
    unpaidAmount: filteredPurchases.reduce((sum, p) => sum + ((p.total_amount || 0) - (p.paid_amount || 0)), 0),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED': return '#4CAF50';
      case 'PENDING': return '#FF9800';
      case 'CANCELLED': return '#F44336';
      default: return '#757575';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return '#4CAF50';
      case 'PARTIAL': return '#FF9800';
      case 'UNPAID': return '#F44336';
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
    return `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('PURCHASE REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .println(now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }))
      .println(now.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' }))
      .feed()
      .println(`Period: ${dateRange.startDate.toLocaleDateString('en-PH')}`)
      .println(`to ${dateRange.endDate.toLocaleDateString('en-PH')}`)
      .doubleSeparator();

    builder
      .align('left')
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .separator()
      .leftRight('Total POs:', totals.count.toString())
      .leftRight('Total Amount:', `P${totals.totalAmount.toFixed(2)}`)
      .leftRight('Total Paid:', `P${totals.paidAmount.toFixed(2)}`)
      .leftRight('Outstanding:', `P${totals.unpaidAmount.toFixed(2)}`)
      .doubleSeparator();

    builder
      .bold(true)
      .println('BY SUPPLIER')
      .bold(false)
      .separator();

    suppliers.forEach(supplier => {
      const supplierPOs = filteredPurchases.filter(p => p.supplier_id === supplier.id);
      if (supplierPOs.length > 0) {
        const total = supplierPOs.reduce((sum, p) => sum + (p.total_amount || 0), 0);
        const name = supplier.name.length > printerWidth - 15
          ? supplier.name.substring(0, printerWidth - 17) + '..'
          : supplier.name;
        builder.leftRight(name, `P${total.toFixed(2)}`);
      }
    });

    builder
      .feed()
      .align('center')
      .separator()
      .println('*** END OF REPORT ***')
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
              <Title style={styles.pageTitle}>Purchase Report</Title>
              <Paragraph style={styles.pageSubtitle}>
                All purchase orders from suppliers
              </Paragraph>
            </View>
            <Button
              mode="contained"
              icon="printer"
              onPress={() => setPrintDialogVisible(true)}
              compact
            >
              Print
            </Button>
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

        {/* Supplier Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Paragraph style={styles.filterLabel}>Supplier:</Paragraph>
            <Menu
              visible={supplierMenuVisible}
              onDismiss={() => setSupplierMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setSupplierMenuVisible(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {selectedSupplier
                      ? suppliers.find(s => s.id === selectedSupplier)?.name || 'Unknown'
                      : 'All Suppliers'}
                  </Text>
                  <Text style={styles.dropdownChevron}>▼</Text>
                </TouchableOpacity>
              }
              contentStyle={styles.menuContent}
            >
              <Menu.Item
                onPress={() => {
                  setSelectedSupplier(null);
                  setSupplierMenuVisible(false);
                }}
                title="All Suppliers"
                leadingIcon={selectedSupplier === null ? 'check' : undefined}
              />
              <Divider />
              {[...suppliers]
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(supplier => (
                  <Menu.Item
                    key={supplier.id}
                    onPress={() => {
                      setSelectedSupplier(supplier.id);
                      setSupplierMenuVisible(false);
                    }}
                    title={supplier.name}
                    leadingIcon={selectedSupplier === supplier.id ? 'check' : undefined}
                  />
                ))}
            </Menu>
          </Card.Content>
        </Card>

        {/* Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Summary</Title>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Total POs</Paragraph>
                <Title style={[styles.summaryValue, { color: '#2196F3' }]}>{totals.count}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Total Amount</Paragraph>
                <Title style={[styles.summaryValue, { color: '#4CAF50' }]}>{formatCurrency(totals.totalAmount)}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Total Paid</Paragraph>
                <Title style={[styles.summaryValue, { color: '#009688' }]}>{formatCurrency(totals.paidAmount)}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Outstanding</Paragraph>
                <Title style={[styles.summaryValue, { color: '#F44336' }]}>{formatCurrency(totals.unpaidAmount)}</Title>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Purchase List */}
        <Card style={styles.tableCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Purchase Orders ({filteredPurchases.length})</Title>

            {filteredPurchases.length === 0 ? (
              <Paragraph style={styles.emptyText}>No purchase orders found</Paragraph>
            ) : (
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={{ flex: 1.5 }}>PO #</DataTable.Title>
                  <DataTable.Title style={{ flex: 2 }}>Supplier</DataTable.Title>
                  <DataTable.Title style={{ flex: 1.2 }}>Date</DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1.2 }}>Amount</DataTable.Title>
                  <DataTable.Title style={{ flex: 1 }}>Status</DataTable.Title>
                </DataTable.Header>

                {filteredPurchases.map((purchase) => (
                  <DataTable.Row key={purchase.id}>
                    <DataTable.Cell style={{ flex: 1.5 }}>{purchase.purchase_number}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 2 }}>{purchase.supplier_name}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.2 }}>{formatDate(purchase.purchase_date || purchase.created_at)}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.2 }}>{formatCurrency(purchase.total_amount)}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1 }}>
                      <Chip
                        compact
                        textStyle={{ fontSize: 10, color: '#fff' }}
                        style={{ backgroundColor: getPaymentStatusColor(purchase.payment_status) }}
                      >
                        {purchase.payment_status || 'UNPAID'}
                      </Chip>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            )}
          </Card.Content>
        </Card>

        {/* By Supplier Breakdown */}
        <Card style={styles.tableCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>By Supplier</Title>

            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={{ flex: 2 }}>Supplier</DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}>POs</DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}>Total</DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}>Unpaid</DataTable.Title>
              </DataTable.Header>

              {suppliers.map(supplier => {
                const supplierPOs = filteredPurchases.filter(p => p.supplier_id === supplier.id);
                if (supplierPOs.length === 0) return null;

                const total = supplierPOs.reduce((sum, p) => sum + (p.total_amount || 0), 0);
                const unpaid = supplierPOs.reduce((sum, p) => sum + ((p.total_amount || 0) - (p.paid_amount || 0)), 0);

                return (
                  <DataTable.Row key={supplier.id}>
                    <DataTable.Cell style={{ flex: 2 }}>{supplier.name}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>{supplierPOs.length}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.5 }}>{formatCurrency(total)}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.5, color: unpaid > 0 ? '#F44336' : '#4CAF50' }}>
                      {formatCurrency(unpaid)}
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            Report generated on {new Date().toLocaleString('en-PH')}
          </Paragraph>
        </View>
      </ScrollView>

      <PrintOptionsDialog
        visible={printDialogVisible}
        onDismiss={() => setPrintDialogVisible(false)}
        title="Print Purchase Report"
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
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    marginRight: 4,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  menuContent: {
    backgroundColor: '#fff',
    maxHeight: 300,
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
