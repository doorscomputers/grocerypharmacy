import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { DatabaseService } from '../database/DatabaseService';

interface StartShiftDialogProps {
  visible: boolean;
  userId: number;
  onShiftStarted: (shiftId: number) => void;
  onCancel?: () => void;
}

// Format currency with commas
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function StartShiftDialog({
  visible,
  userId,
  onShiftStarted,
  onCancel,
}: StartShiftDialogProps) {
  const theme = useTheme();
  const [beginningCash, setBeginningCash] = useState<string>('');
  const [loading, setLoading] = useState(false);
  // NOTE: Each day starts fresh - cashier enters their own beginning cash
  // No suggestions from previous day's ending cash

  const handleStartShift = async () => {
    const cashAmount = parseFloat(beginningCash) || 0;

    if (cashAmount < 0) {
      Alert.alert('Invalid Amount', 'Beginning cash cannot be negative.');
      return;
    }

    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
      const shiftId = await dbService.startShift(userId, cashAmount);

      Alert.alert(
        'Shift Started',
        `Your shift has started with beginning cash of ₱${formatCurrency(cashAmount)}.`,
        [{ text: 'OK', onPress: () => onShiftStarted(shiftId) }]
      );
    } catch (error: any) {
      console.error('Error starting shift:', error);
      Alert.alert('Error', error.message || 'Failed to start shift. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerIcon}>⏱️</Text>
            <Text style={styles.headerTitle}>Start Your Shift</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.description}>
              Enter your beginning cash to start your shift. You won't be able to process sales until your shift is started.
            </Text>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Beginning Cash (₱)</Text>
              <TextInput
                style={styles.input}
                value={beginningCash}
                onChangeText={setBeginningCash}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />

            </View>
          </View>

          <View style={styles.actions}>
            {onCancel && (
              <Button
                mode="outlined"
                onPress={onCancel}
                style={styles.cancelButton}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            <Button
              mode="contained"
              onPress={handleStartShift}
              style={styles.startButton}
              loading={loading}
              disabled={loading}
            >
              Start Shift
            </Button>
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
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  header: {
    backgroundColor: '#1976D2',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    padding: 24,
  },
  description: {
    fontSize: 14,
    color: '#616161',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#212121',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  startButton: {
    flex: 2,
  },
});
