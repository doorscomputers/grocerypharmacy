import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CartItem } from '../../hooks/usePOSCart';

// Format currency with commas
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

interface POSCartItemProps {
  item: CartItem;
  index: number; // Item number (1, 2, 3...)
  onIncrement: (productId: number) => void;
  onDecrement: (productId: number) => void;
  onRemove: (productId: number) => void;
  onQuantityPress?: (item: CartItem) => void; // For manual qty input
}

function POSCartItem({
  item,
  index,
  onIncrement,
  onDecrement,
  onRemove,
  onQuantityPress,
}: POSCartItemProps) {
  const lineTotal = item.price * item.quantity;

  const handleIncrement = useCallback(() => {
    onIncrement(item.id);
  }, [item.id, onIncrement]);

  const handleDecrement = useCallback(() => {
    onDecrement(item.id);
  }, [item.id, onDecrement]);

  const handleRemove = useCallback(() => {
    onRemove(item.id);
  }, [item.id, onRemove]);

  const handleQuantityPress = useCallback(() => {
    if (onQuantityPress) {
      onQuantityPress(item);
    }
  }, [item, onQuantityPress]);

  return (
    <View style={styles.container}>
      {/* Item Number */}
      <View style={styles.indexContainer}>
        <Text style={styles.indexText}>{index}</Text>
      </View>

      {/* Product Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name || 'Unknown Product'}
        </Text>
        <Text style={styles.unitPrice}>
          ₱{formatCurrency(item.price || 0)} × {item.quantity || 0}
        </Text>
      </View>

      {/* Quantity Controls */}
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={[styles.quantityButton, styles.decrementButton]}
          onPress={handleDecrement}
          activeOpacity={0.7}
        >
          <Text style={styles.quantityButtonText}>−</Text>
        </TouchableOpacity>

        {/* Tappable Quantity Display */}
        <TouchableOpacity
          style={styles.quantityDisplay}
          onPress={handleQuantityPress}
          activeOpacity={0.7}
        >
          <Text style={styles.quantityText}>{item.quantity || 0}</Text>
          <Text style={styles.editHint}>tap</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quantityButton, styles.incrementButton]}
          onPress={handleIncrement}
          activeOpacity={0.7}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Line Total */}
      <View style={styles.totalContainer}>
        <Text style={styles.lineTotal}>₱{formatCurrency(lineTotal)}</Text>
      </View>

      {/* Remove Button */}
      <TouchableOpacity
        style={styles.removeButton}
        onPress={handleRemove}
        activeOpacity={0.7}
      >
        <Text style={styles.removeButtonText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  indexContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  indexText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  infoContainer: {
    flex: 1,
    marginRight: 10,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
    lineHeight: 20,
  },
  unitPrice: {
    fontSize: 13,
    color: '#757575',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decrementButton: {
    backgroundColor: '#FFEBEE',
  },
  incrementButton: {
    backgroundColor: '#E8F5E9',
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    lineHeight: 22,
  },
  quantityDisplay: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    marginHorizontal: 4,
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  editHint: {
    fontSize: 9,
    color: '#9E9E9E',
    marginTop: -2,
  },
  totalContainer: {
    minWidth: 80,
    alignItems: 'flex-end',
    marginRight: 8,
  },
  lineTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 16,
  },
});

export default memo(POSCartItem);
