import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
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
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

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
  const { sp, fs, lo } = useResponsiveTheme();
  const [customers, setCustomers] = useState<CustomerAging[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('summary');
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  useEffect(() => {
    loadData(dateRange.startDate, dateRange.endDate);
    loadCompanySettings();
  }, [dateRange]);

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
      .leftRight('From:', formatPrinterDate(dateRange.startDate))
      .leftRight('To:', formatPrinterDate(dateRange.endDate))
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

      customers.sort((a, b) => a.name.localeCompare(b.name)).forEach((customer) => {
        builder.leftRight(customer.name.substring(0, 20), formatCurrency(customer.aging.total));
      });
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
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #9C27B0; }
          .date-range { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 12px 0; }
          .total-box { text-align: center; background: #f3e5f5; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
          .total-amount { font-size: 28px; font-weight: bold; color: #9C27B0; }
          .aging-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
          .aging-item { flex: 1; min-width: 100px; background: #f5f5f5; border-radius: 8px; padding: 12px; text-align: center; border-left: 4px solid #ccc; }
          .aging-item.current { border-left-color: #4CAF50; }
          .aging-item.days30 { border-left-color: #FF9800; }
          .aging-item.days60 { border-left-color: #F44336; }
          .aging-item.days90 { border-left-color: #B71C1C; }
          .aging-label { font-size: 11px; color: #666; margin-bottom: 4px; }
          .aging-value { font-size: 14px; font-weight: bold; }
          .stats-row { display: flex; justify-content: space-around; margin: 16px 0; }
          .stat-item { text-align: center; }
          .stat-label { font-size: 11px; color: #666; }
          .stat-value { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { background-color: #f5f5f5; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .footer-row { background-color: #e8f5e9 !important; }
          .footer-row td { font-weight: bold; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name || 'IgoroTech POS'}</div>
          ${companySettings.address ? `<div class="header-text">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="header-text">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="report-title">ACCOUNTS RECEIVABLE REPORT</div>
        <div class="date-range">Period: ${startDateStr} to ${endDateStr}</div>

        <div class="total-box">
          <div style="font-size: 12px; color: #666;">Total Receivables</div>
          <div class="total-amount">${formatCurrency(totals.total)}</div>
        </div>

        <div class="section-title">Aging Summary</div>
        <div class="aging-grid">
          <div class="aging-item current">
            <div class="aging-label">Current (0-30)</div>
            <div class="aging-value" style="color: #4CAF50;">${formatCurrency(totals.current)}</div>
          </div>
          <div class="aging-item days30">
            <div class="aging-label">31-60 Days</div>
            <div class="aging-value" style="color: #FF9800;">${formatCurrency(totals.days30)}</div>
          </div>
          <div class="aging-item days60">
            <div class="aging-label">61-90 Days</div>
            <div class="aging-value" style="color: #F44336;">${formatCurrency(totals.days60)}</div>
          </div>
          <div class="aging-item days90">
            <div class="aging-label">90+ Days</div>
            <div class="aging-value" style="color: #B71C1C;">${formatCurrency(totals.days90Plus)}</div>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-label">Customers with Balance</div>
            <div class="stat-value" style="color: #2196F3;">${customers.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Open Invoices</div>
            <div class="stat-value" style="color: #FF9800;">${customers.reduce((sum, c) => sum + c.transactions.length, 0)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Average Balance</div>
            <div class="stat-value" style="color: #9C27B0;">${formatCurrency(customers.length > 0 ? totals.total / customers.length : 0)}</div>
          </div>
        </div>

        ${customers.length > 0 ? `
          <div class="section-title">Aging by Customer</div>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Current</th>
                <th>31-60</th>
                <th>61-90</th>
                <th>90+</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${customers.sort((a, b) => a.name.localeCompare(b.name)).map(customer => `
                <tr>
                  <td>${customer.name}</td>
                  <td style="color: #4CAF50;">${customer.aging.current > 0 ? formatCurrency(customer.aging.current) : '-'}</td>
                  <td style="color: #FF9800;">${customer.aging.days30 > 0 ? formatCurrency(customer.aging.days30) : '-'}</td>
                  <td style="color: #F44336;">${customer.aging.days60 > 0 ? formatCurrency(customer.aging.days60) : '-'}</td>
                  <td style="color: #B71C1C;">${customer.aging.days90Plus > 0 ? formatCurrency(customer.aging.days90Plus) : '-'}</td>
                  <td><strong>${formatCurrency(customer.aging.total)}</strong></td>
                </tr>
              `).join('')}
              <tr class="footer-row">
                <td>TOTAL</td>
                <td style="color: #4CAF50;">${formatCurrency(totals.current)}</td>
                <td style="color: #FF9800;">${formatCurrency(totals.days30)}</td>
                <td style="color: #F44336;">${formatCurrency(totals.days60)}</td>
                <td style="color: #B71C1C;">${formatCurrency(totals.days90Plus)}</td>
                <td>${formatCurrency(totals.total)}</td>
              </tr>
            </tbody>
          </table>
        ` : '<p style="text-align: center; color: #999;">No outstanding receivables</p>'}

        <div class="footer">
          <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Accounts Receivable Report</p>
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
        reportTitle="Accounts Receivable Report"
        reportFileName={`AR_Report_${dateRange.startDate.toISOString().split('T')[0]}_to_${dateRange.endDate.toISOString().split('T')[0]}`}
        emailBody={`Please find attached the Accounts Receivable Report.\n\nPeriod: ${dateRange.startDate.toLocaleDateString('en-PH')} to ${dateRange.endDate.toLocaleDateString('en-PH')}\nTotal Receivables: ${formatCurrency(totals.total)}\nCustomers with Balance: ${customers.length}\n\n---\nGenerated by IgoroTech POS`}
        disabled={loading || customers.length === 0}
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
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Total Receivables</Title>
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
              <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Customer Balances</Title>

              {customers.length === 0 ? (
                <Paragraph style={styles.emptyText}>No outstanding receivables</Paragraph>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 2 }}>Customer</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>Invoices</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1.5 }}>Balance</DataTable.Title>
                  </DataTable.Header>

                  {customers.sort((a, b) => a.name.localeCompare(b.name)).map((customer) => (
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
              <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Aging by Customer (A-Z)</Title>

              {customers.length === 0 ? (
                <Paragraph style={styles.emptyText}>No outstanding receivables</Paragraph>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View style={{ minWidth: 600 }}>
                    {/* Header Row */}
                    <View style={styles.agingHeaderRow}>
                      <Text style={[styles.agingCell, styles.agingCustomerCell, styles.agingHeaderText]}>Customer</Text>
                      <Text style={[styles.agingCell, styles.agingAmountCell, styles.agingHeaderText]}>Current</Text>
                      <Text style={[styles.agingCell, styles.agingAmountCell, styles.agingHeaderText]}>31-60</Text>
                      <Text style={[styles.agingCell, styles.agingAmountCell, styles.agingHeaderText]}>61-90</Text>
                      <Text style={[styles.agingCell, styles.agingAmountCell, styles.agingHeaderText]}>90+</Text>
                      <Text style={[styles.agingCell, styles.agingTotalCell, styles.agingHeaderText]}>Total</Text>
                    </View>

                    {/* Data Rows - Sorted by Customer Name A-Z */}
                    {customers.sort((a, b) => a.name.localeCompare(b.name)).map((customer) => (
                      <View key={customer.id} style={styles.agingDataRow}>
                        <Text style={[styles.agingCell, styles.agingCustomerCell]} numberOfLines={1}>{customer.name}</Text>
                        <Text style={[styles.agingCell, styles.agingAmountCell, { color: '#4CAF50' }]}>
                          {customer.aging.current > 0 ? formatCurrency(customer.aging.current) : '-'}
                        </Text>
                        <Text style={[styles.agingCell, styles.agingAmountCell, { color: '#FF9800' }]}>
                          {customer.aging.days30 > 0 ? formatCurrency(customer.aging.days30) : '-'}
                        </Text>
                        <Text style={[styles.agingCell, styles.agingAmountCell, { color: '#F44336' }]}>
                          {customer.aging.days60 > 0 ? formatCurrency(customer.aging.days60) : '-'}
                        </Text>
                        <Text style={[styles.agingCell, styles.agingAmountCell, { color: '#B71C1C' }]}>
                          {customer.aging.days90Plus > 0 ? formatCurrency(customer.aging.days90Plus) : '-'}
                        </Text>
                        <Text style={[styles.agingCell, styles.agingTotalCell, { fontWeight: 'bold' }]}>
                          {formatCurrency(customer.aging.total)}
                        </Text>
                      </View>
                    ))}

                    {/* Totals Row */}
                    <View style={[styles.agingDataRow, { backgroundColor: '#E8EAF6' }]}>
                      <Text style={[styles.agingCell, styles.agingCustomerCell, { fontWeight: 'bold' }]}>TOTAL</Text>
                      <Text style={[styles.agingCell, styles.agingAmountCell, { color: '#4CAF50', fontWeight: 'bold' }]}>
                        {formatCurrency(totals.current)}
                      </Text>
                      <Text style={[styles.agingCell, styles.agingAmountCell, { color: '#FF9800', fontWeight: 'bold' }]}>
                        {formatCurrency(totals.days30)}
                      </Text>
                      <Text style={[styles.agingCell, styles.agingAmountCell, { color: '#F44336', fontWeight: 'bold' }]}>
                        {formatCurrency(totals.days60)}
                      </Text>
                      <Text style={[styles.agingCell, styles.agingAmountCell, { color: '#B71C1C', fontWeight: 'bold' }]}>
                        {formatCurrency(totals.days90Plus)}
                      </Text>
                      <Text style={[styles.agingCell, styles.agingTotalCell, { fontWeight: 'bold' }]}>
                        {formatCurrency(totals.total)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
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
  // Aging Table Styles
  agingHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#E8EAF6',
    borderBottomWidth: 2,
    borderBottomColor: '#9C27B0',
    paddingVertical: 10,
  },
  agingDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
  },
  agingCell: {
    paddingHorizontal: 8,
    fontSize: 13,
  },
  agingCustomerCell: {
    width: 150,
    minWidth: 150,
  },
  agingAmountCell: {
    width: 80,
    minWidth: 80,
    textAlign: 'right',
  },
  agingTotalCell: {
    width: 90,
    minWidth: 90,
    textAlign: 'right',
  },
  agingHeaderText: {
    fontWeight: 'bold',
    color: '#512DA8',
  },
});
