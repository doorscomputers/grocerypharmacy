import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  useTheme,
  DataTable,
  Chip,
  ActivityIndicator,
  IconButton,
  Modal,
  Portal,
  Divider,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { toLocalDateString, formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'VoidRefundExchangeReport'>;
};

type TabType = 'ALL' | 'VOID' | 'REFUND' | 'EXCHANGE';

interface VoidTransaction {
  id: number;
  transaction_number: string;
  invoice_number: string;
  customer_name?: string;
  total_amount: number;
  void_date: string;
  void_reason: string;
  void_by_name?: string;
  cashier_name?: string;
}

interface RefundExchangeTransaction {
  id: number;
  return_number: string;
  original_invoice_number?: string;
  customer_name?: string;
  total_amount: number;
  return_date: string;
  refund_method: string;
  reason?: string;
  processed_by_name?: string;
  item_count: number;
}

interface TransactionItem {
  id: number;
  product_name: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  selling_price?: number;
  total_amount: number;
}

export default function VoidRefundExchangeReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  // Data states
  const [voidTransactions, setVoidTransactions] = useState<VoidTransaction[]>([]);
  const [refundTransactions, setRefundTransactions] = useState<RefundExchangeTransaction[]>([]);
  const [exchangeTransactions, setExchangeTransactions] = useState<RefundExchangeTransaction[]>([]);
  const [summary, setSummary] = useState({
    voidCount: 0, voidTotal: 0,
    refundCount: 0, refundTotal: 0,
    exchangeCount: 0, exchangeTotal: 0,
  });

  // Items cache for reports (keyed by transaction ID)
  const [voidItemsMap, setVoidItemsMap] = useState<Record<number, TransactionItem[]>>({});
  const [refundItemsMap, setRefundItemsMap] = useState<Record<number, TransactionItem[]>>({});
  const [exchangeItemsMap, setExchangeItemsMap] = useState<Record<number, TransactionItem[]>>({});
  const [exchangeReplacementsMap, setExchangeReplacementsMap] = useState<Record<number, TransactionItem[]>>({});

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<TransactionItem[]>([]);
  const [replacementItems, setReplacementItems] = useState<TransactionItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    initAndLoad();
  }, [dateRange]);

  const initAndLoad = async () => {
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.initialize();
      await Promise.all([loadData(), loadCompanySettings()]);
    } catch (error) {
      console.error('Error initializing:', error);
      setLoading(false);
    }
  };

  const loadCompanySettings = async () => {
    try {
      const dbService = DatabaseService.getInstance();
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
      const dbService = DatabaseService.getInstance();
      const startStr = toLocalDateString(dateRange.startDate);
      const endStr = toLocalDateString(dateRange.endDate);

      // Load all data in parallel
      const [voids, refunds, exchanges, summaryData] = await Promise.all([
        dbService.getVoidedTransactions(startStr, endStr),
        dbService.getRefundExchangeTransactions(startStr, endStr, 'REFUND'),
        dbService.getRefundExchangeTransactions(startStr, endStr, 'EXCHANGE'),
        dbService.getVoidRefundExchangeSummary(startStr, endStr),
      ]);

      setVoidTransactions(voids || []);
      setRefundTransactions(refunds || []);
      setExchangeTransactions(exchanges || []);
      setSummary(summaryData);

      // Load items for all transactions (for detailed reports)
      const voidItems: Record<number, TransactionItem[]> = {};
      const refundItems: Record<number, TransactionItem[]> = {};
      const exchangeItems: Record<number, TransactionItem[]> = {};
      const exchangeReplacements: Record<number, TransactionItem[]> = {};

      // Load void items
      for (const v of (voids || [])) {
        voidItems[v.id] = await dbService.getVoidedTransactionItems(v.id);
      }

      // Load refund items
      for (const r of (refunds || [])) {
        refundItems[r.id] = await dbService.getRefundExchangeItems(r.id);
      }

      // Load exchange items and replacements
      for (const e of (exchanges || [])) {
        exchangeItems[e.id] = await dbService.getRefundExchangeItems(e.id);
        exchangeReplacements[e.id] = await dbService.getExchangeReplacementItems(e.id);
      }

      setVoidItemsMap(voidItems);
      setRefundItemsMap(refundItems);
      setExchangeItemsMap(exchangeItems);
      setExchangeReplacementsMap(exchangeReplacements);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (transaction: any, type: 'VOID' | 'REFUND' | 'EXCHANGE') => {
    setSelectedTransaction({ ...transaction, type });
    setShowDetailModal(true);
    setLoadingItems(true);
    setReplacementItems([]);

    try {
      const dbService = DatabaseService.getInstance();
      let items: TransactionItem[] = [];

      if (type === 'VOID') {
        items = await dbService.getVoidedTransactionItems(transaction.id);
      } else {
        items = await dbService.getRefundExchangeItems(transaction.id);

        // For exchanges, also load replacement items
        if (type === 'EXCHANGE') {
          const replacements = await dbService.getExchangeReplacementItems(transaction.id);
          setReplacementItems(replacements || []);
        }
      }

      setSelectedItems(items || []);
    } catch (error) {
      console.error('Error loading items:', error);
      setSelectedItems([]);
      setReplacementItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return `₱${(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'VOID': return '#D32F2F';
      case 'REFUND': return '#FF9800';
      case 'EXCHANGE': return '#2196F3';
      default: return '#757575';
    }
  };

  const getRefundMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return 'Cash';
      case 'CREDIT': return 'Credit';
      case 'STORE_CREDIT': return 'Store Credit';
      case 'EXCHANGE': return 'Exchange';
      default: return method;
    }
  };

  const tabs: { key: TabType; label: string; count: number; color: string }[] = [
    { key: 'ALL', label: 'All', count: summary.voidCount + summary.refundCount + summary.exchangeCount, color: theme.colors.primary },
    { key: 'VOID', label: 'Voided', count: summary.voidCount, color: '#D32F2F' },
    { key: 'REFUND', label: 'Refunded', count: summary.refundCount, color: '#FF9800' },
    { key: 'EXCHANGE', label: 'Exchanged', count: summary.exchangeCount, color: '#2196F3' },
  ];

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('VOID/REFUND/EXCHANGE')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .doubleSeparator()
      .align('left');

    builder
      .leftRight('From:', formatPrinterDate(dateRange.startDate))
      .leftRight('To:', formatPrinterDate(dateRange.endDate))
      .separator();

    builder
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .leftRight(`Voided (${summary.voidCount})`, formatCurrency(summary.voidTotal))
      .leftRight(`Refunded (${summary.refundCount})`, formatCurrency(summary.refundTotal))
      .leftRight(`Exchanged (${summary.exchangeCount})`, formatCurrency(summary.exchangeTotal))
      .doubleSeparator();

    // Voided transactions with item details
    if (voidTransactions.length > 0) {
      builder.bold(true).println('VOIDED TRANSACTIONS').bold(false).separator();
      voidTransactions.forEach(t => {
        builder
          .bold(true).println(t.invoice_number).bold(false)
          .leftRight('  Date:', formatDate(t.void_date))
          .leftRight('  Reason:', (t.void_reason || '-').substring(0, 20));

        // Print item details
        const items = voidItemsMap[t.id] || [];
        if (items.length > 0) {
          builder.println('  Items:');
          items.forEach(item => {
            builder.println(`    ${item.product_name}`);
            builder.leftRight(`      ${item.quantity} x ${formatCurrency(item.unit_price)}`, formatCurrency(item.total_amount || item.quantity * item.unit_price));
          });
        }
        builder.leftRight('  TOTAL:', formatCurrency(t.total_amount));
        builder.println('');
      });
      builder.separator();
    }

    // Refunded transactions with item details
    if (refundTransactions.length > 0) {
      builder.bold(true).println('REFUNDED TRANSACTIONS').bold(false).separator();
      refundTransactions.forEach(t => {
        builder
          .bold(true).println(t.return_number).bold(false)
          .leftRight('  Date:', formatDate(t.return_date))
          .leftRight('  Method:', getRefundMethodLabel(t.refund_method));

        // Print item details
        const items = refundItemsMap[t.id] || [];
        if (items.length > 0) {
          builder.println('  Refunded Items:');
          items.forEach(item => {
            builder.println(`    ${item.product_name}`);
            builder.leftRight(`      ${item.quantity} x ${formatCurrency(item.unit_price)}`, formatCurrency(item.total_amount || item.quantity * item.unit_price));
          });
        }
        builder.leftRight('  TOTAL:', formatCurrency(t.total_amount));
        builder.println('');
      });
      builder.separator();
    }

    // Exchanged transactions with item details
    if (exchangeTransactions.length > 0) {
      builder.bold(true).println('EXCHANGED TRANSACTIONS').bold(false).separator();
      exchangeTransactions.forEach(t => {
        builder
          .bold(true).println(t.return_number).bold(false)
          .leftRight('  Date:', formatDate(t.return_date));

        // Print returned items
        const returnedItems = exchangeItemsMap[t.id] || [];
        if (returnedItems.length > 0) {
          builder.println('  Returned Items:');
          returnedItems.forEach(item => {
            builder.println(`    ${item.product_name}`);
            builder.leftRight(`      ${item.quantity} x ${formatCurrency(item.unit_price)}`, formatCurrency(item.total_amount || item.quantity * item.unit_price));
          });
        }

        // Print replacement items
        const replacements = exchangeReplacementsMap[t.id] || [];
        if (replacements.length > 0) {
          builder.println('  Replacement Items:');
          replacements.forEach(item => {
            const price = item.selling_price || item.unit_price;
            builder.println(`    ${item.product_name}`);
            builder.leftRight(`      ${item.quantity} x ${formatCurrency(price)}`, formatCurrency(item.total_amount || item.quantity * price));
          });
        }

        builder.leftRight('  Return Value:', formatCurrency(t.total_amount));
        builder.println('');
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
    const grandTotal = summary.voidTotal + summary.refundTotal + summary.exchangeTotal;

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
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #424242; }
          .date-range { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 12px 0; }
          .summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
          .summary-item { flex: 1; min-width: 140px; background: #f5f5f5; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-label { font-size: 11px; color: #666; margin-bottom: 4px; }
          .summary-value { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { background-color: #f5f5f5; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .void-badge { background: #FFEBEE; color: #D32F2F; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          .refund-badge { background: #FFF3E0; color: #E65100; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          .exchange-badge { background: #E3F2FD; color: #1565C0; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
          .transaction-card { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
          .transaction-header { background: #f5f5f5; padding: 10px 12px; border-bottom: 1px solid #ddd; }
          .transaction-body { padding: 10px 12px; }
          .items-table { width: 100%; margin-top: 8px; }
          .items-table th { background: #fafafa; padding: 4px 8px; font-size: 11px; text-align: left; }
          .items-table td { padding: 4px 8px; font-size: 11px; border-bottom: 1px solid #f0f0f0; }
          .replacement-section { background: #E3F2FD; margin-top: 8px; padding: 8px; border-radius: 4px; }
          .replacement-title { color: #1565C0; font-weight: 600; font-size: 11px; margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name || 'IgoroTech POS'}</div>
          ${companySettings.address ? `<div class="header-text">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="header-text">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="report-title">VOID / REFUND / EXCHANGE REPORT</div>
        <div class="date-range">Period: ${startDateStr} to ${endDateStr}</div>

        <div class="section-title">Summary</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Voided Transactions</div>
            <div class="summary-value" style="color: #D32F2F;">${summary.voidCount}</div>
            <div style="font-size: 14px; color: #D32F2F;">${formatCurrency(summary.voidTotal)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Refunded Transactions</div>
            <div class="summary-value" style="color: #FF9800;">${summary.refundCount}</div>
            <div style="font-size: 14px; color: #FF9800;">${formatCurrency(summary.refundTotal)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Exchanged Transactions</div>
            <div class="summary-value" style="color: #2196F3;">${summary.exchangeCount}</div>
            <div style="font-size: 14px; color: #2196F3;">${formatCurrency(summary.exchangeTotal)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Grand Total</div>
            <div class="summary-value" style="color: #424242;">${summary.voidCount + summary.refundCount + summary.exchangeCount}</div>
            <div style="font-size: 14px; color: #424242;">${formatCurrency(grandTotal)}</div>
          </div>
        </div>

        ${voidTransactions.length > 0 ? `
          <div class="section-title" style="color: #D32F2F;">Voided Transactions (${voidTransactions.length})</div>
          ${voidTransactions.map(t => {
            const items = voidItemsMap[t.id] || [];
            return `
              <div class="transaction-card" style="border-left: 4px solid #D32F2F;">
                <div class="transaction-header">
                  <strong style="color: #D32F2F;">${t.invoice_number}</strong>
                  <span style="float: right; color: #D32F2F; font-weight: bold;">${formatCurrency(t.total_amount)}</span>
                </div>
                <div class="transaction-body">
                  <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 11px; color: #666; margin-bottom: 8px;">
                    <span><strong>Customer:</strong> ${t.customer_name || 'Walk-in'}</span>
                    <span><strong>Date:</strong> ${formatDateTime(t.void_date)}</span>
                    <span><strong>Voided By:</strong> ${t.void_by_name || '-'}</span>
                  </div>
                  <div style="font-size: 11px; color: #666; margin-bottom: 8px;"><strong>Reason:</strong> ${t.void_reason || '-'}</div>
                  ${items.length > 0 ? `
                    <table class="items-table">
                      <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th style="text-align: right;">Amount</th></tr></thead>
                      <tbody>
                        ${items.map(item => `
                          <tr>
                            <td>${item.product_name}</td>
                            <td>${item.quantity}</td>
                            <td>${formatCurrency(item.unit_price)}</td>
                            <td style="text-align: right;">${formatCurrency(item.total_amount || item.quantity * item.unit_price)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        ` : ''}

        ${refundTransactions.length > 0 ? `
          <div class="section-title" style="color: #FF9800;">Refunded Transactions (${refundTransactions.length})</div>
          ${refundTransactions.map(t => {
            const items = refundItemsMap[t.id] || [];
            return `
              <div class="transaction-card" style="border-left: 4px solid #FF9800;">
                <div class="transaction-header">
                  <strong style="color: #FF9800;">${t.return_number}</strong>
                  <span style="float: right; color: #FF9800; font-weight: bold;">${formatCurrency(t.total_amount)}</span>
                </div>
                <div class="transaction-body">
                  <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 11px; color: #666; margin-bottom: 8px;">
                    <span><strong>Original Invoice:</strong> ${t.original_invoice_number || '-'}</span>
                    <span><strong>Customer:</strong> ${t.customer_name || 'Walk-in'}</span>
                    <span><strong>Date:</strong> ${formatDateTime(t.return_date)}</span>
                    <span><strong>Method:</strong> ${getRefundMethodLabel(t.refund_method)}</span>
                  </div>
                  ${items.length > 0 ? `
                    <div style="font-size: 11px; font-weight: 600; margin-bottom: 4px;">Refunded Items:</div>
                    <table class="items-table">
                      <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th style="text-align: right;">Amount</th></tr></thead>
                      <tbody>
                        ${items.map(item => `
                          <tr>
                            <td>${item.product_name}</td>
                            <td>${item.quantity}</td>
                            <td>${formatCurrency(item.unit_price)}</td>
                            <td style="text-align: right;">${formatCurrency(item.total_amount || item.quantity * item.unit_price)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        ` : ''}

        ${exchangeTransactions.length > 0 ? `
          <div class="section-title" style="color: #2196F3;">Exchanged Transactions (${exchangeTransactions.length})</div>
          ${exchangeTransactions.map(t => {
            const returnedItems = exchangeItemsMap[t.id] || [];
            const replacements = exchangeReplacementsMap[t.id] || [];
            const replacementTotal = replacements.reduce((sum, item) => sum + (item.total_amount || item.quantity * (item.selling_price || item.unit_price)), 0);
            return `
              <div class="transaction-card" style="border-left: 4px solid #2196F3;">
                <div class="transaction-header">
                  <strong style="color: #2196F3;">${t.return_number}</strong>
                  <span style="float: right; color: #2196F3; font-weight: bold;">Return: ${formatCurrency(t.total_amount)}</span>
                </div>
                <div class="transaction-body">
                  <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 11px; color: #666; margin-bottom: 8px;">
                    <span><strong>Original Invoice:</strong> ${t.original_invoice_number || '-'}</span>
                    <span><strong>Customer:</strong> ${t.customer_name || 'Walk-in'}</span>
                    <span><strong>Date:</strong> ${formatDateTime(t.return_date)}</span>
                  </div>
                  ${returnedItems.length > 0 ? `
                    <div style="font-size: 11px; font-weight: 600; margin-bottom: 4px; color: #D32F2F;">Returned Items:</div>
                    <table class="items-table">
                      <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th style="text-align: right;">Amount</th></tr></thead>
                      <tbody>
                        ${returnedItems.map(item => `
                          <tr>
                            <td>${item.product_name}</td>
                            <td>${item.quantity}</td>
                            <td>${formatCurrency(item.unit_price)}</td>
                            <td style="text-align: right;">${formatCurrency(item.total_amount || item.quantity * item.unit_price)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  ` : ''}
                  ${replacements.length > 0 ? `
                    <div class="replacement-section">
                      <div class="replacement-title">Replacement Items (New):</div>
                      <table class="items-table" style="background: transparent;">
                        <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th style="text-align: right;">Amount</th></tr></thead>
                        <tbody>
                          ${replacements.map(item => {
                            const price = item.selling_price || item.unit_price;
                            return `
                              <tr>
                                <td>${item.product_name}</td>
                                <td>${item.quantity}</td>
                                <td>${formatCurrency(price)}</td>
                                <td style="text-align: right;">${formatCurrency(item.total_amount || item.quantity * price)}</td>
                              </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>
                      <div style="text-align: right; margin-top: 8px; font-size: 12px;">
                        <strong>Return Value:</strong> ${formatCurrency(t.total_amount)} |
                        <strong>Replacement Value:</strong> ${formatCurrency(replacementTotal)} |
                        <strong style="color: ${t.total_amount > replacementTotal ? '#2E7D32' : '#D32F2F'};">
                          Difference: ${t.total_amount > replacementTotal ? 'Customer receives ' : 'Customer pays '}${formatCurrency(Math.abs(t.total_amount - replacementTotal))}
                        </strong>
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        ` : ''}

        <div class="footer">
          <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Void/Refund/Exchange Report</p>
        </div>
      </body>
      </html>
    `;
  };

  const renderVoidTable = () => (
    <DataTable>
      <DataTable.Header>
        <DataTable.Title style={{ flex: 1.5 }}>Invoice #</DataTable.Title>
        <DataTable.Title style={{ flex: 1.2 }}>Date</DataTable.Title>
        <DataTable.Title numeric style={{ flex: 1 }}>Amount</DataTable.Title>
        <DataTable.Title style={{ flex: 1.5 }}>Reason</DataTable.Title>
        <DataTable.Title style={{ flex: 0.5 }}></DataTable.Title>
      </DataTable.Header>

      {voidTransactions.map((item) => (
        <DataTable.Row key={`void-${item.id}`}>
          <DataTable.Cell style={{ flex: 1.5 }}>{item.invoice_number}</DataTable.Cell>
          <DataTable.Cell style={{ flex: 1.2 }}>{formatDate(item.void_date)}</DataTable.Cell>
          <DataTable.Cell numeric style={{ flex: 1 }}>
            <Paragraph style={{ color: '#D32F2F', fontWeight: '600' }}>{formatCurrency(item.total_amount)}</Paragraph>
          </DataTable.Cell>
          <DataTable.Cell style={{ flex: 1.5 }}>{(item.void_reason || '-').substring(0, 15)}</DataTable.Cell>
          <DataTable.Cell style={{ flex: 0.5 }}>
            <IconButton icon="eye" size={18} onPress={() => handleViewDetails(item, 'VOID')} />
          </DataTable.Cell>
        </DataTable.Row>
      ))}
    </DataTable>
  );

  const renderRefundTable = () => (
    <DataTable>
      <DataTable.Header>
        <DataTable.Title style={{ flex: 1.5 }}>Return #</DataTable.Title>
        <DataTable.Title style={{ flex: 1.2 }}>Date</DataTable.Title>
        <DataTable.Title numeric style={{ flex: 1 }}>Amount</DataTable.Title>
        <DataTable.Title style={{ flex: 1 }}>Method</DataTable.Title>
        <DataTable.Title style={{ flex: 0.5 }}></DataTable.Title>
      </DataTable.Header>

      {refundTransactions.map((item) => (
        <DataTable.Row key={`refund-${item.id}`}>
          <DataTable.Cell style={{ flex: 1.5 }}>{item.return_number}</DataTable.Cell>
          <DataTable.Cell style={{ flex: 1.2 }}>{formatDate(item.return_date)}</DataTable.Cell>
          <DataTable.Cell numeric style={{ flex: 1 }}>
            <Paragraph style={{ color: '#FF9800', fontWeight: '600' }}>{formatCurrency(item.total_amount)}</Paragraph>
          </DataTable.Cell>
          <DataTable.Cell style={{ flex: 1 }}>
            <Chip compact textStyle={{ fontSize: 9 }} style={{ backgroundColor: '#FFF3E0' }}>
              {getRefundMethodLabel(item.refund_method)}
            </Chip>
          </DataTable.Cell>
          <DataTable.Cell style={{ flex: 0.5 }}>
            <IconButton icon="eye" size={18} onPress={() => handleViewDetails(item, 'REFUND')} />
          </DataTable.Cell>
        </DataTable.Row>
      ))}
    </DataTable>
  );

  const renderExchangeTable = () => (
    <DataTable>
      <DataTable.Header>
        <DataTable.Title style={{ flex: 1.5 }}>Return #</DataTable.Title>
        <DataTable.Title style={{ flex: 1.2 }}>Date</DataTable.Title>
        <DataTable.Title numeric style={{ flex: 1 }}>Value</DataTable.Title>
        <DataTable.Title numeric style={{ flex: 0.8 }}>Items</DataTable.Title>
        <DataTable.Title style={{ flex: 0.5 }}></DataTable.Title>
      </DataTable.Header>

      {exchangeTransactions.map((item) => (
        <DataTable.Row key={`exchange-${item.id}`}>
          <DataTable.Cell style={{ flex: 1.5 }}>{item.return_number}</DataTable.Cell>
          <DataTable.Cell style={{ flex: 1.2 }}>{formatDate(item.return_date)}</DataTable.Cell>
          <DataTable.Cell numeric style={{ flex: 1 }}>
            <Paragraph style={{ color: '#2196F3', fontWeight: '600' }}>{formatCurrency(item.total_amount)}</Paragraph>
          </DataTable.Cell>
          <DataTable.Cell numeric style={{ flex: 0.8 }}>{item.item_count}</DataTable.Cell>
          <DataTable.Cell style={{ flex: 0.5 }}>
            <IconButton icon="eye" size={18} onPress={() => handleViewDetails(item, 'EXCHANGE')} />
          </DataTable.Cell>
        </DataTable.Row>
      ))}
    </DataTable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Void/Refund/Exchange Report"
        reportFileName={`VoidRefundExchange_${dateRange.startDate.toISOString().split('T')[0]}_to_${dateRange.endDate.toISOString().split('T')[0]}`}
        emailBody={`Please find attached the Void/Refund/Exchange Report.\n\nPeriod: ${dateRange.startDate.toLocaleDateString('en-PH')} to ${dateRange.endDate.toLocaleDateString('en-PH')}\n\nVoided: ${summary.voidCount} (${formatCurrency(summary.voidTotal)})\nRefunded: ${summary.refundCount} (${formatCurrency(summary.refundTotal)})\nExchanged: ${summary.exchangeCount} (${formatCurrency(summary.exchangeTotal)})\n\n---\nGenerated by IgoroTech POS`}
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

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <Card style={[styles.summaryCard, { borderLeftColor: '#D32F2F', borderLeftWidth: 4 }]}>
            <Card.Content style={styles.summaryContent}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Voided</Paragraph>
              <Title style={[styles.summaryValue, { color: '#D32F2F' }]}>{summary.voidCount}</Title>
              <Paragraph style={[styles.summaryAmount, { color: '#D32F2F' }]}>{formatCurrency(summary.voidTotal)}</Paragraph>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, { borderLeftColor: '#FF9800', borderLeftWidth: 4 }]}>
            <Card.Content style={styles.summaryContent}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Refunded</Paragraph>
              <Title style={[styles.summaryValue, { color: '#FF9800' }]}>{summary.refundCount}</Title>
              <Paragraph style={[styles.summaryAmount, { color: '#FF9800' }]}>{formatCurrency(summary.refundTotal)}</Paragraph>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, { borderLeftColor: '#2196F3', borderLeftWidth: 4 }]}>
            <Card.Content style={styles.summaryContent}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Exchanged</Paragraph>
              <Title style={[styles.summaryValue, { color: '#2196F3' }]}>{summary.exchangeCount}</Title>
              <Paragraph style={[styles.summaryAmount, { color: '#2196F3' }]}>{formatCurrency(summary.exchangeTotal)}</Paragraph>
            </Card.Content>
          </Card>
        </View>

        {/* Tabs */}
        <Card style={styles.tabCard}>
          <View style={styles.tabContainer}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  activeTab === tab.key && { borderBottomColor: tab.color, borderBottomWidth: 3 }
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Paragraph style={[
                  styles.tabLabel,
                  activeTab === tab.key && { color: tab.color, fontWeight: '700' }
                ]}>
                  {tab.label}
                </Paragraph>
                <View style={[styles.tabBadge, { backgroundColor: tab.color }]}>
                  <Paragraph style={styles.tabBadgeText}>{tab.count}</Paragraph>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}

        {/* Content based on active tab */}
        {!loading && (
          <>
            {(activeTab === 'ALL' || activeTab === 'VOID') && voidTransactions.length > 0 && (
              <Card style={styles.tableCard}>
                <Card.Content>
                  <View style={styles.tableTitleRow}>
                    <View style={[styles.colorIndicator, { backgroundColor: '#D32F2F' }]} />
                    <Title style={[styles.tableTitle, { color: '#D32F2F', fontSize: fs.h3 }]}>
                      Voided Transactions ({voidTransactions.length})
                    </Title>
                  </View>
                  {renderVoidTable()}
                </Card.Content>
              </Card>
            )}

            {(activeTab === 'ALL' || activeTab === 'REFUND') && refundTransactions.length > 0 && (
              <Card style={styles.tableCard}>
                <Card.Content>
                  <View style={styles.tableTitleRow}>
                    <View style={[styles.colorIndicator, { backgroundColor: '#FF9800' }]} />
                    <Title style={[styles.tableTitle, { color: '#FF9800', fontSize: fs.h3 }]}>
                      Refunded Transactions ({refundTransactions.length})
                    </Title>
                  </View>
                  {renderRefundTable()}
                </Card.Content>
              </Card>
            )}

            {(activeTab === 'ALL' || activeTab === 'EXCHANGE') && exchangeTransactions.length > 0 && (
              <Card style={styles.tableCard}>
                <Card.Content>
                  <View style={styles.tableTitleRow}>
                    <View style={[styles.colorIndicator, { backgroundColor: '#2196F3' }]} />
                    <Title style={[styles.tableTitle, { color: '#2196F3', fontSize: fs.h3 }]}>
                      Exchanged Transactions ({exchangeTransactions.length})
                    </Title>
                  </View>
                  {renderExchangeTable()}
                </Card.Content>
              </Card>
            )}

            {/* Empty state */}
            {!loading &&
              ((activeTab === 'ALL' && voidTransactions.length === 0 && refundTransactions.length === 0 && exchangeTransactions.length === 0) ||
               (activeTab === 'VOID' && voidTransactions.length === 0) ||
               (activeTab === 'REFUND' && refundTransactions.length === 0) ||
               (activeTab === 'EXCHANGE' && exchangeTransactions.length === 0)) && (
              <Card style={styles.emptyCard}>
                <Card.Content style={styles.emptyContent}>
                  <Paragraph style={styles.emptyText}>No transactions found for the selected period</Paragraph>
                </Card.Content>
              </Card>
            )}
          </>
        )}

        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            Report generated on {new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
          </Paragraph>
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Portal>
        <Modal
          visible={showDetailModal}
          onDismiss={() => setShowDetailModal(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          {selectedTransaction && (
            <ScrollView>
              <View style={[styles.modalHeader, { backgroundColor: getTypeColor(selectedTransaction.type) }]}>
                <Title style={styles.modalTitle}>
                  {selectedTransaction.type === 'VOID' ? 'Voided Transaction' :
                   selectedTransaction.type === 'REFUND' ? 'Refunded Transaction' : 'Exchanged Transaction'}
                </Title>
                <IconButton icon="close" iconColor="#fff" onPress={() => setShowDetailModal(false)} />
              </View>

              <View style={styles.modalContent}>
                <View style={styles.detailRow}>
                  <Paragraph style={styles.detailLabel}>
                    {selectedTransaction.type === 'VOID' ? 'Invoice #' : 'Return #'}
                  </Paragraph>
                  <Paragraph style={styles.detailValue}>
                    {selectedTransaction.type === 'VOID' ? selectedTransaction.invoice_number : selectedTransaction.return_number}
                  </Paragraph>
                </View>

                {selectedTransaction.type !== 'VOID' && selectedTransaction.original_invoice_number && (
                  <View style={styles.detailRow}>
                    <Paragraph style={styles.detailLabel}>Original Invoice</Paragraph>
                    <Paragraph style={styles.detailValue}>{selectedTransaction.original_invoice_number}</Paragraph>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Paragraph style={styles.detailLabel}>Customer</Paragraph>
                  <Paragraph style={styles.detailValue}>{selectedTransaction.customer_name || 'Walk-in'}</Paragraph>
                </View>

                <View style={styles.detailRow}>
                  <Paragraph style={styles.detailLabel}>Date</Paragraph>
                  <Paragraph style={styles.detailValue}>
                    {formatDateTime(selectedTransaction.type === 'VOID' ? selectedTransaction.void_date : selectedTransaction.return_date)}
                  </Paragraph>
                </View>

                <View style={styles.detailRow}>
                  <Paragraph style={styles.detailLabel}>Amount</Paragraph>
                  <Paragraph style={[styles.detailValue, { color: getTypeColor(selectedTransaction.type), fontWeight: '700', fontSize: 18 }]}>
                    {formatCurrency(selectedTransaction.total_amount)}
                  </Paragraph>
                </View>

                {selectedTransaction.type === 'VOID' && (
                  <>
                    <View style={styles.detailRow}>
                      <Paragraph style={styles.detailLabel}>Void Reason</Paragraph>
                      <Paragraph style={styles.detailValue}>{selectedTransaction.void_reason || '-'}</Paragraph>
                    </View>
                    <View style={styles.detailRow}>
                      <Paragraph style={styles.detailLabel}>Voided By</Paragraph>
                      <Paragraph style={styles.detailValue}>{selectedTransaction.void_by_name || '-'}</Paragraph>
                    </View>
                  </>
                )}

                {selectedTransaction.type === 'REFUND' && (
                  <>
                    <View style={styles.detailRow}>
                      <Paragraph style={styles.detailLabel}>Refund Method</Paragraph>
                      <Paragraph style={styles.detailValue}>{getRefundMethodLabel(selectedTransaction.refund_method)}</Paragraph>
                    </View>
                    <View style={styles.detailRow}>
                      <Paragraph style={styles.detailLabel}>Reason</Paragraph>
                      <Paragraph style={styles.detailValue}>{selectedTransaction.reason || '-'}</Paragraph>
                    </View>
                  </>
                )}

                <Divider style={styles.modalDivider} />

                <Title style={styles.itemsTitle}>
                  {selectedTransaction.type === 'EXCHANGE' ? 'Returned Items' : 'Items'}
                </Title>

                {loadingItems ? (
                  <ActivityIndicator size="small" />
                ) : selectedItems.length > 0 ? (
                  selectedItems.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Paragraph style={styles.itemName}>{item.product_name}</Paragraph>
                        <Paragraph style={styles.itemCode}>{item.product_code || ''}</Paragraph>
                      </View>
                      <View style={styles.itemQtyPrice}>
                        <Paragraph style={styles.itemQty}>{item.quantity} x {formatCurrency(item.unit_price)}</Paragraph>
                        <Paragraph style={styles.itemTotal}>{formatCurrency(item.total_amount || (item.quantity * item.unit_price))}</Paragraph>
                      </View>
                    </View>
                  ))
                ) : (
                  <Paragraph style={styles.noItemsText}>No items found</Paragraph>
                )}

                {/* Show replacement items for exchanges */}
                {selectedTransaction.type === 'EXCHANGE' && replacementItems.length > 0 && (
                  <>
                    <Divider style={styles.modalDivider} />
                    <Title style={[styles.itemsTitle, { color: '#2196F3' }]}>Replacement Items (New)</Title>
                    {replacementItems.map((item, idx) => (
                      <View key={`rep-${idx}`} style={[styles.itemRow, { backgroundColor: '#E3F2FD' }]}>
                        <View style={styles.itemInfo}>
                          <Paragraph style={styles.itemName}>{item.product_name}</Paragraph>
                          <Paragraph style={styles.itemCode}>{item.product_code || ''}</Paragraph>
                        </View>
                        <View style={styles.itemQtyPrice}>
                          <Paragraph style={styles.itemQty}>{item.quantity} x {formatCurrency(item.selling_price || item.unit_price)}</Paragraph>
                          <Paragraph style={[styles.itemTotal, { color: '#1565C0' }]}>{formatCurrency(item.total_amount || (item.quantity * (item.selling_price || item.unit_price)))}</Paragraph>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </Modal>
      </Portal>
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
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    elevation: 2,
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  summaryAmount: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabCard: {
    marginBottom: 16,
    elevation: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 12,
    color: '#757575',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  tableCard: {
    marginBottom: 16,
    elevation: 2,
  },
  tableTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 8,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyCard: {
    marginBottom: 16,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    opacity: 0.6,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
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
  // Modal styles
  modalContainer: {
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
  },
  modalContent: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    color: '#757575',
    fontSize: 13,
  },
  detailValue: {
    fontWeight: '500',
    fontSize: 14,
  },
  modalDivider: {
    marginVertical: 16,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
  },
  itemCode: {
    fontSize: 11,
    color: '#757575',
  },
  itemQtyPrice: {
    alignItems: 'flex-end',
  },
  itemQty: {
    fontSize: 12,
    color: '#757575',
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '600',
  },
  noItemsText: {
    textAlign: 'center',
    color: '#757575',
    padding: 20,
  },
});
