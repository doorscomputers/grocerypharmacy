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
  const { sp, fs, lo } = useResponsiveTheme();
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [selectedRefundMethod, setSelectedRefundMethod] = useState<string | null>(null);
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

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('SALES RETURNS')
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
      .leftRight('Total Amount:', formatCurrency(totals.totalAmount))
      .leftRight('Cash Refunds:', formatCurrency(totals.cashRefunds))
      .leftRight('Credit (AR):', formatCurrency(totals.creditRefunds))
      .leftRight('Store Credit:', formatCurrency(totals.storeCreditRefunds))
      .doubleSeparator();

    // By method
    builder
      .bold(true)
      .println('BY REFUND METHOD')
      .bold(false)
      .separator();

    const cashCount = filteredReturns.filter(r => r.refund_method === 'CASH').length;
    const creditCount = filteredReturns.filter(r => r.refund_method === 'CREDIT').length;
    const storeCreditCount = filteredReturns.filter(r => r.refund_method === 'STORE_CREDIT').length;

    builder
      .leftRight(`Cash (${cashCount})`, formatCurrency(totals.cashRefunds))
      .leftRight(`Credit AR (${creditCount})`, formatCurrency(totals.creditRefunds))
      .leftRight(`Store Credit (${storeCreditCount})`, formatCurrency(totals.storeCreditRefunds))
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
          .leftRight('  Date:', formatDate(ret.return_date))
          .leftRight('  Amount:', formatCurrency(ret.total_amount))
          .leftRight('  Method:', ret.refund_method);
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
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #F44336; }
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

        <div class="report-title">SALES RETURNS REPORT</div>
        <div class="date-range">Period: ${startDateStr} to ${endDateStr}</div>

        <div class="section-title">Summary</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total Returns</div>
            <div class="summary-value" style="color: #F44336;">${totals.count}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Amount</div>
            <div class="summary-value" style="color: #F44336;">${formatCurrency(totals.totalAmount)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Cash Refunds</div>
            <div class="summary-value" style="color: #4CAF50;">${formatCurrency(totals.cashRefunds)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Credit (AR)</div>
            <div class="summary-value" style="color: #2196F3;">${formatCurrency(totals.creditRefunds)}</div>
          </div>
        </div>

        <div class="section-title">By Refund Method</div>
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
              <td>${filteredReturns.filter(r => r.refund_method === 'CASH').length}</td>
              <td style="color: #4CAF50;">${formatCurrency(totals.cashRefunds)}</td>
            </tr>
            <tr>
              <td>Credit (AR Reduction)</td>
              <td>${filteredReturns.filter(r => r.refund_method === 'CREDIT').length}</td>
              <td style="color: #2196F3;">${formatCurrency(totals.creditRefunds)}</td>
            </tr>
            <tr>
              <td>Store Credit</td>
              <td>${filteredReturns.filter(r => r.refund_method === 'STORE_CREDIT').length}</td>
              <td style="color: #FF9800;">${formatCurrency(totals.storeCreditRefunds)}</td>
            </tr>
          </tbody>
        </table>

        ${filteredReturns.length > 0 ? `
          <div class="section-title">Returns Details (${filteredReturns.length})</div>
          <table>
            <thead>
              <tr>
                <th>Return #</th>
                <th>Original Invoice</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReturns.map(ret => `
                <tr>
                  <td>${ret.return_number}</td>
                  <td>${ret.original_invoice_number || '-'}</td>
                  <td>${formatDate(ret.return_date)}</td>
                  <td>${formatCurrency(ret.total_amount)}</td>
                  <td>${ret.refund_method}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="text-align: center; color: #999;">No sales returns found</p>'}

        <div class="footer">
          <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Sales Returns Report</p>
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
        reportTitle="Sales Returns Report"
        reportFileName={`SalesReturns_${dateRange.startDate.toISOString().split('T')[0]}_to_${dateRange.endDate.toISOString().split('T')[0]}`}
        emailBody={`Please find attached the Sales Returns Report.\n\nPeriod: ${dateRange.startDate.toLocaleDateString('en-PH')} to ${dateRange.endDate.toLocaleDateString('en-PH')}\nTotal Returns: ${totals.count}\nTotal Amount: ${formatCurrency(totals.totalAmount)}\n\n---\nGenerated by IgoroTech POS`}
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

        {/* Method Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Paragraph style={[styles.filterLabel, { fontSize: fs.bodySmall }]}>Refund Method:</Paragraph>
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
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Summary</Title>
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
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>By Refund Method</Title>
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
