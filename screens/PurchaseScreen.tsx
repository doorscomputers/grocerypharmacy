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

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Product } from '../database/schema';
import { computeNewAvco, roundAvco } from '../database/avco';
import { useAuth } from '../contexts/AuthContext';
import { toLocalDateString } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

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
  quantity: number;          // paid quantity (what appears on the supplier invoice)
  bonus_quantity: number;    // free/extra units from supplier — NOT on invoice but added to stock
  unit_cost: number;
  total_cost: number;        // = quantity x unit_cost  (invoice amount; bonus is FREE)
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
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState('');
  const [bonusQuantity, setBonusQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  useEffect(() => {
    loadProducts();
    generateReferenceNumber();
  }, []);

  const loadProducts = async () => {
    try {
      const dbService = getDatabase();
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
    setBonusQuantity('');
    setDialogVisible(true);
  };

  const handleAddToPurchase = () => {
    if (!selectedProduct || !purchaseQuantity || !unitCost) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const quantity = parseInt(purchaseQuantity);
    const bonus = parseInt(bonusQuantity || '0') || 0;
    const cost = parseFloat(unitCost);

    if (quantity <= 0 || cost <= 0) {
      Alert.alert('Error', 'Quantity and cost must be greater than 0');
      return;
    }
    if (bonus < 0) {
      Alert.alert('Error', 'Bonus quantity cannot be negative');
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
              bonus_quantity: (item.bonus_quantity || 0) + bonus,
              unit_cost: cost,
              total_cost: (item.quantity + quantity) * cost  // invoice = paid qty x cost (bonus excluded)
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
        bonus_quantity: bonus,
        unit_cost: cost,
        total_cost: quantity * cost,  // invoice = paid qty x cost (bonus excluded)
      };
      setPurchaseItems([...purchaseItems, newItem]);
    }

    setDialogVisible(false);
    setSelectedProduct(null);
    setPurchaseQuantity('');
    setBonusQuantity('');
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
      const dbService = getDatabase();
      const db = dbService.getDatabase();
      const userId = user?.id || 1;
      const totalAmount = calculateTotalAmount();

      await db.withTransactionAsync(async () => {
        // Step 1: Look up or create supplier
        let supplierId: number;
        const existingSupplier = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM suppliers WHERE name = ?',
          [supplierName.trim()]
        );

        if (existingSupplier) {
          supplierId = existingSupplier.id;
        } else {
          // Create new supplier with minimal info
          const supplierCode = `SUP${Date.now()}`;
          const result = await db.runAsync(
            `INSERT INTO suppliers (code, name, is_active, created_by)
             VALUES (?, ?, 1, ?)`,
            [supplierCode, supplierName.trim(), userId]
          );
          supplierId = result.lastInsertRowId;
        }

        // Step 2: Generate unique purchase number
        const purchaseNumber = `PUR${Date.now()}`;
        const purchaseDate = toLocalDateString(new Date());
        const dueDate = toLocalDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

        // Step 3: Insert into purchases table
        const purchaseResult = await db.runAsync(
          `INSERT INTO purchases (
            purchase_number, supplier_id, purchase_date, reference_number, status,
            subtotal, tax_amount, discount_amount, total_amount,
            paid_amount, balance_amount, payment_terms, created_by, received_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            purchaseNumber,
            supplierId,
            purchaseDate,
            referenceNumber,
            'RECEIVED',
            totalAmount,   // subtotal
            0,             // tax_amount
            0,             // discount_amount
            totalAmount,   // total_amount
            0,             // paid_amount
            totalAmount,   // balance_amount
            '30 days',     // payment_terms
            userId,        // created_by
            userId         // received_by
          ]
        );
        const purchaseId = purchaseResult.lastInsertRowId;

        // Step 4: Insert purchase_details for each item — including bonus_quantity (free units from supplier)
        for (const item of purchaseItems) {
          await db.runAsync(
            `INSERT INTO purchase_details (
              purchase_id, product_id, product_code, product_name,
              quantity_ordered, quantity_received, bonus_quantity, unit_cost, total_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              purchaseId,
              item.product_id,
              item.product_code,
              item.product_name,
              item.quantity,
              item.quantity,
              item.bonus_quantity || 0,
              item.unit_cost,
              item.total_cost
            ]
          );
        }

        // Step 5: Create accounts_payable record
        await db.runAsync(
          `INSERT INTO accounts_payable (
            purchase_id, supplier_id, invoice_number, invoice_date, due_date,
            original_amount, paid_amount, balance_amount, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            purchaseId,
            supplierId,
            referenceNumber,
            purchaseDate,
            dueDate,
            totalAmount,
            0,
            totalAmount,
            'OUTSTANDING'
          ]
        );

        // Step 6: Update product quantities and record inventory movements using AVCO (Moving Average Cost).
        //
        //   - Invoice money for this delivery  = item.quantity x item.unit_cost   (already in total_cost)
        //   - Physical units received          = item.quantity + item.bonus_quantity   (paid + free)
        //   - Effective per-selling-unit cost  = invoice_money / (physical_units * conversion_factor)
        //
        // The bonus is FREE from the supplier — it doesn't bill, doesn't increase AP, but it DOES
        // increase stock and LOWERS the rolling AVCO because the same money buys more units.
        for (const item of purchaseItems) {
          // Get current stock, current AVCO, and conversion factor BEFORE this layer is added
          const currentProduct = await db.getFirstAsync<{ stock_quantity: number; cost: number; conversion_factor: number }>(
            'SELECT stock_quantity, cost, COALESCE(conversion_factor, 1) as conversion_factor FROM products WHERE id = ?',
            [item.product_id]
          );
          const quantityBefore = currentProduct?.stock_quantity || 0;
          const currentAvco = currentProduct?.cost || 0;
          const conversionFactor = currentProduct?.conversion_factor || 1;

          const paidPurchaseQty = item.quantity;
          const bonusPurchaseQty = item.bonus_quantity || 0;
          const totalPurchaseQty = paidPurchaseQty + bonusPurchaseQty;

          // Total physical units arriving, in selling units
          const totalSellingQty = totalPurchaseQty * conversionFactor;
          const quantityAfter = quantityBefore + totalSellingQty;

          // Invoice value = what we owe the supplier (PAID units only — bonus is free)
          const invoiceMoney = paidPurchaseQty * item.unit_cost;

          // Effective cost per selling unit — spread the paid money across ALL physical units
          const effectiveCostPerSellingUnit = totalSellingQty > 0
            ? invoiceMoney / totalSellingQty
            : (item.unit_cost / conversionFactor);

          // Compute new AVCO by weighted-average blending with prior stock
          const newAvco = roundAvco(
            computeNewAvco(quantityBefore, currentAvco, totalSellingQty, effectiveCostPerSellingUnit)
          );

          // Update stock quantity (in selling units) and AVCO cost
          await db.runAsync(
            'UPDATE products SET stock_quantity = ?, cost = ? WHERE id = ?',
            [quantityAfter, newAvco, item.product_id]
          );

          // Build movement note describing the math
          let notes = `Purchase from ${supplierName} - ${referenceNumber}`;
          if (bonusPurchaseQty > 0) {
            notes += ` (${paidPurchaseQty} paid + ${bonusPurchaseQty} bonus = ${totalPurchaseQty}${conversionFactor > 1 ? ' x ' + conversionFactor + ' = ' + totalSellingQty + ' units' : ' units'} @ effective PHP ${effectiveCostPerSellingUnit.toFixed(4)}/unit)`;
          } else if (conversionFactor > 1) {
            notes += ` (${paidPurchaseQty} x ${conversionFactor} = ${totalSellingQty})`;
          }

          await db.runAsync(
            `INSERT INTO inventory_movements (
              product_id, product_code, product_name, movement_type, quantity,
              quantity_before, quantity_after, unit_cost, total_value,
              reference_type, reference_id, reference_number, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.product_id,
              item.product_code,
              item.product_name,
              'IN',
              totalSellingQty,
              quantityBefore,
              quantityAfter,
              effectiveCostPerSellingUnit,
              invoiceMoney,
              'PURCHASE',
              purchaseId,
              referenceNumber,
              notes,
              userId
            ]
          );
        }

        // Step 7: Update supplier balance
        await db.runAsync(
          'UPDATE suppliers SET balance = balance + ? WHERE id = ?',
          [totalAmount, supplierId]
        );

        // Step 8: Add eJournal entry
        await db.runAsync(
          `INSERT INTO ejournal (entry_type, reference_number, description, amount, cashier_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            'SYSTEM',
            referenceNumber,
            `Purchase received from ${supplierName}`,
            totalAmount,
            userId
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.mainContainer}>
        {/* Purchase Order Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title style={[styles.headerTitle, { fontSize: fs.h2 }]}>Purchase Order</Title>
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Available Products</Title>
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>
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
                  label="Quantity to Purchase (paid)"
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

                <TextInput
                  label="Free / Bonus Qty (optional)"
                  value={bonusQuantity}
                  onChangeText={setBonusQuantity}
                  mode="outlined"
                  keyboardType="numeric"
                  placeholder="0"
                  style={styles.dialogInput}
                />
                <Paragraph style={{ fontSize: 11, color: '#666', marginTop: -4, marginBottom: 8 }}>
                  Free items from supplier — added to stock but NOT billed. Lowers average cost.
                </Paragraph>

                {purchaseQuantity && unitCost && (
                  <>
                    <Paragraph style={styles.totalCostPreview}>
                      Invoice Total: ₱{(parseInt(purchaseQuantity) * parseFloat(unitCost)).toFixed(2)}
                    </Paragraph>
                    {parseInt(bonusQuantity || '0') > 0 && (() => {
                      const paid = parseInt(purchaseQuantity);
                      const bonus = parseInt(bonusQuantity || '0');
                      const cost = parseFloat(unitCost);
                      const totalUnits = paid + bonus;
                      const effective = totalUnits > 0 ? (paid * cost) / totalUnits : cost;
                      return (
                        <Paragraph style={{ fontSize: 12, color: '#388E3C', marginTop: 4 }}>
                          Total units received: {totalUnits} ({paid} paid + {bonus} free) — Effective AVCO cost: ₱{effective.toFixed(4)} per unit
                        </Paragraph>
                      );
                    })()}
                  </>
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
    </View>
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