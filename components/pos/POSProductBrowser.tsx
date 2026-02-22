import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Product, Category } from '../../database/schema';
import POSProductCard from './POSProductCard';
import POSCategoryChips from './POSCategoryChips';

export interface POSProductBrowserContentProps {
  products: Product[];
  categories: Category[];
  onSelect: (product: Product) => void;
  getCartQuantity: (productId: number) => number;
  containerWidth?: number;
}

/**
 * Inner content of the product browser — search, category chips, product grid.
 * Can be used inline (landscape SalesScreen) or inside the modal wrapper.
 */
export const POSProductBrowserContent = memo(function POSProductBrowserContent({
  products,
  categories,
  onSelect,
  getCartQuantity,
  containerWidth,
}: POSProductBrowserContentProps) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const effectiveWidth = containerWidth || screenWidth;
  const numColumns = effectiveWidth > 600 ? 3 : 2;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== null) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => {
        const name = (p.name || '').toLowerCase();
        const code = (p.code || '').toLowerCase();
        return name.includes(query) || code.includes(query);
      });
    }
    return filtered;
  }, [products, selectedCategory, searchQuery]);

  const handleSelect = useCallback((product: Product) => {
    onSelect(product);
  }, [onSelect]);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <POSProductCard
      product={item}
      cartQuantity={getCartQuantity(item.id)}
      onPress={handleSelect}
      numColumns={numColumns}
      containerWidth={effectiveWidth}
    />
  ), [getCartQuantity, handleSelect, numColumns, effectiveWidth]);

  return (
    <View style={styles.contentContainer}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearch}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearSearchText}>x</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Chips */}
      <POSCategoryChips
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Product Grid */}
      <FlatList
        data={filteredProducts}
        keyExtractor={item => item.id.toString()}
        renderItem={renderProduct}
        numColumns={numColumns}
        key={`grid-${numColumns}`}
        contentContainerStyle={styles.productGrid}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'No products in this category'}
            </Text>
          </View>
        }
      />

      {/* Tap to select hint */}
      <View style={[styles.hint, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.hintText}>Tap a product to add to cart</Text>
      </View>
    </View>
  );
});

// -------- Modal Wrapper (original POSProductBrowser) --------

interface POSProductBrowserProps {
  visible: boolean;
  products: Product[];
  categories: Category[];
  onSelect: (product: Product) => void;
  onClose: () => void;
  getCartQuantity: (productId: number) => number;
}

function POSProductBrowser({
  visible,
  products,
  categories,
  onSelect,
  onClose,
  getCartQuantity,
}: POSProductBrowserProps) {
  const handleSelect = useCallback((product: Product) => {
    onSelect(product);
    onClose();
  }, [onSelect, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              icon="close"
              size={24}
              onPress={handleClose}
            />
            <Text style={styles.headerTitle}>Browse Products</Text>
          </View>
        </View>

        <POSProductBrowserContent
          products={products}
          categories={categories}
          onSelect={handleSelect}
          getCartQuantity={getCartQuantity}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  clearSearch: {
    position: 'absolute',
    right: 20,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#9E9E9E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearSearchText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  productGrid: {
    padding: 8,
    paddingBottom: 60,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    alignItems: 'center',
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default memo(POSProductBrowser);
