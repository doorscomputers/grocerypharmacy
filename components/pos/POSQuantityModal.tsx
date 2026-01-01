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
import { CartItem } from '../../hooks/usePOSCart';

interface POSQuantityModalProps {
  visible: boolean;
  item: CartItem | null;
  onConfirm: (productId: number, quantity: number) => void;
  onClose: () => void;
}

export default function POSQuantityModal({
  visible,
  item,
  onConfirm,
  onClose,
}: POSQuantityModalProps) {
  const [quantity, setQuantity] = useState('');

  // Initialize with current quantity when modal opens
  useEffect(() => {
    if (visible && item) {
      setQuantity(item.quantity.toString());
    }
  }, [visible, item]);

  const handleConfirm = () => {
    if (!item) return;

    const qty = parseInt(quantity, 10);

    // Validation
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Invalid Quantity', 'Please enter a quantity of at least 1');
      return;
    }

    if (qty > item.stock_quantity) {
      Alert.alert(
        'Insufficient Stock',
        `Only ${item.stock_quantity} available in stock`
      );
      return;
    }

    onConfirm(item.id, qty);
    onClose();
  };

  const handleQuickQty = (qty: number) => {
    if (item && qty <= item.stock_quantity) {
      setQuantity(qty.toString());
    }
  };

  if (!item) return null;

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
            <Text style={styles.headerTitle}>Enter Quantity</Text>
            <IconButton icon="close" size={24} onPress={onClose} />
          </View>

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.productPrice}>₱{item.price.toFixed(2)} each</Text>
            <Text style={styles.stockInfo}>Stock: {item.stock_quantity} available</Text>
          </View>

          {/* Quantity Input */}
          <View style={styles.inputSection}>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={(text) => {
                // Only allow numbers
                const cleaned = text.replace(/[^0-9]/g, '');
                setQuantity(cleaned);
              }}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#9E9E9E"
              autoFocus
              selectTextOnFocus
            />
          </View>

          {/* Quick Quantity Buttons */}
          <View style={styles.quickButtons}>
            {[1, 2, 5, 10, 12, 24].map((qty) => (
              <TouchableOpacity
                key={qty}
                style={[
                  styles.quickButton,
                  qty > item.stock_quantity && styles.quickButtonDisabled,
                ]}
                onPress={() => handleQuickQty(qty)}
                disabled={qty > item.stock_quantity}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.quickButtonText,
                  qty > item.stock_quantity && styles.quickButtonTextDisabled,
                ]}>
                  {qty}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Line Total Preview */}
          {quantity && parseInt(quantity, 10) > 0 && (
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Line Total:</Text>
              <Text style={styles.previewValue}>
                ₱{(item.price * parseInt(quantity, 10)).toFixed(2)}
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
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
    maxWidth: 340,
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
  productInfo: {
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  stockInfo: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  inputSection: {
    padding: 16,
    alignItems: 'center',
  },
  input: {
    width: '100%',
    fontSize: 36,
    fontWeight: '700',
    color: '#212121',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    textAlign: 'center',
  },
  quickButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 12,
    justifyContent: 'center',
  },
  quickButton: {
    width: 50,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  quickButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
  },
  quickButtonTextDisabled: {
    color: '#BDBDBD',
  },
  previewSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  previewLabel: {
    fontSize: 14,
    color: '#757575',
  },
  previewValue: {
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
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
