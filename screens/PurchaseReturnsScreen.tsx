import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  FlatList,
  TouchableOpacity,
  Text,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  useTheme,
  Divider,
  List,
  IconButton,
  Chip,
  Portal,
  Modal,
  RadioButton,
  Searchbar,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'PurchaseReturns'>;
};

interface ReturnItem {
  product_id: number;
  product_name: string;
  quantity: number;
  max_quantity: number;
  unit_cost: number;
  reason: string;
}

interface Product {
  id: number;
  name: string;
  cost: number;
  selling_price: number;
  stock_quantity: number;
}

interface Supplier {
  id: number;
  name: string;
}

export default function PurchaseReturnsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const { user } = useAuth();

  // State for return form
  const [purchaseId, setPurchaseId] = useState('');
  const [originalPurchase, setOriginalPurchase] = useState<any>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CREDIT' | 'REPLACEMENT'>('CREDIT');
  const [notes, setNotes] = useState('');

  // State for product selection (when no original purchase)
  const [showProductModal, setShowProductModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  // State for return history
  const [returnHistory, setReturnHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // History filter states
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [filterSupplierId, setFilterSupplierId] = useState<number | null>(null);
  const [showFilterSupplierModal, setShowFilterSupplierModal] = useState(false);
  const [filterSupplierSearch, setFilterSupplierSearch] = useState('');

  // Loading/error states
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dbService = getDatabase();
      const [productsData, suppliersData, returnsData] = await Promise.all([
        dbService.getProducts(),
        dbService.getSuppliers(),
        dbService.getPurchaseReturns(),
      ]);
      setProducts(productsData);
      setSuppliers(suppliersData);
      setReturnHistory(returnsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const lookupPurchase = async () => {
    if (!purchaseId.trim()) {
      showAlert('Error', 'Please enter a purchase order number');
      return;
    }

    setLookingUp(true);
    try {
      const dbService = getDatabase();
      const purchase = await dbService.getPurchaseForReturn(purchaseId.trim());

      if (purchase) {
        setOriginalPurchase(purchase);
        // Pre-populate return items from purchase
        if (purchase.items && purchase.items.length > 0) {
          const items = purchase.items.map((item: any) => ({
            product_id: item.product_id,
            product_name: item.product_name || item.name,
            quantity: 0, // Start with 0, user selects what to return
            max_quantity: item.quantity,
            unit_cost: item.unit_cost || item.cost,
            reason: '',
          }));
          setReturnItems(items);
        }

        // Set supplier
        if (purchase.supplier_id) {
          const supplier = suppliers.find(s => s.id === purchase.supplier_id);
          if (supplier) {
            setSelectedSupplier(supplier);
          }
        }
      } else {
        showAlert('Not Found', 'Purchase order not found');
      }
    } catch (error) {
      console.error('Error looking up purchase:', error);
      showAlert('Error', 'Failed to look up purchase order');
    } finally {
      setLookingUp(false);
    }
  };

  const addProductToReturn = (product: Product) => {
    // Check if already in list
    if (returnItems.some(item => item.product_id === product.id)) {
      showAlert('Already Added', 'This product is already in the return list');
      return;
    }

    if (!selectedSupplier) {
      showAlert('Error', 'Please select a supplier first');
      return;
    }

    setReturnItems([...returnItems, {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      max_quantity: product.stock_quantity, // Can only return what we have in stock
      unit_cost: product.cost || product.selling_price * 0.7, // Use cost or estimate
      reason: '',
    }]);
    setShowProductModal(false);
  };

  const updateItemQuantity = (productId: number, quantity: number) => {
    setReturnItems(returnItems.map(item => {
      if (item.product_id === productId) {
        const newQty = Math.max(0, Math.min(quantity, item.max_quantity));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateItemReason = (productId: number, reason: string) => {
    setReturnItems(returnItems.map(item => {
      if (item.product_id === productId) {
        return { ...item, reason };
      }
      return item;
    }));
  };

  const removeItem = (productId: number) => {
    setReturnItems(returnItems.filter(item => item.product_id !== productId));
  };

  const calculateTotal = () => {
    return returnItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: onConfirm },
      ]);
    }
  };

  const processReturn = async () => {
    // Validate
    if (!selectedSupplier) {
      showAlert('Error', 'Please select a supplier');
      return;
    }

    const itemsToReturn = returnItems.filter(item => item.quantity > 0);
    if (itemsToReturn.length === 0) {
      showAlert('Error', 'Please select at least one item to return');
      return;
    }

    // Check reasons
    const missingReason = itemsToReturn.find(item => !item.reason.trim());
    if (missingReason) {
      showAlert('Error', `Please provide a reason for returning "${missingReason.product_name}"`);
      return;
    }

    const total = calculateTotal();
    showConfirm(
      'Confirm Purchase Return',
      `Return ${itemsToReturn.length} item(s) to ${selectedSupplier.name}?\n\nTotal Value: ₱${total.toFixed(2)}\nMethod: ${refundMethod}`,
      async () => {
        setLoading(true);
        try {
          const dbService = getDatabase();
          const result = await dbService.processPurchaseReturn({
            original_purchase_id: originalPurchase?.purchase_id || purchaseId,
            supplier_id: selectedSupplier.id,
            supplier_name: selectedSupplier.name,
            items: itemsToReturn.map(item => ({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              reason: item.reason,
            })),
            refund_method: refundMethod,
            notes: notes,
            created_by: user?.id || 1,
          });

          showAlert(
            'Return Processed',
            `Purchase Return ${result.returnNumber} processed!\n\nTotal: ₱${total.toFixed(2)}\nMethod: ${refundMethod}\n\nInventory has been reduced and ${refundMethod === 'CREDIT' ? 'AP balance reduced' : 'refund recorded'}.`,
            () => {
              // Reset form
              resetForm();
              loadData(); // Reload history
            }
          );
        } catch (error) {
          console.error('Error processing return:', error);
          showAlert('Error', 'Failed to process return');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const resetForm = () => {
    setPurchaseId('');
    setOriginalPurchase(null);
    setSelectedSupplier(null);
    setReturnItems([]);
    setRefundMethod('CREDIT');
    setNotes('');
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) && p.stock_quantity > 0
  );

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const filteredFilterSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(filterSupplierSearch.toLowerCase())
  );

  const handleDateChange = (startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  };

  const filteredReturnHistory = returnHistory.filter(ret => {
    // Date filter
    const retDate = new Date(ret.created_at || ret.return_date);
    if (retDate < dateRange.startDate || retDate > dateRange.endDate) return false;
    // Supplier filter
    if (filterSupplierId && ret.supplier_id !== filterSupplierId) return false;
    return true;
  });

  const webContainerStyle = {};
  const webScrollStyle = {};

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }, webContainerStyle]}>
      <ScrollView style={[styles.scrollView, webScrollStyle]} contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}>
        {/* Header with History Toggle */}
        <View style={styles.header}>
          <Title style={[styles.pageTitle, { fontSize: fs.h2 }]}>Purchase Returns</Title>
          <Button
            mode={showHistory ? 'contained' : 'outlined'}
            onPress={() => setShowHistory(!showHistory)}
            compact
          >
            {showHistory ? 'New Return' : 'History'}
          </Button>
        </View>

        {showHistory ? (
          // Return History View
          <>
            {/* Date Filter */}
            <Card style={styles.card}>
              <Card.Content>
                <DateRangeFilter
                  onDateChange={handleDateChange}
                  selectedPreset="this_month"
                />
              </Card.Content>
            </Card>

            {/* Supplier Filter */}
            <Card style={styles.card}>
              <Card.Content>
                <Paragraph style={styles.filterLabel}>Supplier:</Paragraph>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowFilterSupplierModal(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {filterSupplierId
                      ? suppliers.find(s => s.id === filterSupplierId)?.name || 'Unknown'
                      : 'All Suppliers'}
                  </Text>
                  <Text style={styles.dropdownChevron}>▼</Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>

            {/* Return History List */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Return History</Title>
                {filteredReturnHistory.length === 0 ? (
                  <Paragraph style={styles.emptyText}>No purchase returns found</Paragraph>
                ) : (
                  filteredReturnHistory.map((ret, index) => (
                    <View key={ret.id || index}>
                      <List.Item
                        title={ret.return_number}
                        description={`${ret.supplier_name} - ₱${(ret.total_amount || 0).toFixed(2)} - ${ret.refund_method}`}
                        left={props => <List.Icon {...props} icon="truck-delivery" color={theme.colors.primary} />}
                        right={() => (
                          <Paragraph style={styles.dateText}>
                            {new Date(ret.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
                          </Paragraph>
                        )}
                      />
                      {index < filteredReturnHistory.length - 1 && <Divider />}
                    </View>
                  ))
                )}
              </Card.Content>
            </Card>
          </>
        ) : (
          // New Return Form
          <>
            {/* Supplier Selection */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Supplier *</Title>
                  <Button
                    mode="outlined"
                    onPress={() => setShowSupplierModal(true)}
                    compact
                    disabled={!!originalPurchase?.supplier_id}
                  >
                    {selectedSupplier ? 'Change' : 'Select'}
                  </Button>
                </View>
                {selectedSupplier ? (
                  <Paragraph style={styles.supplierName}>{selectedSupplier.name}</Paragraph>
                ) : (
                  <Paragraph style={styles.emptyText}>Please select a supplier</Paragraph>
                )}
              </Card.Content>
            </Card>

            {/* Return Items */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Items to Return</Title>
                  {!originalPurchase && (
                    <Button
                      mode="contained"
                      onPress={() => setShowProductModal(true)}
                      compact
                      icon="plus"
                      disabled={!selectedSupplier}
                    >
                      Add
                    </Button>
                  )}
                </View>

                {returnItems.length === 0 ? (
                  <Paragraph style={styles.emptyText}>
                    {originalPurchase
                      ? 'No items in original purchase'
                      : selectedSupplier
                        ? 'Add items to return'
                        : 'Select a supplier first'}
                  </Paragraph>
                ) : (
                  returnItems.map((item, index) => (
                    <View key={item.product_id} style={styles.returnItem}>
                      <View style={styles.itemHeader}>
                        <Paragraph style={styles.itemName}>{item.product_name}</Paragraph>
                        <Paragraph style={styles.itemPrice}>₱{item.unit_cost.toFixed(2)}</Paragraph>
                        <IconButton
                          icon="delete"
                          size={20}
                          onPress={() => removeItem(item.product_id)}
                        />
                      </View>

                      <View style={styles.itemControls}>
                        <View style={styles.qtyControl}>
                          <IconButton
                            icon="minus"
                            size={18}
                            onPress={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                          />
                          <TextInput
                            value={String(item.quantity)}
                            onChangeText={(text) => updateItemQuantity(item.product_id, parseInt(text) || 0)}
                            keyboardType="numeric"
                            style={styles.qtyInput}
                            dense
                          />
                          <IconButton
                            icon="plus"
                            size={18}
                            onPress={() => updateItemQuantity(item.product_id, item.quantity + 1)}
                          />
                          <Paragraph style={styles.maxQty}>/ {item.max_quantity} max</Paragraph>
                        </View>

                        <Paragraph style={styles.itemTotal}>
                          = ₱{(item.quantity * item.unit_cost).toFixed(2)}
                        </Paragraph>
                      </View>

                      <TextInput
                        label="Reason for return *"
                        value={item.reason}
                        onChangeText={(text) => updateItemReason(item.product_id, text)}
                        style={styles.reasonInput}
                        placeholder="e.g., Defective, Wrong item, Expired"
                        dense
                      />

                      {index < returnItems.length - 1 && <Divider style={styles.itemDivider} />}
                    </View>
                  ))
                )}
              </Card.Content>
            </Card>

            {/* Refund Method */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Settlement Method</Title>
                <RadioButton.Group
                  onValueChange={(value) => setRefundMethod(value as any)}
                  value={refundMethod}
                >
                  <View style={styles.radioRow}>
                    <RadioButton.Item
                      label="Apply as Credit (Reduce AP Balance)"
                      value="CREDIT"
                    />
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton.Item label="Cash Refund" value="CASH" />
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton.Item label="Replacement (No financial impact)" value="REPLACEMENT" />
                  </View>
                </RadioButton.Group>

                <TextInput
                  label="Notes (optional)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                  style={styles.notesInput}
                />
              </Card.Content>
            </Card>

            {/* Total and Process Button */}
            <Card style={[styles.card, styles.totalCard]}>
              <Card.Content>
                <View style={styles.totalRow}>
                  <Title>Total Return Value:</Title>
                  <Title style={[styles.totalAmount, { color: theme.colors.primary }]}>
                    ₱{calculateTotal().toFixed(2)}
                  </Title>
                </View>
                <Paragraph style={styles.infoText}>
                  {refundMethod === 'CREDIT'
                    ? 'This will reduce your outstanding balance to the supplier'
                    : refundMethod === 'CASH'
                      ? 'Supplier will provide cash refund'
                      : 'Supplier will send replacement items'}
                </Paragraph>
                <Button
                  mode="contained"
                  onPress={processReturn}
                  loading={loading}
                  disabled={loading || !selectedSupplier || returnItems.filter(i => i.quantity > 0).length === 0}
                  style={styles.processButton}
                  contentStyle={styles.processButtonContent}
                  icon="truck-delivery"
                >
                  Process Return to Supplier
                </Button>
              </Card.Content>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Product Selection Modal */}
      <Portal>
        <Modal
          visible={showProductModal}
          onDismiss={() => setShowProductModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Title style={styles.modalTitle}>Select Product to Return</Title>
          <Searchbar
            placeholder="Search products..."
            value={productSearch}
            onChangeText={setProductSearch}
            style={styles.searchBar}
          />
          <Paragraph style={styles.modalNote}>Only showing products with stock &gt; 0</Paragraph>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => String(item.id)}
            style={styles.productList}
            renderItem={({ item }) => (
              <List.Item
                title={item.name}
                description={`Cost: ₱${(item.cost || 0).toFixed(2)} | Stock: ${item.stock_quantity}`}
                onPress={() => addProductToReturn(item)}
                right={props => <List.Icon {...props} icon="plus-circle" />}
              />
            )}
            ItemSeparatorComponent={() => <Divider />}
          />
          <Button onPress={() => setShowProductModal(false)} style={styles.modalClose}>
            Cancel
          </Button>
        </Modal>
      </Portal>

      {/* Supplier Selection Modal */}
      <Portal>
        <Modal
          visible={showSupplierModal}
          onDismiss={() => { setShowSupplierModal(false); setSupplierSearch(''); }}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Title style={styles.modalTitle}>Select Supplier</Title>
          <Searchbar
            placeholder="Search suppliers..."
            value={supplierSearch}
            onChangeText={setSupplierSearch}
            style={styles.searchBar}
          />
          <FlatList
            data={filteredSuppliers}
            keyExtractor={(item) => String(item.id)}
            style={styles.productList}
            renderItem={({ item }) => (
              <List.Item
                title={item.name}
                onPress={() => {
                  setSelectedSupplier(item);
                  setShowSupplierModal(false);
                  setSupplierSearch('');
                }}
                right={props => <List.Icon {...props} icon="chevron-right" />}
              />
            )}
            ItemSeparatorComponent={() => <Divider />}
            ListEmptyComponent={() => (
              <Paragraph style={styles.emptyText}>No suppliers found</Paragraph>
            )}
          />
          <Button onPress={() => { setShowSupplierModal(false); setSupplierSearch(''); }} style={styles.modalClose}>
            Cancel
          </Button>
        </Modal>
      </Portal>

      {/* Filter Supplier Modal (History) */}
      <Portal>
        <Modal
          visible={showFilterSupplierModal}
          onDismiss={() => { setShowFilterSupplierModal(false); setFilterSupplierSearch(''); }}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Title style={styles.modalTitle}>Filter by Supplier</Title>
          <Searchbar
            placeholder="Search suppliers..."
            value={filterSupplierSearch}
            onChangeText={setFilterSupplierSearch}
            style={styles.searchBar}
          />
          <FlatList
            data={[{ id: 0, name: 'All Suppliers' } as Supplier, ...filteredFilterSuppliers]}
            keyExtractor={(item) => String(item.id)}
            style={styles.productList}
            renderItem={({ item }) => (
              <List.Item
                title={item.name}
                onPress={() => {
                  setFilterSupplierId(item.id === 0 ? null : item.id);
                  setShowFilterSupplierModal(false);
                  setFilterSupplierSearch('');
                }}
                left={props => <List.Icon {...props} icon={
                  (item.id === 0 && filterSupplierId === null) || item.id === filterSupplierId
                    ? 'check-circle' : 'circle-outline'
                } color={
                  (item.id === 0 && filterSupplierId === null) || item.id === filterSupplierId
                    ? theme.colors.primary : undefined
                } />}
              />
            )}
            ItemSeparatorComponent={() => <Divider />}
            ListEmptyComponent={() => (
              <Paragraph style={styles.emptyText}>No suppliers found</Paragraph>
            )}
          />
          <Button onPress={() => { setShowFilterSupplierModal(false); setFilterSupplierSearch(''); }} style={styles.modalClose}>
            Cancel
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lookupInput: {
    flex: 1,
  },
  lookupButton: {
    marginTop: 8,
  },
  purchaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  foundChip: {
    backgroundColor: '#E8F5E9',
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyText: {
    fontStyle: 'italic',
    opacity: 0.6,
    textAlign: 'center',
    paddingVertical: 16,
  },
  returnItem: {
    marginBottom: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    flex: 1,
    fontWeight: 'bold',
  },
  itemPrice: {
    marginRight: 8,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyInput: {
    width: 50,
    textAlign: 'center',
  },
  maxQty: {
    marginLeft: 8,
    opacity: 0.6,
    fontSize: 12,
  },
  itemTotal: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  reasonInput: {
    marginTop: 4,
  },
  itemDivider: {
    marginTop: 16,
  },
  radioRow: {
    marginVertical: -4,
  },
  notesInput: {
    marginTop: 12,
  },
  totalCard: {
    backgroundColor: '#E3F2FD',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  processButton: {
    marginTop: 8,
  },
  processButtonContent: {
    paddingVertical: 8,
  },
  dateText: {
    fontSize: 12,
    opacity: 0.6,
  },
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  modalNote: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
    textAlign: 'center',
  },
  searchBar: {
    marginBottom: 12,
  },
  productList: {
    maxHeight: 300,
  },
  modalClose: {
    marginTop: 16,
  },
  filterLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
});
