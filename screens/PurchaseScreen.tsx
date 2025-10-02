import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
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
  Divider,
  Chip,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import { Product } from '../database/schema';

type PurchaseScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Purchase'
>;

type Props = {
  navigation: PurchaseScreenNavigationProp;
};

interface PurchaseItem {
  id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

interface PurchaseOrder {
  id?: number;
  supplier_name: string;
  reference_number: string;
  purchase_date: string;
  total_amount: number;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  items: PurchaseItem[];
}

export default function PurchaseScreen({ navigation }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const theme = useTheme();

  useEffect(() => {
    loadProducts();
    generateReferenceNumber();
  }, []);

  const loadProducts = async () => {
    try {
      const dbService = DatabaseService.getInstance();
      const rawProductList = await dbService.getProducts(true); // Only active products for purchasing
      setProducts(rawProductList as Product[]);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const generateReferenceNumber = () => {
    const now = new Date();
    const refNum = `PO${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    setReferenceNumber(refNum);
  };

  const handleAddProduct = (product: Product) => {
    setSelectedProduct(product);
    setUnitCost(product.cost.toString());
    setPurchaseQuantity('');
    setDialogVisible(true);
  };

  const handleAddToPurchase = () => {
    if (!selectedProduct || !purchaseQuantity || !unitCost) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const quantity = parseInt(purchaseQuantity);
    const cost = parseFloat(unitCost);

    if (quantity <= 0 || cost <= 0) {
      Alert.alert('Error', 'Quantity and cost must be greater than 0');
      return;
    }

    const existingItem = purchaseItems.find(item => item.product_id === selectedProduct.id);

    if (existingItem) {
      // Update existing item
      setPurchaseItems(purchaseItems.map(item =>
        item.product_id === selectedProduct.id
          ? {
              ...item,
              quantity: item.quantity + quantity,
              unit_cost: cost,
              total_cost: (item.quantity + quantity) * cost
            }
          : item
      ));
    } else {
      // Add new item
      const newItem: PurchaseItem = {
        id: Date.now(),
        product_id: selectedProduct.id,
        product_code: selectedProduct.code,
        product_name: selectedProduct.name,
        quantity: quantity,
        unit_cost: cost,
        total_cost: quantity * cost,
      };
      setPurchaseItems([...purchaseItems, newItem]);
    }

    setDialogVisible(false);
    setSelectedProduct(null);
    setPurchaseQuantity('');
    setUnitCost('');
  };

  const removeFromPurchase = (productId: number) => {
    setPurchaseItems(purchaseItems.filter(item => item.product_id !== productId));
  };

  const updatePurchaseQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromPurchase(productId);
      return;
    }

    setPurchaseItems(purchaseItems.map(item =>
      item.product_id === productId
        ? {
            ...item,
            quantity: quantity,
            total_cost: quantity * item.unit_cost
          }
        : item
    ));
  };

  const calculateTotalAmount = () => {
    return purchaseItems.reduce((total, item) => total + item.total_cost, 0);
  };

  const handleReceivePurchase = async () => {
    if (purchaseItems.length === 0) {
      Alert.alert('Error', 'Please add items to the purchase order');
      return;
    }

    if (!supplierName.trim()) {
      Alert.alert('Error', 'Please enter supplier name');
      return;
    }

    setLoading(true);

    try {
      const dbService = DatabaseService.getInstance();
      const db = dbService.getDatabase();

      await db.withTransactionAsync(async () => {
        // Create purchase record (you would extend DatabaseService for this)
        const purchaseData = {
          supplier_name: supplierName,
          reference_number: referenceNumber,
          purchase_date: new Date().toISOString(),
          total_amount: calculateTotalAmount(),
          status: 'RECEIVED' as const,
          items: purchaseItems,
        };

        // Update product quantities and costs
        for (const item of purchaseItems) {
          // Update stock quantity
          await db.runAsync(
            'UPDATE products SET stock_quantity = stock_quantity + ?, cost = ? WHERE id = ?',
            [item.quantity, item.unit_cost, item.product_id]
          );

          // Record inventory movement
          await db.runAsync(
            `INSERT INTO inventory_movements (
              product_id, movement_type, quantity, reference_type, reference_id,
              notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              item.product_id,
              'IN',
              item.quantity,
              'PURCHASE',
              Date.now(), // Would use actual purchase ID
              `Purchase from ${supplierName} - ${referenceNumber}`,
              1 // Would get from user context
            ]
          );
        }

        // Add eJournal entry
        await db.runAsync(
          `INSERT INTO ejournal (entry_type, reference_number, description, amount, cashier_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            'SYSTEM',
            referenceNumber,
            `Purchase received from ${supplierName}`,
            calculateTotalAmount(),
            1
          ]
        );
      });

      Alert.alert(
        'Purchase Completed',
        `Purchase order ${referenceNumber} has been received and inventory updated.`,
        [
          {
            text: 'New Purchase',
            onPress: () => {
              setPurchaseItems([]);
              setSupplierName('');
              generateReferenceNumber();
            },
          },
          {
            text: 'View Products',
            onPress: () => navigation.navigate('Products'),
          },
        ]
      );

      // Reload products to show updated quantities
      await loadProducts();
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'Failed to process purchase order');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.mainContainer}>
        {/* Purchase Order Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title style={styles.headerTitle}>Purchase Order</Title>
            <View style={styles.headerInfo}>
              <TextInput
                label="Reference Number"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                mode="outlined"
                style={styles.headerInput}
                dense
              />
              <TextInput
                label="Supplier Name"
                value={supplierName}
                onChangeText={setSupplierName}
                mode="outlined"
                style={styles.headerInput}
                dense
              />
            </View>
            <Paragraph style={styles.dateText}>
              Date: {new Date().toLocaleDateString()}
            </Paragraph>
          </Card.Content>
        </Card>

        <View style={styles.bodyContainer}>
          {/* Product Search and List */}
          <View style={styles.productSection}>
            <Card style={styles.productCard}>
              <Card.Content>
                <Title style={styles.sectionTitle}>Available Products</Title>
                <TextInput
                  label="Search Products"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  mode="outlined"
                  style={styles.searchInput}
                  right={<TextInput.Icon icon="magnify" />}
                  dense
                />
                <FlatList
                  data={filteredProducts}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <List.Item
                      title={item.name}
                      description={`Code: ${item.code} • Stock: ${item.stock_quantity} ${item.unit} • Cost: ₱${item.cost.toFixed(2)}`}
                      left={props => <List.Icon {...props} icon="package-variant" />}
                      right={props => (
                        <IconButton
                          {...props}
                          icon="plus"
                          onPress={() => handleAddProduct(item)}
                        />
                      )}
                      onPress={() => handleAddProduct(item)}
                      style={styles.productItem}
                    />
                  )}
                  style={styles.productList}
                />
              </Card.Content>
            </Card>
          </View>

          {/* Purchase Items */}
          <View style={styles.purchaseSection}>
            <Card style={styles.purchaseCard}>
              <Card.Content>
                <Title style={styles.sectionTitle}>
                  Purchase Items ({purchaseItems.length})
                </Title>

                {purchaseItems.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Paragraph style={styles.emptyText}>
                      No items added yet. Add products from the list.
                    </Paragraph>
                  </View>
                ) : (
                  <ScrollView style={styles.purchaseList}>
                    {purchaseItems.map((item) => (
                      <View key={item.product_id} style={styles.purchaseItem}>
                        <View style={styles.purchaseItemInfo}>
                          <Paragraph style={styles.purchaseItemName}>
                            {item.product_name}
                          </Paragraph>
                          <Paragraph style={styles.purchaseItemDetails}>
                            {item.product_code} • ₱{item.unit_cost.toFixed(2)} each
                          </Paragraph>
                          <Paragraph style={styles.purchaseItemTotal}>
                            {item.quantity} units = ₱{item.total_cost.toFixed(2)}
                          </Paragraph>
                        </View>
                        <View style={styles.purchaseItemActions}>
                          <IconButton
                            icon="minus"
                            size={18}
                            onPress={() => updatePurchaseQuantity(item.product_id, item.quantity - 1)}
                          />
                          <Paragraph style={styles.quantity}>{item.quantity}</Paragraph>
                          <IconButton
                            icon="plus"
                            size={18}
                            onPress={() => updatePurchaseQuantity(item.product_id, item.quantity + 1)}
                          />
                          <IconButton
                            icon="delete"
                            size={18}
                            onPress={() => removeFromPurchase(item.product_id)}
                          />
                        </View>
                      </View>
                    ))}

                    <Divider style={styles.divider} />

                    <View style={styles.totalSection}>
                      <View style={styles.totalRow}>
                        <Title style={styles.totalLabel}>Total Amount:</Title>
                        <Title style={styles.totalAmount}>
                          ₱{calculateTotalAmount().toFixed(2)}
                        </Title>
                      </View>
                    </View>

                    <Button
                      mode="outlined"
                      onPress={handleReceivePurchase}
                      style={[styles.receiveButton, { backgroundColor: '#4CAF50' }]}
                      contentStyle={styles.buttonContent}
                      loading={loading}
                      disabled={loading}
                      labelStyle={[styles.buttonLabel, { color: 'white' }]}
                    >
                      Receive Purchase Order
                    </Button>
                  </ScrollView>
                )}
              </Card.Content>
            </Card>
          </View>
        </View>
      </View>

      {/* Add Product Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Add to Purchase Order</Dialog.Title>
          <Dialog.Content>
            {selectedProduct && (
              <>
                <Paragraph style={styles.selectedProductName}>
                  {selectedProduct.name}
                </Paragraph>
                <Paragraph style={styles.selectedProductInfo}>
                  Code: {selectedProduct.code} • Current Stock: {selectedProduct.stock_quantity}
                </Paragraph>

                <TextInput
                  label="Quantity to Purchase"
                  value={purchaseQuantity}
                  onChangeText={setPurchaseQuantity}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.dialogInput}
                />

                <TextInput
                  label="Unit Cost"
                  value={unitCost}
                  onChangeText={setUnitCost}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.dialogInput}
                />

                {purchaseQuantity && unitCost && (
                  <Paragraph style={styles.totalCostPreview}>
                    Total Cost: ₱{(parseInt(purchaseQuantity) * parseFloat(unitCost)).toFixed(2)}
                  </Paragraph>
                )}
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAddToPurchase} loading={loading}>
              Add to Purchase
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
  mainContainer: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  headerInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  headerInput: {
    flex: 1,
  },
  dateText: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
  },
  bodyContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  productSection: {
    flex: 1,
  },
  productCard: {
    flex: 1,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  searchInput: {
    marginBottom: 12,
  },
  productList: {
    flex: 1,
  },
  productItem: {
    paddingVertical: 4,
  },
  purchaseSection: {
    flex: 1,
    minWidth: 400,
  },
  purchaseCard: {
    flex: 1,
    elevation: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 16,
  },
  purchaseList: {
    flex: 1,
  },
  purchaseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  purchaseItemInfo: {
    flex: 1,
  },
  purchaseItemName: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  purchaseItemDetails: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  purchaseItemTotal: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  purchaseItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantity: {
    marginHorizontal: 8,
    fontWeight: 'bold',
    fontSize: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  divider: {
    marginVertical: 16,
  },
  totalSection: {
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  receiveButton: {
    marginTop: 8,
    marginHorizontal: 8,
    minHeight: 56,
    maxHeight: 64,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buttonContent: {
    paddingVertical: '2%',
    paddingHorizontal: '2%',
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 16,
    paddingVertical: 2,
  },
  selectedProductName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  selectedProductInfo: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 16,
  },
  dialogInput: {
    marginBottom: 16,
  },
  totalCostPreview: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    backgroundColor: '#E8F5E8',
    padding: 8,
    borderRadius: 4,
  },
});