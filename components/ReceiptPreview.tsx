import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
} from 'react-native';
import {
  Card,
  Button,
  Divider,
  useTheme,
} from 'react-native-paper';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptData {
  // Business info
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  tin?: string;
  permitNumber?: string;

  // Transaction info
  invoiceNumber: string;
  transactionDate: Date;
  cashierName: string;

  // Items
  items: ReceiptItem[];

  // Totals
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  discountLabel?: string;
  total: number;

  // BIR VAT Breakdown
  vatableSales?: number;
  vatExemptSales?: number;
  zeroRatedSales?: number;
  vatAmount?: number;

  // Payment
  paymentMethod: string;
  amountTendered: number;
  changeAmount: number;

  // Customer
  customerName?: string;

  // Footer
  footerText?: string;
}

interface ReceiptPreviewProps {
  data: ReceiptData;
  width?: '58mm' | '80mm';
  onPrint?: () => void;
  onClose?: () => void;
  isPrinting?: boolean;
  showActions?: boolean;
}

export default function ReceiptPreview({
  data,
  width = '58mm',
  onPrint,
  onClose,
  isPrinting = false,
  showActions = true,
}: ReceiptPreviewProps) {
  const theme = useTheme();

  // Character width based on paper size
  const charWidth = width === '58mm' ? 32 : 48;

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
    });
  };

  const formatCurrency = (amount: number): string => {
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return `P${safeAmount.toFixed(2)}`;
  };

  const renderLine = (left: string, right: string): React.ReactNode => {
    // Defensive checks for null/undefined values
    const safeLeft = String(left || '');
    const safeRight = String(right || '');
    const maxLeftWidth = charWidth - safeRight.length - 1;
    const truncatedLeft = safeLeft.length > maxLeftWidth
      ? safeLeft.substring(0, maxLeftWidth - 2) + '..'
      : safeLeft;

    return (
      <View style={styles.lineRow}>
        <Text style={styles.lineText}>{truncatedLeft}</Text>
        <Text style={styles.lineText}>{safeRight}</Text>
      </View>
    );
  };

  const renderSeparator = (char: string = '-'): React.ReactNode => {
    return (
      <Text style={styles.separator}>
        {char.repeat(charWidth)}
      </Text>
    );
  };

  const renderDoubleSeparator = (): React.ReactNode => {
    return (
      <Text style={styles.separator}>
        {'='.repeat(charWidth)}
      </Text>
    );
  };

  return (
    <Card style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[
          styles.receipt,
          { width: width === '58mm' ? 280 : 380 }
        ]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.businessName}>{data.businessName || 'Store'}</Text>
            {data.businessAddress ? (
              <Text style={styles.headerText}>{data.businessAddress}</Text>
            ) : null}
            {data.businessPhone ? (
              <Text style={styles.headerText}>Tel: {data.businessPhone}</Text>
            ) : null}
            {data.tin ? (
              <Text style={styles.headerText}>TIN: {data.tin}</Text>
            ) : null}
            {data.permitNumber ? (
              <Text style={styles.headerText}>Permit No: {data.permitNumber}</Text>
            ) : null}
          </View>

          {renderDoubleSeparator()}

          {/* Transaction Type */}
          <Text style={styles.invoiceTitle}>SALES INVOICE</Text>

          {renderSeparator()}

          {/* Transaction Details */}
          <View style={styles.detailsSection}>
            {renderLine('Invoice #:', data.invoiceNumber || '')}
            {renderLine('Date:', formatDate(data.transactionDate))}
            {renderLine('Time:', formatTime(data.transactionDate))}
            {renderLine('Cashier:', data.cashierName || '')}
            {data.customerName ? renderLine('Customer:', data.customerName) : null}
          </View>

          {renderSeparator()}

          {/* Items Header */}
          <View style={styles.itemsHeader}>
            <Text style={[styles.columnHeader, { flex: 2 }]}>Item</Text>
            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Amount</Text>
          </View>

          {renderSeparator()}

          {/* Items */}
          <View style={styles.itemsSection}>
            {(data.items || []).map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name || 'Item'}
                </Text>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQtyPrice}>
                    {item.quantity || 0} x {formatCurrency(item.unitPrice || 0)}
                  </Text>
                  <Text style={styles.itemTotal}>
                    {formatCurrency(item.totalPrice || 0)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {renderSeparator()}

          {/* BIR VAT Breakdown */}
          <View style={styles.totalsSection}>
            {/* Show VAT breakdown if available */}
            {(data.vatableSales !== undefined || data.vatExemptSales !== undefined || data.zeroRatedSales !== undefined) ? (
              <>
                {renderLine('VATable Sales:', formatCurrency(data.vatableSales || 0))}
                {renderLine('VAT-Exempt Sales:', formatCurrency(data.vatExemptSales || 0))}
                {renderLine('Zero-Rated Sales:', formatCurrency(data.zeroRatedSales || 0))}
                {renderLine('VAT Amount (12%):', formatCurrency(data.vatAmount || 0))}
              </>
            ) : (
              <>
                {renderLine('Subtotal:', formatCurrency(data.subtotal))}
                {renderLine('VAT (12%):', formatCurrency(data.taxAmount))}
              </>
            )}
            {data.discountAmount && data.discountAmount > 0 ? (
              renderLine(
                data.discountLabel || 'Discount:',
                `-${formatCurrency(data.discountAmount)}`
              )
            ) : null}
          </View>

          {renderDoubleSeparator()}

          {/* Grand Total */}
          <View style={styles.grandTotal}>
            <Text style={styles.totalLabel}>TOTAL:</Text>
            <Text style={styles.totalAmount}>{formatCurrency(data.total)}</Text>
          </View>

          {renderSeparator()}

          {/* Payment Details */}
          <View style={styles.paymentSection}>
            {renderLine('Payment:', data.paymentMethod || 'CASH')}
            {renderLine('Tendered:', formatCurrency(data.amountTendered || 0))}
            {renderLine('Change:', formatCurrency(data.changeAmount || 0))}
          </View>

          {renderSeparator()}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for your purchase!</Text>
            <Text style={styles.footerText}>Please come again</Text>
            {data.footerText ? (
              <Text style={styles.footerText}>{data.footerText}</Text>
            ) : null}
            <View style={styles.officialReceipt}>
              <Text style={styles.officialText}>*** THIS SERVES AS YOUR ***</Text>
              <Text style={styles.officialText}>*** OFFICIAL RECEIPT ***</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      {showActions && (
        <View style={styles.actions}>
          {onClose && (
            <Button
              mode="outlined"
              onPress={onClose}
              style={styles.actionButton}
              disabled={isPrinting}
            >
              Close
            </Button>
          )}
          {onPrint && (
            <Button
              mode="contained"
              onPress={onPrint}
              style={styles.actionButton}
              loading={isPrinting}
              disabled={isPrinting}
              icon="printer"
            >
              Print Receipt
            </Button>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 16,
    maxHeight: '90%',
  },
  scrollView: {
    maxHeight: 500,
  },
  receipt: {
    padding: 16,
    backgroundColor: 'white',
    alignSelf: 'center',
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
    color: '#666',
    marginVertical: 4,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 8,
    fontFamily: 'monospace',
  },
  detailsSection: {
    marginVertical: 4,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  lineText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  itemsHeader: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  itemsSection: {
    marginVertical: 4,
  },
  itemRow: {
    marginVertical: 4,
  },
  itemName: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 8,
  },
  itemQtyPrice: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#666',
  },
  itemTotal: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  totalsSection: {
    marginVertical: 4,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#2E7D32',
  },
  paymentSection: {
    marginVertical: 4,
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
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});
