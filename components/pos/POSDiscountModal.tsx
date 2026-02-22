import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { useResponsiveTheme } from '../../utils/responsive';

interface POSDiscountModalProps {
  visible: boolean;
  subtotal: number;
  currentType: 'none' | 'percent' | 'amount' | 'senior';
  currentValue: string;
  onApply: (type: 'percent' | 'amount', value: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function POSDiscountModal({
  visible,
  subtotal,
  currentType,
  currentValue,
  onApply,
  onClear,
  onClose,
}: POSDiscountModalProps) {
  const { sp, fs, lo } = useResponsiveTheme();
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('');

  // Initialize with current values when modal opens
  useEffect(() => {
    if (visible) {
      if (currentType === 'percent' || currentType === 'amount') {
        setDiscountType(currentType);
        setValue(currentValue || '');
      } else {
        setDiscountType('percent');
        setValue('');
      }
    }
  }, [visible, currentType, currentValue]);

  const handleApply = () => {
    const numValue = parseFloat(value) || 0;

    // Validation
    if (numValue <= 0) {
      Alert.alert('Invalid Discount', 'Please enter a value greater than 0');
      return;
    }

    if (discountType === 'percent') {
      if (numValue > 100) {
        Alert.alert('Invalid Percentage', 'Percentage cannot exceed 100%');
        return;
      }
    } else {
      // Fixed amount
      if (numValue > subtotal) {
        Alert.alert(
          'Invalid Amount',
          `Discount cannot exceed subtotal of ₱${subtotal.toFixed(2)}`
        );
        return;
      }
    }

    onApply(discountType, value);
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  // Calculate preview
  const numValue = parseFloat(value) || 0;
  let previewDiscount = 0;
  if (discountType === 'percent' && numValue > 0 && numValue <= 100) {
    previewDiscount = (subtotal * numValue) / 100;
  } else if (discountType === 'amount' && numValue > 0 && numValue <= subtotal) {
    previewDiscount = numValue;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { maxWidth: lo.modalMaxWidth }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { fontSize: fs.h3 }]}>Apply Discount</Text>
            <IconButton icon="close" size={24} onPress={onClose} />
          </View>

          {/* Discount Type Selection */}
          <View style={[styles.typeSection, { padding: sp.md }]}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                discountType === 'percent' && styles.typeButtonActive,
              ]}
              onPress={() => {
                setDiscountType('percent');
                setValue('');
              }}
              activeOpacity={0.7}
            >
              <View style={[
                styles.radio,
                discountType === 'percent' && styles.radioActive,
              ]}>
                {discountType === 'percent' && <View style={styles.radioInner} />}
              </View>
              <Text style={[
                styles.typeButtonText,
                discountType === 'percent' && styles.typeButtonTextActive,
              ]}>
                Percentage (%)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                discountType === 'amount' && styles.typeButtonActive,
              ]}
              onPress={() => {
                setDiscountType('amount');
                setValue('');
              }}
              activeOpacity={0.7}
            >
              <View style={[
                styles.radio,
                discountType === 'amount' && styles.radioActive,
              ]}>
                {discountType === 'amount' && <View style={styles.radioInner} />}
              </View>
              <Text style={[
                styles.typeButtonText,
                discountType === 'amount' && styles.typeButtonTextActive,
              ]}>
                Fixed Amount (₱)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Value Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              {discountType === 'percent' ? 'Enter Percentage' : 'Enter Amount'}
            </Text>
            <View style={styles.inputRow}>
              {discountType === 'amount' && (
                <Text style={styles.currencyPrefix}>₱</Text>
              )}
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={(text) => {
                  // Only allow numbers and one decimal point
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  if (parts.length > 2) return;
                  setValue(cleaned);
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#BDBDBD"
                autoFocus
              />
              {discountType === 'percent' && (
                <Text style={styles.percentSuffix}>%</Text>
              )}
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Subtotal:</Text>
              <Text style={styles.infoValue}>₱{subtotal.toFixed(2)}</Text>
            </View>
            {discountType === 'amount' && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Max Discount:</Text>
                <Text style={styles.infoValue}>₱{subtotal.toFixed(2)}</Text>
              </View>
            )}
            {previewDiscount > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelHighlight}>Discount Preview:</Text>
                <Text style={styles.infoValueHighlight}>
                  -₱{previewDiscount.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {(currentType === 'percent' || currentType === 'amount') && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <Text style={styles.clearButtonText}>Clear Discount</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
              activeOpacity={0.7}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    maxWidth: 360,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  typeSection: {
    padding: 16,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    marginBottom: 10,
  },
  typeButtonActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#9E9E9E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioActive: {
    borderColor: '#2196F3',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#616161',
  },
  typeButtonTextActive: {
    color: '#1976D2',
    fontWeight: '600',
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#616161',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '600',
    color: '#212121',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#212121',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center',
  },
  percentSuffix: {
    fontSize: 24,
    fontWeight: '600',
    color: '#212121',
    marginLeft: 8,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#757575',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  infoLabelHighlight: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  infoValueHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F44336',
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#FFEBEE',
    marginRight: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#616161',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
