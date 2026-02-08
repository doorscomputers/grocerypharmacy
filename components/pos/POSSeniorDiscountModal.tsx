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

interface ScPwdInfo {
  id: string;
  name: string;
  type: 'SENIOR' | 'PWD';
}

interface POSSeniorDiscountModalProps {
  visible: boolean;
  subtotal: number;
  vatAmount: number;
  currentTotalCustomers: number;
  currentSeniorCount: number;
  isSeniorApplied: boolean;
  currentScPwdInfo?: ScPwdInfo;
  onApply: (totalCustomers: number, seniorCount: number, scPwdInfo?: ScPwdInfo) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function POSSeniorDiscountModal({
  visible,
  subtotal,
  vatAmount,
  currentTotalCustomers,
  currentSeniorCount,
  isSeniorApplied,
  currentScPwdInfo,
  onApply,
  onClear,
  onClose,
}: POSSeniorDiscountModalProps) {
  const [totalCustomers, setTotalCustomers] = useState('1');
  const [seniorCount, setSeniorCount] = useState('1');
  // BIR Compliance: SC/PWD ID and Name capture
  const [scPwdId, setScPwdId] = useState('');
  const [scPwdName, setScPwdName] = useState('');
  const [discountType, setDiscountType] = useState<'SENIOR' | 'PWD'>('SENIOR');

  // Initialize with current values when modal opens
  useEffect(() => {
    if (visible) {
      if (isSeniorApplied) {
        setTotalCustomers(currentTotalCustomers.toString());
        setSeniorCount(currentSeniorCount.toString());
        if (currentScPwdInfo) {
          setScPwdId(currentScPwdInfo.id);
          setScPwdName(currentScPwdInfo.name);
          setDiscountType(currentScPwdInfo.type);
        }
      } else {
        setTotalCustomers('1');
        setSeniorCount('1');
        setScPwdId('');
        setScPwdName('');
        setDiscountType('SENIOR');
      }
    }
  }, [visible, isSeniorApplied, currentTotalCustomers, currentSeniorCount, currentScPwdInfo]);

  const handleApply = () => {
    const total = parseInt(totalCustomers) || 0;
    const seniors = parseInt(seniorCount) || 0;

    // Validation
    if (total < 1) {
      Alert.alert('Invalid Input', 'Total customers must be at least 1');
      return;
    }

    if (seniors < 1) {
      Alert.alert('Invalid Input', 'Senior count must be at least 1');
      return;
    }

    if (seniors > total) {
      Alert.alert(
        'Invalid Input',
        'Senior count cannot exceed total customers'
      );
      return;
    }

    // BIR Compliance: Validate SC/PWD ID (required for BIR)
    if (!scPwdId.trim()) {
      Alert.alert('ID Required', `Please enter the ${discountType === 'SENIOR' ? 'Senior Citizen' : 'PWD'} ID number for BIR compliance.`);
      return;
    }

    // BIR Compliance: Validate SC/PWD Name (required for BIR)
    if (!scPwdName.trim()) {
      Alert.alert('Name Required', `Please enter the ${discountType === 'SENIOR' ? 'Senior Citizen' : 'PWD'} name for BIR compliance.`);
      return;
    }

    const scPwdInfo: ScPwdInfo = {
      id: scPwdId.trim(),
      name: scPwdName.trim(),
      type: discountType,
    };

    onApply(total, seniors, scPwdInfo);
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  const handleTotalChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setTotalCustomers(cleaned);

    // Auto-adjust senior count if it exceeds new total
    const newTotal = parseInt(cleaned) || 0;
    const currentSeniors = parseInt(seniorCount) || 0;
    if (currentSeniors > newTotal && newTotal > 0) {
      setSeniorCount(cleaned);
    }
  };

  const handleSeniorChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const newSeniors = parseInt(cleaned) || 0;
    const total = parseInt(totalCustomers) || 0;

    // Don't allow senior count to exceed total
    if (newSeniors <= total || cleaned === '') {
      setSeniorCount(cleaned);
    }
  };

  // Calculate preview
  const total = parseInt(totalCustomers) || 0;
  const seniors = parseInt(seniorCount) || 0;
  let previewDiscount = 0;
  let seniorPortion = 0;
  let vatSaved = 0;

