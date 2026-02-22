import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
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
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

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
  const { sp, fs, lo } = useResponsiveTheme();
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [selectedSettlementMethod, setSelectedSettlementMethod] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

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

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('PURCHASE RETURNS')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .doubleSeparator()
      .align('left');

    // Date range
    builder
      .leftRight('From:', formatPrinterDate(dateRange.startDate))
      .leftRight('To:', formatPrinterDate(dateRange.endDate))
      .separator();

    // Summary
    builder
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .leftRight('Total Returns:', totals.count.toString())
      .leftRight('Total Value:', formatCurrency(totals.totalAmount))
      .leftRight('Cash Refunds:', formatCurrency(totals.cashSettlements))
      .leftRight('Credit (AP):', formatCurrency(totals.creditSettlements))
      .leftRight('Replacements:', formatCurrency(totals.replacementSettlements))
      .doubleSeparator();

    // By method
    builder
      .bold(true)
      .println('BY SETTLEMENT METHOD')
      .bold(false)
      .separator();

    const cashCount = filteredReturns.filter(r => r.settlement_method === 'CASH').length;
    const creditCount = filteredReturns.filter(r => r.settlement_method === 'CREDIT').length;
    const replacementCount = filteredReturns.filter(r => r.settlement_method === 'REPLACEMENT').length;

    builder
      .leftRight(`Cash (${cashCount})`, formatCurrency(totals.cashSettlements))
      .leftRight(`Credit AP (${creditCount})`, formatCurrency(totals.creditSettlements))
      .leftRight(`Replacement (${replacementCount})`, formatCurrency(totals.replacementSettlements))
      .separator();

    // Returns list
    if (filteredReturns.length > 0) {
      builder
        .bold(true)
        .println('RETURNS DETAILS')
        .bold(false)
        .separator();

      filteredReturns.slice(0, 20).forEach(ret => {
        builder
          .println(ret.return_number)
          .leftRight('  Supplier:', (ret.supplier_name || '').substring(0, 15))
          .leftRight('  Date:', formatDate(ret.return_date))
          .leftRight('  Amount:', formatCurrency(ret.total_amount));
      });

      if (filteredReturns.length > 20) {
        builder.println(`... and ${filteredReturns.length - 20} more`);
      }
    }

    builder
      .feed()
      .separator()
      .align('center')
      .println('Report Generated:')
      .println(formatPrinterDateTime(new Date()))
      .feed(2)
      .cut();

    return builder;
  };

  const buildPdfHtml = (): string => {
    const startDateStr = dateRange.startDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    const endDateStr = dateRange.endDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });

    // Group by supplier
    const supplierTotals = suppliers.map(supplier => {
      const supplierReturns = filteredReturns.filter(r => r.supplier_id === supplier.id);
      return {
        name: supplier.name,
        count: supplierReturns.length,
        total: supplierReturns.reduce((sum, r) => sum + (r.total_amount || 0), 0),
      };
    }).filter(s => s.count > 0);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
          .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 16px; }
          .company-name { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
          .header-text { font-size: 11px; color: #666; }
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #795548; }
          .date-range { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 12px 0; }
          .summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
          .summary-item { flex: 1; min-width: 120px; background: #f5f5f5; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-label { font-size: 11px; color: #666; margin-bottom: 4px; }
          .summary-value { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { background-color: #f5f5f5; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name || 'IgoroTech POS'}</div>
          ${companySettings.address ? `<div class="header-text">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="header-text">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="report-title">PURCHASE RETURNS REPORT</div>
        <div class="date-range">Period: ${startDateStr} to ${endDateStr}</div>

        <div class="section-title">Summary</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total Returns</div>
            <div class="summary-value" style="color: #795548;">${totals.count}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Value</div>
            <div class="summary-value" style="color: #795548;">${formatCurrency(totals.totalAmount)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Cash Refunds</div>
            <div class="summary-value" style="color: #4CAF50;">${formatCurrency(totals.cashSettlements)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">AP Reduction</div>
            <div class="summary-value" style="color: #2196F3;">${formatCurrency(totals.creditSettlements)}</div>
          </div>
        </div>

        <div class="section-title">By Settlement Method</div>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Count</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cash Refund</td>
              <td>${filteredReturns.filter(r => r.settlement_method === 'CASH').length}</td>
              <td style="color: #4CAF50;">${formatCurrency(totals.cashSettlements)}</td>
            </tr>
            <tr>
              <td>Credit (AP Reduction)</td>
              <td>${filteredReturns.filter(r => r.settlement_method === 'CREDIT').length}</td>
              <td style="color: #2196F3;">${formatCurrency(totals.creditSettlements)}</td>
            </tr>
            <tr>
              <td>Replacement</td>
              <td>${filteredReturns.filter(r => r.settlement_method === 'REPLACEMENT').length}</td>
              <td style="color: #FF9800;">${formatCurrency(totals.replacementSettlements)}</td>
            </tr>
          </tbody>
        </table>

        ${supplierTotals.length > 0 ? `
          <div class="section-title">By Supplier</div>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Returns</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${supplierTotals.map(s => `
                <tr>
                  <td>${s.name}</td>
                  <td>${s.count}</td>
                  <td>${formatCurrency(s.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${filteredReturns.length > 0 ? `
          <div class="section-title">Returns Details (${filteredReturns.length})</div>
          <table>
            <thead>
              <tr>
                <th>Return #</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReturns.map(ret => `
                <tr>
                  <td>${ret.return_number}</td>
                  <td>${ret.supplier_name || '-'}</td>
                  <td>${formatDate(ret.return_date)}</td>
                  <td>${formatCurrency(ret.total_amount)}</td>
                  <td>${ret.settlement_method}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="text-align: center; color: #999;">No purchase returns found</p>'}

        <div class="footer">
          <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Purchase Returns Report</p>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Purchase Returns Report"
        reportFileName={`PurchaseReturns_${dateRange.startDate.toISOString().split('T')[0]}_to_${dateRange.endDate.toISOString().split('T')[0]}`}
        emailBody={`Please find attached the Purchase Returns Report.\n\nPeriod: ${dateRange.startDate.toLocaleDateString('en-PH')} to ${dateRange.endDate.toLocaleDateString('en-PH')}\nTotal Returns: ${totals.count}\nTotal Value: ${formatCurrency(totals.totalAmount)}\n\n---\nGenerated by IgoroTech POS`}
        disabled={loading}
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

        {/* Other Filters */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Paragraph style={[styles.filterLabel, { fontSize: fs.bodySmall }]}>Settlement Method:</Paragraph>
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
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Summary</Title>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.bodySmall }]}>Total Returns</Paragraph>
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
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>By Settlement Method</Title>
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
          <Paragraph style={[styles.footerText, { fontSize: fs.caption }]}>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
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
