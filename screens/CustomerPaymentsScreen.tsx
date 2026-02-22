import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  TouchableOpacity,
  Text,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  useTheme,
  Chip,
  DataTable,
  Searchbar,
  Modal,
  Portal,
  Divider,
  Checkbox,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { Picker } from '@react-native-picker/picker';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import PaymentReceiptPreview, { PaymentReceiptData } from '../components/PaymentReceiptPreview';
import * as Print from 'expo-print';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import { buildPaymentReceipt, PRINTER_WIDTH, ESCPOSBuilder } from '../utils/escpos';
import ReportActionsBar from '../components/ReportActionsBar';
import { useResponsiveTheme } from '../utils/responsive';

type CustomerPaymentsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CustomerPayments'
>;

type Props = {
  navigation: CustomerPaymentsScreenNavigationProp;
};

export default function CustomerPaymentsScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'receivables' | 'payments'>('receivables');
  const [receivables, setReceivables] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>('UNPAID'); // Default to Unpaid tab

  // Date filter
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  // Multi-invoice selection state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());

  // Payment modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'CHECK' | 'BANK_TRANSFER' | 'ONLINE'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Receipt preview state
  const [receiptPreviewVisible, setReceiptPreviewVisible] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Company settings for reports
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const { user } = useAuth();
  const printerService = BluetoothPrinterService.getInstance();

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

  // Filter payments when date range or search query changes
  useEffect(() => {
    let filtered = payments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      return paymentDate >= dateRange.startDate && paymentDate <= dateRange.endDate;
    });

    // Also apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.customer_name?.toLowerCase().includes(query) ||
        payment.payment_number?.toLowerCase().includes(query) ||
        payment.invoice_number?.toLowerCase().includes(query)
      );
    }

    setFilteredPayments(filtered);
  }, [payments, dateRange, searchQuery]);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const [receivablesData, paymentsData, customersData] = await Promise.all([
        dbService.getAccountsReceivable(),
        dbService.getCustomerPayments(),
        dbService.getCustomers()
      ]);

      setReceivables(receivablesData);
      setPayments(paymentsData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customer payments data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const [receivablesData, paymentsData] = await Promise.all([
        dbService.getAccountsReceivable(selectedCustomer || undefined),
        dbService.getCustomerPayments(selectedCustomer || undefined)
      ]);

      setReceivables(receivablesData);
      setPayments(paymentsData);
    } catch (error) {
      console.error('Error loading filtered data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter receivables based on status and search
  const filteredReceivables = useMemo(() => {
    return receivables.filter(receivable => {
      // Status filter
      if (statusFilter === 'UNPAID') {
        if (receivable.status !== 'OUTSTANDING' && receivable.status !== 'OVERDUE' && receivable.status !== 'PARTIALLY_PAID') return false;
      } else if (statusFilter === 'PAID') {
        if (receivable.status !== 'PAID') return false;
      } else if (statusFilter) {
        if (receivable.status !== statusFilter) return false;
      }

      // Search filter
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        receivable.customer_name?.toLowerCase().includes(query) ||
        receivable.invoice_number?.toLowerCase().includes(query) ||
        receivable.customer_code?.toLowerCase().includes(query)
      );
    });
  }, [receivables, statusFilter, searchQuery]);

  // Calculate customer summary when customer is selected
  const customerSummary = useMemo(() => {
    if (!selectedCustomer) return null;

    const customerReceivables = receivables.filter(r =>
      r.customer_id === selectedCustomer &&
      r.status !== 'PAID'
    );

    const totalOutstanding = customerReceivables.reduce((sum, r) => sum + (r.balance_amount || 0), 0);
    const invoiceCount = customerReceivables.length;

    return {
      customerName: selectedCustomerName,
      totalOutstanding,
      invoiceCount
    };
  }, [selectedCustomer, selectedCustomerName, receivables]);

  // Calculate selected invoices total
  const selectedInvoicesTotal = useMemo(() => {
    let total = 0;
    let invoices: any[] = [];

    filteredReceivables.forEach(r => {
      if (selectedInvoiceIds.has(r.id) && r.status !== 'PAID') {
        total += r.balance_amount || 0;
        invoices.push(r);
      }
    });

    return { total, invoices, count: invoices.length };
  }, [selectedInvoiceIds, filteredReceivables]);

  // Toggle invoice selection
  const toggleInvoiceSelection = (invoiceId: number) => {
    setSelectedInvoiceIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  // Select/deselect all unpaid invoices
  const toggleSelectAll = () => {
    const unpaidInvoices = filteredReceivables.filter(r => r.status !== 'PAID');
    if (selectedInvoiceIds.size === unpaidInvoices.length) {
      // Deselect all
      setSelectedInvoiceIds(new Set());
    } else {
      // Select all unpaid
      setSelectedInvoiceIds(new Set(unpaidInvoices.map(r => r.id)));
    }
  };

  // Calculate FIFO payment distribution preview
  const calculatePaymentDistribution = (paymentAmt: number) => {
    const distributions: Array<{ invoice: any; amount: number; newBalance: number; status: string }> = [];
    let remaining = paymentAmt;

    // Sort by transaction_id (FIFO - older first)
    const sortedInvoices = [...selectedInvoicesTotal.invoices].sort((a, b) => a.transaction_id - b.transaction_id);

    for (const invoice of sortedInvoices) {
      if (remaining <= 0) break;

      const amountToApply = Math.min(remaining, invoice.balance_amount);
      remaining -= amountToApply;
      const newBalance = invoice.balance_amount - amountToApply;

      distributions.push({
        invoice,
        amount: amountToApply,
        newBalance,
        status: newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID'
      });
    }

    return distributions;
  };

  // Handle payment for single invoice (legacy)
  const handlePayment = (receivable: any) => {
    setSelectedInvoiceIds(new Set([receivable.id]));
    setSelectedReceivable(receivable);
    setPaymentAmount(receivable.balance_amount.toString());
    setPaymentMethod('CASH');
    setReferenceNumber('');
    setPaymentNotes('');
    setPaymentModalVisible(true);
  };

  // Handle payment for multiple selected invoices
  const handleMultiPayment = () => {
    if (selectedInvoicesTotal.count === 0) {
      Alert.alert('No Selection', 'Please select at least one invoice to collect payment.');
      return;
    }
    setSelectedReceivable(null); // Clear single selection
    setPaymentAmount(selectedInvoicesTotal.total.toString());
    setPaymentMethod('CASH');
    setReferenceNumber('');
    setPaymentNotes('');
    setPaymentModalVisible(true);
  };

  const processPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    const amount = parseFloat(paymentAmount);

    // Check if multi-invoice or single invoice payment
    const isMultiInvoice = selectedInvoicesTotal.count > 1 || (!selectedReceivable && selectedInvoicesTotal.count === 1);

    if (isMultiInvoice) {
      // Multi-invoice payment
      if (amount > selectedInvoicesTotal.total) {
        Alert.alert('Error', 'Payment amount cannot exceed total outstanding balance');
        return;
      }

      try {
        setLoading(true);
        const dbService = getDatabase();

        // Prepare invoices for multi-payment
        const invoicesToPay = selectedInvoicesTotal.invoices
          .sort((a: any, b: any) => a.transaction_id - b.transaction_id) // FIFO
          .map((inv: any) => ({
            transaction_id: inv.transaction_id,
            invoice_number: inv.invoice_number,
            balance_amount: inv.balance_amount
          }));

        const firstInvoice = selectedInvoicesTotal.invoices[0];

        const result = await dbService.processMultiInvoicePayment({
          customer_id: firstInvoice?.customer_id,
          customer_name: firstInvoice?.customer_name,
          invoices: invoicesToPay,
          total_payment: amount,
          payment_method: paymentMethod,
          reference_number: referenceNumber || undefined,
          notes: paymentNotes || undefined,
          received_by: user!.id
        });

        // Show success message with distribution summary
        const distributionSummary = result.distributions
          .map(d => `${d.invoice_number}: ₱${d.amount.toFixed(2)} → ${d.status}`)
          .join('\n');

        Alert.alert(
          'Payment Successful',
          `${result.paymentIds.length} payment(s) processed:\n\n${distributionSummary}`,
          [{ text: 'OK' }]
        );

        setPaymentModalVisible(false);
        setSelectedInvoiceIds(new Set());
        await loadData();
      } catch (error) {
        console.error('Error processing multi-invoice payment:', error);
        Alert.alert('Error', 'Failed to process payment');
      } finally {
        setLoading(false);
      }
    } else if (selectedReceivable) {
      // Single invoice payment (legacy flow)
      if (amount > selectedReceivable.balance_amount) {
        Alert.alert('Error', 'Payment amount cannot exceed the outstanding balance');
        return;
      }

      try {
        setLoading(true);
        const dbService = getDatabase();

        const paymentResult = await dbService.processCustomerPayment({
          customer_id: selectedReceivable.customer_id,
          transaction_id: selectedReceivable.transaction_id,
          payment_method: paymentMethod,
          amount_paid: amount,
          reference_number: referenceNumber || undefined,
          notes: paymentNotes || undefined,
          received_by: user!.id
        });

        // Get business settings for receipt
        const companyName = await dbService.getSetting('company_name') || 'Your Company';
        const companyAddress = await dbService.getSetting('company_address') || '';
        const companyTin = await dbService.getSetting('company_tin') || '';
        const receiptFooter = await dbService.getSetting('receipt_footer') || '';

        // Prepare receipt data
        const previouslyPaid = selectedReceivable.paid_amount || 0;
        const balanceAfterPayment = selectedReceivable.balance_amount - amount;

        const newReceiptData: PaymentReceiptData = {
          businessName: companyName,
          businessAddress: companyAddress,
          tin: companyTin,
          paymentNumber: paymentResult?.payment_number || `PAY${Date.now()}`,
          paymentDate: new Date(),
          receivedBy: user?.username || 'Cashier',
          customerName: selectedReceivable.customer_name || 'Walk-in Customer',
          customerCode: selectedReceivable.customer_code,
          invoiceNumber: selectedReceivable.invoice_number,
          originalAmount: selectedReceivable.original_amount,
          previouslyPaid: previouslyPaid,
          amountPaid: amount,
          balanceAfterPayment: balanceAfterPayment,
          paymentMethod: paymentMethod,
          referenceNumber: referenceNumber || undefined,
          notes: paymentNotes || undefined,
          footerText: receiptFooter,
        };

        setReceiptData(newReceiptData);
        setPaymentModalVisible(false);
        setSelectedInvoiceIds(new Set());
        setReceiptPreviewVisible(true);
        await loadData();
      } catch (error) {
        console.error('Error processing payment:', error);
        Alert.alert('Error', 'Failed to process payment');
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePrintReceipt = async () => {
    if (!receiptData) return;

    try {
      setIsPrinting(true);

      if (printerService.isConnected()) {
        // Bluetooth thermal printer
        const printerWidth = printerService.getSettings().printerWidth;
        const receiptBuilder = buildPaymentReceipt({
          businessName: receiptData.businessName,
          businessAddress: receiptData.businessAddress,
          tin: receiptData.tin,
          paymentNumber: receiptData.paymentNumber,
          paymentDate: receiptData.paymentDate,
          receivedBy: receiptData.receivedBy,
          customerName: receiptData.customerName,
          customerCode: receiptData.customerCode,
          invoiceNumber: receiptData.invoiceNumber,
          originalAmount: receiptData.originalAmount,
          previouslyPaid: receiptData.previouslyPaid,
          amountPaid: receiptData.amountPaid,
          balanceAfterPayment: receiptData.balanceAfterPayment,
          paymentMethod: receiptData.paymentMethod,
          referenceNumber: receiptData.referenceNumber,
          notes: receiptData.notes,
          footerText: receiptData.footerText,
        }, printerWidth);
        await printerService.print(receiptBuilder);
        Alert.alert('Success', 'Receipt printed successfully');
      } else {
        // Fallback: system print dialog
        const d = receiptData;
        const html = `
          <html><head><meta charset="utf-8"/><style>
            body{font-family:monospace;font-size:12px;padding:20px;max-width:400px;margin:auto;}
            h2,h3{text-align:center;margin:4px 0;}
            .row{display:flex;justify-content:space-between;padding:2px 0;}
            .center{text-align:center;} .right{text-align:right;}
            hr{border:none;border-top:1px dashed #333;margin:8px 0;}
          </style></head><body>
            <h2>${d.businessName}</h2>
            ${d.businessAddress ? `<p class="center">${d.businessAddress}</p>` : ''}
            ${d.tin ? `<p class="center">TIN: ${d.tin}</p>` : ''}
            <h3>PAYMENT RECEIPT</h3>
            <hr/>
            <div class="row"><span>Payment #:</span><span>${d.paymentNumber}</span></div>
            <div class="row"><span>Date:</span><span>${d.paymentDate.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span></div>
            <div class="row"><span>Customer:</span><span>${d.customerName}${d.customerCode ? ` (${d.customerCode})` : ''}</span></div>
            <div class="row"><span>Invoice:</span><span>${d.invoiceNumber}</span></div>
            <hr/>
            <div class="row"><span>Invoice Amount:</span><span>₱${d.originalAmount.toFixed(2)}</span></div>
            <div class="row"><span>Previously Paid:</span><span>₱${d.previouslyPaid.toFixed(2)}</span></div>
            <div class="row"><strong>AMOUNT PAID:</strong><strong>₱${d.amountPaid.toFixed(2)}</strong></div>
            <div class="row"><span>Balance:</span><span>₱${d.balanceAfterPayment.toFixed(2)}</span></div>
            <hr/>
            <div class="row"><span>Method:</span><span>${d.paymentMethod}</span></div>
            ${d.referenceNumber ? `<div class="row"><span>Ref #:</span><span>${d.referenceNumber}</span></div>` : ''}
            ${d.notes ? `<div class="row"><span>Notes:</span><span>${d.notes}</span></div>` : ''}
            <p class="center">Received by: ${d.receivedBy}</p>
          </body></html>
        `;
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', 'Failed to print receipt. Please check printer connection.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendEmail = async (email: string) => {
    if (!receiptData) return;

    try {
      setIsSendingEmail(true);

      // For now, we'll just simulate sending email
      // In a real app, you would call an API endpoint to send the email
      // with the receipt data

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Log for debugging
      console.log('Sending payment receipt to:', email);
      console.log('Receipt data:', receiptData);

      // In a real implementation, you would:
      // const response = await fetch('your-api/send-receipt-email', {
      //   method: 'POST',
      //   body: JSON.stringify({ email, receiptData }),
      // });

    } catch (error) {
      console.error('Email error:', error);
      throw error;
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCloseReceipt = () => {
    setReceiptPreviewVisible(false);
    setReceiptData(null);
  };

  // Format currency helper
  const formatCurrency = (amount: number) => `₱${(amount || 0).toFixed(2)}`;

  // ASCII-safe helpers for thermal printer output (₱ causes Chinese chars on ESC/POS printers)
  const printCurrency = (amount: number) => `P${(amount || 0).toFixed(2)}`;
  const printDate = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const y = date.getFullYear();
    return `${m}/${day}/${y}`;
  };
  const printDateTime = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    const h = date.getHours();
    const min = String(date.getMinutes()).padStart(2, '0');
    const sec = String(date.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${printDate(date)} ${h12}:${min}:${sec} ${ampm}`;
  };

  // Build print report for Payments list
  const buildPaymentsPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('CUSTOMER PAYMENTS')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .doubleSeparator()
      .align('left');

    // Date range
    builder
      .leftRight('From:', printDate(dateRange.startDate))
      .leftRight('To:', printDate(dateRange.endDate))
      .separator();

    // Summary
    const totalPayments = filteredPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    builder
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .leftRight('Total Payments:', filteredPayments.length.toString())
      .leftRight('Total Amount:', printCurrency(totalPayments))
      .separator();

    // Payment list sorted by customer name
    if (filteredPayments.length > 0) {
      builder
        .bold(true)
        .println('PAYMENT DETAILS')
        .bold(false)
        .separator();

      filteredPayments
        .sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''))
        .forEach((payment) => {
          builder
            .println(payment.customer_name || 'Walk-in')
            .leftRight(`  ${payment.payment_number}`, printCurrency(payment.amount_paid))
            .leftRight(`  ${payment.payment_method}`, printDate(payment.payment_date));
        });
    }

    builder
      .feed()
      .separator()
      .align('center')
      .println('Report Generated:')
      .println(printDateTime(new Date()))
      .feed(2)
      .cut();

    return builder;
  };

  // Build PDF HTML for Payments list
  const buildPaymentsPdfHtml = (): string => {
    const startDateStr = dateRange.startDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    const endDateStr = dateRange.endDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    const totalPayments = filteredPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

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
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #4CAF50; }
          .date-range { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          .summary-box { display: flex; justify-content: space-around; background: #E8F5E9; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 11px; color: #666; }
          .summary-value { font-size: 24px; font-weight: bold; color: #4CAF50; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { background-color: #f5f5f5; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .method-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; color: white; }
          .method-CASH { background-color: #4CAF50; }
          .method-CARD { background-color: #2196F3; }
          .method-CHECK { background-color: #FF9800; }
          .method-BANK_TRANSFER { background-color: #9C27B0; }
          .method-ONLINE { background-color: #607D8B; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name || 'IgoroTech POS'}</div>
          ${companySettings.address ? `<div class="header-text">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="header-text">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="report-title">CUSTOMER PAYMENTS REPORT</div>
        <div class="date-range">Period: ${startDateStr} to ${endDateStr}</div>

        <div class="summary-box">
          <div class="summary-item">
            <div class="summary-label">Total Payments</div>
            <div class="summary-value">${filteredPayments.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Amount</div>
            <div class="summary-value">${formatCurrency(totalPayments)}</div>
          </div>
        </div>

        ${filteredPayments.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Payment #</th>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Date</th>
                <th>Method</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPayments
                .sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''))
                .map(payment => `
                  <tr>
                    <td>${payment.payment_number}</td>
                    <td>${payment.customer_name || 'Walk-in'}</td>
                    <td>${payment.invoice_number}</td>
                    <td>${new Date(payment.payment_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                    <td><span class="method-badge method-${payment.payment_method}">${payment.payment_method}</span></td>
                    <td style="text-align: right; font-weight: bold;">${formatCurrency(payment.amount_paid)}</td>
                  </tr>
                `).join('')}
              <tr style="background-color: #E8F5E9; font-weight: bold;">
                <td colspan="5">TOTAL</td>
                <td style="text-align: right;">${formatCurrency(totalPayments)}</td>
              </tr>
            </tbody>
          </table>
        ` : '<p style="text-align: center; color: #999;">No payments found for the selected period</p>'}

        <div class="footer">
          <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Customer Payments Report</p>
        </div>
      </body>
      </html>
    `;
  };

  // Build print report for Receivables/Invoices list
  const buildReceivablesPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('CUSTOMER INVOICES')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .doubleSeparator()
      .align('left');

    // Filter info
    const filterLabel = statusFilter === 'UNPAID' ? 'Unpaid' :
                        statusFilter === 'PAID' ? 'Paid' :
                        statusFilter === 'OVERDUE' ? 'Overdue' : 'All';
    builder
      .leftRight('Status Filter:', filterLabel)
      .separator();

    // Summary
    const totalOriginal = filteredReceivables.reduce((sum, r) => sum + (r.original_amount || 0), 0);
    const totalPaid = filteredReceivables.reduce((sum, r) => sum + (r.paid_amount || 0), 0);
    const totalBalance = filteredReceivables.reduce((sum, r) => sum + (r.balance_amount || 0), 0);

    builder
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .leftRight('Total Invoices:', filteredReceivables.length.toString())
      .leftRight('Total Amount:', printCurrency(totalOriginal))
      .leftRight('Total Paid:', printCurrency(totalPaid))
      .leftRight('Total Balance:', printCurrency(totalBalance))
      .separator();

    // Invoice list sorted by customer name
    if (filteredReceivables.length > 0) {
      builder
        .bold(true)
        .println('INVOICE DETAILS')
        .bold(false)
        .separator();

      filteredReceivables
        .sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''))
        .forEach((inv) => {
          builder
            .println(inv.customer_name || 'Walk-in')
            .leftRight(`  ${inv.invoice_number}`, printCurrency(inv.original_amount))
            .leftRight(`  Balance:`, printCurrency(inv.balance_amount))
            .leftRight(`  Status:`, inv.status);
        });
    }

    builder
      .feed()
      .separator()
      .align('center')
      .println('Report Generated:')
      .println(printDateTime(new Date()))
      .feed(2)
      .cut();

    return builder;
  };

  // Build PDF HTML for Receivables/Invoices list
  const buildReceivablesPdfHtml = (): string => {
    const filterLabel = statusFilter === 'UNPAID' ? 'Unpaid' :
                        statusFilter === 'PAID' ? 'Paid' :
                        statusFilter === 'OVERDUE' ? 'Overdue' : 'All';
    const totalOriginal = filteredReceivables.reduce((sum, r) => sum + (r.original_amount || 0), 0);
    const totalPaid = filteredReceivables.reduce((sum, r) => sum + (r.paid_amount || 0), 0);
    const totalBalance = filteredReceivables.reduce((sum, r) => sum + (r.balance_amount || 0), 0);

    const getStatusBgColor = (status: string) => {
      switch (status) {
        case 'OUTSTANDING': return '#F44336';
        case 'PARTIALLY_PAID': return '#FF9800';
        case 'PAID': return '#4CAF50';
        case 'OVERDUE': return '#D32F2F';
        default: return '#9E9E9E';
      }
    };

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
          .filter-info { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          .summary-box { display: flex; justify-content: space-around; background: #E3F2FD; padding: 16px; border-radius: 8px; margin-bottom: 16px; flex-wrap: wrap; }
          .summary-item { text-align: center; min-width: 100px; margin: 4px; }
          .summary-label { font-size: 11px; color: #666; }
          .summary-value { font-size: 18px; font-weight: bold; color: #2196F3; }
          .summary-value.balance { color: #F44336; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { background-color: #f5f5f5; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .status-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; color: white; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name || 'IgoroTech POS'}</div>
          ${companySettings.address ? `<div class="header-text">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="header-text">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="report-title">CUSTOMER INVOICES REPORT</div>
        <div class="filter-info">Status Filter: ${filterLabel}</div>

        <div class="summary-box">
          <div class="summary-item">
            <div class="summary-label">Total Invoices</div>
            <div class="summary-value">${filteredReceivables.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Amount</div>
            <div class="summary-value">${formatCurrency(totalOriginal)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Paid</div>
            <div class="summary-value" style="color: #4CAF50;">${formatCurrency(totalPaid)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Balance</div>
            <div class="summary-value balance">${formatCurrency(totalBalance)}</div>
          </div>
        </div>

        ${filteredReceivables.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style="text-align: right;">Amount</th>
                <th style="text-align: right;">Paid</th>
                <th style="text-align: right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReceivables
                .sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''))
                .map(inv => `
                  <tr>
                    <td>${inv.invoice_number}</td>
                    <td>${inv.customer_name || 'Walk-in'}</td>
                    <td>${new Date(inv.invoice_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                    <td>${new Date(inv.due_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                    <td><span class="status-badge" style="background-color: ${getStatusBgColor(inv.status)}">${inv.status}</span></td>
                    <td style="text-align: right;">${formatCurrency(inv.original_amount)}</td>
                    <td style="text-align: right; color: #4CAF50;">${formatCurrency(inv.paid_amount)}</td>
                    <td style="text-align: right; font-weight: bold; color: #F44336;">${formatCurrency(inv.balance_amount)}</td>
                  </tr>
                `).join('')}
              <tr style="background-color: #E3F2FD; font-weight: bold;">
                <td colspan="5">TOTAL</td>
                <td style="text-align: right;">${formatCurrency(totalOriginal)}</td>
                <td style="text-align: right; color: #4CAF50;">${formatCurrency(totalPaid)}</td>
                <td style="text-align: right; color: #F44336;">${formatCurrency(totalBalance)}</td>
              </tr>
            </tbody>
          </table>
        ` : '<p style="text-align: center; color: #999;">No invoices found</p>'}

        <div class="footer">
          <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Customer Invoices Report</p>
        </div>
      </body>
      </html>
    `;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OUTSTANDING': return '#F44336';
      case 'PARTIALLY_PAID': return '#FF9800';
      case 'PAID': return '#4CAF50';
      case 'OVERDUE': return '#D32F2F';
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
      default: return '#9E9E9E';
    }
  };

  // Moved to useMemo before other computations that depend on it

  const renderReceivable = ({ item }: { item: any }) => {
    const isSelected = selectedInvoiceIds.has(item.id);
    const isPaid = item.status === 'PAID';

    return (
      <Card style={[styles.card, isSelected && styles.cardSelected]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            {/* Checkbox for unpaid invoices */}
            {!isPaid && (
              <TouchableOpacity
                onPress={() => toggleInvoiceSelection(item.id)}
                style={styles.checkboxContainer}
              >
                <Checkbox
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => toggleInvoiceSelection(item.id)}
                  color="#4CAF50"
                />
              </TouchableOpacity>
            )}

            <View style={[styles.receivableInfo, !isPaid && { marginLeft: 8 }]}>
              <Paragraph style={styles.customerName}>{item.customer_name || 'Walk-in Customer'}</Paragraph>
              <Paragraph style={styles.customerCode}>{item.customer_code}</Paragraph>
              <Paragraph style={styles.invoiceNumber}>Invoice: {item.invoice_number}</Paragraph>
              <Paragraph style={styles.dates}>
                Due: {new Date(item.due_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
              </Paragraph>
              <Paragraph style={styles.dates}>
                Issued: {new Date(item.invoice_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
              </Paragraph>
            </View>
            <View style={styles.receivableStats}>
              <Chip
                style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
                textStyle={{ color: 'white', fontSize: 10 }}
                compact
              >
                {item.status}
              </Chip>
              <Paragraph style={styles.originalAmount}>
                ₱{item.original_amount?.toFixed(2)}
              </Paragraph>
              <Paragraph style={styles.paidAmount}>
                Paid: ₱{item.paid_amount?.toFixed(2)}
              </Paragraph>
              <Paragraph style={[styles.balanceAmount, { color: getStatusColor(item.status) }]}>
                Balance: ₱{item.balance_amount?.toFixed(2)}
              </Paragraph>
            </View>
          </View>

          {!isPaid && !isSelected && (
            <Button
              mode="contained"
              onPress={() => handlePayment(item)}
              style={styles.payButton}
              compact
            >
              Collect Payment
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderPayment = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.paymentInfo}>
            <Paragraph style={styles.paymentNumber}>Payment: {item.payment_number}</Paragraph>
            <Paragraph style={styles.customerName}>{item.customer_name || 'Walk-in Customer'}</Paragraph>
            <Paragraph style={styles.invoiceNumber}>Invoice: {item.invoice_number}</Paragraph>
            <Paragraph style={styles.dates}>
              Paid: {new Date(item.payment_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
            </Paragraph>
            <Paragraph style={styles.receivedBy}>By: {item.received_by_name}</Paragraph>
          </View>
          <View style={styles.paymentStats}>
            <Chip
              style={[styles.methodChip, { backgroundColor: getPaymentMethodColor(item.payment_method) }]}
              textStyle={{ color: 'white', fontSize: 10 }}
              compact
            >
              {item.payment_method}
            </Chip>
            <Paragraph style={styles.paymentAmount}>
              ₱{item.amount_paid?.toFixed(2)}
            </Paragraph>
          </View>
        </View>

        {item.reference_number && (
          <Paragraph style={styles.referenceNumber}>
            Ref: {item.reference_number}
          </Paragraph>
        )}

        {item.notes && (
          <Paragraph style={styles.notes}>{item.notes}</Paragraph>
        )}
      </Card.Content>
    </Card>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'receivables':
        const unpaidCount = filteredReceivables.filter(r => r.status !== 'PAID').length;
        const allUnpaidSelected = unpaidCount > 0 && selectedInvoiceIds.size === unpaidCount;

        return (
          <View style={styles.tabContent}>
            {/* Customer Summary Card - shown when customer is selected */}
            {customerSummary && (
              <Card style={styles.customerSummaryCard}>
                <Card.Content style={styles.customerSummaryContent}>
                  <View style={styles.customerSummaryLeft}>
                    <Text style={styles.customerSummaryIcon}>👤</Text>
                    <View>
                      <Text style={styles.customerSummaryName}>{customerSummary.customerName}</Text>
                      <Text style={styles.customerSummaryInvoices}>{customerSummary.invoiceCount} unpaid invoice{customerSummary.invoiceCount !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <View style={styles.customerSummaryRight}>
                    <Text style={styles.customerSummaryLabel}>Total Outstanding</Text>
                    <Text style={styles.customerSummaryTotal}>{formatCurrency(customerSummary.totalOutstanding)}</Text>
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Report Actions: Print, PDF, Email */}
            <View style={styles.reportActionsContainer}>
              <ReportActionsBar
                onBuildPrintData={buildReceivablesPrintReport}
                onBuildPdfHtml={buildReceivablesPdfHtml}
                reportTitle="Customer Invoices Report"
                reportFileName={`Customer_Invoices_${new Date().toISOString().split('T')[0]}`}
                emailBody={`Please find attached the Customer Invoices Report.\n\nTotal Invoices: ${filteredReceivables.length}\nTotal Balance: ${formatCurrency(filteredReceivables.reduce((sum, r) => sum + (r.balance_amount || 0), 0))}\n\n---\nGenerated by IgoroTech POS`}
                disabled={loading || filteredReceivables.length === 0}
              />
            </View>
            {/* Status Filter */}
            <View style={styles.statusFilterContainer}>
              <Chip
                selected={statusFilter === null}
                onPress={() => setStatusFilter(null)}
                style={styles.statusChipFilter}
                compact
              >
                All
              </Chip>
              <Chip
                selected={statusFilter === 'UNPAID'}
                onPress={() => setStatusFilter('UNPAID')}
                style={styles.statusChipFilter}
                compact
              >
                Unpaid
              </Chip>
              <Chip
                selected={statusFilter === 'PAID'}
                onPress={() => setStatusFilter('PAID')}
                style={styles.statusChipFilter}
                compact
              >
                Paid
              </Chip>
              <Chip
                selected={statusFilter === 'OVERDUE'}
                onPress={() => setStatusFilter('OVERDUE')}
                style={styles.statusChipFilter}
                compact
              >
                Overdue
              </Chip>
            </View>

            {/* Select All and Selection Summary */}
            {unpaidCount > 0 && statusFilter !== 'PAID' && (
              <View style={styles.selectionContainer}>
                <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllRow}>
                  <Checkbox
                    status={allUnpaidSelected ? 'checked' : selectedInvoiceIds.size > 0 ? 'indeterminate' : 'unchecked'}
                    onPress={toggleSelectAll}
                    color="#4CAF50"
                  />
                  <Text style={styles.selectAllText}>
                    {allUnpaidSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>

                {selectedInvoicesTotal.count > 0 && (
                  <View style={styles.selectionSummary}>
                    <Text style={styles.selectionSummaryText}>
                      Selected: {selectedInvoicesTotal.count} invoice{selectedInvoicesTotal.count !== 1 ? 's' : ''} = {formatCurrency(selectedInvoicesTotal.total)}
                    </Text>
                    <Button
                      mode="contained"
                      onPress={handleMultiPayment}
                      style={styles.collectSelectedBtn}
                      labelStyle={styles.collectSelectedBtnLabel}
                      compact
                    >
                      Collect Payment
                    </Button>
                  </View>
                )}
              </View>
            )}

            <Searchbar
              placeholder="Search receivables..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />
            <FlatList
              data={filteredReceivables}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderReceivable}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={loadData}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Paragraph style={styles.emptyText}>
                    No outstanding receivables found.
                  </Paragraph>
                </View>
              }
            />
          </View>
        );
      case 'payments':
        return (
          <View style={styles.tabContent}>
            {/* Report Actions: Print, PDF, Email */}
            <View style={styles.reportActionsContainer}>
              <ReportActionsBar
                onBuildPrintData={buildPaymentsPrintReport}
                onBuildPdfHtml={buildPaymentsPdfHtml}
                reportTitle="Customer Payments Report"
                reportFileName={`Customer_Payments_${dateRange.startDate.toISOString().split('T')[0]}_to_${dateRange.endDate.toISOString().split('T')[0]}`}
                emailBody={`Please find attached the Customer Payments Report.\n\nPeriod: ${dateRange.startDate.toLocaleDateString('en-PH')} to ${dateRange.endDate.toLocaleDateString('en-PH')}\nTotal Payments: ${filteredPayments.length}\nTotal Amount: ${formatCurrency(filteredPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0))}\n\n---\nGenerated by IgoroTech POS`}
                disabled={loading || filteredPayments.length === 0}
              />
            </View>
            {/* Date Filter */}
            <Card style={styles.dateFilterCard}>
              <Card.Content>
                <DateRangeFilter
                  onDateChange={handleDateChange}
                  selectedPreset="this_month"
                />
              </Card.Content>
            </Card>
            <Searchbar
              placeholder="Search payments..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />
            <FlatList
              data={filteredPayments}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderPayment}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={loadData}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Paragraph style={styles.emptyText}>
                    No payments found for the selected date range.
                  </Paragraph>
                </View>
              }
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { padding: lo.screenPadding }]}>
        <Title style={[styles.headerTitle, { fontSize: fs.h2 }]}>Customer Payments</Title>

        {/* Customer Filter - Search as you type */}
        <View style={styles.filterContainer}>
          <Title style={styles.filterLabel}>Filter by Customer:</Title>
          <View style={styles.customerSearchContainer}>
            <TextInput
              mode="outlined"
              placeholder="Search customer by name or code..."
              value={selectedCustomer ? selectedCustomerName : customerSearchText}
              onChangeText={(text) => {
                if (selectedCustomer) {
                  // Clear selection when user starts typing again
                  setSelectedCustomer(null);
                  setSelectedCustomerName('');
                }
                setCustomerSearchText(text);
                setShowCustomerSuggestions(text.length > 0);
              }}
              onFocus={() => {
                if (customerSearchText.length > 0 && !selectedCustomer) {
                  setShowCustomerSuggestions(true);
                }
              }}
              style={styles.customerSearchInput}
              right={selectedCustomer ? (
                <TextInput.Icon
                  icon="close"
                  onPress={() => {
                    setSelectedCustomer(null);
                    setSelectedCustomerName('');
                    setCustomerSearchText('');
                    setShowCustomerSuggestions(false);
                  }}
                />
              ) : undefined}
            />
            {showCustomerSuggestions && !selectedCustomer && (
              <View style={styles.suggestionsContainer}>
                <ScrollView style={styles.suggestionsList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  <Button
                    mode="text"
                    onPress={() => {
                      setSelectedCustomer(null);
                      setSelectedCustomerName('');
                      setCustomerSearchText('');
                      setShowCustomerSuggestions(false);
                      loadFilteredData();
                    }}
                    style={styles.suggestionItem}
                    labelStyle={styles.suggestionLabel}
                  >
                    All Customers
                  </Button>
                  {customers
                    .filter((c) => {
                      const searchLower = customerSearchText.toLowerCase();
                      return (
                        c.name?.toLowerCase().includes(searchLower) ||
                        c.code?.toLowerCase().includes(searchLower)
                      );
                    })
                    .slice(0, 20) // Limit to 20 suggestions for performance
                    .map((customer) => (
                      <Button
                        key={customer.id}
                        mode="text"
                        onPress={() => {
                          setSelectedCustomer(customer.id);
                          setSelectedCustomerName(`${customer.code} - ${customer.name}`);
                          setCustomerSearchText('');
                          setShowCustomerSuggestions(false);
                        }}
                        style={styles.suggestionItem}
                        labelStyle={styles.suggestionLabel}
                      >
                        {customer.code} - {customer.name}
                      </Button>
                    ))}
                  {customers.filter((c) => {
                    const searchLower = customerSearchText.toLowerCase();
                    return (
                      c.name?.toLowerCase().includes(searchLower) ||
                      c.code?.toLowerCase().includes(searchLower)
                    );
                  }).length === 0 && (
                    <Paragraph style={styles.noResultsText}>No customers found</Paragraph>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
          <Button
            mode="outlined"
            onPress={() => {
              setShowCustomerSuggestions(false);
              loadFilteredData();
            }}
            style={styles.filterButton}
            compact
          >
            Apply
          </Button>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Button
            mode={activeTab === 'receivables' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('receivables')}
            style={styles.tabButton}
            compact
          >
            Outstanding
          </Button>
          <Button
            mode={activeTab === 'payments' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('payments')}
            style={styles.tabButton}
            compact
          >
            Payments
          </Button>
        </View>
      </View>

      {renderTabContent()}

      {/* Payment Modal */}
      <Portal>
        <Modal
          visible={paymentModalVisible}
          onDismiss={() => setPaymentModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Title style={styles.modalTitle}>Collect Payment</Title>

            <View style={styles.modalContent}>
              {/* Single invoice info */}
              {selectedReceivable && selectedInvoicesTotal.count <= 1 && (
                <>
                  <Paragraph style={styles.modalLabel}>Customer: {selectedReceivable.customer_name}</Paragraph>
                  <Paragraph style={styles.modalLabel}>Invoice: {selectedReceivable.invoice_number}</Paragraph>
                  <Paragraph style={styles.modalLabel}>
                    Outstanding Balance: ₱{selectedReceivable.balance_amount?.toFixed(2)}
                  </Paragraph>
                </>
              )}

              {/* Multi-invoice info */}
              {selectedInvoicesTotal.count > 1 && (
                <>
                  <Paragraph style={styles.modalLabel}>
                    Customer: {selectedInvoicesTotal.invoices[0]?.customer_name || 'Multiple'}
                  </Paragraph>

                  <View style={styles.invoiceListContainer}>
                    <Text style={styles.invoiceListTitle}>Invoices to Pay ({selectedInvoicesTotal.count}):</Text>
                    {selectedInvoicesTotal.invoices.slice(0, 5).map((inv: any) => (
                      <View key={inv.id} style={styles.invoiceListItem}>
                        <Text style={styles.invoiceListInvoice}>{inv.invoice_number}</Text>
                        <Text style={styles.invoiceListAmount}>{formatCurrency(inv.balance_amount)}</Text>
                      </View>
                    ))}
                    {selectedInvoicesTotal.count > 5 && (
                      <Text style={styles.invoiceListMore}>
                        ... and {selectedInvoicesTotal.count - 5} more
                      </Text>
                    )}
                  </View>

                  <View style={styles.totalSelectedBox}>
                    <Text style={styles.totalSelectedLabel}>Total Selected:</Text>
                    <Text style={styles.totalSelectedValue}>{formatCurrency(selectedInvoicesTotal.total)}</Text>
                  </View>
                </>
              )}

              <Divider style={styles.divider} />

              <TextInput
                label="Payment Amount"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
              />

              <Title style={styles.inputLabel}>Payment Method:</Title>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={paymentMethod}
                  onValueChange={setPaymentMethod}
                  style={styles.picker}
                >
                  <Picker.Item label="Cash" value="CASH" />
                  <Picker.Item label="Card" value="CARD" />
                  <Picker.Item label="Check" value="CHECK" />
                  <Picker.Item label="Bank Transfer" value="BANK_TRANSFER" />
                  <Picker.Item label="Online Payment" value="ONLINE" />
                </Picker>
              </View>

              <TextInput
                label="Reference Number (Optional)"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                mode="outlined"
                style={styles.input}
                placeholder="Check #, Bank ref, etc."
              />

              <TextInput
                label="Notes (Optional)"
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.input}
              />

              {/* FIFO Preview for multi-invoice */}
              {selectedInvoicesTotal.count > 1 && parseFloat(paymentAmount) > 0 && (
                <View style={styles.fifoPreviewContainer}>
                  <Text style={styles.fifoPreviewTitle}>Payment Preview (FIFO):</Text>
                  {calculatePaymentDistribution(parseFloat(paymentAmount)).map((dist, idx) => (
                    <View key={idx} style={styles.fifoPreviewItem}>
                      <Text style={styles.fifoInvoice}>{dist.invoice.invoice_number}</Text>
                      <Text style={styles.fifoAmount}>{formatCurrency(dist.amount)}</Text>
                      <Text style={[
                        styles.fifoStatus,
                        { color: dist.status === 'PAID' ? '#4CAF50' : '#FF9800' }
                      ]}>
                        {dist.status === 'PAID' ? 'PAID' : `Bal: ${formatCurrency(dist.newBalance)}`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setPaymentModalVisible(false);
                    if (selectedInvoicesTotal.count > 1) {
                      // Keep selections for multi-invoice
                    } else {
                      setSelectedInvoiceIds(new Set());
                    }
                  }}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={processPayment}
                  style={styles.modalButton}
                  loading={loading}
                >
                  Process Payment
                </Button>
              </View>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Receipt Preview */}
      {receiptData && (
        <PaymentReceiptPreview
          data={receiptData}
          visible={receiptPreviewVisible}
          onClose={handleCloseReceipt}
          onPrint={handlePrintReceipt}
          onSendEmail={handleSendEmail}
          isPrinting={isPrinting}
          isSendingEmail={isSendingEmail}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  customerSearchContainer: {
    position: 'relative',
    zIndex: 1000,
    marginBottom: 8,
  },
  customerSearchInput: {
    backgroundColor: 'white',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: 200,
    zIndex: 1001,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  suggestionLabel: {
    textAlign: 'left',
    fontSize: 14,
  },
  noResultsText: {
    padding: 16,
    textAlign: 'center',
    opacity: 0.6,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginBottom: 8,
  },
  picker: {
    height: 50,
    color: '#212121',
  },
  filterButton: {
    alignSelf: 'flex-start',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  reportActionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statusFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statusChipFilter: {
    marginRight: 4,
  },
  dateFilterCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
  },
  searchBar: {
    margin: 16,
    marginTop: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    marginBottom: 16,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  receivableInfo: {
    flex: 1,
  },
  paymentInfo: {
    flex: 1,
  },
  receivableStats: {
    alignItems: 'flex-end',
  },
  paymentStats: {
    alignItems: 'flex-end',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  customerCode: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  paymentNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#2196F3',
  },
  dates: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  receivedBy: {
    fontSize: 12,
    opacity: 0.7,
  },
  statusChip: {
    marginBottom: 8,
    alignSelf: 'flex-end',
  },
  methodChip: {
    marginBottom: 8,
    alignSelf: 'flex-end',
  },
  originalAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  paidAmount: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  referenceNumber: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    opacity: 0.8,
  },
  notes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    opacity: 0.7,
  },
  payButton: {
    marginTop: 8,
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
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalContent: {
    paddingBottom: 8,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  input: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 16,
  },
  modalButton: {
    flex: 1,
  },
  // Customer Summary Card
  customerSummaryCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#E3F2FD',
    elevation: 2,
  },
  customerSummaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerSummaryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  customerSummaryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  customerSummaryInvoices: {
    fontSize: 12,
    color: '#42A5F5',
  },
  customerSummaryRight: {
    alignItems: 'flex-end',
  },
  customerSummaryLabel: {
    fontSize: 11,
    color: '#757575',
  },
  customerSummaryTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  // Selection Controls
  selectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
  },
  selectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  selectionSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  collectSelectedBtn: {
    backgroundColor: '#4CAF50',
  },
  collectSelectedBtnLabel: {
    fontSize: 12,
  },
  // Card selection state
  cardSelected: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  checkboxContainer: {
    marginRight: 4,
  },
  // Multi-invoice modal
  invoiceListContainer: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  invoiceListTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },
  invoiceListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  invoiceListInvoice: {
    fontSize: 13,
    color: '#424242',
  },
  invoiceListAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
  },
  invoiceListMore: {
    fontSize: 12,
    color: '#9E9E9E',
    fontStyle: 'italic',
    marginTop: 4,
  },
  totalSelectedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  totalSelectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },
  totalSelectedValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  // FIFO Preview
  fifoPreviewContainer: {
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  fifoPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 8,
  },
  fifoPreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  fifoInvoice: {
    fontSize: 12,
    color: '#424242',
    flex: 1,
  },
  fifoAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#424242',
    marginHorizontal: 8,
  },
  fifoStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
});