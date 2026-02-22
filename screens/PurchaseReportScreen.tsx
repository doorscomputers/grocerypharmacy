import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  useTheme,
  DataTable,
  Divider,
  Chip,
  Menu,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'PurchaseReport'>;
  route: RouteProp<RootStackParamList, 'PurchaseReport'>;
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

export default function PurchaseReportScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const viewParam = route.params?.view || 'all';
  const isBySupplier = viewParam === 'by_supplier';

  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierMenuVisible, setSupplierMenuVisible] = useState(false);
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  // Set the navigation title based on view
  useEffect(() => {
    navigation.setOptions({
      title: isBySupplier ? 'Purchases by Supplier' : 'Purchase Report',
    });
  }, [isBySupplier, navigation]);

  useEffect(() => {
    loadData();
    loadCompanySettings();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const dbService = getDatabase();
      const name = await dbService.getSetting('company_name') || 'IgoroTech POS';
      const address = await dbService.getSetting('company_address') || '';
      const tin = await dbService.getSetting('company_tin') || '';
      setCompanySettings({ name, address, tin });
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

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
      setSuppliers(suppliersData || []);

      // Load purchases
      const purchasesData = await dbService.getPurchaseOrders();

      // Enrich with supplier names
      const enrichedPurchases = (purchasesData || []).map((po: any) => {
        const supplier = (suppliersData || []).find((s: any) => s.id === po.supplier_id);
        return {
          ...po,
          supplier_name: po.supplier_name || supplier?.name || 'Unknown Supplier',
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

    // Date filter
    filtered = filtered.filter(p => {
      const pDate = new Date(p.purchase_date || p.created_at);
      return pDate >= dateRange.startDate && pDate <= dateRange.endDate;
    });

    // Supplier filter
    if (selectedSupplier) {
      filtered = filtered.filter(p => p.supplier_id === selectedSupplier);
    }

    return filtered.sort((a, b) =>
      new Date(b.purchase_date || b.created_at).getTime() - new Date(a.purchase_date || a.created_at).getTime()
    );
  };

  const filteredPurchases = getFilteredPurchases();

  const totals = {
    count: filteredPurchases.length,
    totalAmount: filteredPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0),
    paidAmount: filteredPurchases.reduce((sum, p) => sum + (p.paid_amount || 0), 0),
    unpaidAmount: filteredPurchases.reduce((sum, p) => sum + ((p.total_amount || 0) - (p.paid_amount || 0)), 0),
  };

  // Build supplier aggregation
  const supplierSummaries = suppliers
    .map(supplier => {
      const supplierPOs = filteredPurchases.filter(p => p.supplier_id === supplier.id);
      if (supplierPOs.length === 0) return null;
      const total = supplierPOs.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const paid = supplierPOs.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
      const unpaid = total - paid;
      return { ...supplier, poCount: supplierPOs.length, total, paid, unpaid };
    })
    .filter(Boolean) as any[];

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': case 'RECEIVED': return '#4CAF50';
      case 'PARTIAL': case 'PARTIALLY_RECEIVED': return '#FF9800';
      case 'UNPAID': case 'DRAFT': case 'ORDERED': return '#F44336';
      case 'CANCELLED': return '#9E9E9E';
      default: return '#757575';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateForPrint = (d: Date): string => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const formatTimeForPrint = (d: Date): string => {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const reportTitle = isBySupplier ? 'PURCHASES BY SUPPLIER' : 'PURCHASE REPORT';

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println(reportTitle)
      .normalSize()
      .bold(false)
      .feed()
      .println(formatDateForPrint(now))
      .println(formatTimeForPrint(now))
      .feed()
      .println(`Period: ${formatDateForPrint(dateRange.startDate)}`)
      .println(`to ${formatDateForPrint(dateRange.endDate)}`)
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

    // By Supplier section
    builder
      .bold(true)
      .println('BY SUPPLIER')
      .bold(false)
      .separator();

    supplierSummaries.forEach(s => {
      const name = s.name.length > printerWidth - 15
        ? s.name.substring(0, printerWidth - 17) + '..'
        : s.name;
      builder.leftRight(name, `P${s.total.toFixed(2)}`);
      builder.leftRight(`  ${s.poCount} POs`, `Unpaid: P${s.unpaid.toFixed(2)}`);
    });

    if (supplierSummaries.length === 0) {
      builder.println('No purchases found');
    }

    if (!isBySupplier) {
      // Detail section for full purchase report
      builder.doubleSeparator();
      builder
        .bold(true)
        .println('PURCHASE ORDERS')
        .bold(false)
        .separator();

      filteredPurchases.forEach(po => {
        builder.leftRight(po.purchase_number || '-', `P${(po.total_amount || 0).toFixed(2)}`);
        builder.leftRight(po.supplier_name || '-', po.status || 'DRAFT');
      });

      if (filteredPurchases.length === 0) {
        builder.println('No purchase orders found');
      }
    }

    builder
      .feed()
      .align('center')
      .separator()
      .println('*** END OF REPORT ***')
      .feed(2)
      .cut();

    return builder;
  };

  const buildPdfHtml = (): string => {
    const now = new Date();
    const dateStr = formatDateForPrint(now);
    const timeStr = formatTimeForPrint(now);

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 18px; font-weight: bold; }
          .company-info { font-size: 11px; color: #666; }
          .report-title { font-size: 16px; font-weight: bold; margin: 15px 0; }
          .date-time { font-size: 11px; color: #666; }
          .section { margin: 15px 0; }
          .section-title { font-size: 13px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 11px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .summary-grid { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
          .summary-item { flex: 1; min-width: 120px; padding: 10px; background: #f9f9f9; border-radius: 5px; text-align: center; }
          .summary-label { font-size: 10px; color: #666; }
          .summary-value { font-size: 14px; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          ${companySettings.address ? `<div class="company-info">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
          <div class="report-title">${isBySupplier ? 'PURCHASES BY SUPPLIER' : 'PURCHASE REPORT'}</div>
          <div class="date-time">Generated: ${dateStr} ${timeStr}</div>
          <div class="date-time">Period: ${formatDateForPrint(dateRange.startDate)} to ${formatDateForPrint(dateRange.endDate)}</div>
        </div>

        <div class="section">
          <div class="section-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total POs</div>
              <div class="summary-value">${totals.count}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Amount</div>
              <div class="summary-value">${formatCurrency(totals.totalAmount)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Paid</div>
              <div class="summary-value">${formatCurrency(totals.paidAmount)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Outstanding</div>
              <div class="summary-value" style="color: #F44336;">${formatCurrency(totals.unpaidAmount)}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">By Supplier</div>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th class="text-right">POs</th>
                <th class="text-right">Total</th>
                <th class="text-right">Paid</th>
                <th class="text-right">Unpaid</th>
              </tr>
            </thead>
            <tbody>
              ${supplierSummaries.length === 0 ? '<tr><td colspan="5" class="text-center">No purchases found</td></tr>' : ''}
              ${supplierSummaries.map(s => `
                <tr>
                  <td>${s.name}</td>
                  <td class="text-right">${s.poCount}</td>
                  <td class="text-right">${formatCurrency(s.total)}</td>
                  <td class="text-right">${formatCurrency(s.paid)}</td>
                  <td class="text-right" style="color: ${s.unpaid > 0 ? '#F44336' : '#4CAF50'};">${formatCurrency(s.unpaid)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;

    if (!isBySupplier) {
      html += `
        <div class="section">
          <div class="section-title">Purchase Orders (${filteredPurchases.length})</div>
          <table>
            <thead>
              <tr>
                <th>PO #</th>
                <th>Supplier</th>
                <th>Date</th>
                <th class="text-right">Amount</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPurchases.length === 0 ? '<tr><td colspan="5" class="text-center">No purchase orders found</td></tr>' : ''}
              ${filteredPurchases.map(purchase => `
                <tr>
                  <td>${purchase.purchase_number || '-'}</td>
                  <td>${purchase.supplier_name || '-'}</td>
                  <td>${formatDate(purchase.purchase_date || purchase.created_at)}</td>
                  <td class="text-right">${formatCurrency(purchase.total_amount)}</td>
                  <td class="text-center">${purchase.status || 'DRAFT'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    }

    html += `
        <div class="footer">
          Report generated on ${dateStr} ${timeStr}
        </div>
      </body>
      </html>
    `;
    return html;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle={isBySupplier ? 'Purchases by Supplier' : 'Purchase Report'}
        reportFileName={isBySupplier ? 'PurchasesBySupplier' : 'PurchaseReport'}
        disabled={filteredPurchases.length === 0 && supplierSummaries.length === 0}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
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
            <Paragraph style={[styles.filterLabel, { fontSize: fs.bodySmall }]}>Supplier:</Paragraph>
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
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Summary</Title>
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

        {/* By Supplier Breakdown - shown for both views */}
        <Card style={styles.tableCard}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>By Supplier</Title>

            {supplierSummaries.length === 0 ? (
              <Paragraph style={styles.emptyText}>No purchases found for selected period</Paragraph>
            ) : (
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={{ flex: 2 }}>Supplier</DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1 }}>POs</DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1.5 }}>Total</DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1.5 }}>Unpaid</DataTable.Title>
                </DataTable.Header>

                {supplierSummaries.map(s => (
                  <DataTable.Row key={s.id}>
                    <DataTable.Cell style={{ flex: 2 }}>{s.name}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>{s.poCount}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.5 }}>{formatCurrency(s.total)}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.5 }}>
                      <Text style={{ color: s.unpaid > 0 ? '#F44336' : '#4CAF50', fontSize: 12 }}>
                        {formatCurrency(s.unpaid)}
                      </Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            )}
          </Card.Content>
        </Card>

        {/* Purchase Orders List - only for 'all' view */}
        {!isBySupplier && (
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
                          style={{ backgroundColor: getPaymentStatusColor(purchase.status || 'DRAFT') }}
                        >
                          {purchase.status || 'DRAFT'}
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
          <Paragraph style={[styles.footerText, { fontSize: fs.caption }]}>
            Report generated on {new Date().toLocaleDateString('en-PH')}
          </Paragraph>
        </View>
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
    paddingBottom: 100,
  },
  filterCard: {
    marginBottom: 12,
    elevation: 2,
  },
  summaryCard: {
    marginBottom: 12,
    elevation: 2,
  },
  tableCard: {
    marginBottom: 12,
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
