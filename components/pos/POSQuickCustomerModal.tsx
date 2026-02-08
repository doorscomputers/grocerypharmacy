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

interface POSQuickCustomerModalProps {
  visible: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: { id: number; name: string; phone?: string; code?: string }) => void;
  userId: number;
}

export default function POSQuickCustomerModal({
  visible,
  onClose,
  onCustomerCreated,
  userId,
}: POSQuickCustomerModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tin, setTin] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    setIsLoading(true);
    try {
      const db = DatabaseService.getInstance();
      const customerId = await db.createCustomerWithAudit(
        {
          name: name.trim(),
          phone: phone.trim() || undefined,
          tin: tin.trim() || undefined,
          address: address.trim() || undefined,
          credit_limit: creditLimit ? parseFloat(creditLimit) : 0,
          credit_terms: 30,
        },
        userId
      );

      // Get the created customer details
      const customer = await db.getCustomerWithBalance(customerId);

      Alert.alert('Success', `Customer "${name}" added successfully`);

      onCustomerCreated({
        id: customerId,
        name: name.trim(),
        phone: phone.trim() || undefined,
        code: customer?.code,
      });

      handleClose();
    } catch (error: any) {
      console.error('Error creating customer:', error);
      Alert.alert('Error', error?.message || 'Failed to create customer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setPhone('');
    setTin('');
    setAddress('');
    setCreditLimit('');
    onClose();
  };

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
            <View>
              <Text style={styles.headerTitle}>Quick Add Customer</Text>
              <Text style={styles.headerSubtitle}>Add new customer for this transaction</Text>
            </View>
            <IconButton icon="close" size={24} iconColor="#FFFFFF" onPress={handleClose} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Name - Required */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Customer Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter customer name"
                placeholderTextColor="#9E9E9E"
                autoFocus
              />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g., 09171234567"
                placeholderTextColor="#9E9E9E"
                keyboardType="phone-pad"
              />
            </View>

            {/* TIN - Optional */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>TIN (Tax ID)</Text>
              <TextInput
                style={styles.input}
                value={tin}
                onChangeText={setTin}
                placeholder="e.g., 123-456-789-000"
                placeholderTextColor="#9E9E9E"
              />
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={address}
                onChangeText={setAddress}
                placeholder="Customer address (optional)"
                placeholderTextColor="#9E9E9E"
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Credit Limit */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Credit Limit (₱)</Text>
              <TextInput
                style={styles.input}
                value={creditLimit}
                onChangeText={setCreditLimit}
                placeholder="0.00"
                placeholderTextColor="#9E9E9E"
                keyboardType="decimal-pad"
              />
              <Text style={styles.helperText}>
                Set a credit limit if this customer will use charge invoices
              </Text>
            </View>

            {/* Info Note */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>
                This customer will be automatically selected for the current transaction.
                You can edit more details later from Customer Management.
              </Text>
            </View>

            {/* Audit Trail Note */}
            <View style={styles.auditNote}>
              <Text style={styles.auditIcon}>📋</Text>
              <Text style={styles.auditText}>
                All customer changes are logged for audit purposes.
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
              disabled={isLoading || !name.trim()}
            >
              <Text style={styles.saveBtnText}>
                {isLoading ? 'Saving...' : 'Add & Select'}
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
    maxWidth: 420,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 12,
    backgroundColor: '#00897B',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#B2DFDB',
    marginTop: 2,
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FAFAFA',
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 70,
  },
  helperText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 6,
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  auditNote: {
    flexDirection: 'row',
    backgroundColor: '#F3E5F5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  auditIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  auditText: {
    flex: 1,
    fontSize: 12,
    color: '#7B1FA2',
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
    backgroundColor: '#00897B',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#80CBC4',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
