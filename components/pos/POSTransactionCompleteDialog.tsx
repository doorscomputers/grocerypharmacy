import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { RadioButton } from 'react-native-paper';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import { ESCPOSBuilder, PRINTER_WIDTH } from '../../utils/escpos';
import BluetoothPrinterService from '../../utils/BluetoothPrinterService';
import { DatabaseService } from '../../database/DatabaseService';
import { formatPhilippineDateTime } from '../../utils/dateTime';
import { useResponsiveTheme } from '../../utils/responsive';

export type TransactionType = 'VOID' | 'REFUND' | 'EXCHANGE';

export interface TransactionCompleteData {
  transactionType: TransactionType;
  referenceNumber: string;
  originalInvoice: string;
  customerName?: string;
  totalAmount: number;
  reason: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
  // For Exchange
  newItems?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
  difference?: number;
  isCreditTransaction?: boolean; // For credit/charge invoice exchanges
  refundMethod?: 'CASH' | 'CREDIT' | 'EXCHANGE';
  cashierName?: string;
  transactionDate: Date;
}

interface POSTransactionCompleteDialogProps {
  visible: boolean;
  onClose: () => void;
  data: TransactionCompleteData | null;
}

export default function POSTransactionCompleteDialog({
  visible,
  onClose,
  data,
}: POSTransactionCompleteDialogProps) {
  const { sp, fs, lo } = useResponsiveTheme();
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('58mm');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>({});

  useEffect(() => {
    if (visible) {
      loadCompanySettings();
    }
  }, [visible]);

  const loadCompanySettings = async () => {
    try {
      const db = DatabaseService.getInstance();
      const businessName = await db.getSetting('business_name');
      const businessAddress = await db.getSetting('business_address');
      const businessPhone = await db.getSetting('business_phone');
      const tin = await db.getSetting('tin');
      const permitNumber = await db.getSetting('permit_number');
      setCompanySettings({
        businessName: businessName || 'IgoroTech POS',
        businessAddress: businessAddress || '',
        businessPhone: businessPhone || '',
        tin: tin || '',
        permitNumber: permitNumber || '',
      });
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  if (!data) return null;

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const getTypeColor = () => {
    switch (data.transactionType) {
      case 'VOID': return { bg: '#FFEBEE', text: '#C62828', accent: '#D32F2F' };
      case 'REFUND': return { bg: '#FFF3E0', text: '#E65100', accent: '#FF9800' };
      case 'EXCHANGE': return { bg: '#E3F2FD', text: '#1565C0', accent: '#2196F3' };
    }
  };

  const getTypeLabel = () => {
    switch (data.transactionType) {
      case 'VOID': return 'VOID TRANSACTION';
      case 'REFUND': return 'REFUND RECEIPT';
      case 'EXCHANGE': return 'EXCHANGE RECEIPT';
    }
  };

  const colors = getTypeColor();

  // Build ESC/POS print data
  const buildPrintData = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const isNarrow = printerWidth === PRINTER_WIDTH.MM_58;

    // Header
    builder
      .align('center')
      .bold(true)
      .println(companySettings.businessName || 'IgoroTech POS')
      .bold(false)
      .println(companySettings.businessAddress || '')
      .println(companySettings.tin ? `TIN: ${companySettings.tin}` : '')
      .feed(1)
      .doubleSeparator()
      .bold(true)
      .doubleSize()
      .println(getTypeLabel())
      .normalSize()
      .bold(false)
      .separator()
      .align('left');

    // Transaction Info
    builder
      .println(`Ref #: ${data.referenceNumber}`)
      .println(`Orig Invoice: ${data.originalInvoice}`)
      .println(`Date: ${formatPhilippineDateTime(data.transactionDate)}`)
      .println(`Cashier: ${data.cashierName || 'N/A'}`)
      .println(`Customer: ${data.customerName || 'Walk-in'}`)
      .separator();

    // Reason
    builder
      .println(`Reason: ${data.reason}`)
      .separator();

    // Items
    if (data.transactionType === 'EXCHANGE') {
      builder.bold(true).println('RETURNED ITEMS:').bold(false);
    }

    for (const item of data.items) {
      if (isNarrow) {
        builder.println(`${item.name.substring(0, 20)}`);
        builder.leftRight(
          `  ${item.quantity} x ${formatCurrency(item.unitPrice)}`,
          formatCurrency(item.totalAmount)
        );
      } else {
        builder.leftRight(
          `${item.quantity}x ${item.name.substring(0, 24)}`,
          formatCurrency(item.totalAmount)
        );
      }
    }

    // New items for Exchange
    if (data.transactionType === 'EXCHANGE' && data.newItems && data.newItems.length > 0) {
      builder.separator();
      builder.bold(true).println('REPLACEMENT ITEMS:').bold(false);
      for (const item of data.newItems) {
        if (isNarrow) {
          builder.println(`${item.name.substring(0, 20)}`);
          builder.leftRight(
            `  ${item.quantity} x ${formatCurrency(item.unitPrice)}`,
            formatCurrency(item.totalAmount)
          );
        } else {
          builder.leftRight(
            `${item.quantity}x ${item.name.substring(0, 24)}`,
            formatCurrency(item.totalAmount)
          );
        }
      }
    }

    builder.doubleSeparator();

    // Total
    builder.bold(true);
    if (data.transactionType === 'VOID') {
      builder.leftRight('VOIDED AMOUNT:', formatCurrency(data.totalAmount));
    } else if (data.transactionType === 'REFUND') {
      builder.leftRight('REFUND AMOUNT:', formatCurrency(data.totalAmount));
      builder.leftRight('REFUND METHOD:', data.refundMethod || 'CASH');
    } else if (data.transactionType === 'EXCHANGE') {
      builder.leftRight('RETURN VALUE:', formatCurrency(data.totalAmount));
      const newTotal = data.newItems?.reduce((sum, i) => sum + i.totalAmount, 0) || 0;
      builder.leftRight('NEW ITEMS VALUE:', formatCurrency(newTotal));
      if (data.difference !== undefined && data.difference !== 0) {
        let diffLabel: string;
        if (data.isCreditTransaction) {
          diffLabel = data.difference > 0 ? 'BALANCE INCREASED:' : 'BALANCE REDUCED:';
        } else {
          diffLabel = data.difference > 0 ? 'CUSTOMER PAYS:' : 'CUSTOMER RECEIVES:';
        }
        builder.leftRight(diffLabel, formatCurrency(Math.abs(data.difference)));
      } else {
        builder.leftRight('DIFFERENCE:', 'EVEN');
      }
    }
    builder.bold(false);

    // Footer
    builder
      .separator()
      .align('center')
      .println('Items returned to inventory')
      .feed(1)
      .println('Thank you!')
      .feed(2)
      .cut();

    return builder;
  };

  // Build HTML for PDF
  const buildPdfHtml = (): string => {
    const itemsHtml = data.items.map(item => `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">${formatCurrency(item.unitPrice)}</td>
        <td style="text-align:right;">${formatCurrency(item.totalAmount)}</td>
      </tr>
    `).join('');

    let newItemsHtml = '';
    if (data.transactionType === 'EXCHANGE' && data.newItems && data.newItems.length > 0) {
      newItemsHtml = `
        <h3 style="color:#2E7D32; margin-top:20px;">Replacement Items</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr style="background:#E8F5E9;">
              <th style="text-align:left; padding:8px; border-bottom:2px solid #4CAF50;">Item</th>
              <th style="text-align:center; padding:8px; border-bottom:2px solid #4CAF50;">Qty</th>
              <th style="text-align:right; padding:8px; border-bottom:2px solid #4CAF50;">Unit Price</th>
              <th style="text-align:right; padding:8px; border-bottom:2px solid #4CAF50;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.newItems.map(item => `
              <tr>
                <td style="padding:8px; border-bottom:1px solid #ddd;">${item.name}</td>
                <td style="text-align:center; padding:8px; border-bottom:1px solid #ddd;">${item.quantity}</td>
                <td style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">${formatCurrency(item.unitPrice)}</td>
                <td style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">${formatCurrency(item.totalAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    let totalsHtml = '';
    if (data.transactionType === 'VOID') {
      totalsHtml = `
        <tr><td><strong>Voided Amount:</strong></td><td style="text-align:right;"><strong>${formatCurrency(data.totalAmount)}</strong></td></tr>
      `;
    } else if (data.transactionType === 'REFUND') {
      totalsHtml = `
        <tr><td><strong>Refund Amount:</strong></td><td style="text-align:right;"><strong>${formatCurrency(data.totalAmount)}</strong></td></tr>
        <tr><td>Refund Method:</td><td style="text-align:right;">${data.refundMethod || 'CASH'}</td></tr>
      `;
    } else if (data.transactionType === 'EXCHANGE') {
      const newTotal = data.newItems?.reduce((sum, i) => sum + i.totalAmount, 0) || 0;
      let diffLabel: string;
      if ((data.difference || 0) === 0) {
        diffLabel = 'Difference:';
      } else if (data.isCreditTransaction) {
        diffLabel = (data.difference || 0) > 0 ? 'Balance Increased:' : 'Balance Reduced:';
      } else {
        diffLabel = (data.difference || 0) > 0 ? 'Customer Pays:' : 'Customer Receives:';
      }
      totalsHtml = `
        <tr><td>Return Value:</td><td style="text-align:right;">${formatCurrency(data.totalAmount)}</td></tr>
        <tr><td>New Items Value:</td><td style="text-align:right;">${formatCurrency(newTotal)}</td></tr>
        <tr><td><strong>${diffLabel}</strong></td>
            <td style="text-align:right;"><strong>${(data.difference || 0) === 0 ? 'EVEN' : formatCurrency(Math.abs(data.difference || 0))}</strong></td></tr>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 20px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 20px; font-weight: bold; color: #333; }
          .company-info { font-size: 11px; color: #666; }
          .title { font-size: 18px; font-weight: bold; color: ${colors.accent}; text-align: center; margin: 20px 0; padding: 10px; background: ${colors.bg}; border-radius: 8px; }
          .info-section { margin: 15px 0; padding: 10px; background: #f5f5f5; border-radius: 8px; }
          .info-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .reason-box { background: #FFF3E0; padding: 10px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #FF9800; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 8px; background: #f0f0f0; border-bottom: 2px solid #ddd; }
          td { padding: 8px; border-bottom: 1px solid #eee; }
          .totals { margin-top: 15px; padding: 10px; background: ${colors.bg}; border-radius: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.businessName || 'IgoroTech POS'}</div>
          <div class="company-info">${companySettings.businessAddress || ''}</div>
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="title">${getTypeLabel()}</div>

        <div class="info-section">
          <div class="info-row"><span>Reference #:</span><span><strong>${data.referenceNumber}</strong></span></div>
          <div class="info-row"><span>Original Invoice:</span><span>${data.originalInvoice}</span></div>
          <div class="info-row"><span>Date/Time:</span><span>${formatPhilippineDateTime(data.transactionDate)}</span></div>
          <div class="info-row"><span>Cashier:</span><span>${data.cashierName || 'N/A'}</span></div>
          <div class="info-row"><span>Customer:</span><span>${data.customerName || 'Walk-in Customer'}</span></div>
        </div>

        <div class="reason-box">
          <strong>Reason:</strong> ${data.reason}
        </div>

        <h3 style="color:${colors.text};">${data.transactionType === 'EXCHANGE' ? 'Returned Items' : 'Items'}</h3>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${newItemsHtml}

        <div class="totals">
          <table>
            ${totalsHtml}
          </table>
        </div>

        <div class="footer">
          <p>Items have been returned to inventory.</p>
          <p>Generated: ${formatPhilippineDateTime(new Date())}</p>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const printerService = BluetoothPrinterService.getInstance();

      if (printerService.isConnected()) {
        // Bluetooth thermal printer
        const printerWidth = paperSize === '80mm' ? PRINTER_WIDTH.MM_80 : PRINTER_WIDTH.MM_58;
        const builder = buildPrintData(printerWidth);
        await printerService.print(builder);
        Alert.alert('Success', 'Receipt printed successfully!');
      } else {
        // PDF fallback via system print dialog
        const html = buildPdfHtml();
        await Print.printAsync({ html });
      }

      setShowPrintDialog(false);
    } catch (error: any) {
      console.error('Print error:', error);
      Alert.alert('Print Error', error.message || 'Failed to print');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleEmail = async () => {
    try {
      setIsEmailing(true);

      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Email Not Available', 'No email app is configured on this device.');
        return;
      }

      const html = buildPdfHtml();
      const { uri } = await Print.printToFileAsync({ html });

      const fileName = `${data.transactionType}_${data.referenceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const newUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: newUri });

      await MailComposer.composeAsync({
        subject: `${getTypeLabel()} - ${data.referenceNumber}`,
        body: `Please find attached the ${data.transactionType.toLowerCase()} receipt for ${data.originalInvoice}.\n\nAmount: ${formatCurrency(data.totalAmount)}\nDate: ${formatPhilippineDateTime(data.transactionDate)}`,
        attachments: [newUri],
      });

      Alert.alert('Success', 'Email composer opened.');
    } catch (error: any) {
      console.error('Email error:', error);
      Alert.alert('Email Error', error.message || 'Failed to send email');
    } finally {
      setIsEmailing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { maxWidth: lo.modalMaxWidth }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.accent }]}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={[styles.headerTitle, { fontSize: fs.h2 }]}>{data.transactionType} Complete</Text>
          </View>

          {showPrintDialog ? (
            /* Print Paper Size Selection (inline, replaces content) */
            <View style={styles.printDialogContent}>
              <Text style={styles.printDialogTitle}>Print Receipt</Text>
              <Text style={styles.printLabel}>Select Paper Size:</Text>
              <RadioButton.Group
                onValueChange={(value) => setPaperSize(value as '58mm' | '80mm')}
                value={paperSize}
              >
                <RadioButton.Item label="58mm (32 characters)" value="58mm" />
                <RadioButton.Item label="80mm (48 characters)" value="80mm" />
              </RadioButton.Group>

              <View style={styles.printDialogActions}>
                <TouchableOpacity
                  style={styles.printDialogCancelBtn}
                  onPress={() => setShowPrintDialog(false)}
                  disabled={isPrinting}
                >
                  <Text style={styles.printDialogCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.printDialogPrintBtn, isPrinting && { opacity: 0.5 }]}
                  onPress={handlePrint}
                  disabled={isPrinting}
                >
                  {isPrinting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.printDialogPrintText}>Print</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <ScrollView style={[styles.content, { padding: sp.md }]} showsVerticalScrollIndicator={false}>
                {/* Summary */}
                <View style={[styles.summaryBox, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.typeLabel, { color: colors.text }]}>{getTypeLabel()}</Text>
                  <Text style={styles.referenceNumber}>{data.referenceNumber}</Text>
                  <Text style={styles.originalInvoice}>Original: {data.originalInvoice}</Text>
                </View>

                {/* Amount */}
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>
                    {data.transactionType === 'VOID' ? 'Voided Amount' :
                     data.transactionType === 'REFUND' ? 'Refund Amount' : 'Return Value'}
                  </Text>
                  <Text style={[styles.amountValue, { color: colors.accent }]}>
                    {formatCurrency(data.totalAmount)}
                  </Text>
                  {data.transactionType === 'REFUND' && data.refundMethod && (
                    <Text style={styles.methodText}>Method: {data.refundMethod}</Text>
                  )}
                  {data.transactionType === 'EXCHANGE' && data.difference !== undefined && (
                    <Text style={styles.methodText}>
                      {data.difference > 0
                        ? (data.isCreditTransaction
                            ? `Balance increased by: ${formatCurrency(data.difference)}`
                            : `Customer pays: ${formatCurrency(data.difference)}`)
                        : data.difference < 0
                          ? (data.isCreditTransaction
                              ? `Balance reduced by: ${formatCurrency(Math.abs(data.difference))}`
                              : `Customer receives: ${formatCurrency(Math.abs(data.difference))}`)
                          : 'Even exchange'}
                    </Text>
                  )}
                </View>

                {/* Items Count */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Items {data.transactionType === 'EXCHANGE' ? 'Returned' : 'Processed'}:</Text>
                  <Text style={styles.infoValue}>{data.items.length}</Text>
                </View>
                {data.transactionType === 'EXCHANGE' && data.newItems && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Replacement Items:</Text>
                    <Text style={styles.infoValue}>{data.newItems.length}</Text>
                  </View>
                )}

                <View style={styles.statusNote}>
                  <Text style={styles.statusNoteText}>
                    ✓ Inventory has been updated
                  </Text>
                  {data.transactionType === 'EXCHANGE' && data.isCreditTransaction && data.difference !== 0 && (
                    <Text style={[styles.statusNoteText, { marginTop: 4 }]}>
                      ✓ Customer balance has been adjusted
                    </Text>
                  )}
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.printBtn]}
                  onPress={() => setShowPrintDialog(true)}
                  disabled={isPrinting}
                >
                  <Text style={styles.actionBtnText}>🖨️ Print</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.emailBtn]}
                  onPress={handleEmail}
                  disabled={isEmailing}
                >
                  {isEmailing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>✉️ Email</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Done Button */}
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: colors.accent }]}
                onPress={onClose}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  successIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    width: 36,
    height: 36,
    borderRadius: 18,
    textAlign: 'center',
    lineHeight: 36,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  summaryBox: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  referenceNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginTop: 4,
  },
  originalInvoice: {
    fontSize: 13,
    color: '#757575',
    marginTop: 4,
  },
  amountBox: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  methodText: {
    fontSize: 13,
    color: '#616161',
    marginTop: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#616161',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  statusNote: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  statusNoteText: {
    fontSize: 13,
    color: '#2E7D32',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  printBtn: {
    backgroundColor: '#1976D2',
  },
  emailBtn: {
    backgroundColor: '#7B1FA2',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  doneBtn: {
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  printDialogContent: {
    padding: 20,
  },
  printDialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
    textAlign: 'center',
  },
  printLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  printDialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  printDialogCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  printDialogCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  printDialogPrintBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#1976D2',
    minWidth: 80,
    alignItems: 'center',
  },
  printDialogPrintText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
