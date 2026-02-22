import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useResponsiveTheme } from '../../utils/responsive';

interface POSDiscountWarningBannerProps {
  discountAmount: number;
  totalAmount: number;
  originalAmount?: number; // subtotal + tax before discount
  scPwdId?: string;
  scPwdName?: string;
  scPwdType?: 'SENIOR' | 'PWD';
}

// Format currency with commas
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function POSDiscountWarningBanner({
  discountAmount,
  totalAmount,
  originalAmount,
  scPwdId,
  scPwdName,
  scPwdType,
}: POSDiscountWarningBannerProps) {
  const { sp, fs, lo } = useResponsiveTheme();

  if (!discountAmount || discountAmount <= 0) {
    return null;
  }

  const isSCPWD = scPwdId && scPwdType;
  const discountTypeLabel = scPwdType === 'SENIOR' ? 'Senior Citizen' : scPwdType === 'PWD' ? 'PWD' : 'Regular';

  return (
    <View style={[styles.container, { padding: sp.sm }]}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="alert" size={20} color="#8B4513" />
        <Text style={[styles.headerText, { fontSize: fs.bodySmall }]}>DISCOUNT APPLIED</Text>
      </View>

      <Text style={[styles.warningText, { fontSize: fs.bodySmall }]}>
        This invoice has a{' '}
        <Text style={styles.amountHighlight}>₱{formatCurrency(discountAmount)}</Text>{' '}
        discount applied.
      </Text>

      <Text style={styles.refundText}>
        Only the discounted amount of{' '}
        <Text style={styles.amountHighlight}>₱{formatCurrency(totalAmount)}</Text>{' '}
        can be refunded/exchanged.
      </Text>

      {originalAmount && originalAmount > totalAmount && (
        <Text style={styles.originalText}>
          Original amount: ₱{formatCurrency(originalAmount)}
        </Text>
      )}

      {isSCPWD && (
        <View style={styles.scPwdInfo}>
          <Text style={styles.scPwdText}>
            {discountTypeLabel} Discount: {scPwdName} (ID: {scPwdId})
          </Text>
          <Text style={styles.scPwdNote}>
            VAT-exempt portion included in discount
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFCC00',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#8B4513',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#664d03',
    marginBottom: 4,
  },
  refundText: {
    fontSize: 13,
    color: '#664d03',
    fontWeight: '500',
  },
  amountHighlight: {
    fontWeight: 'bold',
    color: '#8B4513',
  },
  originalText: {
    fontSize: 12,
    color: '#856404',
    marginTop: 4,
    fontStyle: 'italic',
  },
  scPwdInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFCC00',
  },
  scPwdText: {
    fontSize: 12,
    color: '#664d03',
    fontWeight: '500',
  },
  scPwdNote: {
    fontSize: 11,
    color: '#856404',
    fontStyle: 'italic',
    marginTop: 2,
  },
});
