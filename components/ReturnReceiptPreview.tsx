import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Alert,
  Platform,
} from 'react-native';
import {
  Button,
  TextInput,
  Portal,
  Modal,
} from 'react-native-paper';

export interface ReturnReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason: string;
}

export interface ReturnReceiptData {
  // Business info
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  tin?: string;

  // Return info
  returnNumber: string;
  returnDate: Date;
  processedBy: string;

  // Original transaction (optional)
  originalTransactionNumber?: string;

  // Customer info (optional)
  customerName?: string;
  customerCode?: string;

  // Items
  items: ReturnReceiptItem[];

  // Totals
  totalAmount: number;

  // Refund details
  refundMethod: string;
  notes?: string;

  // Footer
  footerText?: string;
}

interface ReturnReceiptPreviewProps {
  data: ReturnReceiptData;
  visible: boolean;
  onClose: () => void;
  onPrint: () => Promise<void>;
  onSendEmail: (email: string) => Promise<void>;
  isPrinting?: boolean;
  isSendingEmail?: boolean;
}

export default function ReturnReceiptPreview({
  data,
  visible,
  onClose,
  onPrint,
  onSendEmail,
  isPrinting = false,
  isSendingEmail = false,
}: ReturnReceiptPreviewProps) {
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatCurrency = (amount: number): string => {
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return `₱${safeAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const validateEmail = (emailAddress: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(emailAddress.trim());
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleEmailSubmit = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setEmailError('Please enter an email address');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailError('');
    try {
      await onSendEmail(trimmedEmail);
      setShowEmailInput(false);
      setEmail('');
      showAlert('Success', `Receipt sent to ${trimmedEmail}`);
    } catch (error) {
      showAlert('Error', 'Failed to send email. Please try again.');
    }
  };

  const handlePrint = async () => {
    try {
      await onPrint();
    } catch (error) {
      showAlert('Print Error', 'Failed to print receipt. Make sure printer is connected.');
    }
  };

  const renderLine = (left: string, right: string): React.ReactNode => {
    return (
      <View style={styles.lineRow}>
        <Text style={styles.lineTextLeft}>{left}</Text>
        <Text style={styles.lineTextRight}>{right}</Text>
      </View>
    );
  };

  const renderSeparator = (): React.ReactNode => {
    return <Text style={styles.separator}>{'─'.repeat(40)}</Text>;
  };

  const renderDoubleSeparator = (): React.ReactNode => {
    return <Text style={styles.separator}>{'═'.repeat(40)}</Text>;
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalContainer}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.receipt}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.businessName}>{data.businessName || 'Store'}</Text>
              {data.businessAddress && (
                <Text style={styles.headerText}>{data.businessAddress}</Text>
              )}
              {data.businessPhone && (
                <Text style={styles.headerText}>Tel: {data.businessPhone}</Text>
              )}
              {data.tin && (
                <Text style={styles.headerText}>TIN: {data.tin}</Text>
              )}
            </View>

            {renderDoubleSeparator()}

            {/* Receipt Title */}
            <Text style={styles.receiptTitle}>SALES RETURN RECEIPT</Text>

            {renderSeparator()}

            {/* Return Details */}
            <View style={styles.detailsSection}>
              {renderLine('Return #:', data.returnNumber)}
              {renderLine('Date:', formatDate(data.returnDate))}
              {renderLine('Time:', formatTime(data.returnDate))}
              {renderLine('Processed By:', data.processedBy)}
              {data.originalTransactionNumber && (
                renderLine('Orig. Trans #:', data.originalTransactionNumber)
              )}
            </View>

            {renderSeparator()}

            {/* Customer Info */}
            {data.customerName && (
              <>
                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>CUSTOMER</Text>
                  {renderLine('Name:', data.customerName)}
                  {data.customerCode && renderLine('Code:', data.customerCode)}
                </View>
                {renderSeparator()}
              </>
            )}

            {/* Items Header */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>RETURNED ITEMS</Text>
              <View style={styles.itemHeader}>
                <Text style={[styles.itemHeaderText, { flex: 2 }]}>Item</Text>
                <Text style={[styles.itemHeaderText, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.itemHeaderText, { flex: 1, textAlign: 'right' }]}>Price</Text>
                <Text style={[styles.itemHeaderText, { flex: 1, textAlign: 'right' }]}>Total</Text>
              </View>
            </View>

            {/* Items */}
            {data.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemMainRow}>
                  <Text style={[styles.itemText, { flex: 2 }]} numberOfLines={2}>
                    {item.productName}
                  </Text>
                  <Text style={[styles.itemText, { flex: 1, textAlign: 'center' }]}>
                    {item.quantity}
                  </Text>
                  <Text style={[styles.itemText, { flex: 1, textAlign: 'right' }]}>
                    {formatCurrency(item.unitPrice)}
                  </Text>
                  <Text style={[styles.itemText, { flex: 1, textAlign: 'right' }]}>
                    {formatCurrency(item.total)}
                  </Text>
                </View>
                <Text style={styles.itemReason}>Reason: {item.reason}</Text>
              </View>
            ))}

            {renderDoubleSeparator()}

            {/* Total Amount */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>TOTAL REFUND:</Text>
              <Text style={styles.amountValue}>{formatCurrency(data.totalAmount)}</Text>
            </View>

            {renderSeparator()}

            {/* Refund Method */}
            <View style={styles.detailsSection}>
              {renderLine('Refund Method:', data.refundMethod)}
              {data.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>Notes:</Text>
                  <Text style={styles.notesText}>{data.notes}</Text>
                </View>
              )}
            </View>

            {renderSeparator()}

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Thank you!</Text>
              {data.footerText && (
                <Text style={styles.footerText}>{data.footerText}</Text>
              )}
              <View style={styles.officialReceipt}>
                <Text style={styles.officialText}>*** SALES RETURN ACKNOWLEDGMENT ***</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Email Input Section */}
        {showEmailInput && (
          <View style={styles.emailSection}>
            <TextInput
              label="Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError('');
              }}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={!!emailError}
              style={styles.emailInput}
              placeholder="customer@example.com"
            />
            {emailError ? (
              <Text style={styles.errorText}>{emailError}</Text>
            ) : null}
            <View style={styles.emailButtons}>
              <Button
                mode="outlined"
                onPress={() => {
                  setShowEmailInput(false);
                  setEmail('');
                  setEmailError('');
                }}
                style={styles.emailButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleEmailSubmit}
                style={styles.emailButton}
                loading={isSendingEmail}
                disabled={isSendingEmail}
              >
                Send
              </Button>
            </View>
          </View>
        )}

        {/* Actions */}
        {!showEmailInput && (
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onClose}
              style={styles.actionButton}
              disabled={isPrinting || isSendingEmail}
            >
              Close
            </Button>
            <Button
              mode="outlined"
              onPress={() => setShowEmailInput(true)}
              style={styles.actionButton}
              icon="email"
              disabled={isPrinting || isSendingEmail}
            >
              Email
            </Button>
            <Button
              mode="contained"
              onPress={handlePrint}
              style={styles.actionButton}
              loading={isPrinting}
              disabled={isPrinting || isSendingEmail}
              icon="printer"
            >
              Print
            </Button>
          </View>
        )}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    maxHeight: '90%',
  },
  scrollView: {
    maxHeight: 450,
  },
  receipt: {
    padding: 16,
    backgroundColor: 'white',
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  headerText: {
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
    color: '#333',
  },
  separator: {
    fontSize: 10,
    fontFamily: 'monospace',
    textAlign: 'center',
    color: '#999',
    marginVertical: 6,
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 8,
    fontFamily: 'monospace',
    color: '#F44336',
  },
  detailsSection: {
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 4,
    color: '#666',
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  lineTextLeft: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  lineTextRight: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  itemHeader: {
    flexDirection: 'row',
    marginTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  itemHeaderText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#666',
  },
  itemRow: {
    marginVertical: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  itemMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  itemReason: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontStyle: 'italic',
    color: '#666',
    marginTop: 2,
    marginLeft: 8,
  },
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 8,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#C62828',
  },
  notesSection: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#666',
  },
  notesText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontStyle: 'italic',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginVertical: 2,
  },
  officialReceipt: {
    marginTop: 8,
    alignItems: 'center',
  },
  officialText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#666',
  },
  emailSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  emailInput: {
    marginBottom: 8,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginBottom: 8,
  },
  emailButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  emailButton: {
    minWidth: 80,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
});
