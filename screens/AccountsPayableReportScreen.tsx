import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  useTheme,
  DataTable,
  Chip,
  SegmentedButtons,
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
  const { sp, fs, lo } = useResponsiveTheme();
  const [suppliers, setSuppliers] = useState<SupplierAging[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('summary');
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

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('ACCOUNTS PAYABLE')
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
      .leftRight('Suppliers:', suppliers.length.toString())
      .leftRight('Unpaid POs:', suppliers.reduce((sum, s) => sum + s.purchaseOrders.length, 0).toString())
      .leftRight('Avg Balance:', formatCurrency(suppliers.length > 0 ? totals.total / suppliers.length : 0))
      .separator();

    // Supplier balances
    if (suppliers.length > 0) {
      builder
        .bold(true)
        .println('SUPPLIER BALANCES')
        .bold(false)
        .separator();

      suppliers.sort((a, b) => b.aging.total - a.aging.total).forEach((supplier) => {
        builder.leftRight(supplier.name.substring(0, 20), formatCurrency(supplier.aging.total));
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
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #E91E63; }
          .date-range { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 12px 0; }
          .total-box { text-align: center; background: #fce4ec; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
          .total-amount { font-size: 28px; font-weight: bold; color: #E91E63; }
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

        <div class="report-title">ACCOUNTS PAYABLE REPORT</div>
        <div class="date-range">Period: ${startDateStr} to ${endDateStr}</div>

        <div class="total-box">
          <div style="font-size: 12px; color: #666;">Total Payables</div>
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
            <div class="stat-label">Suppliers with Balance</div>
            <div class="stat-value" style="color: #2196F3;">${suppliers.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Unpaid POs</div>
            <div class="stat-value" style="color: #FF9800;">${suppliers.reduce((sum, s) => sum + s.purchaseOrders.length, 0)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Average Balance</div>
            <div class="stat-value" style="color: #E91E63;">${formatCurrency(suppliers.length > 0 ? totals.total / suppliers.length : 0)}</div>
          </div>
        </div>

        ${suppliers.length > 0 ? `
          <div class="section-title">Aging by Supplier</div>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Current</th>
                <th>31-60</th>
                <th>61-90</th>
                <th>90+</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${suppliers.sort((a, b) => b.aging.total - a.aging.total).map(supplier => `
                <tr>
                  <td>${supplier.name}</td>
                  <td style="color: #4CAF50;">${supplier.aging.current > 0 ? formatCurrency(supplier.aging.current) : '-'}</td>
                  <td style="color: #FF9800;">${supplier.aging.days30 > 0 ? formatCurrency(supplier.aging.days30) : '-'}</td>
                  <td style="color: #F44336;">${supplier.aging.days60 > 0 ? formatCurrency(supplier.aging.days60) : '-'}</td>
                  <td style="color: #B71C1C;">${supplier.aging.days90Plus > 0 ? formatCurrency(supplier.aging.days90Plus) : '-'}</td>
                  <td><strong>${formatCurrency(supplier.aging.total)}</strong></td>
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
        ` : '<p style="text-align: center; color: #999;">No outstanding payables</p>'}

        <div class="footer">
          <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Accounts Payable Report</p>
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
        reportTitle="Accounts Payable Report"
        reportFileName={`AP_Report_${dateRange.startDate.toISOString().split('T')[0]}_to_${dateRange.endDate.toISOString().split('T')[0]}`}
        emailBody={`Please find attached the Accounts Payable Report.\n\nPeriod: ${dateRange.startDate.toLocaleDateString('en-PH')} to ${dateRange.endDate.toLocaleDateString('en-PH')}\nTotal Payables: ${formatCurrency(totals.total)}\nSuppliers with Balance: ${suppliers.length}\n\n---\nGenerated by IgoroTech POS`}
        disabled={loading || suppliers.length === 0}
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
                { value: 'transactions', label: 'Purchase Orders' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Summary Totals */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Total Payables</Title>
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
              <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Supplier Balances</Title>

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
              <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Aging by Supplier</Title>

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
});
