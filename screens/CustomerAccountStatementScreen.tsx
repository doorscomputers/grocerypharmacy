/**
 * CustomerAccountStatementScreen - Customer Account Statement Report
 *
 * Provides detailed customer reports for:
 * - Purchases (with item details)
 * - Payments (full and partial)
 * - Balance Summary
 *
 * Features:
 * - Customer search/selection
 * - Date range filtering (pre-defined + custom)
 * - Print (58mm/80mm thermal)
 * - PDF export
 * - Email functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Text,
  useTheme,
  Searchbar,
  Chip,
  Divider,
  SegmentedButtons,
  Surface,
  IconButton,
  ActivityIndicator,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder, PRINTER_WIDTH } from '../utils/escpos';
import { formatPhilippineDateTime, formatPhilippineDate } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'CustomerAccountStatement'>;
};

interface Customer {
  id: number;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface TransactionItem {
  id: number;
  product_name: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  discount_amount?: number;
}

interface Transaction {
  id: number;
  invoice_number: string;
  transaction_date: string;
  total_amount: number;
  payment_method: string;
  status: string;
  cashier_name?: string;
  items: TransactionItem[];
  discount_amount?: number;
}

interface Payment {
  id: number;
  payment_number: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  invoice_number?: string;
  invoice_total?: number;
  received_by_name?: string;
  notes?: string;
  status: string;
}

interface BalanceSummary {
  totalPurchases: number;
  totalPayments: number;
  currentBalance: number;
  invoiceCount: number;
  paidInvoices: number;
  unpaidInvoices: number;
}

interface UnpaidInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  original_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: string;
  days_outstanding: number;
}

export default function CustomerAccountStatementScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);

  // Tab and data
  const [activeTab, setActiveTab] = useState('soa');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Date range
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  // Company settings for reports
  const [companySettings, setCompanySettings] = useState({
    name: 'IgoroTech POS',
    address: '',
    tin: '',
  });

  useEffect(() => {
    loadCustomers();
    loadCompanySettings();
  }, []);

  // Load balance summary and unpaid invoices when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      loadBalanceSummary();
      loadUnpaidInvoices();
    }
  }, [selectedCustomer]);

  // Load transactions and payments when customer or date changes
  useEffect(() => {
    if (selectedCustomer) {
      loadDateRangeData();
    }
  }, [selectedCustomer, dateRange]);

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

  const loadCustomers = async () => {
    try {
      const dbService = getDatabase();
      const customersData = await dbService.getCustomers();
      setCustomers(customersData.filter((c: any) => c.is_active !== 0));
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  // Load balance summary (not date-dependent - overall balance)
  const loadBalanceSummary = async () => {
    if (!selectedCustomer) return;

    try {
      const dbService = getDatabase();
      const summary = await dbService.getCustomerBalanceSummary(selectedCustomer.id);
      setBalanceSummary(summary);
    } catch (error) {
      console.error('Error loading balance summary:', error);
    }
  };

  // Load unpaid invoices for Statement of Account
  const loadUnpaidInvoices = async () => {
    if (!selectedCustomer) return;

    try {
      const dbService = getDatabase();
      const receivables = await dbService.getAccountsReceivable(selectedCustomer.id);
      // Filter to only unpaid/partially paid invoices
      const unpaid = receivables.filter((r: any) =>
        r.status === 'OUTSTANDING' || r.status === 'PARTIALLY_PAID' || r.status === 'OVERDUE'
      );
      setUnpaidInvoices(unpaid);
    } catch (error) {
      console.error('Error loading unpaid invoices:', error);
      setUnpaidInvoices([]);
    }
  };

  // Load transactions and payments for selected date range
  const loadDateRangeData = async () => {
    if (!selectedCustomer) return;

    try {
      setLoading(true);
      const dbService = getDatabase();
      const startDateStr = dateRange.startDate.toISOString().split('T')[0];
      const endDateStr = dateRange.endDate.toISOString().split('T')[0];

      // Load transactions with items
      const txData = await dbService.getCustomerTransactionsWithItems(
        selectedCustomer.id,
        startDateStr,
        endDateStr
      );
      setTransactions(txData);

      // Load payments
      const payData = await dbService.getCustomerPaymentsByDateRange(
        selectedCustomer.id,
        startDateStr,
        endDateStr
      );
      setPayments(payData);
    } catch (error) {
      console.error('Error loading date range data:', error);
      Alert.alert('Error', 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchQuery(customer.name);
    setShowCustomerList(false);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return formatPhilippineDate(date);
  };

  // Returns { bg, text } for proper contrast
  const getPaymentMethodColors = (method: string) => {
    switch (method) {
      case 'CASH': return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'CARD': return { bg: '#E3F2FD', text: '#1565C0' };
      case 'CHECK': return { bg: '#FFF3E0', text: '#E65100' };
      case 'BANK_TRANSFER': return { bg: '#F3E5F5', text: '#7B1FA2' };
      case 'CHARGE_INVOICE': return { bg: '#FCE4EC', text: '#C2185B' };
      case 'ONLINE': return { bg: '#ECEFF1', text: '#455A64' };
      default: return { bg: '#F5F5F5', text: '#616161' };
    }
  };

  // Returns { bg, text } for proper contrast
  const getStatusColors = (status: string) => {
    switch (status) {
      case 'COMPLETED': return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'PARTIALLY_PAID': return { bg: '#FFF3E0', text: '#E65100' };
      case 'PAID': return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'UNPAID': return { bg: '#FFEBEE', text: '#C62828' };
      default: return { bg: '#F5F5F5', text: '#616161' };
    }
  };

  // For PDF HTML - keep the old style with white text
  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'CASH': return '#388E3C';
      case 'CARD': return '#1976D2';
      case 'CHECK': return '#F57C00';
      case 'BANK_TRANSFER': return '#7B1FA2';
      case 'CHARGE_INVOICE': return '#C2185B';
      default: return '#757575';
    }
  };

  // Totals calculations
  const totalPurchasesInRange = transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const totalPaymentsInRange = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  // SOA totals - unpaid invoices
  const totalUnpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.original_amount || 0), 0);
  const totalPaidOnUnpaid = unpaidInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  const totalOutstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + (inv.balance_amount || 0), 0);

  // Build ESC/POS print data
  const buildPrintData = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const isNarrow = printerWidth === PRINTER_WIDTH.MM_58;
    const dateRangeStr = `${formatDate(dateRange.startDate.toISOString())} - ${formatDate(dateRange.endDate.toISOString())}`;

    // Header
    builder
      .align('center')
      .bold(true)
      .println(companySettings.name)
      .bold(false)
      .println(companySettings.address || '')
      .println(companySettings.tin ? `TIN: ${companySettings.tin}` : '')
      .feed(1)
      .doubleSeparator()
      .doubleSize()
      .println('CUSTOMER STATEMENT')
      .normalSize()
      .separator()
      .align('left');

    // Customer Info
    builder
      .println(`Customer: ${selectedCustomer?.name || 'N/A'}`)
      .println(`Code: ${selectedCustomer?.code || 'N/A'}`)
      .println(`Period: ${dateRangeStr}`)
      .separator();

    // Balance Summary
    if (balanceSummary) {
      builder
        .bold(true)
        .println('ACCOUNT SUMMARY')
        .bold(false)
        .leftRight('Total Purchases:', formatCurrency(balanceSummary.totalPurchases))
        .leftRight('Total Payments:', formatCurrency(balanceSummary.totalPayments))
        .leftRight('Current Balance:', formatCurrency(balanceSummary.currentBalance))
        .separator();
    }

    // Purchases in date range
    if (transactions.length > 0) {
      builder
        .bold(true)
        .println('PURCHASES')
        .bold(false);

      for (const tx of transactions) {
        builder
          .leftRight(tx.invoice_number, formatDate(tx.transaction_date))
          .leftRight('  Amount:', formatCurrency(tx.total_amount));

        // Print items for each transaction
        if (tx.items && tx.items.length > 0) {
          for (const item of tx.items) {
            if (isNarrow) {
              builder.println(`    ${item.product_name.substring(0, 18)}`);
              builder.println(`      ${item.quantity} x ${formatCurrency(item.unit_price)}`);
            } else {
              builder.println(`    ${item.quantity}x ${item.product_name.substring(0, 28)}`);
            }
          }
        }
        builder.feed(1);
      }
      builder.leftRight('TOTAL PURCHASES:', formatCurrency(totalPurchasesInRange));
      builder.separator();
    }

    // Payments in date range
    if (payments.length > 0) {
      builder
        .bold(true)
        .println('PAYMENTS')
        .bold(false);

      for (const pay of payments) {
        builder
          .leftRight(pay.payment_number || 'Payment', formatDate(pay.payment_date))
          .leftRight(`  ${pay.payment_method}:`, formatCurrency(pay.amount_paid));
        if (pay.invoice_number) {
          builder.println(`    For: ${pay.invoice_number}`);
        }
      }
      builder.leftRight('TOTAL PAYMENTS:', formatCurrency(totalPaymentsInRange));
      builder.separator();
    }

    // Footer
    builder
      .feed(1)
      .align('center')
      .println(`Generated: ${formatPhilippineDateTime(new Date())}`)
      .feed(2)
      .cut();

    return builder;
  };

  // Build PDF HTML
  const buildPdfHtml = (): string => {
    const dateRangeStr = `${formatDate(dateRange.startDate.toISOString())} - ${formatDate(dateRange.endDate.toISOString())}`;

    let purchasesHtml = '';
    if (transactions.length > 0) {
      purchasesHtml = `
        <h2 style="color:#1976D2; margin-top:20px;">Purchases</h2>
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr style="background:#E3F2FD;">
              <th style="text-align:left; padding:10px; border-bottom:2px solid #1976D2;">Invoice #</th>
              <th style="text-align:left; padding:10px; border-bottom:2px solid #1976D2;">Date</th>
              <th style="text-align:left; padding:10px; border-bottom:2px solid #1976D2;">Items</th>
              <th style="text-align:right; padding:10px; border-bottom:2px solid #1976D2;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(tx => `
              <tr>
                <td style="padding:10px; border-bottom:1px solid #eee; vertical-align:top;">${tx.invoice_number}</td>
                <td style="padding:10px; border-bottom:1px solid #eee; vertical-align:top;">${formatDate(tx.transaction_date)}</td>
                <td style="padding:10px; border-bottom:1px solid #eee; vertical-align:top; font-size:11px;">
                  ${tx.items?.map(item => `${item.quantity}x ${item.product_name}`).join('<br>') || '-'}
                </td>
                <td style="text-align:right; padding:10px; border-bottom:1px solid #eee; vertical-align:top;">${formatCurrency(tx.total_amount)}</td>
              </tr>
            `).join('')}
            <tr style="background:#E3F2FD; font-weight:bold;">
              <td colspan="3" style="padding:10px;">Total Purchases</td>
              <td style="text-align:right; padding:10px;">${formatCurrency(totalPurchasesInRange)}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    let paymentsHtml = '';
    if (payments.length > 0) {
      paymentsHtml = `
        <h2 style="color:#4CAF50; margin-top:20px;">Payments</h2>
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr style="background:#E8F5E9;">
              <th style="text-align:left; padding:10px; border-bottom:2px solid #4CAF50;">Payment #</th>
              <th style="text-align:left; padding:10px; border-bottom:2px solid #4CAF50;">Date</th>
              <th style="text-align:left; padding:10px; border-bottom:2px solid #4CAF50;">For Invoice</th>
              <th style="text-align:center; padding:10px; border-bottom:2px solid #4CAF50;">Method</th>
              <th style="text-align:right; padding:10px; border-bottom:2px solid #4CAF50;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(pay => `
              <tr>
                <td style="padding:10px; border-bottom:1px solid #eee;">${pay.payment_number || '-'}</td>
                <td style="padding:10px; border-bottom:1px solid #eee;">${formatDate(pay.payment_date)}</td>
                <td style="padding:10px; border-bottom:1px solid #eee;">${pay.invoice_number || '-'}</td>
                <td style="text-align:center; padding:10px; border-bottom:1px solid #eee;">
                  <span style="background:${getPaymentMethodColor(pay.payment_method)}; color:white; padding:2px 8px; border-radius:4px; font-size:11px;">${pay.payment_method}</span>
                </td>
                <td style="text-align:right; padding:10px; border-bottom:1px solid #eee;">${formatCurrency(pay.amount_paid)}</td>
              </tr>
            `).join('')}
            <tr style="background:#E8F5E9; font-weight:bold;">
              <td colspan="4" style="padding:10px;">Total Payments</td>
              <td style="text-align:right; padding:10px;">${formatCurrency(totalPaymentsInRange)}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 22px; font-weight: bold; color: #1976D2; }
          .company-info { font-size: 11px; color: #666; }
          .title { font-size: 18px; font-weight: bold; color: #333; text-align: center; margin: 20px 0; padding: 15px; background: #F5F5F5; border-radius: 8px; }
          .customer-info { background: #FAFAFA; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .customer-info h3 { margin: 0 0 10px 0; color: #1976D2; }
          .summary-box { display: flex; justify-content: space-around; margin: 20px 0; }
          .summary-item { text-align: center; padding: 15px 20px; background: #F5F5F5; border-radius: 8px; min-width: 150px; }
          .summary-item .label { font-size: 11px; color: #666; margin-bottom: 5px; }
          .summary-item .value { font-size: 20px; font-weight: bold; }
          .summary-item.balance { background: #FFEBEE; }
          .summary-item.balance .value { color: #D32F2F; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 10px; border-top: 1px solid #eee; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          <div class="company-info">${companySettings.address || ''}</div>
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="title">CUSTOMER ACCOUNT STATEMENT</div>

        <div class="customer-info">
          <h3>Customer Details</h3>
          <p><strong>Name:</strong> ${selectedCustomer?.name || 'N/A'}</p>
          <p><strong>Code:</strong> ${selectedCustomer?.code || 'N/A'}</p>
          ${selectedCustomer?.phone ? `<p><strong>Phone:</strong> ${selectedCustomer.phone}</p>` : ''}
          ${selectedCustomer?.address ? `<p><strong>Address:</strong> ${selectedCustomer.address}</p>` : ''}
          <p><strong>Report Period:</strong> ${dateRangeStr}</p>
        </div>

        ${balanceSummary ? `
          <div class="summary-box">
            <div class="summary-item">
              <div class="label">Total Purchases</div>
              <div class="value" style="color:#1976D2;">${formatCurrency(balanceSummary.totalPurchases)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Total Payments</div>
              <div class="value" style="color:#4CAF50;">${formatCurrency(balanceSummary.totalPayments)}</div>
            </div>
            <div class="summary-item balance">
              <div class="label">Current Balance</div>
              <div class="value">${formatCurrency(balanceSummary.currentBalance)}</div>
            </div>
          </div>
        ` : ''}

        ${purchasesHtml}

        ${paymentsHtml}

        <div class="footer">
          <p>Generated: ${formatPhilippineDateTime(new Date())}</p>
          <p>This is a computer-generated statement. No signature required.</p>
        </div>
      </body>
      </html>
    `;
  };

  // Build SOA (Statement of Account) Print Data - focused on unpaid invoices
  const buildSOAPrintData = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    // Header
    builder
      .align('center')
      .bold(true)
      .println(companySettings.name)
      .bold(false)
      .println(companySettings.address || '')
      .println(companySettings.tin ? `TIN: ${companySettings.tin}` : '')
      .feed(1)
      .doubleSeparator()
      .doubleSize()
      .println('STATEMENT OF ACCOUNT')
      .normalSize()
      .separator()
      .align('left');

    // Customer Info
    builder
      .bold(true)
      .println('CUSTOMER:')
      .bold(false)
      .println(selectedCustomer?.name || 'N/A')
      .println(`Code: ${selectedCustomer?.code || 'N/A'}`)
      .println(`Date: ${formatPhilippineDate(new Date())}`)
      .separator();

    // Outstanding Balance Summary Box
    builder
      .doubleSeparator()
      .align('center')
      .bold(true)
      .doubleSize()
      .println('AMOUNT DUE')
      .println(formatCurrency(totalOutstandingBalance))
      .normalSize()
      .bold(false)
      .doubleSeparator()
      .align('left');

    // Summary Totals
    builder
      .bold(true)
      .println('ACCOUNT SUMMARY')
      .bold(false)
      .leftRight('Total Credit Purchases:', formatCurrency(totalUnpaidAmount))
      .leftRight('Less: Payments Made:', formatCurrency(totalPaidOnUnpaid))
      .doubleSeparator()
      .bold(true)
      .leftRight('OUTSTANDING BALANCE:', formatCurrency(totalOutstandingBalance))
      .bold(false)
      .separator();

    // Unpaid Invoices List
    if (unpaidInvoices.length > 0) {
      builder
        .feed(1)
        .bold(true)
        .println('UNPAID INVOICES')
        .bold(false)
        .separator();

      unpaidInvoices
        .sort((a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime())
        .forEach((inv) => {
          builder
            .leftRight(inv.invoice_number, formatDate(inv.invoice_date))
            .leftRight('  Amount:', formatCurrency(inv.original_amount))
            .leftRight('  Paid:', formatCurrency(inv.paid_amount))
            .leftRight('  Balance:', formatCurrency(inv.balance_amount))
            .println(`  Status: ${inv.status} (${inv.days_outstanding || 0} days)`)
            .feed(1);
        });

      builder
        .separator()
        .bold(true)
        .leftRight('TOTAL UNPAID:', formatCurrency(totalOutstandingBalance))
        .bold(false);
    } else {
      builder
        .feed(1)
        .align('center')
        .println('No unpaid invoices')
        .println('Account is fully paid!')
        .align('left');
    }

    // Footer
    builder
      .feed(2)
      .separator()
      .align('center')
      .println('Please settle your account')
      .println('Thank you for your business!')
      .feed(1)
      .println(`Generated: ${formatPhilippineDateTime(new Date())}`)
      .feed(2)
      .cut();

    return builder;
  };

  // Build SOA PDF HTML - focused on unpaid invoices
  const buildSOAPdfHtml = (): string => {
    const getAgingColor = (days: number) => {
      if (days <= 30) return '#4CAF50';
      if (days <= 60) return '#FF9800';
      if (days <= 90) return '#F44336';
      return '#B71C1C';
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #1976D2; padding-bottom: 15px; }
          .company-name { font-size: 24px; font-weight: bold; color: #1976D2; }
          .company-info { font-size: 11px; color: #666; margin-top: 4px; }
          .title { font-size: 22px; font-weight: bold; color: #333; text-align: center; margin: 25px 0; padding: 15px; background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); border-radius: 8px; }
          .customer-box { background: #FAFAFA; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #1976D2; }
          .customer-box h3 { margin: 0 0 12px 0; color: #1976D2; font-size: 16px; }
          .customer-box p { margin: 6px 0; font-size: 13px; }
          .balance-box { background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; border: 2px solid #F44336; }
          .balance-label { font-size: 14px; color: #C62828; font-weight: 600; margin-bottom: 8px; }
          .balance-amount { font-size: 42px; font-weight: bold; color: #D32F2F; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
          .summary-item { background: #F5F5F5; padding: 20px; border-radius: 8px; text-align: center; }
          .summary-item.purchases { border-top: 4px solid #1976D2; }
          .summary-item.payments { border-top: 4px solid #4CAF50; }
          .summary-item.balance { border-top: 4px solid #F44336; background: #FFF3E0; }
          .summary-label { font-size: 11px; color: #666; margin-bottom: 6px; text-transform: uppercase; }
          .summary-value { font-size: 20px; font-weight: bold; }
          .section-title { font-size: 16px; font-weight: bold; color: #333; margin: 25px 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #E0E0E0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #E3F2FD; padding: 12px 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #1976D2; font-size: 11px; }
          td { padding: 10px; border-bottom: 1px solid #EEE; font-size: 12px; }
          tr:nth-child(even) { background: #FAFAFA; }
          .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; color: white; font-weight: 600; }
          .total-row { background: #E3F2FD !important; font-weight: bold; }
          .total-row td { border-top: 2px solid #1976D2; font-size: 14px; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #EEE; }
          .footer-message { font-size: 14px; color: #1976D2; font-weight: 600; margin-bottom: 10px; }
          .footer-date { font-size: 10px; color: #999; }
          .no-invoices { text-align: center; padding: 40px; background: #E8F5E9; border-radius: 8px; color: #2E7D32; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          <div class="company-info">${companySettings.address || ''}</div>
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="title">STATEMENT OF ACCOUNT</div>

        <div class="customer-box">
          <h3>Customer Details</h3>
          <p><strong>Name:</strong> ${selectedCustomer?.name || 'N/A'}</p>
          <p><strong>Code:</strong> ${selectedCustomer?.code || 'N/A'}</p>
          ${selectedCustomer?.phone ? `<p><strong>Phone:</strong> ${selectedCustomer.phone}</p>` : ''}
          ${selectedCustomer?.address ? `<p><strong>Address:</strong> ${selectedCustomer.address}</p>` : ''}
          <p><strong>Statement Date:</strong> ${formatPhilippineDate(new Date())}</p>
        </div>

        <div class="balance-box">
          <div class="balance-label">TOTAL AMOUNT DUE</div>
          <div class="balance-amount">${formatCurrency(totalOutstandingBalance)}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-item purchases">
            <div class="summary-label">Total Credit Purchases</div>
            <div class="summary-value" style="color: #1976D2;">${formatCurrency(totalUnpaidAmount)}</div>
          </div>
          <div class="summary-item payments">
            <div class="summary-label">Total Payments Made</div>
            <div class="summary-value" style="color: #4CAF50;">${formatCurrency(totalPaidOnUnpaid)}</div>
          </div>
          <div class="summary-item balance">
            <div class="summary-label">Outstanding Balance</div>
            <div class="summary-value" style="color: #F44336;">${formatCurrency(totalOutstandingBalance)}</div>
          </div>
        </div>

        ${unpaidInvoices.length > 0 ? `
          <div class="section-title">Unpaid Invoices (${unpaidInvoices.length})</div>
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th>Days</th>
                <th style="text-align: right;">Amount</th>
                <th style="text-align: right;">Paid</th>
                <th style="text-align: right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${unpaidInvoices
                .sort((a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime())
                .map(inv => `
                  <tr>
                    <td><strong>${inv.invoice_number}</strong></td>
                    <td>${formatDate(inv.invoice_date)}</td>
                    <td>${formatDate(inv.due_date)}</td>
                    <td><span class="status-badge" style="background-color: ${getAgingColor(inv.days_outstanding || 0)}">${inv.days_outstanding || 0}d</span></td>
                    <td style="text-align: right;">${formatCurrency(inv.original_amount)}</td>
                    <td style="text-align: right; color: #4CAF50;">${formatCurrency(inv.paid_amount)}</td>
                    <td style="text-align: right; font-weight: bold; color: #D32F2F;">${formatCurrency(inv.balance_amount)}</td>
                  </tr>
                `).join('')}
              <tr class="total-row">
                <td colspan="4"><strong>TOTAL</strong></td>
                <td style="text-align: right;">${formatCurrency(totalUnpaidAmount)}</td>
                <td style="text-align: right; color: #4CAF50;">${formatCurrency(totalPaidOnUnpaid)}</td>
                <td style="text-align: right; color: #D32F2F;">${formatCurrency(totalOutstandingBalance)}</td>
              </tr>
            </tbody>
          </table>
        ` : `
          <div class="no-invoices">
            <p style="font-size: 24px; margin-bottom: 10px;">✓</p>
            <p><strong>No Unpaid Invoices</strong></p>
            <p style="font-size: 12px; margin-top: 8px;">This account is fully paid. Thank you!</p>
          </div>
        `}

        <div class="footer">
          <div class="footer-message">Please settle your account at your earliest convenience. Thank you for your business!</div>
          <div class="footer-date">Generated: ${formatPhilippineDateTime(new Date())}</div>
          <div class="footer-date" style="margin-top: 5px;">This is a computer-generated statement. No signature required.</div>
        </div>
      </body>
      </html>
    `;
  };

  // Render purchase item
  const renderPurchaseItem = ({ item: tx }: { item: Transaction }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemHeader}>
          <View>
            <Text style={styles.invoiceNumber}>{tx.invoice_number}</Text>
            <Text style={styles.dateText}>{formatDate(tx.transaction_date)}</Text>
          </View>
          <View style={styles.amountContainer}>
            <Text style={styles.amountText}>{formatCurrency(tx.total_amount)}</Text>
            <Chip
              compact
              mode="flat"
              style={[styles.statusChip, { backgroundColor: getStatusColors(tx.status).bg }]}
              textStyle={[styles.statusChipText, { color: getStatusColors(tx.status).text }]}
            >
              {tx.status}
            </Chip>
          </View>
        </View>

        {tx.items && tx.items.length > 0 && (
          <View style={styles.itemsContainer}>
            <Divider style={styles.divider} />
            <Text style={styles.itemsHeader}>Items:</Text>
            {tx.items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.quantity}x {item.product_name}</Text>
                <Text style={styles.itemPrice}>{formatCurrency(item.total_amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );

  // Render payment item
  const renderPaymentItem = ({ item: pay }: { item: Payment }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemHeader}>
          <View>
            <Text style={styles.invoiceNumber}>{pay.payment_number || 'Payment'}</Text>
            <Text style={styles.dateText}>{formatDate(pay.payment_date)}</Text>
            {pay.invoice_number && (
              <Text style={styles.forInvoice}>For: {pay.invoice_number}</Text>
            )}
          </View>
          <View style={styles.amountContainer}>
            <Text style={[styles.amountText, { color: '#4CAF50' }]}>
              {formatCurrency(pay.amount_paid)}
            </Text>
            <Chip
              compact
              mode="flat"
              style={[styles.methodChip, { backgroundColor: getPaymentMethodColors(pay.payment_method).bg }]}
              textStyle={[styles.statusChipText, { color: getPaymentMethodColors(pay.payment_method).text }]}
            >
              {pay.payment_method}
            </Chip>
          </View>
        </View>
        {pay.notes && (
          <Text style={styles.notes}>Note: {pay.notes}</Text>
        )}
      </Card.Content>
    </Card>
  );

  // Render SOA (Statement of Account) tab
  const renderSOATab = () => (
    <ScrollView style={[styles.soaContainer, { padding: sp.md }]}>
      {/* Outstanding Balance - Big Display */}
      <Card style={[styles.soaBalanceCard, { backgroundColor: '#FFEBEE' }]}>
        <Card.Content style={styles.soaBalanceContent}>
          <Text style={styles.soaBalanceLabel}>TOTAL AMOUNT DUE</Text>
          <Text style={styles.soaBalanceAmount}>{formatCurrency(totalOutstandingBalance)}</Text>
          <Text style={styles.soaBalanceSubtext}>
            {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length !== 1 ? 's' : ''}
          </Text>
        </Card.Content>
      </Card>

      {/* Summary Cards */}
      <View style={styles.soaSummaryRow}>
        <Card style={[styles.soaSummaryCard, { borderTopColor: '#1976D2' }]}>
          <Card.Content style={styles.soaSummaryContent}>
            <Text style={styles.soaSummaryLabel}>Credit Purchases</Text>
            <Text style={[styles.soaSummaryValue, { color: '#1976D2' }]}>
              {formatCurrency(totalUnpaidAmount)}
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.soaSummaryCard, { borderTopColor: '#4CAF50' }]}>
          <Card.Content style={styles.soaSummaryContent}>
            <Text style={styles.soaSummaryLabel}>Payments Made</Text>
            <Text style={[styles.soaSummaryValue, { color: '#4CAF50' }]}>
              {formatCurrency(totalPaidOnUnpaid)}
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Unpaid Invoices List */}
      <View style={styles.soaSection}>
        <Text style={styles.soaSectionTitle}>Unpaid Invoices</Text>
        {unpaidInvoices.length === 0 ? (
          <Card style={[styles.soaEmptyCard, { backgroundColor: '#E8F5E9' }]}>
            <Card.Content style={styles.soaEmptyContent}>
              <Text style={styles.soaEmptyIcon}>✓</Text>
              <Text style={styles.soaEmptyTitle}>No Unpaid Invoices</Text>
              <Text style={styles.soaEmptyText}>This account is fully paid!</Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            {unpaidInvoices
              .sort((a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime())
              .map((inv) => (
                <Card key={inv.id} style={styles.soaInvoiceCard}>
                  <Card.Content>
                    <View style={styles.soaInvoiceHeader}>
                      <View>
                        <Text style={styles.soaInvoiceNumber}>{inv.invoice_number}</Text>
                        <Text style={styles.soaInvoiceDate}>{formatDate(inv.invoice_date)}</Text>
                      </View>
                      <View style={styles.soaInvoiceAmounts}>
                        <Chip
                          compact
                          mode="flat"
                          style={[
                            styles.soaAgingChip,
                            {
                              backgroundColor:
                                (inv.days_outstanding || 0) <= 30 ? '#E8F5E9' :
                                (inv.days_outstanding || 0) <= 60 ? '#FFF3E0' :
                                (inv.days_outstanding || 0) <= 90 ? '#FFEBEE' : '#FFCDD2'
                            }
                          ]}
                          textStyle={{
                            color:
                              (inv.days_outstanding || 0) <= 30 ? '#2E7D32' :
                              (inv.days_outstanding || 0) <= 60 ? '#E65100' :
                              (inv.days_outstanding || 0) <= 90 ? '#C62828' : '#B71C1C',
                            fontSize: 11,
                            fontWeight: '600'
                          }}
                        >
                          {inv.days_outstanding || 0} days
                        </Chip>
                      </View>
                    </View>
                    <Divider style={styles.soaDivider} />
                    <View style={styles.soaInvoiceDetails}>
                      <View style={styles.soaDetailRow}>
                        <Text style={styles.soaDetailLabel}>Invoice Amount:</Text>
                        <Text style={styles.soaDetailValue}>{formatCurrency(inv.original_amount)}</Text>
                      </View>
                      <View style={styles.soaDetailRow}>
                        <Text style={styles.soaDetailLabel}>Amount Paid:</Text>
                        <Text style={[styles.soaDetailValue, { color: '#4CAF50' }]}>
                          {formatCurrency(inv.paid_amount)}
                        </Text>
                      </View>
                      <View style={styles.soaDetailRow}>
                        <Text style={[styles.soaDetailLabel, { fontWeight: '700' }]}>Balance Due:</Text>
                        <Text style={[styles.soaDetailValue, { color: '#D32F2F', fontWeight: '700', fontSize: 16 }]}>
                          {formatCurrency(inv.balance_amount)}
                        </Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              ))}

            {/* Total Footer */}
            <Card style={[styles.soaTotalCard, { backgroundColor: '#E3F2FD' }]}>
              <Card.Content>
                <View style={styles.soaTotalRow}>
                  <Text style={styles.soaTotalLabel}>TOTAL OUTSTANDING</Text>
                  <Text style={styles.soaTotalValue}>{formatCurrency(totalOutstandingBalance)}</Text>
                </View>
              </Card.Content>
            </Card>
          </>
        )}
      </View>
    </ScrollView>
  );

  // Render summary tab
  const renderSummaryTab = () => (
    <ScrollView style={styles.summaryContainer}>
      {balanceSummary && (
        <>
          {/* Balance Card */}
          <Card style={[styles.summaryCard, { backgroundColor: '#FFEBEE' }]}>
            <Card.Content>
              <Text style={[styles.summaryLabel, { fontSize: fs.caption }]}>Current Outstanding Balance</Text>
              <Text style={[styles.summaryValue, { color: '#D32F2F', fontSize: 32 }]}>
                {formatCurrency(balanceSummary.currentBalance)}
              </Text>
            </Card.Content>
          </Card>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <Card style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
              <Card.Content style={styles.statContent}>
                <Text style={styles.statLabel}>Total Purchases</Text>
                <Text style={[styles.statValue, { color: '#1976D2' }]}>
                  {formatCurrency(balanceSummary.totalPurchases)}
                </Text>
                <Text style={styles.statSubtext}>{balanceSummary.invoiceCount} invoices</Text>
              </Card.Content>
            </Card>
            <Card style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
              <Card.Content style={styles.statContent}>
                <Text style={styles.statLabel}>Total Payments</Text>
                <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                  {formatCurrency(balanceSummary.totalPayments)}
                </Text>
                <Text style={styles.statSubtext}>{payments.length} payments</Text>
              </Card.Content>
            </Card>
          </View>

          {/* Invoice Stats */}
          <View style={styles.statsRow}>
            <Card style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
              <Card.Content style={styles.statContent}>
                <Text style={styles.statLabel}>Paid Invoices</Text>
                <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                  {balanceSummary.paidInvoices}
                </Text>
              </Card.Content>
            </Card>
            <Card style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
              <Card.Content style={styles.statContent}>
                <Text style={styles.statLabel}>Unpaid Invoices</Text>
                <Text style={[styles.statValue, { color: '#FF9800' }]}>
                  {balanceSummary.unpaidInvoices}
                </Text>
              </Card.Content>
            </Card>
          </View>

          {/* Period Summary */}
          <Card style={styles.periodCard}>
            <Card.Content>
              <Text style={styles.periodTitle}>Selected Period Summary</Text>
              <Text style={styles.periodDate}>
                {formatDate(dateRange.startDate.toISOString())} - {formatDate(dateRange.endDate.toISOString())}
              </Text>
              <View style={styles.periodRow}>
                <Text style={styles.periodLabel}>Purchases in period:</Text>
                <Text style={styles.periodValue}>{formatCurrency(totalPurchasesInRange)}</Text>
              </View>
              <View style={styles.periodRow}>
                <Text style={styles.periodLabel}>Payments in period:</Text>
                <Text style={styles.periodValue}>{formatCurrency(totalPaymentsInRange)}</Text>
              </View>
            </Card.Content>
          </Card>
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Customer Search */}
      <View style={[styles.searchContainer, { padding: sp.md }]}>
        <Searchbar
          placeholder="Search customer by name or code..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setShowCustomerList(text.length > 0);
            if (text.length === 0) {
              setSelectedCustomer(null);
            }
          }}
          onFocus={() => setShowCustomerList(searchQuery.length > 0 || customers.length > 0)}
          style={styles.searchbar}
        />
        {showCustomerList && (
          <Surface style={styles.suggestionList}>
            <FlatList
              data={filteredCustomers.slice(0, 10)}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectCustomer(item)}
                >
                  <View>
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    <Text style={styles.suggestionCode}>{item.code}</Text>
                  </View>
                  {item.phone && <Text style={styles.suggestionPhone}>{item.phone}</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noResults}>No customers found</Text>
              }
            />
          </Surface>
        )}
      </View>

      {selectedCustomer ? (
        <>
          {/* Selected Customer Info */}
          <View style={styles.selectedCustomerBanner}>
            <View style={styles.selectedCustomerInfo}>
              <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
              <Text style={styles.selectedCustomerCode}>{selectedCustomer.code}</Text>
            </View>
            <IconButton
              icon="close"
              size={20}
              onPress={() => {
                setSelectedCustomer(null);
                setSearchQuery('');
              }}
            />
          </View>

          {/* Date Range Filter */}
          <DateRangeFilter onDateChange={handleDateChange} />

          {/* Tab Selector */}
          <SegmentedButtons
            value={activeTab}
            onValueChange={setActiveTab}
            buttons={[
              { value: 'soa', label: 'SOA', icon: 'file-document' },
              { value: 'purchases', label: 'Purchases', icon: 'cart' },
              { value: 'payments', label: 'Payments', icon: 'cash' },
              { value: 'summary', label: 'Summary', icon: 'chart-bar' },
            ]}
            style={styles.segmentedButtons}
          />

          {/* Report Actions */}
          <ReportActionsBar
            onBuildPrintData={activeTab === 'soa' ? buildSOAPrintData : buildPrintData}
            onBuildPdfHtml={activeTab === 'soa' ? buildSOAPdfHtml : buildPdfHtml}
            reportTitle={activeTab === 'soa' ? `Statement of Account - ${selectedCustomer.name}` : `Customer Statement - ${selectedCustomer.name}`}
            reportFileName={activeTab === 'soa' ? `SOA_${selectedCustomer.code}_${new Date().toISOString().split('T')[0]}` : `Customer_Statement_${selectedCustomer.code}_${new Date().toISOString().split('T')[0]}`}
            emailBody={activeTab === 'soa'
              ? `Dear ${selectedCustomer.name},\n\nPlease find attached your Statement of Account.\n\nTotal Amount Due: ${formatCurrency(totalOutstandingBalance)}\nUnpaid Invoices: ${unpaidInvoices.length}\n\nPlease settle your account at your earliest convenience.\n\nThank you for your business!\n\n---\nGenerated by IgoroTech POS`
              : `Please find attached the account statement for ${selectedCustomer.name}.\n\nCurrent Balance: ${formatCurrency(balanceSummary?.currentBalance || 0)}\n\nGenerated by IgoroTech POS`}
            disabled={loading || (activeTab === 'soa' ? false : (!transactions.length && !payments.length))}
          />

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading customer data...</Text>
            </View>
          ) : (
            <View style={styles.contentContainer}>
              {activeTab === 'soa' && renderSOATab()}
              {activeTab === 'purchases' && (
                <FlatList
                  data={transactions}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderPurchaseItem}
                  contentContainerStyle={[styles.listContent, { padding: sp.md }]}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No purchases found for this period</Text>
                    </View>
                  }
                  ListHeaderComponent={
                    transactions.length > 0 ? (
                      <View style={styles.listHeader}>
                        <Text style={styles.listHeaderText}>
                          {transactions.length} purchase(s) • Total: {formatCurrency(totalPurchasesInRange)}
                        </Text>
                      </View>
                    ) : null
                  }
                />
              )}
              {activeTab === 'payments' && (
                <FlatList
                  data={payments}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderPaymentItem}
                  contentContainerStyle={[styles.listContent, { padding: sp.md }]}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No payments found for this period</Text>
                    </View>
                  }
                  ListHeaderComponent={
                    payments.length > 0 ? (
                      <View style={styles.listHeader}>
                        <Text style={styles.listHeaderText}>
                          {payments.length} payment(s) • Total: {formatCurrency(totalPaymentsInRange)}
                        </Text>
                      </View>
                    ) : null
                  }
                />
              )}
              {activeTab === 'summary' && renderSummaryTab()}
            </View>
          )}
        </>
      ) : (
        <View style={styles.noCustomerContainer}>
          <Text style={styles.noCustomerTitle}>Select a Customer</Text>
          <Text style={styles.noCustomerText}>
            Search and select a customer above to view their account statement,
            purchase history, and payment records.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    zIndex: 100,
  },
  searchbar: {
    elevation: 0,
    backgroundColor: '#F5F5F5',
  },
  suggestionList: {
    position: 'absolute',
    top: 64,
    left: 12,
    right: 12,
    maxHeight: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 4,
    zIndex: 101,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  suggestionCode: {
    fontSize: 12,
    color: '#757575',
  },
  suggestionPhone: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  noResults: {
    padding: 16,
    textAlign: 'center',
    color: '#757575',
  },
  selectedCustomerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectedCustomerInfo: {
    flex: 1,
  },
  selectedCustomerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
  },
  selectedCustomerCode: {
    fontSize: 12,
    color: '#1976D2',
  },
  segmentedButtons: {
    marginHorizontal: 12,
    marginVertical: 8,
  },
  contentContainer: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  listHeader: {
    backgroundColor: '#FAFAFA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  listHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
    textAlign: 'center',
  },
  itemCard: {
    marginBottom: 10,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 50,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212121',
  },
  dateText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  forInvoice: {
    fontSize: 11,
    color: '#1976D2',
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1976D2',
  },
  statusChip: {
    marginTop: 6,
  },
  methodChip: {
    marginTop: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemsContainer: {
    marginTop: 10,
  },
  divider: {
    marginBottom: 8,
  },
  itemsHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  itemName: {
    fontSize: 13,
    color: '#424242',
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    color: '#616161',
    marginLeft: 8,
  },
  notes: {
    fontSize: 11,
    color: '#9E9E9E',
    fontStyle: 'italic',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#757575',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  noCustomerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noCustomerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#424242',
    marginBottom: 12,
  },
  noCustomerText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 22,
  },
  summaryContainer: {
    flex: 1,
    padding: 12,
  },
  summaryCard: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  statsRow: {
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
    fontSize: 11,
    color: '#616161',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 10,
    color: '#9E9E9E',
    marginTop: 2,
  },
  periodCard: {
    marginTop: 8,
  },
  periodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 4,
  },
  periodDate: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 12,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  periodLabel: {
    fontSize: 13,
    color: '#616161',
  },
  periodValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
  },
  // SOA (Statement of Account) Styles
  soaContainer: {
    flex: 1,
    padding: 12,
  },
  soaBalanceCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  soaBalanceContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  soaBalanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C62828',
    marginBottom: 8,
  },
  soaBalanceAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: '#D32F2F',
  },
  soaBalanceSubtext: {
    fontSize: 13,
    color: '#757575',
    marginTop: 8,
  },
  soaSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  soaSummaryCard: {
    flex: 1,
    borderTopWidth: 4,
  },
  soaSummaryContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  soaSummaryLabel: {
    fontSize: 11,
    color: '#616161',
    marginBottom: 6,
  },
  soaSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  soaSection: {
    marginTop: 8,
  },
  soaSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#424242',
    marginBottom: 12,
  },
  soaEmptyCard: {
    borderRadius: 12,
  },
  soaEmptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  soaEmptyIcon: {
    fontSize: 40,
    color: '#4CAF50',
    marginBottom: 12,
  },
  soaEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 4,
  },
  soaEmptyText: {
    fontSize: 13,
    color: '#4CAF50',
  },
  soaInvoiceCard: {
    marginBottom: 10,
    elevation: 2,
  },
  soaInvoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  soaInvoiceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  soaInvoiceDate: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  soaInvoiceAmounts: {
    alignItems: 'flex-end',
  },
  soaAgingChip: {
    height: 24,
  },
  soaDivider: {
    marginVertical: 10,
  },
  soaInvoiceDetails: {
    gap: 6,
  },
  soaDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  soaDetailLabel: {
    fontSize: 13,
    color: '#616161',
  },
  soaDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  soaTotalCard: {
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 8,
  },
  soaTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soaTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1565C0',
  },
  soaTotalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#D32F2F',
  },
});
