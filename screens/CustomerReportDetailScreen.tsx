import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  useTheme,
  Chip,
  Divider,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime, formatPhilippineDate, toLocalDateString } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'CustomerReportDetail'>;
  route: RouteProp<RootStackParamList, 'CustomerReportDetail'>;
};

export default function CustomerReportDetailScreen({ navigation, route }: Props) {
  const { customerId, customerName, reportType } = route.params as any;

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerBalance, setCustomerBalance] = useState(0);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  useEffect(() => {
    loadData();
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

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      // Get outstanding balance
      const receivables = await dbService.getAccountsReceivable(customerId);
      const outstandingBalance = receivables
        .filter((r: any) => r.status !== 'PAID')
        .reduce((sum: number, r: any) => sum + (r.balance_amount || 0), 0);
      setCustomerBalance(outstandingBalance);

      // Load report-specific data
      let reportData: any[] = [];

      if (reportType === 'INVOICES') {
        const transactions = await dbService.getTransactions();
        reportData = transactions.filter((t: any) => {
          if (t.customer_id !== customerId) return false;
          const txDate = new Date(t.created_at);
          return txDate >= dateRange.startDate && txDate <= dateRange.endDate;
        });
      } else if (reportType === 'RETURNS') {
        const returns = await dbService.getSalesReturns(500);
        reportData = returns.filter((r: any) => {
          if (r.customer_id !== customerId) return false;
          const rDate = new Date(r.return_date);
          return rDate >= dateRange.startDate && rDate <= dateRange.endDate;
        });
      } else if (reportType === 'PAYMENTS') {
        const payments = await dbService.getCustomerPayments(customerId);
        reportData = payments.filter((p: any) => {
          const pDate = new Date(p.payment_date);
          return pDate >= dateRange.startDate && pDate <= dateRange.endDate;
        });
      }

      setData(reportData);
    } catch (error) {
      console.error('Error loading customer report detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'INVOICES': return 'Sales / Invoices';
      case 'RETURNS': return 'Sales Returns';
      case 'PAYMENTS': return 'Payments';
      default: return 'Report';
    }
  };

  const getTotalAmount = () => {
    if (reportType === 'INVOICES') {
      return data.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    } else if (reportType === 'RETURNS') {
      return data.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    } else if (reportType === 'PAYMENTS') {
      return data.reduce((sum, item) => sum + (item.amount_paid || 0), 0);
    }
    return 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#4CAF50';
      case 'VOID': return '#F44336';
      case 'OUTSTANDING': return '#FF9800';
      case 'PARTIALLY_PAID': return '#FF9800';
      case 'PAID': return '#4CAF50';
      case 'OVERDUE': return '#D32F2F';
      case 'APPROVED': return '#4CAF50';
      case 'PENDING': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'CASH': return '#4CAF50';
      case 'CARD': return '#2196F3';
      case 'CHECK': return '#FF9800';
      case 'BANK_TRANSFER': return '#9C27B0';
      case 'ONLINE': return '#607D8B';
      case 'CHARGE_INVOICE': return '#E91E63';
      default: return '#9E9E9E';
    }
  };

  const formatDate = (dateStr: string) => {
    return formatPhilippineDate(dateStr);
  };

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('CUSTOMER REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .println(formatPrinterDateTime(now))
      .doubleSeparator();

    // Customer info
    builder
      .align('left')
      .bold(true)
      .println(customerName)
      .bold(false)
      .leftRight('Report:', getReportTitle())
      .leftRight('Period:', `${formatPrinterDate(dateRange.startDate)}`)
      .leftRight('To:', `${formatPrinterDate(dateRange.endDate)}`)
      .separator();

    // Summary
    builder
      .bold(true)
      .leftRight('Records:', data.length.toString())
      .leftRight('Total:', `P${getTotalAmount().toFixed(2)}`)
      .leftRight('Balance:', `P${customerBalance.toFixed(2)}`)
      .bold(false)
      .doubleSeparator();

    // Detail list
    if (data.length > 0) {
      builder.bold(true).println('DETAILS').bold(false).separator();

      data.slice(0, 25).forEach((item: any) => {
        if (reportType === 'INVOICES') {
          builder
            .println(item.invoice_number || '-')
            .leftRight(`  ${formatPrinterDate(item.created_at)}`, `P${(item.total_amount || 0).toFixed(2)}`)
            .leftRight(`  ${item.payment_method || '-'}`, item.status || '-');
        } else if (reportType === 'RETURNS') {
          builder
            .println(item.return_number || '-')
            .leftRight(`  ${formatPrinterDate(item.return_date)}`, `-P${(item.total_amount || 0).toFixed(2)}`)
            .leftRight(`  ${item.refund_method || '-'}`, item.status || '-');
        } else if (reportType === 'PAYMENTS') {
          builder
            .println(item.payment_number || '-')
            .leftRight(`  ${formatPrinterDate(item.payment_date)}`, `P${(item.amount_paid || 0).toFixed(2)}`)
            .leftRight(`  ${item.payment_method || '-'}`, item.invoice_number || '-');
        }
        builder.separator('-');
      });

      if (data.length > 25) {
        builder.println(`... and ${data.length - 25} more`);
      }
    }

    // Footer
    builder
      .feed()
      .align('center')
      .println('*** END OF REPORT ***')
      .println(formatPrinterDateTime(now))
      .feed(2)
      .cut();

    return builder;
  };

  const buildPdfHtml = (): string => {
    const now = new Date();

    let detailRows = '';
    if (reportType === 'INVOICES') {
      detailRows = `
        <thead><tr><th>Invoice #</th><th>Date</th><th>Method</th><th>Status</th><th>Amount</th></tr></thead>
        <tbody>
          ${data.map((item: any) => `
            <tr>
              <td>${item.invoice_number || '-'}</td>
              <td>${formatPhilippineDate(item.created_at)}</td>
              <td>${item.payment_method || '-'}</td>
              <td>${item.status || '-'}</td>
              <td style="text-align: right;">&#8369;${(item.total_amount || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      `;
    } else if (reportType === 'RETURNS') {
      detailRows = `
        <thead><tr><th>Return #</th><th>Date</th><th>Method</th><th>Status</th><th>Amount</th></tr></thead>
        <tbody>
          ${data.map((item: any) => `
            <tr>
              <td>${item.return_number || '-'}</td>
              <td>${formatPhilippineDate(item.return_date)}</td>
              <td>${item.refund_method || '-'}</td>
              <td>${item.status || '-'}</td>
              <td style="text-align: right; color: #F44336;">-&#8369;${(item.total_amount || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      `;
    } else if (reportType === 'PAYMENTS') {
      detailRows = `
        <thead><tr><th>Payment #</th><th>Date</th><th>Invoice</th><th>Method</th><th>Amount</th></tr></thead>
        <tbody>
          ${data.map((item: any) => `
            <tr>
              <td>${item.payment_number || '-'}</td>
              <td>${formatPhilippineDate(item.payment_date)}</td>
              <td>${item.invoice_number || '-'}</td>
              <td>${item.payment_method || '-'}</td>
              <td style="text-align: right; color: #4CAF50;">&#8369;${(item.amount_paid || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      `;
    }

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
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #2196F3; }
          .customer-name { font-size: 16px; font-weight: bold; text-align: center; margin: 8px 0; }
          .date-range { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          .summary-grid { display: flex; gap: 12px; margin: 12px 0; }
          .summary-item { flex: 1; background: #f5f5f5; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-label { font-size: 11px; color: #666; margin-bottom: 4px; }
          .summary-value { font-size: 18px; font-weight: bold; }
          .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 12px 0; }
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

        <div class="report-title">CUSTOMER ${getReportTitle().toUpperCase()} REPORT</div>
        <div class="customer-name">${customerName}</div>
        <div class="date-range">Period: ${formatPhilippineDate(dateRange.startDate)} to ${formatPhilippineDate(dateRange.endDate)}</div>

        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Records</div>
            <div class="summary-value" style="color: #2196F3;">${data.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Amount</div>
            <div class="summary-value">&#8369;${getTotalAmount().toFixed(2)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Outstanding Balance</div>
            <div class="summary-value" style="color: ${customerBalance > 0 ? '#F44336' : '#4CAF50'};">&#8369;${customerBalance.toFixed(2)}</div>
          </div>
        </div>

        <div class="section-title">${getReportTitle()} (${data.length})</div>
        ${data.length > 0 ? `<table>${detailRows}</table>` : '<p style="text-align: center; color: #999;">No records found</p>'}

        <div class="footer">
          <p>Generated: ${now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Customer Report</p>
        </div>
      </body>
      </html>
    `;
  };

  const renderInvoiceItem = ({ item }: { item: any }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Paragraph style={styles.itemTitle}>{item.invoice_number}</Paragraph>
            <Paragraph style={styles.itemDate}>{formatDate(item.created_at)}</Paragraph>
            {item.payment_method && (
              <Chip
                style={[styles.methodChip, { backgroundColor: getPaymentMethodColor(item.payment_method) }]}
                textStyle={{ color: 'white', fontSize: 9 }}
                compact
              >
                {item.payment_method}
              </Chip>
            )}
          </View>
          <View style={styles.itemAmountContainer}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={{ color: 'white', fontSize: 9 }}
              compact
            >
              {item.status}
            </Chip>
            <Paragraph style={styles.itemAmount}>
              {'\u20B1'}{(item.total_amount || 0).toFixed(2)}
            </Paragraph>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderReturnItem = ({ item }: { item: any }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Paragraph style={styles.itemTitle}>{item.return_number}</Paragraph>
            <Paragraph style={styles.itemDate}>{formatDate(item.return_date)}</Paragraph>
            <Paragraph style={styles.itemSubtext}>Reason: {item.reason}</Paragraph>
            {item.refund_method && (
              <Chip
                style={[styles.methodChip, { backgroundColor: '#FF9800' }]}
                textStyle={{ color: 'white', fontSize: 9 }}
                compact
              >
                {item.refund_method}
              </Chip>
            )}
          </View>
          <View style={styles.itemAmountContainer}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={{ color: 'white', fontSize: 9 }}
              compact
            >
              {item.status}
            </Chip>
            <Paragraph style={[styles.itemAmount, { color: '#F44336' }]}>
              -{'\u20B1'}{(item.total_amount || 0).toFixed(2)}
            </Paragraph>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderPaymentItem = ({ item }: { item: any }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Paragraph style={styles.itemTitle}>{item.payment_number}</Paragraph>
            <Paragraph style={styles.itemDate}>{formatDate(item.payment_date)}</Paragraph>
            <Paragraph style={styles.itemSubtext}>Invoice: {item.invoice_number}</Paragraph>
            {item.reference_number && (
              <Paragraph style={styles.itemSubtext}>Ref: {item.reference_number}</Paragraph>
            )}
          </View>
          <View style={styles.itemAmountContainer}>
            <Chip
              style={[styles.methodChip, { backgroundColor: getPaymentMethodColor(item.payment_method) }]}
              textStyle={{ color: 'white', fontSize: 9 }}
              compact
            >
              {item.payment_method}
            </Chip>
            <Paragraph style={[styles.itemAmount, { color: '#4CAF50' }]}>
              {'\u20B1'}{(item.amount_paid || 0).toFixed(2)}
            </Paragraph>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderItem = ({ item }: { item: any }) => {
    if (reportType === 'INVOICES') return renderInvoiceItem({ item });
    if (reportType === 'RETURNS') return renderReturnItem({ item });
    if (reportType === 'PAYMENTS') return renderPaymentItem({ item });
    return null;
  };

  const totalAmount = getTotalAmount();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Customer Header */}
      <Card style={styles.customerHeader}>
        <Card.Content>
          <View style={styles.customerRow}>
            <View>
              <Title style={[styles.customerName, { fontSize: fs.h2 }]}>{customerName}</Title>
              <Paragraph style={styles.reportTypeLabel}>{getReportTitle()}</Paragraph>
            </View>
            <View style={styles.balanceBox}>
              <Paragraph style={styles.balanceLabel}>Outstanding Balance</Paragraph>
              <Paragraph
                style={[
                  styles.balanceAmount,
                  { color: customerBalance > 0 ? '#F44336' : customerBalance < 0 ? '#2196F3' : '#4CAF50' },
                ]}
              >
                {'\u20B1'}{customerBalance.toFixed(2)}
              </Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Report Actions: Print, PDF, Email */}
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle={`Customer ${getReportTitle()} - ${customerName}`}
        reportFileName={`Customer_${customerName}_${getReportTitle()}_${toLocalDateString(dateRange.startDate)}`}
      />

      {/* Date Filter */}
      <Card style={styles.dateFilterCard}>
        <Card.Content>
          <DateRangeFilter
            onDateChange={handleDateChange}
            selectedPreset="this_month"
          />
        </Card.Content>
      </Card>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
          <Card.Content style={styles.summaryContent}>
            <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Records</Paragraph>
            <Title style={styles.summaryValue}>{data.length}</Title>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
          <Card.Content style={styles.summaryContent}>
            <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Amount</Paragraph>
            <Title style={styles.summaryValue}>{'\u20B1'}{totalAmount.toFixed(2)}</Title>
          </Card.Content>
        </Card>
      </View>

      <Divider />

      {/* Data List */}
      <FlatList
        data={data}
        keyExtractor={(item, index) => (item.id || index).toString()}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContainer, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              No {getReportTitle().toLowerCase()} found for the selected date range.
            </Paragraph>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customerHeader: {
    margin: 16,
    marginBottom: 8,
    elevation: 3,
    backgroundColor: '#F5F5F5',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  reportTypeLabel: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '600',
  },
  balanceBox: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 11,
    opacity: 0.6,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dateFilterCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    elevation: 1,
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -4,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  itemCard: {
    marginBottom: 10,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 2,
  },
  itemDate: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  itemSubtext: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  itemAmountContainer: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statusChip: {
    marginBottom: 2,
  },
  methodChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
});
