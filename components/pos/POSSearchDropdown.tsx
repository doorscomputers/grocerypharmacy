import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { Product } from '../../database/schema';

interface POSSearchDropdownProps {
  products: Product[];
  visible: boolean;
  onSelect: (product: Product) => void;
  searchQuery: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function POSSearchDropdown({
  products,
  visible,
  onSelect,
  searchQuery,
}: POSSearchDropdownProps) {
  const theme = useTheme();

  const handleSelect = useCallback((product: Product) => {
    onSelect(product);
  }, [onSelect]);

  if (!visible || products.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {products.length} result{products.length !== 1 ? 's' : ''} for "{searchQuery}"
        </Text>
      </View>
      <FlatList
        data={products}
        keyExtractor={item => item.id.toString()}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => handleSelect(item)}
            activeOpacity={0.7}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemCode}>{item.code}</Text>
            </View>
            <View style={styles.itemRight}>
              <Text style={[styles.itemPrice, { color: theme.colors.primary }]}>
                ₱{item.price.toFixed(2)}
              </Text>
              <Text style={[
                styles.itemStock,
                (item.stock_quantity || 0) <= 0 && styles.itemStockOut,
                (item.stock_quantity || 0) > 0 && (item.stock_quantity || 0) <= 5 && styles.itemStockLow,
              ]}>
                Stock: {item.stock_quantity || 0}
              </Text>
            </View>
            <View style={[styles.addIcon, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.addIconText}>+</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: SCREEN_HEIGHT * 0.4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerText: {
    fontSize: 12,
    color: '#616161',
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  itemCode: {
    fontSize: 12,
    color: '#757575',
  },
  itemRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  itemStock: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 2,
  },
  itemStockOut: {
    color: '#F44336',
  },
  itemStockLow: {
    color: '#FF9800',
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9E9E9E',
  },
});

export default memo(POSSearchDropdown);
