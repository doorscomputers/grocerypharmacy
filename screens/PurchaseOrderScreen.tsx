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
  Menu,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import { Product, Supplier } from '../database/schema';

type PurchaseOrderScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PurchaseOrder'
>;

type Props = {
  navigation: PurchaseOrderScreenNavigationProp;
};

interface PurchaseItem {
  product_id: number;
  product_code: string;
  product_name: string;
  quantity_ordered: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

export default function PurchaseOrderScreen({ navigation }: Props) {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [receiveDialogVisible, setReceiveDialogVisible] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

  // Purchase Order Creation
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierMenuVisible, setSupplierMenuVisible] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 days');
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);

  // Product Selection
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [addProductDialogVisible, setAddProductDialogVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const theme = useTheme();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();
      const [purchaseOrdersData, suppliersData, productsData] = await Promise.all([
        dbService.getPurchaseOrders(20),
        dbService.getSuppliers(true),
        dbService.getProducts(true, 100)
      ]);

      setPurchaseOrders(purchaseOrdersData);
      setSuppliers(suppliersData);
      setProducts(productsData as Product[]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return '#9E9E9E';
      case 'ORDERED': return '#2196F3';
      case 'PARTIALLY_RECEIVED': return '#FF9800';
      case 'RECEIVED': return '#4CAF50';
      case 'CANCELLED': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const openCreateDialog = () => {
    // Reset form
    setSelectedSupplier(null);
    setReferenceNumber('');
    setExpectedDeliveryDate('');
    setPaymentTerms('30 days');
    setNotes('');
    setPurchaseItems([]);
    setCreateDialogVisible(true);
  };

  const addProductToPurchase = () => {
    if (!selectedProduct || !quantity || !unitCost) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const qty = parseInt(quantity);
    const cost = parseFloat(unitCost);

    if (qty <= 0 || cost <= 0) {
      Alert.alert('Error', 'Quantity and cost must be greater than 0');
      return;
    }

    const existingItemIndex = purchaseItems.findIndex(
      item => item.product_id === selectedProduct.id
    );

    const taxAmount = selectedProduct.is_vat_inclusive ? 0 : cost * qty * 0.12;
    const totalAmount = (cost * qty) + taxAmount;

    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedItems = [...purchaseItems];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity_ordered: qty,
        unit_cost: cost,
        tax_amount: taxAmount,
        total_amount: totalAmount
      };
      setPurchaseItems(updatedItems);
    } else {
      // Add new item
      const newItem: PurchaseItem = {
        product_id: selectedProduct.id,
        product_code: selectedProduct.code,
        product_name: selectedProduct.name,
        quantity_ordered: qty,
        unit_cost: cost,
        discount_amount: 0,
        tax_amount: taxAmount,
        total_amount: totalAmount
      };
      setPurchaseItems([...purchaseItems, newItem]);
    }

    setAddProductDialogVisible(false);
    setSelectedProduct(null);
    setQuantity('');
    setUnitCost('');
  };

  const removeProductFromPurchase = (productId: number) => {
    setPurchaseItems(purchaseItems.filter(item => item.product_id !== productId));
  };

  const calculatePurchaseTotal = () => {
    return purchaseItems.reduce((total, item) => total + item.total_amount, 0);
  };

  const createPurchaseOrder = async () => {
    if (!selectedSupplier) {
      Alert.alert('Error', 'Please select a supplier');
      return;
    }

    if (purchaseItems.length === 0) {
      Alert.alert('Error', 'Please add items to the purchase order');
      return;
    }

    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();

      const purchaseData = {
        supplier_id: selectedSupplier.id,
        expected_delivery_date: expectedDeliveryDate || undefined,
        reference_number: referenceNumber || undefined,
        payment_terms: paymentTerms,
        notes: notes || undefined,
        created_by: 1, // TODO: Get from user context
        items: purchaseItems
      };

      const result = await dbService.createPurchaseOrder(purchaseData);

      Alert.alert(
        'Success',
        `Purchase order ${result.purchaseNumber} created successfully`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCreateDialogVisible(false);
              loadData();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating purchase order:', error);
      Alert.alert('Error', 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const openReceiveDialog = async (purchase: any) => {
    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();
      const purchaseDetails = await dbService.getPurchaseOrderById(purchase.id);
      setSelectedPurchase(purchaseDetails);
      setReceiveDialogVisible(true);
    } catch (error) {
      console.error('Error loading purchase details:', error);
      Alert.alert('Error', 'Failed to load purchase details');
    } finally {
      setLoading(false);
    }
  };

  const receivePurchaseOrder = async () => {
    if (!selectedPurchase) return;

    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();

      // For simplicity, receive all ordered quantities
      const items = selectedPurchase.items.map((item: any) => ({
        product_id: item.product_id,
        quantity_received: item.quantity_ordered - item.quantity_received
      }));

      await dbService.receivePurchaseOrder(selectedPurchase.id, 1, items);

      Alert.alert(
        'Success',
        'Purchase order received successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              setReceiveDialogVisible(false);
              setSelectedPurchase(null);
              loadData();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error receiving purchase order:', error);
      Alert.alert('Error', 'Failed to receive purchase order');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.code.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const renderPurchaseOrder = ({ item }: { item: any }) => (
    <Card style={styles.purchaseCard}>
      <Card.Content>
        <View style={styles.purchaseHeader}>
          <View style={styles.purchaseInfo}>
            <Title style={styles.purchaseNumber}>{item.purchase_number}</Title>
            <Paragraph style={styles.supplierName}>{item.supplier_name}</Paragraph>
            <Paragraph style={styles.purchaseDate}>
              Date: {new Date(item.purchase_date).toLocaleDateString()}
            </Paragraph>
          </View>
          <View style={styles.purchaseStatus}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={{ color: 'white' }}
            >
              {item.status}
            </Chip>
            <Paragraph style={styles.totalAmount}>
              ₱{item.total_amount.toLocaleString()}
            </Paragraph>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.purchaseDetails}>
          {item.reference_number && (
            <Paragraph style={styles.detail}>Ref: {item.reference_number}</Paragraph>
          )}
          {item.expected_delivery_date && (
            <Paragraph style={styles.detail}>
              Expected: {new Date(item.expected_delivery_date).toLocaleDateString()}
            </Paragraph>
          )}
          <Paragraph style={styles.detail}>Terms: {item.payment_terms}</Paragraph>
        </View>

        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => openReceiveDialog(item)}
            style={styles.actionButton}
            disabled={item.status === 'RECEIVED' || item.status === 'CANCELLED'}
            icon="package-down"
          >
            Receive
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Purchase Orders</Title>
      </View>

      <FlatList
        data={purchaseOrders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPurchaseOrder}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              No purchase orders found. Create your first purchase order.
            </Paragraph>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openCreateDialog}
        label="New Purchase Order"
      />

      {/* Create Purchase Order Dialog */}
      <Portal>
        <Dialog
          visible={createDialogVisible}
          onDismiss={() => setCreateDialogVisible(false)}
          style={styles.createDialog}
        >
          <Dialog.Title>Create Purchase Order</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              {/* Supplier Selection */}
              <Menu
                visible={supplierMenuVisible}
                onDismiss={() => setSupplierMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setSupplierMenuVisible(true)}
                    style={styles.dialogInput}
                    icon="chevron-down"
                    contentStyle={{ justifyContent: 'flex-start' }}
                  >
                    {selectedSupplier ? selectedSupplier.name : 'Select Supplier'}
                  </Button>
                }
              >
                {suppliers.map(supplier => (
                  <Menu.Item
                    key={supplier.id}
                    onPress={() => {
                      setSelectedSupplier(supplier);
                      setSupplierMenuVisible(false);
                    }}
                    title={supplier.name}
                  />
                ))}
              </Menu>

              <TextInput
                label="Reference Number"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                mode="outlined"
                style={styles.dialogInput}
              />

              <TextInput
                label="Expected Delivery Date"
                value={expectedDeliveryDate}
                onChangeText={setExpectedDeliveryDate}
                mode="outlined"
                style={styles.dialogInput}
                placeholder="YYYY-MM-DD"
              />

              <TextInput
                label="Payment Terms"
                value={paymentTerms}
                onChangeText={setPaymentTerms}
                mode="outlined"
                style={styles.dialogInput}
              />

              <TextInput
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                style={styles.dialogInput}
                multiline
                numberOfLines={2}
              />

              {/* Purchase Items */}
              <Title style={styles.sectionTitle}>Items</Title>

              {purchaseItems.map((item, index) => (
                <Card key={index} style={styles.itemCard}>
                  <Card.Content>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemInfo}>
                        <Paragraph style={styles.itemName}>{item.product_name}</Paragraph>
                        <Paragraph style={styles.itemDetails}>
                          {item.quantity_ordered} × ₱{item.unit_cost.toFixed(2)} = ₱{item.total_amount.toFixed(2)}
                        </Paragraph>
                      </View>
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => removeProductFromPurchase(item.product_id)}
                      />
                    </View>
                  </Card.Content>
                </Card>
              ))}

              <Button
                mode="outlined"
                onPress={() => setAddProductDialogVisible(true)}
                style={styles.addItemButton}
                icon="plus"
              >
                Add Product
              </Button>

              <Divider style={styles.divider} />

              <View style={styles.totalSection}>
                <Title style={styles.totalAmount}>
                  Total: ₱{calculatePurchaseTotal().toFixed(2)}
                </Title>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialogVisible(false)}>Cancel</Button>
            <Button onPress={createPurchaseOrder} loading={loading}>
              Create Purchase Order
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Product Dialog */}
      <Portal>
        <Dialog
          visible={addProductDialogVisible}
          onDismiss={() => setAddProductDialogVisible(false)}
        >
          <Dialog.Title>Add Product</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              <TextInput
                label="Search Products"
                value={productSearchQuery}
                onChangeText={setProductSearchQuery}
                mode="outlined"
                style={styles.dialogInput}
                right={<TextInput.Icon icon="magnify" />}
              />

              <FlatList
                data={filteredProducts.slice(0, 10)}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <List.Item
                    title={item.name}
                    description={`${item.code} • Stock: ${item.stock_quantity} • Cost: ₱${item.cost.toFixed(2)}`}
                    onPress={() => {
                      setSelectedProduct(item);
                      setUnitCost(item.cost.toString());
                    }}
                    style={selectedProduct?.id === item.id ? styles.selectedProduct : undefined}
                  />
                )}
                style={styles.productList}
              />

              {selectedProduct && (
                <>
                  <Paragraph style={styles.selectedProductName}>
                    Selected: {selectedProduct.name}
                  </Paragraph>

                  <TextInput
                    label="Quantity"
                    value={quantity}
                    onChangeText={setQuantity}
                    mode="outlined"
                    style={styles.dialogInput}
                    keyboardType="numeric"
                  />

                  <TextInput
                    label="Unit Cost"
                    value={unitCost}
                    onChangeText={setUnitCost}
                    mode="outlined"
                    style={styles.dialogInput}
                    keyboardType="numeric"
                  />
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAddProductDialogVisible(false)}>Cancel</Button>
            <Button onPress={addProductToPurchase} disabled={!selectedProduct}>
              Add Product
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Receive Purchase Order Dialog */}
      <Portal>
        <Dialog
          visible={receiveDialogVisible}
          onDismiss={() => setReceiveDialogVisible(false)}
        >
          <Dialog.Title>Receive Purchase Order</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              {selectedPurchase && (
                <>
                  <Paragraph style={styles.receiveTitle}>
                    {selectedPurchase.purchase_number} - {selectedPurchase.supplier_name}
                  </Paragraph>

                  {selectedPurchase.items?.map((item: any, index: number) => (
                    <Card key={index} style={styles.itemCard}>
                      <Card.Content>
                        <Paragraph style={styles.itemName}>{item.product_name}</Paragraph>
                        <Paragraph style={styles.itemDetails}>
                          Ordered: {item.quantity_ordered} | Received: {item.quantity_received}
                        </Paragraph>
                        <Paragraph style={styles.itemDetails}>
                          Pending: {item.quantity_ordered - item.quantity_received}
                        </Paragraph>
                      </Card.Content>
                    </Card>
                  ))}
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setReceiveDialogVisible(false)}>Cancel</Button>
            <Button onPress={receivePurchaseOrder} loading={loading}>
              Receive All Pending
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
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  purchaseCard: {
    marginBottom: 16,
    elevation: 4,
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  purchaseInfo: {
    flex: 1,
  },
  purchaseNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  supplierName: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  purchaseDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  purchaseStatus: {
    alignItems: 'flex-end',
  },
  statusChip: {
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  divider: {
    marginVertical: 12,
  },
  purchaseDetails: {
    marginBottom: 16,
  },
  detail: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  createDialog: {
    maxHeight: '90%',
  },
  dialogContent: {
    maxHeight: 500,
  },
  dialogInput: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  itemCard: {
    marginBottom: 8,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    opacity: 0.7,
  },
  addItemButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  totalSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  productList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  selectedProduct: {
    backgroundColor: '#E3F2FD',
  },
  selectedProductName: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#1976D2',
  },
  receiveTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
});