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
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { DatabaseService } from '../../database/DatabaseService';

interface POSPettyCashModalProps {
  visible: boolean;
  onClose: () => void;
  cashierId: number;
  onSuccess?: () => void;
}

export default function POSPettyCashModal({
  visible,
  onClose,
  cashierId,
  onSuccess,
}: POSPettyCashModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter the purpose/description');
      return;
    }

    if (!approvedBy.trim()) {
      Alert.alert('Error', 'Please enter who approved this withdrawal');
      return;
    }

    setIsLoading(true);
    try {
      const db = DatabaseService.getInstance();
      await db.createCashMovement({
        movement_type: 'PETTY_CASH',
        amount: amountValue,
        description: description.trim(),
        approved_by: approvedBy.trim(),
        cashier_id: cashierId,
      });

      Alert.alert('Success', `Petty Cash of ₱${amountValue.toFixed(2)} recorded successfully`);
      setAmount('');
      setDescription('');
      setApprovedBy('');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error recording petty cash:', error);
      Alert.alert('Error', 'Failed to record petty cash withdrawal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setDescription('');
    setApprovedBy('');
    onClose();
  };

  const commonReasons = [
    'Office Supplies',
    'Transportation',
    'Meals/Food',
    'Utilities',
    'Emergency Expense',
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Petty Cash Withdrawal</Text>
            <IconButton icon="close" size={24} onPress={handleClose} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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

            {/* Purpose/Description */}
            <View style={styles.section}>
              <Text style={styles.label}>Purpose/Description *</Text>
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="What is this withdrawal for?"
                placeholderTextColor="#9E9E9E"
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Quick Reasons */}
            <View style={styles.quickReasons}>
              {commonReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonChip,
                    description === reason && styles.reasonChipActive,
                  ]}
                  onPress={() => setDescription(reason)}
                >
                  <Text
                    style={[
                      styles.reasonChipText,
                      description === reason && styles.reasonChipTextActive,
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Approved By */}
            <View style={styles.section}>
              <Text style={styles.label}>Approved By (Owner/Manager) *</Text>
              <TextInput
                style={styles.textInput}
                value={approvedBy}
                onChangeText={setApprovedBy}
                placeholder="Name of person who approved"
                placeholderTextColor="#9E9E9E"
              />
            </View>

            {/* Warning Box */}
            <View style={styles.warningBox}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                This will be deducted from your expected cash drawer balance.
                Make sure to get proper authorization before withdrawing.
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
              <Text style={styles.saveBtnText}>
                {isLoading ? 'Recording...' : 'Record Withdrawal'}
              </Text>
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
    maxHeight: '85%',
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
    marginBottom: 16,
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
    color: '#C62828',
    borderWidth: 2,
    borderColor: '#EF5350',
    borderRadius: 12,
    padding: 16,
    textAlign: 'center',
    backgroundColor: '#FFEBEE',
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
  quickReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  reasonChip: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reasonChipActive: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  reasonChipText: {
    fontSize: 13,
    color: '#616161',
  },
  reasonChipTextActive: {
    color: '#E65100',
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#E65100',
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
    backgroundColor: '#FF9800',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#FFCC80',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
