import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  List,
  FAB,
  IconButton,
  useTheme,
  Dialog,
  Portal,
  Chip,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import { Product as BaseProduct } from '../database/schema';

interface Product extends BaseProduct {
  category_name?: string;
}

type ProductsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Products'
>;

type Props = {
  navigation: ProductsScreenNavigationProp;
};

export default function ProductsScreen({ navigation }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    price: '',
    cost: '',
    stock_quantity: '',
    unit: 'pcs',
    tax_rate: '12.00',
    is_vat_inclusive: true,
  });
  const theme = useTheme();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
      const rawProductList = await dbService.getProducts(false); // Load all products
      setProducts(rawProductList as Product[]);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      price: '',
      cost: '',
      stock_quantity: '',
      unit: 'pcs',
      tax_rate: '12.00',
      is_vat_inclusive: true,
    });
    setEditingProduct(null);
  };

  const handleAddProduct = () => {
    resetForm();
    setDialogVisible(true);
  };

  const handleEditProduct = (product: Product) => {
    setFormData({
      code: product.code,
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      cost: product.cost.toString(),
      stock_quantity: product.stock_quantity.toString(),
      unit: product.unit,
      tax_rate: product.tax_rate.toString(),
      is_vat_inclusive: product.is_vat_inclusive,
    });
    setEditingProduct(product);
    setDialogVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!formData.code || !formData.name || !formData.price) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();

      const productData = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost) || 0,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        unit: formData.unit,
        tax_rate: parseFloat(formData.tax_rate),
        is_vat_inclusive: formData.is_vat_inclusive,
      };

      if (editingProduct) {
        // Update product (would need update method in DatabaseService)
        Alert.alert('Info', 'Update functionality not implemented yet');
      } else {
        await dbService.createProduct(productData);
        Alert.alert('Success', 'Product added successfully');
      }

      setDialogVisible(false);
      resetForm();
      await loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.category_name && product.category_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderProduct = ({ item }: { item: Product }) => (
    <Card style={styles.productCard}>
      <Card.Content>
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Title style={styles.productName}>{item.name}</Title>
            <Paragraph style={styles.productCode}>Code: {item.code}</Paragraph>
            {item.category_name && (
              <Chip compact style={styles.categoryChip}>
                {item.category_name}
              </Chip>
            )}
          </View>
          <View style={styles.productActions}>
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => handleEditProduct(item)}
            />
          </View>
        </View>

        <View style={styles.productDetails}>
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Price:</Paragraph>
            <Paragraph style={styles.value}>₱{item.price.toFixed(2)}</Paragraph>
          </View>
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Stock:</Paragraph>
            <Paragraph style={[
              styles.value,
              item.stock_quantity <= 10 ? styles.lowStock : null
            ]}>
              {item.stock_quantity} {item.unit}
            </Paragraph>
          </View>
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>VAT:</Paragraph>
            <Paragraph style={styles.value}>
              {item.tax_rate}% ({item.is_vat_inclusive ? 'Inclusive' : 'Exclusive'})
            </Paragraph>
          </View>
        </View>

        {!item.is_active && (
          <Chip compact style={styles.inactiveChip}>
            Inactive
          </Chip>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TextInput
            label="Search Products"
            value={searchQuery}
            onChangeText={setSearchQuery}
            mode="outlined"
            style={styles.searchInput}
            right={<TextInput.Icon icon="magnify" />}
          />
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProduct}
          style={styles.productList}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={loadProducts}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Paragraph style={styles.emptyText}>
                {searchQuery ? 'No products found matching your search' : 'No products available'}
              </Paragraph>
              <Button mode="outlined" onPress={handleAddProduct}>
                Add First Product
              </Button>
            </View>
          }
        />
      </View>

      <FAB
        style={styles.fab}
        icon="plus"
        label="Add Product"
        onPress={handleAddProduct}
      />

      {/* Add/Edit Product Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </Dialog.Title>
          <Dialog.ScrollArea>
            <View style={styles.dialogContent}>
              <TextInput
                label="Product Code *"
                value={formData.code}
                onChangeText={(text) => setFormData({...formData, code: text})}
                mode="outlined"
                style={styles.input}
              />

              <TextInput
                label="Product Name *"
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                mode="outlined"
                style={styles.input}
              />

              <TextInput
                label="Description"
                value={formData.description}
                onChangeText={(text) => setFormData({...formData, description: text})}
                mode="outlined"
                multiline
                style={styles.input}
              />

              <View style={styles.row}>
                <TextInput
                  label="Price *"
                  value={formData.price}
                  onChangeText={(text) => setFormData({...formData, price: text})}
                  mode="outlined"
                  keyboardType="numeric"
                  style={[styles.input, styles.halfWidth]}
                />

                <TextInput
                  label="Cost"
                  value={formData.cost}
                  onChangeText={(text) => setFormData({...formData, cost: text})}
                  mode="outlined"
                  keyboardType="numeric"
                  style={[styles.input, styles.halfWidth]}
                />
              </View>

              <View style={styles.row}>
                <TextInput
                  label="Stock Quantity"
                  value={formData.stock_quantity}
                  onChangeText={(text) => setFormData({...formData, stock_quantity: text})}
                  mode="outlined"
                  keyboardType="numeric"
                  style={[styles.input, styles.halfWidth]}
                />

                <TextInput
                  label="Unit"
                  value={formData.unit}
                  onChangeText={(text) => setFormData({...formData, unit: text})}
                  mode="outlined"
                  style={[styles.input, styles.halfWidth]}
                />
              </View>

              <TextInput
                label="VAT Rate (%)"
                value={formData.tax_rate}
                onChangeText={(text) => setFormData({...formData, tax_rate: text})}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
              />

              <View style={styles.switchRow}>
                <Paragraph>VAT Inclusive:</Paragraph>
                <Button
                  mode={formData.is_vat_inclusive ? "contained" : "outlined"}
                  compact
                  onPress={() => setFormData({...formData, is_vat_inclusive: !formData.is_vat_inclusive})}
                >
                  {formData.is_vat_inclusive ? "Yes" : "No"}
                </Button>
              </View>
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleSaveProduct}
              loading={loading}
              disabled={loading}
            >
              {editingProduct ? 'Update' : 'Add'} Product
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: '4%',
  },
  header: {
    marginBottom: '4%',
  },
  searchInput: {
    backgroundColor: 'white',
  },
  productList: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: '25%',
  },
  productCard: {
    marginBottom: '3%',
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '3%',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
  },
  productActions: {
    flexDirection: 'row',
  },
  productDetails: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  label: {
    fontSize: 14,
    opacity: 0.7,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  lowStock: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  inactiveChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFEBEE',
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: '4%',
    right: 0,
    bottom: 0,
  },
  dialogContent: {
    paddingHorizontal: 24,
  },
  input: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
});