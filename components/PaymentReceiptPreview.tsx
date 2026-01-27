import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Alert,
} from 'react-native';
import {
  Card,
  Button,
  TextInput,
  useTheme,
  Portal,
  Modal,
} from 'react-native-paper';

export interface PaymentReceiptData {
  // Business info
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  tin?: string;

  // Payment info
  paymentNumber: string;
  paymentDate: Date;
  receivedBy: string;

  // Customer info
  customerName: string;
  customerCode?: string;

  // Invoice info
  invoiceNumber: string;
  originalAmount: number;
  previouslyPaid: number;
  amountPaid: number;
  balanceAfterPayment: number;

  // Payment details
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;

  // Footer
  footerText?: string;
}

interface PaymentReceiptPreviewProps {
  data: PaymentReceiptData;
  visible: boolean;
  onClose: () => void;
  onPrint: () => Promise<void>;
  onSendEmail: (email: string) => Promise<void>;
  isPrinting?: boolean;
  isSendingEmail?: boolean;
}

export default function PaymentReceiptPreview({
  data,
  visible,
  onClose,
  onPrint,
  onSendEmail,
  isPrinting = false,
  isSendingEmail = false,
}: PaymentReceiptPreviewProps) {
  const theme = useTheme();
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
    // Standard email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(emailAddress.trim());
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
      Alert.alert('Success', `Receipt sent to ${trimmedEmail}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to send email. Please try again.');
    }
  };

  const handlePrint = async () => {
    try {
      await onPrint();
    } catch (error) {
      Alert.alert('Print Error', 'Failed to print receipt. Make sure printer is connected.');
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
            <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>

            {renderSeparator()}

            {/* Payment Details */}
            <View style={styles.detailsSection}>
              {renderLine('Receipt #:', data.paymentNumber)}
              {renderLine('Date:', formatDate(data.paymentDate))}
              {renderLine('Time:', formatTime(data.paymentDate))}
              {renderLine('Received By:', data.receivedBy)}
            </View>

            {renderSeparator()}

            {/* Customer Info */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>CUSTOMER</Text>
              {renderLine('Name:', data.customerName)}
              {data.customerCode && renderLine('Code:', data.customerCode)}
            </View>

            {renderSeparator()}

            {/* Invoice Info */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>PAYMENT FOR</Text>
              {renderLine('Invoice #:', data.invoiceNumber)}
              {renderLine('Invoice Amount:', formatCurrency(data.originalAmount))}
              {renderLine('Previously Paid:', formatCurrency(data.previouslyPaid))}
            </View>

            {renderDoubleSeparator()}

            {/* Payment Amount */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>AMOUNT PAID:</Text>
              <Text style={styles.amountValue}>{formatCurrency(data.amountPaid)}</Text>
            </View>

            <View style={styles.balanceSection}>
              {renderLine('Remaining Balance:', formatCurrency(data.balanceAfterPayment))}
            </View>

            {renderSeparator()}

            {/* Payment Method */}
            <View style={styles.detailsSection}>
              {renderLine('Payment Method:', data.paymentMethod)}
              {data.referenceNumber && renderLine('Reference #:', data.referenceNumber)}
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
              <Text style={styles.footerText}>Thank you for your payment!</Text>
              {data.footerText && (
                <Text style={styles.footerText}>{data.footerText}</Text>
              )}
              <View style={styles.officialReceipt}>
                <Text style={styles.officialText}>*** PAYMENT ACKNOWLEDGMENT ***</Text>
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
    color: '#2196F3',
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
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 8,
    backgroundColor: '#E8F5E9',
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
    color: '#2E7D32',
  },
  balanceSection: {
    marginVertical: 4,
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
