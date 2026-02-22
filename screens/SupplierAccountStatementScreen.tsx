import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, FlatList } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  useTheme,
  Divider,
  Chip,
  Searchbar,
  SegmentedButtons,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPhilippineDate, formatPhilippineDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'SupplierAccountStatement'>;
};

interface Supplier {
  id: number;
  name: string;
  code?: string;
  phone?: string;
  contact_person?: string;
}

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getDateRange = (preset: string): DateRange => {
  const now = new Date();
  const today = toLocalDateStr(now);

  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today, label: 'Today' };
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yDate = toLocalDateStr(yesterday);
      return { startDate: yDate, endDate: yDate, label: 'Yesterday' };
    }
    case 'this_week': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      return { startDate: toLocalDateStr(startOfWeek), endDate: today, label: 'This Week' };
    }
    case 'last_week': {
      const lastWeekEnd = new Date(now);
      lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
      return { startDate: toLocalDateStr(lastWeekStart), endDate: toLocalDateStr(lastWeekEnd), label: 'Last Week' };
    }
    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toLocalDateStr(startOfMonth), endDate: today, label: 'This Month' };
    }
    case 'last_month': {
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { startDate: toLocalDateStr(lastMonthStart), endDate: toLocalDateStr(lastMonthEnd), label: 'Last Month' };
    }
    case 'this_year': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return { startDate: toLocalDateStr(startOfYear), endDate: today, label: 'This Year' };
    }
    case 'all_time':
    default:
      return { startDate: '2020-01-01', endDate: today, label: 'All Time' };
  }
};

