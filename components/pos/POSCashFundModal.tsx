import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { DatabaseService } from '../../database/DatabaseService';
import BluetoothPrinterService from '../../utils/BluetoothPrinterService';
import { buildCashMovementReceipt, PRINTER_WIDTH } from '../../utils/escpos';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import { useResponsiveTheme } from '../../utils/responsive';

interface POSCashFundModalProps {
  visible: boolean;
  onClose: () => void;
  cashierId: number;
  cashierName?: string;
  onSuccess?: () => void;
}

interface SavedMovementData {
  amount: number;
  description: string;
  date: Date;
}

export default function POSCashFundModal({
  visible,
  onClose,
  cashierId,
  cashierName,
  onSuccess,
}: POSCashFundModalProps) {
  const { sp, fs, lo } = useResponsiveTheme();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Post-save dialog
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [savedData, setSavedData] = useState<SavedMovementData | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);

  const getBusinessInfo = async () => {
    const db = DatabaseService.getInstance();
    const [name, address, phone, tin, footer] = await Promise.all([
      db.getSetting('company_name'),
      db.getSetting('company_address'),
      db.getSetting('company_phone'),
      db.getSetting('company_tin'),
      db.getSetting('receipt_footer'),
    ]);
    return {
      businessName: name || 'Store',
      businessAddress: address || '',
      businessPhone: phone || '',
      tin: tin || '',
      footerText: footer || '',
    };
  };

  const handleSave = async () => {
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    setIsLoading(true);
    try {
      const db = DatabaseService.getInstance();
      await db.createCashMovement({
        movement_type: 'OPENING_FUND',
        amount: amountValue,
        description: description.trim(),
        cashier_id: cashierId,
      });

      // Save data for receipt, then show success dialog
      setSavedData({
        amount: amountValue,
        description: description.trim(),
        date: new Date(),
      });
      setShowSuccessDialog(true);
      onSuccess?.();
    } catch (error) {
      console.error('Error adding cash fund:', error);
      Alert.alert('Error', 'Failed to add cash fund');
    } finally {
      setIsLoading(false);
    }
  };

  const buildHtmlReceipt = async (): Promise<string> => {
    if (!savedData) return '';
    const info = await getBusinessInfo();
    return `
      <html><body style="font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:16px;">
        <div style="text-align:center;">
          <h2 style="margin:0;">${info.businessName}</h2>
          ${info.businessAddress ? `<p style="margin:2px 0;">${info.businessAddress}</p>` : ''}
          ${info.businessPhone ? `<p style="margin:2px 0;">Tel: ${info.businessPhone}</p>` : ''}
          ${info.tin ? `<p style="margin:2px 0;">TIN: ${info.tin}</p>` : ''}
          <hr/>
          <h3 style="margin:8px 0;">CASH FUND</h3>
          <hr/>
        </div>
        <p><b>Date:</b> ${savedData.date.toLocaleDateString('en-PH')}</p>
        <p><b>Time:</b> ${savedData.date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
        <p><b>Cashier:</b> ${cashierName || 'Cashier'}</p>
        <hr/>
        <p style="font-size:16px;text-align:center;"><b>AMOUNT ADDED: ₱${savedData.amount.toFixed(2)}</b></p>
        <hr/>
        <p><b>Purpose:</b> ${savedData.description}</p>
        <hr/>
        <p style="text-align:center;">Cash Fund Acknowledged</p>
        <p style="text-align:center;font-size:10px;">*** CASH FUND RECEIPT ***</p>
        <p style="text-align:center;font-size:10px;">${new Date().toLocaleString('en-PH')}</p>
      </body></html>
    `;
  };

  const handlePrint = async () => {
    if (!savedData) return;

    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Thermal printing is not available on web.');
      return;
    }

    const printerService = BluetoothPrinterService.getInstance();
    if (!printerService.isConnected()) {
      Alert.alert('Not Connected', 'Please connect to a Bluetooth printer first.');
      return;
    }

    setIsPrinting(true);
    try {
      const info = await getBusinessInfo();
      const settings = printerService.getSettings();
      const builder = buildCashMovementReceipt({
        businessName: info.businessName,
        businessAddress: info.businessAddress,
        businessPhone: info.businessPhone,
        tin: info.tin,
        movementType: 'OPENING_FUND',
        amount: savedData.amount,
        description: savedData.description,
        cashierName: cashierName || 'Cashier',
        movementDate: savedData.date,
        footerText: info.footerText,
      }, settings.printerWidth);

      await printerService.print(builder);
      Alert.alert('Success', 'Receipt printed successfully!');
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', 'Failed to print receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!savedData) return;
    setIsExporting(true);
    try {
      const html = await buildHtmlReceipt();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Cash Fund Receipt' });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to export PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmail = async () => {
    if (!savedData) return;
    setIsEmailing(true);
    try {
      const available = await MailComposer.isAvailableAsync();
      if (!available) {
        Alert.alert('Not Available', 'Email is not available on this device.');
        return;
      }
      const html = await buildHtmlReceipt();
      const { uri } = await Print.printToFileAsync({ html });
      await MailComposer.composeAsync({
        subject: `Cash Fund Receipt - ₱${savedData.amount.toFixed(2)}`,
        body: `Cash Fund of ₱${savedData.amount.toFixed(2)} added on ${savedData.date.toLocaleDateString('en-PH')}.\n\nPurpose: ${savedData.description}`,
        attachments: [uri],
      });
    } catch (error) {
      console.error('Email error:', error);
      Alert.alert('Email Error', 'Failed to send email.');
    } finally {
      setIsEmailing(false);
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccessDialog(false);
    setSavedData(null);
    setAmount('');
    setDescription('');
    onClose();
  };

  const handleClose = () => {
    setAmount('');
    setDescription('');
    onClose();
  };

  const quickAmounts = [500, 1000, 2000, 5000];

  return (
    <>
      <Modal
        visible={visible && !showSuccessDialog}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.container, { maxWidth: lo.modalMaxWidth }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { fontSize: fs.h2 }]}>Add Cash Fund</Text>
              <IconButton icon="close" size={24} onPress={handleClose} />
            </View>

            <ScrollView style={[styles.content, { padding: sp.lg }]} showsVerticalScrollIndicator={false}>
              {/* Amount Input */}
              <View style={styles.section}>
                <Text style={styles.label}>Amount (₱)</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9E9E9E"
                />
              </View>

              {/* Quick Amount Buttons */}
              <View style={styles.quickAmounts}>
                {quickAmounts.map((quickAmount) => (
                  <TouchableOpacity
                    key={quickAmount}
                    style={styles.quickAmountBtn}
                    onPress={() => setAmount(quickAmount.toString())}
                  >
                    <Text style={styles.quickAmountText}>₱{quickAmount.toLocaleString()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description Input */}
              <View style={styles.section}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g., Opening cash fund, Additional cash"
                  placeholderTextColor="#9E9E9E"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Text style={styles.infoIcon}>ℹ️</Text>
                <Text style={styles.infoText}>
                  Cash fund is added to track opening cash or additional cash placed in the drawer.
                  This will be reflected in your X/Z Reading reports.
                </Text>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                disabled={isLoading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={isLoading}
              >
                <Text style={[styles.saveBtnText, { fontSize: fs.button }]}>
                  {isLoading ? 'Saving...' : 'Add Cash Fund'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Success Dialog with Print/Export/Email */}
      <Modal
        visible={showSuccessDialog}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSuccess}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successDialog}>
            {/* Success Header */}
            <View style={styles.successHeader}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={[styles.successTitle, { fontSize: fs.h2 }]}>Cash Fund Added</Text>
            </View>

            {/* Summary */}
            <View style={styles.successContent}>
              {savedData && (
                <View style={styles.successSummary}>
                  <View style={styles.successRow}>
                    <Text style={styles.successLabel}>Amount:</Text>
                    <Text style={styles.successValueGreen}>₱{savedData.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.successRow}>
                    <Text style={styles.successLabel}>Purpose:</Text>
                    <Text style={styles.successValue}>{savedData.description}</Text>
                  </View>
                  <View style={styles.successRow}>
                    <Text style={styles.successLabel}>Date:</Text>
                    <Text style={styles.successValue}>{savedData.date.toLocaleString('en-PH')}</Text>
                  </View>
                </View>
              )}

              <Text style={styles.successPrompt}>
                Would you like to print or export the receipt?
              </Text>

              {/* Action Buttons */}
              <View style={styles.successActions}>
                <TouchableOpacity
                  style={[styles.successActionBtn, isPrinting && styles.actionBtnDisabled]}
                  onPress={handlePrint}
                  disabled={isPrinting || isExporting || isEmailing}
                >
                  {isPrinting ? (
                    <ActivityIndicator size="small" color="#4CAF50" />
                  ) : (
                    <>
                      <Text style={styles.successActionIcon}>🖨️</Text>
                      <Text style={styles.successActionText}>Print</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.successActionBtn, isExporting && styles.actionBtnDisabled]}
                  onPress={handleExportPdf}
                  disabled={isPrinting || isExporting || isEmailing}
                >
                  {isExporting ? (
                    <ActivityIndicator size="small" color="#4CAF50" />
                  ) : (
                    <>
                      <Text style={styles.successActionIcon}>📄</Text>
                      <Text style={styles.successActionText}>PDF</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.successActionBtn, isEmailing && styles.actionBtnDisabled]}
                  onPress={handleEmail}
                  disabled={isPrinting || isExporting || isEmailing}
                >
                  {isEmailing ? (
                    <ActivityIndicator size="small" color="#4CAF50" />
                  ) : (
                    <>
                      <Text style={styles.successActionIcon}>📧</Text>
                      <Text style={styles.successActionText}>Email</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Done Button */}
            <TouchableOpacity
              style={styles.successDoneBtn}
              onPress={handleCloseSuccess}
            >
              <Text style={styles.successDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2E7D32',
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    textAlign: 'center',
    backgroundColor: '#F5FFF5',
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  quickAmountBtn: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#E8F5E9',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  textInput: {
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FAFAFA',
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#A5D6A7',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Success Dialog
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
  },
  successHeader: {
    backgroundColor: '#4CAF50',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  successContent: {
    padding: 20,
  },
  successSummary: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  successLabel: {
    fontSize: 14,
    color: '#616161',
  },
  successValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  successValueGreen: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  successPrompt: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 16,
  },
  successActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  successActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 80,
    elevation: 2,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  successActionIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  successActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  successDoneBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    alignItems: 'center',
  },
  successDoneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
