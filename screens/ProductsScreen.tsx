import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  Dimensions,
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
  Appbar,
} from 'react-native-paper';
import { CameraView, Camera } from 'expo-camera';
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
  const [refreshing, setRefreshing] = useState(false);
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
    is_active: true,
  });
  const [scannerVisible, setScannerVisible] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    loadProducts();
    getCameraPermissions();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadProducts(searchQuery.trim() || undefined);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const loadProducts = async (searchTerm?: string) => {
    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
      // When searching, allow unlimited results; when browsing, limit to 100 for performance
      const limit = searchTerm && searchTerm.trim() !== '' ? undefined : 100;
      const rawProductList = await dbService.getProducts(false, limit, searchTerm);
      console.log(`ProductsScreen: Loaded ${rawProductList.length} products${searchTerm ? ` (search: "${searchTerm}")` : ' (browsing)'}`);
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
      is_active: true,
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
      is_active: product.is_active,
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
        is_active: formData.is_active,
      };

      if (editingProduct) {
        await dbService.updateProduct(editingProduct.id, productData);
        Alert.alert('Success', 'Product updated successfully');
      } else {
        await dbService.createProduct(productData);
        Alert.alert('Success', 'Product added successfully');
      }

      setDialogVisible(false);
      resetForm();
      await loadProducts(searchQuery.trim() || undefined);
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setScannerVisible(false);

    // Search for existing product with this barcode
    const existingProduct = products.find(p => p.code === data);

    if (existingProduct) {
      // If product exists, show it
      setSearchQuery(data);
      Alert.alert(
        'Product Found',
        `Found existing product: ${existingProduct.name}`,
        [
          { text: 'View Product', onPress: () => {} },
          { text: 'Edit Product', onPress: () => handleEditProduct(existingProduct) }
        ]
      );
    } else {
      // If product doesn't exist, offer to create new one
      Alert.alert(
        'New Product',
        `Barcode scanned: ${data}\n\nThis product doesn't exist yet. Would you like to create it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Product',
            onPress: () => {
              resetForm();
              setFormData(prev => ({ ...prev, code: data }));
              setDialogVisible(true);
            }
          }
        ]
      );
    }

    // Reset scanner state after a delay
    setTimeout(() => setScanned(false), 2000);
  };

  const handleScannerPress = () => {
    if (hasPermission === null) {
      Alert.alert('Permission', 'Requesting camera permission...');
      getCameraPermissions();
      return;
    }

    if (hasPermission === false) {
      Alert.alert(
        'Camera Permission',
        'Camera permission is required for barcode scanning. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => getCameraPermissions() }
        ]
      );
      return;
    }

    setScannerVisible(true);
    setScanned(false);
  };

  const handleToggleActive = async (product: Product) => {
    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();
      await dbService.toggleProductActive(product.id);

      Alert.alert(
        'Success',
        `Product "${product.name}" has been ${product.is_active ? 'deactivated' : 'activated'}`
      );

      await loadProducts(searchQuery.trim() || undefined);
    } catch (error) {
      console.error('Error toggling product status:', error);
      Alert.alert('Error', 'Failed to update product status');
    } finally {
      setLoading(false);
    }
  };

  // No client-side filtering needed since we're doing server-side filtering
  const filteredProducts = products;

  const renderProduct = ({ item }: { item: Product }) => (
    <Card style={[
      styles.productCard,
      !item.is_active && styles.inactiveProductCard
    ]}>
      <Card.Content>
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Title style={[
              styles.productName,
              !item.is_active && styles.inactiveText
            ]}>
              {item.name}
              {!item.is_active && ' (Inactive)'}
            </Title>
            <Paragraph style={styles.productCode}>Code: {item.code}</Paragraph>
            {item.category_name && (
              <Chip compact style={styles.categoryChip}>
                {item.category_name}
              </Chip>
            )}
            {!item.is_active && (
              <Chip compact style={styles.inactiveChip} icon="eye-off">
                Inactive
              </Chip>
            )}
          </View>
          <View style={styles.productActions}>
            <IconButton
              icon={item.is_active ? "eye" : "eye-off"}
              size={20}
              iconColor={item.is_active ? "#4CAF50" : "#F44336"}
              onPress={() => handleToggleActive(item)}
            />
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => handleEditProduct(item)}
            />
          </View>
        </View>

        <View style={styles.productDetails}>
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Status:</Paragraph>
            <Paragraph style={[
              styles.value,
              item.is_active ? styles.activeStatus : styles.inactiveStatus
            ]}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Paragraph>
          </View>
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
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <TextInput
            label="Search Products / Scan Barcode"
            value={searchQuery}
            onChangeText={setSearchQuery}
            mode="outlined"
            style={styles.searchInput}
            placeholder="Type product name or scan barcode..."
            right={
              <View style={styles.searchIcons}>
                <TextInput.Icon
                  icon="barcode-scan"
                  onPress={handleScannerPress}
                />
                {searchQuery.length > 0 && (
                  <TextInput.Icon
                    icon="close"
                    onPress={() => setSearchQuery('')}
                  />
                )}
              </View>
            }
          />
          {!searchQuery && (
            <Paragraph style={styles.performanceNote}>
              📄 Showing first 100 products for performance. Use search to access all 5000+ products.
            </Paragraph>
          )}
          {searchQuery && (
            <Paragraph style={styles.searchInfo}>
              🔍 Searching for "{searchQuery}" - {filteredProducts.length} result(s)
            </Paragraph>
          )}
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProduct}
          style={styles.productList}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadProducts(searchQuery.trim() || undefined);
            setRefreshing(false);
          }}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
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
                right={
                  <TextInput.Icon
                    icon="barcode-scan"
                    onPress={() => {
                      setDialogVisible(false);
                      handleScannerPress();
                    }}
                  />
                }
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

              <View style={styles.switchRow}>
                <Paragraph>Active Product:</Paragraph>
                <Button
                  mode={formData.is_active ? "contained" : "outlined"}
                  compact
                  onPress={() => setFormData({...formData, is_active: !formData.is_active})}
                >
                  {formData.is_active ? "Active" : "Inactive"}
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

      {/* Barcode Scanner Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerContainer}>
          <Appbar.Header>
            <Appbar.BackAction onPress={() => setScannerVisible(false)} />
            <Appbar.Content title="Scan Barcode" />
          </Appbar.Header>

          {hasPermission && (
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
              }}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Paragraph style={styles.scannerText}>
                  {scanned ? 'Barcode scanned! Processing...' : 'Point camera at barcode'}
                </Paragraph>
              </View>
            </CameraView>
          )}

          {!hasPermission && (
            <View style={styles.permissionContainer}>
              <Paragraph style={styles.permissionText}>
                Camera permission is required for barcode scanning
              </Paragraph>
              <Button mode="contained" onPress={getCameraPermissions}>
                Grant Permission
              </Button>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchInput: {
    backgroundColor: 'white',
    marginBottom: 0,
  },
  performanceNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  searchInfo: {
    fontSize: 12,
    color: '#2196F3',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
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
    marginTop: 4,
  },
  inactiveProductCard: {
    backgroundColor: '#F5F5F5',
    opacity: 0.8,
  },
  inactiveText: {
    color: '#757575',
  },
  activeStatus: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  inactiveStatus: {
    color: '#F44336',
    fontWeight: 'bold',
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
  searchContainer: {
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  searchIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  scannerText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
});