export default function SupplierAccountStatementScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [datePreset, setDatePreset] = useState('this_month');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('this_month'));
  const [activeTab, setActiveTab] = useState('purchases');

  // Data states
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  useEffect(() => {
    loadSuppliers();
    loadCompanySettings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (selectedSupplier) {
        loadStatementData();
      }
    }, [selectedSupplier, dateRange])
  );

  useEffect(() => {
    setDateRange(getDateRange(datePreset));
  }, [datePreset]);

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

  const loadSuppliers = async () => {
    try {
      const dbService = getDatabase();
      const supplierList = await dbService.getSuppliers(true);
      setSuppliers(supplierList);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadStatementData = async () => {
    if (!selectedSupplier) return;

    setLoading(true);
    try {
      const dbService = getDatabase();

      const [purchasesData, paymentsData, summaryData] = await Promise.all([
        dbService.getSupplierPurchasesWithItems(selectedSupplier.id, dateRange.startDate, dateRange.endDate),
        dbService.getSupplierPaymentsByDateRange(selectedSupplier.id, dateRange.startDate, dateRange.endDate),
        dbService.getSupplierBalanceSummary(selectedSupplier.id),
      ]);

      setPurchases(purchasesData);
      setPayments(paymentsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading statement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.code?.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [suppliers, searchQuery]);

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSearchQuery(supplier.name);
    setShowSuggestions(false);
  };

  const formatCurrency = (amount: number) => {
    return `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return formatPhilippineDate(dateStr);
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'CASH': return '#4CAF50';
      case 'CHEQUE': return '#2196F3';
      case 'OTHERS': return '#9C27B0';
      default: return '#757575';
    }
  };

  const getChequeStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#FF9800';
      case 'DEPOSITED': return '#2196F3';
      case 'CLEARED': return '#4CAF50';
      case 'BOUNCED': return '#F44336';
      default: return '#757575';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED': return '#4CAF50';
      case 'PARTIALLY_RECEIVED': return '#FF9800';
      case 'ORDERED': return '#2196F3';
      default: return '#757575';
    }
  };

  // Calculate period totals
  const periodTotals = useMemo(() => {
    const purchaseTotal = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const paymentTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const chequePayments = payments.filter(p => p.payment_method === 'CHEQUE');
    const pendingCheques = chequePayments.filter(p => p.cheque_status === 'PENDING');

    return {
      purchaseTotal,
      paymentTotal,
      purchaseCount: purchases.length,
      paymentCount: payments.length,
      pendingChequeCount: pendingCheques.length,
      pendingChequeAmount: pendingCheques.reduce((sum, p) => sum + (p.amount || 0), 0),
    };
  }, [purchases, payments]);

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    builder
      .align('center')
      .bold(true)
      .println(companySettings.name)
      .bold(false)
      .println(companySettings.address || '')
      .println(companySettings.tin ? `TIN: ${companySettings.tin}` : '')
      .feed()
      .doubleSize()
      .println('SUPPLIER STATEMENT')
      .normalSize()
      .feed()
      .align('left')
      .println(`Supplier: ${selectedSupplier?.name}`)
      .println(`Code: ${selectedSupplier?.code || '-'}`)
      .println(`Period: ${dateRange.label}`)
      .println(`${dateRange.startDate} to ${dateRange.endDate}`)
      .doubleSeparator();

    // Summary
    builder
      .bold(true)
      .println('ACCOUNT SUMMARY')
      .bold(false)
      .separator()
      .leftRight('Total Purchases:', formatCurrency(summary?.totalPurchases || 0))
      .leftRight('Total Payments:', formatCurrency(summary?.totalPayments || 0))
      .leftRight('Current Balance:', formatCurrency(summary?.currentBalance || 0))
      .leftRight('Pending Cheques:', `${summary?.pendingCheques || 0} (${formatCurrency(summary?.pendingChequeAmount || 0)})`)
      .separator();

    // Period Summary
    builder
      .bold(true)
      .println(`PERIOD: ${dateRange.label}`)
      .bold(false)
      .separator()
      .leftRight('Purchases:', `${periodTotals.purchaseCount} (${formatCurrency(periodTotals.purchaseTotal)})`)
      .leftRight('Payments:', `${periodTotals.paymentCount} (${formatCurrency(periodTotals.paymentTotal)})`)
      .separator();

    // Purchases
    if (purchases.length > 0) {
      builder.bold(true).println('PURCHASES').bold(false).separator();
      purchases.slice(0, 15).forEach(p => {
        builder.println(`${p.purchase_number} - ${formatDate(p.purchase_date)}`);
        builder.leftRight(`  ${p.status}`, formatCurrency(p.total_amount));
      });
      if (purchases.length > 15) {
        builder.println(`... and ${purchases.length - 15} more`);
      }
      builder.separator();
    }

    // Payments
    if (payments.length > 0) {
      builder.bold(true).println('PAYMENTS').bold(false).separator();
      payments.slice(0, 15).forEach(p => {
        builder.println(`${p.payment_number} - ${formatDate(p.payment_date)}`);
        const methodInfo = p.payment_method === 'CHEQUE'
          ? `CHQ#${p.cheque_number || '-'} (${p.cheque_status})`
          : p.payment_method;
        builder.leftRight(`  ${methodInfo}`, formatCurrency(p.amount));
      });
      if (payments.length > 15) {
        builder.println(`... and ${payments.length - 15} more`);
      }
    }

    builder
      .feed()
      .align('center')
      .separator()
      .println(`Generated: ${formatPhilippineDateTime(now)}`)
      .feed(2)
      .cut();

    return builder;
  };

  const buildPdfHtml = (): string => {
    const now = new Date();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 18px; font-weight: bold; }
          .company-info { font-size: 11px; color: #666; }
          .report-title { font-size: 16px; font-weight: bold; margin: 15px 0; color: #E91E63; }
          .supplier-info { background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 15px; }
          .section { margin: 15px 0; }
          .section-title { font-size: 13px; font-weight: bold; border-bottom: 2px solid #E91E63; padding-bottom: 5px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 11px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .summary-grid { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
          .summary-item { flex: 1; min-width: 140px; padding: 12px; background: #f9f9f9; border-radius: 5px; text-align: center; border-left: 3px solid #E91E63; }
          .summary-label { font-size: 10px; color: #666; }
          .summary-value { font-size: 16px; font-weight: bold; margin-top: 5px; }
          .status-received { color: #4CAF50; }
          .status-partial { color: #FF9800; }
          .status-ordered { color: #2196F3; }
          .method-cash { background-color: #E8F5E9; color: #2E7D32; }
          .method-cheque { background-color: #E3F2FD; color: #1565C0; }
          .method-others { background-color: #F3E5F5; color: #7B1FA2; }
          .cheque-pending { color: #FF9800; }
          .cheque-cleared { color: #4CAF50; }
          .cheque-bounced { color: #F44336; }
          .balance-due { color: #F44336; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
          .item-list { font-size: 10px; color: #666; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          ${companySettings.address ? `<div class="company-info">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
          <div class="report-title">SUPPLIER ACCOUNT STATEMENT</div>
        </div>

        <div class="supplier-info">
          <strong>${selectedSupplier?.name}</strong> ${selectedSupplier?.code ? `(${selectedSupplier.code})` : ''}<br/>
          ${selectedSupplier?.contact_person ? `Contact: ${selectedSupplier.contact_person}<br/>` : ''}
          ${selectedSupplier?.phone ? `Phone: ${selectedSupplier.phone}<br/>` : ''}
          <strong>Period:</strong> ${dateRange.label} (${dateRange.startDate} to ${dateRange.endDate})
        </div>

        <div class="section">
          <div class="section-title">Account Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total Purchases</div>
              <div class="summary-value" style="color: #2196F3;">${formatCurrency(summary?.totalPurchases || 0)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Payments</div>
              <div class="summary-value" style="color: #4CAF50;">${formatCurrency(summary?.totalPayments || 0)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Current Balance Due</div>
              <div class="summary-value balance-due">${formatCurrency(summary?.currentBalance || 0)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Pending Cheques</div>
              <div class="summary-value" style="color: #FF9800;">${summary?.pendingCheques || 0} (${formatCurrency(summary?.pendingChequeAmount || 0)})</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Purchases (${purchases.length})</div>
          ${purchases.length === 0 ? '<p>No purchases in this period</p>' : `
          <table>
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Date</th>
                <th>Reference</th>
                <th>Status</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Paid</th>
                <th class="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${purchases.map(p => `
                <tr>
                  <td>
                    ${p.purchase_number}
                    ${p.items?.length ? `<div class="item-list">${p.items.slice(0, 3).map((i: any) => `${i.quantity_ordered}x ${i.product_name}`).join(', ')}${p.items.length > 3 ? '...' : ''}</div>` : ''}
                  </td>
                  <td>${formatDate(p.purchase_date)}</td>
                  <td>${p.reference_number || '-'}</td>
                  <td class="${p.status === 'RECEIVED' ? 'status-received' : p.status === 'PARTIALLY_RECEIVED' ? 'status-partial' : 'status-ordered'}">${p.status}</td>
                  <td class="text-right">${formatCurrency(p.total_amount)}</td>
                  <td class="text-right">${formatCurrency(p.paid_amount || 0)}</td>
                  <td class="text-right balance-due">${formatCurrency(p.balance_amount || 0)}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background-color: #f0f0f0;">
                <td colspan="4">TOTAL</td>
                <td class="text-right">${formatCurrency(periodTotals.purchaseTotal)}</td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </table>
          `}
        </div>

        <div class="section">
          <div class="section-title">Payments (${payments.length})</div>
          ${payments.length === 0 ? '<p>No payments in this period</p>' : `
          <table>
            <thead>
              <tr>
                <th>Payment #</th>
                <th>Date</th>
                <th>For PO</th>
                <th>Method</th>
                <th>Cheque Details</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => `
                <tr>
                  <td>${p.payment_number}</td>
                  <td>${formatDate(p.payment_date)}</td>
                  <td>${p.purchase_number || '-'}</td>
                  <td><span class="method-${p.payment_method.toLowerCase()}" style="padding: 2px 6px; border-radius: 3px;">${p.payment_method}</span></td>
                  <td>
                    ${p.payment_method === 'CHEQUE' ? `
                      CHQ# ${p.cheque_number || '-'}<br/>
                      Bank: ${p.bank_name || '-'}<br/>
                      Date: ${formatDate(p.cheque_date)}<br/>
                      <span class="${p.cheque_status === 'PENDING' ? 'cheque-pending' : p.cheque_status === 'CLEARED' ? 'cheque-cleared' : p.cheque_status === 'BOUNCED' ? 'cheque-bounced' : ''}">${p.cheque_status}</span>
                    ` : p.reference_number || '-'}
                  </td>
                  <td class="text-right" style="color: #4CAF50; font-weight: bold;">${formatCurrency(p.amount)}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background-color: #f0f0f0;">
                <td colspan="5">TOTAL</td>
                <td class="text-right" style="color: #4CAF50;">${formatCurrency(periodTotals.paymentTotal)}</td>
              </tr>
            </tbody>
          </table>
          `}
        </div>

        <div class="footer">
          Report generated on ${formatPhilippineDateTime(now)}
        </div>
      </body>
      </html>
    `;
  };

  const renderPurchaseItem = ({ item }: { item: any }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemHeader}>
          <View style={{ flex: 1 }}>
            <Title style={styles.itemTitle}>{item.purchase_number}</Title>
            <Paragraph style={styles.itemDate}>{formatDate(item.purchase_date)}</Paragraph>
          </View>
          <View style={styles.itemAmountContainer}>
            <Paragraph style={styles.itemAmount}>{formatCurrency(item.total_amount)}</Paragraph>
            <Chip
              compact
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) + '20' }]}
              textStyle={{ color: getStatusColor(item.status), fontSize: 10 }}
            >
              {item.status}
            </Chip>
          </View>
        </View>

        {item.reference_number && (
          <Paragraph style={styles.referenceText}>Ref: {item.reference_number}</Paragraph>
        )}

        {item.items?.length > 0 && (
          <View style={styles.itemsList}>
            {item.items.slice(0, 3).map((i: any, idx: number) => (
              <Paragraph key={idx} style={styles.lineItem}>
                {i.quantity_ordered}x {i.product_name}
              </Paragraph>
            ))}
            {item.items.length > 3 && (
              <Paragraph style={styles.moreItems}>+{item.items.length - 3} more items</Paragraph>
            )}
          </View>
        )}

        <View style={styles.balanceRow}>
          <Paragraph style={styles.balanceLabel}>Paid: {formatCurrency(item.paid_amount || 0)}</Paragraph>
          <Paragraph style={[styles.balanceValue, { color: '#F44336' }]}>
            Balance: {formatCurrency(item.balance_amount || 0)}
          </Paragraph>
        </View>
      </Card.Content>
    </Card>
  );

  const renderPaymentItem = ({ item }: { item: any }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemHeader}>
          <View style={{ flex: 1 }}>
            <Title style={styles.itemTitle}>{item.payment_number}</Title>
            <Paragraph style={styles.itemDate}>{formatDate(item.payment_date)}</Paragraph>
            {item.purchase_number && (
              <Paragraph style={styles.referenceText}>For: {item.purchase_number}</Paragraph>
            )}
          </View>
          <View style={styles.itemAmountContainer}>
            <Paragraph style={[styles.itemAmount, { color: '#4CAF50' }]}>{formatCurrency(item.amount)}</Paragraph>
            <Chip
              compact
              style={[styles.statusChip, { backgroundColor: getPaymentMethodColor(item.payment_method) + '20' }]}
              textStyle={{ color: getPaymentMethodColor(item.payment_method), fontSize: 10 }}
            >
              {item.payment_method}
            </Chip>
          </View>
        </View>

        {item.payment_method === 'CHEQUE' && (
          <View style={styles.chequeDetails}>
            <View style={styles.chequeRow}>
              <Paragraph style={styles.chequeLabel}>Cheque #:</Paragraph>
              <Paragraph style={styles.chequeValue}>{item.cheque_number || '-'}</Paragraph>
            </View>
            <View style={styles.chequeRow}>
              <Paragraph style={styles.chequeLabel}>Bank:</Paragraph>
              <Paragraph style={styles.chequeValue}>{item.bank_name || '-'}</Paragraph>
            </View>
            <View style={styles.chequeRow}>
              <Paragraph style={styles.chequeLabel}>Cheque Date:</Paragraph>
              <Paragraph style={styles.chequeValue}>{formatDate(item.cheque_date)}</Paragraph>
            </View>
            <View style={styles.chequeRow}>
              <Paragraph style={styles.chequeLabel}>Status:</Paragraph>
              <Chip
                compact
                style={[styles.statusChip, { backgroundColor: getChequeStatusColor(item.cheque_status) + '20' }]}
                textStyle={{ color: getChequeStatusColor(item.cheque_status), fontSize: 10 }}
              >
                {item.cheque_status}
              </Chip>
            </View>
          </View>
        )}

        {item.payment_method === 'OTHERS' && item.others_type && (
          <Paragraph style={styles.referenceText}>
            {item.others_type}: {item.reference_number || '-'}
          </Paragraph>
        )}

        {item.notes && (
          <Paragraph style={styles.notesText}>Notes: {item.notes}</Paragraph>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Actions Bar - Fixed at top */}
      {selectedSupplier && (
        <ReportActionsBar
          onBuildPrintData={buildPrintReport}
          onBuildPdfHtml={buildPdfHtml}
          reportTitle="Supplier Statement"
          reportFileName={`SupplierStatement_${selectedSupplier.code || selectedSupplier.id}`}
          disabled={!selectedSupplier}
        />
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        {/* Supplier Search */}
        <Card style={styles.searchCard}>
          <Card.Content>
            <Searchbar
              placeholder="Search supplier by name or code..."
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setShowSuggestions(text.length > 0);
                if (!text) setSelectedSupplier(null);
              }}
              onFocus={() => setShowSuggestions(searchQuery.length > 0)}
              style={styles.searchBar}
            />

            {showSuggestions && filteredSuppliers.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {filteredSuppliers.map((supplier) => (
                  <TouchableOpacity
                    key={supplier.id}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSupplier(supplier)}
                  >
                    <Paragraph style={styles.suggestionName}>{supplier.name}</Paragraph>
                    <Paragraph style={styles.suggestionCode}>{supplier.code || ''}</Paragraph>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>

        {selectedSupplier && (
          <>
            {/* Selected Supplier Info */}
            <Card style={styles.supplierInfoCard}>
              <Card.Content style={styles.supplierInfoContent}>
                <View style={{ flex: 1 }}>
                  <Title style={[styles.supplierName, { fontSize: fs.h3 }]}>{selectedSupplier.name}</Title>
                  {selectedSupplier.code && (
                    <Paragraph style={styles.supplierCode}>Code: {selectedSupplier.code}</Paragraph>
                  )}
                </View>
                {summary && (
                  <View style={styles.balanceDisplay}>
                    <Paragraph style={styles.balanceLabel}>Balance Due</Paragraph>
                    <Title style={styles.balanceAmount}>{formatCurrency(summary.currentBalance)}</Title>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Date Range */}
            <View style={styles.dateRangeContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['today', 'this_week', 'this_month', 'last_month', 'this_year', 'all_time'].map((preset) => (
                  <Chip
                    key={preset}
                    selected={datePreset === preset}
                    onPress={() => setDatePreset(preset)}
                    style={styles.dateChip}
                  >
                    {getDateRange(preset).label}
                  </Chip>
                ))}
              </ScrollView>
            </View>

            {/* Tab Navigation */}
            <SegmentedButtons
              value={activeTab}
              onValueChange={setActiveTab}
              buttons={[
                { value: 'purchases', label: `Purchases (${purchases.length})` },
                { value: 'payments', label: `Payments (${payments.length})` },
                { value: 'summary', label: 'Summary' },
              ]}
              style={styles.tabButtons}
            />

            {/* Tab Content */}
            {activeTab === 'purchases' && (
              <View style={styles.tabContent}>
                <View style={styles.tabHeader}>
                  <Paragraph style={styles.tabHeaderText}>
                    {purchases.length} purchases - {formatCurrency(periodTotals.purchaseTotal)}
                  </Paragraph>
                </View>
                {purchases.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Card.Content>
                      <Paragraph style={styles.emptyText}>No purchases in this period</Paragraph>
                    </Card.Content>
                  </Card>
                ) : (
                  <FlatList
                    data={purchases}
                    renderItem={renderPurchaseItem}
                    keyExtractor={(item) => item.id.toString()}
                    scrollEnabled={false}
                  />
                )}
              </View>
            )}

            {activeTab === 'payments' && (
              <View style={styles.tabContent}>
                <View style={styles.tabHeader}>
                  <Paragraph style={styles.tabHeaderText}>
                    {payments.length} payments - {formatCurrency(periodTotals.paymentTotal)}
                  </Paragraph>
                </View>
                {payments.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Card.Content>
                      <Paragraph style={styles.emptyText}>No payments in this period</Paragraph>
                    </Card.Content>
                  </Card>
                ) : (
                  <FlatList
                    data={payments}
                    renderItem={renderPaymentItem}
                    keyExtractor={(item) => item.id.toString()}
                    scrollEnabled={false}
                  />
                )}
              </View>
            )}

            {activeTab === 'summary' && summary && (
              <View style={styles.tabContent}>
                {/* Balance Card */}
                <Card style={[styles.balanceCard, { backgroundColor: '#FFEBEE' }]}>
                  <Card.Content>
                    <Paragraph style={styles.balanceCardLabel}>Current Balance Due</Paragraph>
                    <Title style={[styles.balanceCardValue, { color: '#F44336' }]}>
                      {formatCurrency(summary.currentBalance)}
                    </Title>
                  </Card.Content>
                </Card>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <Card style={styles.statCard}>
                    <Card.Content style={styles.statContent}>
                      <Paragraph style={[styles.statLabel, { fontSize: fs.caption }]}>Total Purchases</Paragraph>
                      <Title style={[styles.statValue, { color: '#2196F3' }]}>
                        {formatCurrency(summary.totalPurchases)}
                      </Title>
                      <Paragraph style={styles.statCount}>{summary.purchaseCount} orders</Paragraph>
                    </Card.Content>
                  </Card>
                  <Card style={styles.statCard}>
                    <Card.Content style={styles.statContent}>
                      <Paragraph style={[styles.statLabel, { fontSize: fs.caption }]}>Total Payments</Paragraph>
                      <Title style={[styles.statValue, { color: '#4CAF50' }]}>
                        {formatCurrency(summary.totalPayments)}
                      </Title>
                      <Paragraph style={styles.statCount}>{summary.paidPurchases} paid</Paragraph>
                    </Card.Content>
                  </Card>
                </View>

                <View style={styles.statsGrid}>
                  <Card style={styles.statCard}>
                    <Card.Content style={styles.statContent}>
                      <Paragraph style={[styles.statLabel, { fontSize: fs.caption }]}>Unpaid Orders</Paragraph>
                      <Title style={[styles.statValue, { color: '#FF9800' }]}>
                        {summary.unpaidPurchases}
                      </Title>
                    </Card.Content>
                  </Card>
                  <Card style={styles.statCard}>
                    <Card.Content style={styles.statContent}>
                      <Paragraph style={[styles.statLabel, { fontSize: fs.caption }]}>Pending Cheques</Paragraph>
                      <Title style={[styles.statValue, { color: '#9C27B0' }]}>
                        {summary.pendingCheques}
                      </Title>
                      <Paragraph style={styles.statCount}>{formatCurrency(summary.pendingChequeAmount)}</Paragraph>
                    </Card.Content>
                  </Card>
                </View>

                {/* Period Summary */}
                <Card style={styles.periodCard}>
                  <Card.Content>
                    <Title style={styles.periodTitle}>Period: {dateRange.label}</Title>
                    <Divider style={styles.divider} />
                    <View style={styles.periodRow}>
                      <Paragraph>Purchases</Paragraph>
                      <Paragraph style={{ color: '#2196F3', fontWeight: 'bold' }}>
                        {periodTotals.purchaseCount} ({formatCurrency(periodTotals.purchaseTotal)})
                      </Paragraph>
                    </View>
                    <View style={styles.periodRow}>
                      <Paragraph>Payments</Paragraph>
                      <Paragraph style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                        {periodTotals.paymentCount} ({formatCurrency(periodTotals.paymentTotal)})
                      </Paragraph>
                    </View>
                    {periodTotals.pendingChequeCount > 0 && (
                      <View style={styles.periodRow}>
                        <Paragraph>Pending Cheques</Paragraph>
                        <Paragraph style={{ color: '#FF9800', fontWeight: 'bold' }}>
                          {periodTotals.pendingChequeCount} ({formatCurrency(periodTotals.pendingChequeAmount)})
                        </Paragraph>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              </View>
            )}
          </>
        )}

        {!selectedSupplier && (
          <Card style={styles.instructionCard}>
            <Card.Content>
              <Paragraph style={styles.instructionText}>
                Search and select a supplier above to view their account statement, including purchases, payments, and cheques.
              </Paragraph>
            </Card.Content>
          </Card>
        )}

        <View style={{ height: 50 }} />
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
  searchCard: {
    marginBottom: 12,
  },
  supplierInfoCard: {
    marginBottom: 12,
    backgroundColor: '#E8F5E9',
  },
  supplierInfoContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supplierName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  supplierCode: {
    fontSize: 12,
    color: '#666',
  },
  balanceDisplay: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 11,
    color: '#666',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionName: {
    fontWeight: '500',
  },
  suggestionCode: {
    color: '#666',
  },
  dateRangeContainer: {
    marginBottom: 16,
  },
  dateChip: {
    marginRight: 8,
  },
  tabButtons: {
    marginBottom: 16,
  },
  tabContent: {
    marginBottom: 16,
  },
  tabHeader: {
    marginBottom: 8,
  },
  tabHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  itemCard: {
    marginBottom: 12,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemDate: {
    fontSize: 12,
    color: '#666',
  },
  itemAmountContainer: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusChip: {
    marginTop: 4,
    height: 24,
  },
  referenceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  itemsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  lineItem: {
    fontSize: 12,
    color: '#444',
  },
  moreItems: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#666',
  },
  balanceValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  chequeDetails: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  chequeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chequeLabel: {
    fontSize: 12,
    color: '#666',
  },
  chequeValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  emptyCard: {
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
  instructionCard: {
    marginTop: 8,
    backgroundColor: '#FFF8E1',
  },
  instructionText: {
    textAlign: 'center',
    color: '#F57C00',
  },
  balanceCard: {
    marginBottom: 16,
  },
  balanceCardLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  balanceCardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statCount: {
    fontSize: 11,
    color: '#999',
  },
  periodCard: {
    marginTop: 8,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