  if (total > 0 && seniors > 0 && seniors <= total) {
    // Per-person share of subtotal (VAT-exclusive)
    const perPersonSubtotal = subtotal / total;
    // Per-person share of VAT
    const perPersonVat = vatAmount / total;

    // Senior portion
    seniorPortion = perPersonSubtotal * seniors;
    // 20% discount on senior's VAT-exclusive amount
    previewDiscount = seniorPortion * 0.20;
    // VAT saved (seniors are VAT-exempt)
    vatSaved = perPersonVat * seniors;
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
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>👴</Text>
              <Text style={styles.headerTitle}>Senior Citizen / PWD Discount</Text>
            </View>
            <IconButton icon="close" size={24} onPress={onClose} />
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              20% discount on VAT-exclusive price + VAT exemption
            </Text>
            <Text style={styles.infoBannerSubtext}>
              (Applies only to senior's portion)
            </Text>
          </View>

          {/* Customer Count Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Total Number of Customers</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => {
                  const current = parseInt(totalCustomers) || 0;
                  if (current > 1) {
                    const newVal = (current - 1).toString();
                    handleTotalChange(newVal);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.stepButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={totalCustomers}
                onChangeText={handleTotalChange}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor="#9E9E9E"
                textAlign="center"
              />
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => {
                  const current = parseInt(totalCustomers) || 0;
                  handleTotalChange((current + 1).toString());
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.stepButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Senior Count Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Number of Senior Citizens / PWD</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => {
                  const current = parseInt(seniorCount) || 0;
                  if (current > 1) {
                    setSeniorCount((current - 1).toString());
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.stepButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={seniorCount}
                onChangeText={handleSeniorChange}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor="#9E9E9E"
                textAlign="center"
              />
              <TouchableOpacity
                style={[
                  styles.stepButton,
                  seniors >= total && styles.stepButtonDisabled,
                ]}
                onPress={() => {
                  const current = parseInt(seniorCount) || 0;
                  const max = parseInt(totalCustomers) || 0;
                  if (current < max) {
                    setSeniorCount((current + 1).toString());
                  }
                }}
                activeOpacity={0.7}
                disabled={seniors >= total}
              >
                <Text style={[
                  styles.stepButtonText,
                  seniors >= total && styles.stepButtonTextDisabled,
                ]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* BIR Compliance: Discount Type Selector */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Discount Type (BIR Required)</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  discountType === 'SENIOR' && styles.typeButtonActive,
                ]}
                onPress={() => setDiscountType('SENIOR')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.typeButtonText,
                  discountType === 'SENIOR' && styles.typeButtonTextActive,
                ]}>Senior Citizen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  discountType === 'PWD' && styles.typeButtonActive,
                ]}
                onPress={() => setDiscountType('PWD')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.typeButtonText,
                  discountType === 'PWD' && styles.typeButtonTextActive,
                ]}>PWD</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* BIR Compliance: SC/PWD ID Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              {discountType === 'SENIOR' ? 'Senior Citizen' : 'PWD'} ID Number *
            </Text>
            <TextInput
              style={styles.textInputField}
              value={scPwdId}
              onChangeText={setScPwdId}
              placeholder={`Enter ${discountType === 'SENIOR' ? 'OSCA' : 'PWD'} ID Number`}
              placeholderTextColor="#9E9E9E"
              autoCapitalize="characters"
            />
          </View>

          {/* BIR Compliance: SC/PWD Name Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              {discountType === 'SENIOR' ? 'Senior Citizen' : 'PWD'} Name *
            </Text>
            <TextInput
              style={styles.textInputField}
              value={scPwdName}
              onChangeText={setScPwdName}
              placeholder="Enter full name as shown on ID"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="words"
            />
          </View>

          {/* Calculation Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Discount Preview</Text>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Subtotal (VAT-exclusive):</Text>
              <Text style={styles.previewValue}>₱{subtotal.toFixed(2)}</Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>VAT Amount:</Text>
              <Text style={styles.previewValue}>₱{vatAmount.toFixed(2)}</Text>
            </View>

            {total > 0 && seniors > 0 && (
              <>
                <View style={styles.divider} />

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>
                    Senior Portion ({seniors}/{total}):
                  </Text>
                  <Text style={styles.previewValue}>₱{seniorPortion.toFixed(2)}</Text>
                </View>

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabelHighlight}>20% SC Discount:</Text>
                  <Text style={styles.previewValueDiscount}>
                    -₱{previewDiscount.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabelHighlight}>VAT Exemption:</Text>
                  <Text style={styles.previewValueDiscount}>
                    -₱{vatSaved.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.previewRow}>
                  <Text style={styles.totalSavingsLabel}>Total Savings:</Text>
                  <Text style={styles.totalSavingsValue}>
                    ₱{(previewDiscount + vatSaved).toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {isSeniorApplied && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <Text style={styles.clearButtonText}>Remove</Text>
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
    maxWidth: 400,
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
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  infoBanner: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    margin: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  infoBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'center',
  },
  infoBannerSubtext: {
    fontSize: 11,
    color: '#388E3C',
    textAlign: 'center',
    marginTop: 2,
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  stepButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepButtonTextDisabled: {
    color: '#9E9E9E',
  },
  input: {
    width: 100,
    fontSize: 32,
    fontWeight: '700',
    color: '#212121',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 8,
    marginHorizontal: 16,
  },
  previewSection: {
    backgroundColor: '#FAFAFA',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#424242',
    marginBottom: 12,
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  previewLabel: {
    fontSize: 13,
    color: '#616161',
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#212121',
  },
  previewLabelHighlight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  previewValueDiscount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F44336',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  totalSavingsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976D2',
  },
  totalSavingsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
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
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // BIR Compliance: Type selector styles
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  typeButtonTextActive: {
    color: '#1976D2',
  },
  // BIR Compliance: Text input field styles
  textInputField: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
});
