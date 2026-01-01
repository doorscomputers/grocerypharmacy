import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Product } from '../../database/schema';

interface POSProductCardProps {
  product: Product;
  cartQuantity: number;
  onPress: (product: Product) => void;
  numColumns?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function POSProductCard({ product, cartQuantity, onPress, numColumns = 2 }: POSProductCardProps) {
  const theme = useTheme();

  const handlePress = useCallback(() => {
    onPress(product);
  }, [product, onPress]);

  const isOutOfStock = (product.stock_quantity || 0) <= 0;
  const isLowStock = (product.stock_quantity || 0) <= 5 && !isOutOfStock;

  // Calculate card width based on screen width and columns
  const cardWidth = (SCREEN_WIDTH - 32 - (numColumns - 1) * 8) / numColumns;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { width: cardWidth },
        isOutOfStock && styles.cardOutOfStock,
        cartQuantity > 0 && styles.cardInCart,
      ]}
      onPress={handlePress}
      disabled={isOutOfStock}
      activeOpacity={0.7}
    >
      {/* Stock badge */}
      {isOutOfStock && (
        <View style={styles.outOfStockBadge}>
          <Text style={styles.outOfStockText}>OUT</Text>
        </View>
      )}
      {isLowStock && !isOutOfStock && (
        <View style={styles.lowStockBadge}>
          <Text style={styles.lowStockText}>{product.stock_quantity}</Text>
        </View>
      )}

      {/* Cart quantity badge */}
      {cartQuantity > 0 && (
        <View style={[styles.cartBadge, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.cartBadgeText}>{cartQuantity}</Text>
        </View>
      )}

      {/* Product info */}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.productCode} numberOfLines={1}>
          {product.code}
        </Text>
      </View>

      {/* Price */}
      <View style={styles.priceContainer}>
        <Text style={[styles.price, isOutOfStock && styles.priceOutOfStock]}>
          ₱{product.price.toFixed(2)}
        </Text>
      </View>

      {/* Quick add indicator */}
      {!isOutOfStock && (
        <View style={[styles.addIndicator, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.addIndicatorText}>+</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    marginRight: 8,
    minHeight: 120,
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    position: 'relative',
  },
  cardOutOfStock: {
    backgroundColor: '#F5F5F5',
    opacity: 0.7,
  },
  cardInCart: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    lineHeight: 18,
    marginBottom: 4,
  },
  productCode: {
    fontSize: 11,
    color: '#757575',
  },
  priceContainer: {
    marginTop: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  priceOutOfStock: {
    color: '#9E9E9E',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F44336',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  outOfStockText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  lowStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lowStockText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIndicatorText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
});

export default memo(POSProductCard);
