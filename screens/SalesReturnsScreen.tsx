import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  FlatList,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'SalesReturns'>;
};

interface ReturnItem {
  product_id: number;
  product_name: string;
  quantity: number;
  max_quantity: number;
  unit_price: number;
  reason: string;
}

interface Product {
  id: number;
  name: string;
  selling_price: number;
  stock_quantity: number;
}

interface Customer {
  id: number;
  name: string;
  balance: number;
}

export default function SalesReturnsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user } = useAuth();

  // State for return form
  const [transactionNumber, setTransactionNumber] = useState('');
  const [originalTransaction, setOriginalTransaction] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CREDIT' | 'STORE_CREDIT'>('CASH');
  const [notes, setNotes] = useState('');

  // State for product selection (when no original transaction)
  const [showProductModal, setShowProductModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // State for return history
  const [returnHistory, setReturnHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Loading/error states
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dbService = getDatabase();
      const [productsData, customersData, returnsData] = await Promise.all([
        dbService.getProducts(),
        dbService.getCustomers(),
        dbService.getSalesReturns(),
      ]);
      setProducts(productsData);
      setCustomers(customersData);
      setReturnHistory(returnsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const lookupTransaction = async () => {
    if (!transactionNumber.trim()) {
      showAlert('Error', 'Please enter a transaction number');
      return;
    }

    setLookingUp(true);
    try {
      const dbService = getDatabase();
      const transaction = await dbService.getTransactionForReturn(transactionNumber.trim());

      if (transaction) {
        setOriginalTransaction(transaction);
        // Pre-populate return items from transaction
        if (transaction.items && transaction.items.length > 0) {
          const items = transaction.items.map((item: any) => ({
            product_id: item.product_id,
            product_name: item.product_name || item.name,
            quantity: 0, // Start with 0, user selects what to return
            max_quantity: item.quantity,
            unit_price: item.unit_price || item.selling_price,
            reason: '',
          }));
          setReturnItems(items);
        }

        // Set customer if exists
        if (transaction.customer_id) {
          const customer = customers.find(c => c.id === transaction.customer_id);
          if (customer) {
            setSelectedCustomer(customer);
            setRefundMethod('CREDIT'); // Default to credit for credit customers
          }
        }
      } else {
        showAlert('Not Found', 'Transaction not found or not eligible for return');
      }
    } catch (error) {
      console.error('Error looking up transaction:', error);
      showAlert('Error', 'Failed to look up transaction');
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

    setReturnItems([...returnItems, {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      max_quantity: 999, // No limit for manual returns
      unit_price: product.selling_price,
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
    return returnItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
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
      'Confirm Return',
      `Process return for ${itemsToReturn.length} item(s) totaling ₱${total.toFixed(2)}?\n\nRefund Method: ${refundMethod}`,
      async () => {
        setLoading(true);
        try {
          const dbService = getDatabase();
          const result = await dbService.processSalesReturn({
            original_transaction_id: originalTransaction?.id,
            original_transaction_number: originalTransaction?.transaction_number || transactionNumber,
            customer_id: selectedCustomer?.id,
            customer_name: selectedCustomer?.name,
            items: itemsToReturn.map(item => ({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              reason: item.reason,
            })),
            refund_method: refundMethod,
            notes: notes,
            created_by: user?.id || 1,
          });

          showAlert(
            'Return Processed',
            `Return ${result.returnNumber} processed successfully!\n\nTotal Refund: ₱${total.toFixed(2)}\nMethod: ${refundMethod}`,
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
    setTransactionNumber('');
    setOriginalTransaction(null);
    setSelectedCustomer(null);
    setReturnItems([]);
    setRefundMethod('CASH');
    setNotes('');
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const webContainerStyle = Platform.OS === 'web'
    ? { height: 'calc(100vh - 64px)', overflow: 'hidden' as const }
    : {};

  const webScrollStyle = Platform.OS === 'web'
    ? { flex: 1, overflow: 'auto' as const }
    : {};

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }, webContainerStyle]}>
      <ScrollView style={[styles.scrollView, webScrollStyle]} contentContainerStyle={styles.scrollContent}>
        {/* Header with History Toggle */}
        <View style={styles.header}>
          <Title style={styles.pageTitle}>Sales Returns</Title>
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
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Return History</Title>
              {returnHistory.length === 0 ? (
                <Paragraph style={styles.emptyText}>No returns recorded yet</Paragraph>
              ) : (
                returnHistory.map((ret, index) => (
                  <View key={ret.id || index}>
                    <List.Item
                      title={ret.return_number}
                      description={`${ret.customer_name || 'Walk-in'} - ₱${(ret.total_amount || 0).toFixed(2)} - ${ret.refund_method}`}
                      left={props => <List.Icon {...props} icon="undo" color={theme.colors.error} />}
                      right={() => (
                        <Paragraph style={styles.dateText}>
                          {new Date(ret.created_at).toLocaleDateString()}
                        </Paragraph>
                      )}
                    />
                    {index < returnHistory.length - 1 && <Divider />}
                  </View>
                ))
              )}
            </Card.Content>
          </Card>
        ) : (
          // New Return Form
          <>
            {/* Lookup Original Transaction */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.sectionTitle}>Lookup Transaction (Optional)</Title>
                <View style={styles.lookupRow}>
                  <TextInput
                    label="Transaction Number"
                    value={transactionNumber}
                    onChangeText={setTransactionNumber}
                    style={styles.lookupInput}
                    placeholder="e.g., TXN-000001"
                    disabled={!!originalTransaction}
                  />
                  <Button
                    mode="contained"
                    onPress={lookupTransaction}
                    loading={lookingUp}
                    disabled={lookingUp || !!originalTransaction}
                    style={styles.lookupButton}
                  >
                    Lookup
                  </Button>
                </View>
                {originalTransaction && (
                  <View style={styles.transactionInfo}>
                    <Chip icon="check-circle" style={styles.foundChip}>
                      Found: {originalTransaction.transaction_number}
                    </Chip>
                    <Button mode="text" onPress={resetForm}>Clear</Button>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Customer Selection */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <Title style={styles.sectionTitle}>Customer</Title>
                  <Button
                    mode="outlined"
                    onPress={() => setShowCustomerModal(true)}
                    compact
                    disabled={!!originalTransaction?.customer_id}
                  >
                    {selectedCustomer ? 'Change' : 'Select'}
                  </Button>
                </View>
                {selectedCustomer ? (
                  <View style={styles.customerInfo}>
                    <Paragraph>{selectedCustomer.name}</Paragraph>
                    <Paragraph style={styles.balanceText}>
                      Balance: ₱{(selectedCustomer.balance || 0).toFixed(2)}
                    </Paragraph>
                  </View>
                ) : (
                  <Paragraph style={styles.emptyText}>Walk-in customer (optional)</Paragraph>
                )}
              </Card.Content>
            </Card>

            {/* Return Items */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <Title style={styles.sectionTitle}>Items to Return</Title>
                  {!originalTransaction && (
                    <Button
                      mode="contained"
                      onPress={() => setShowProductModal(true)}
                      compact
                      icon="plus"
                    >
                      Add
                    </Button>
                  )}
                </View>

                {returnItems.length === 0 ? (
                  <Paragraph style={styles.emptyText}>
                    {originalTransaction
                      ? 'No items in original transaction'
                      : 'Add items to return'}
                  </Paragraph>
                ) : (
                  returnItems.map((item, index) => (
                    <View key={item.product_id} style={styles.returnItem}>
                      <View style={styles.itemHeader}>
                        <Paragraph style={styles.itemName}>{item.product_name}</Paragraph>
                        <Paragraph style={styles.itemPrice}>₱{item.unit_price.toFixed(2)}</Paragraph>
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
                          {originalTransaction && (
                            <Paragraph style={styles.maxQty}>/ {item.max_quantity}</Paragraph>
                          )}
                        </View>

                        <Paragraph style={styles.itemTotal}>
                          = ₱{(item.quantity * item.unit_price).toFixed(2)}
                        </Paragraph>
                      </View>

                      <TextInput
                        label="Reason for return *"
                        value={item.reason}
                        onChangeText={(text) => updateItemReason(item.product_id, text)}
                        style={styles.reasonInput}
                        placeholder="e.g., Defective, Wrong item, Customer changed mind"
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
                <Title style={styles.sectionTitle}>Refund Method</Title>
                <RadioButton.Group
                  onValueChange={(value) => setRefundMethod(value as any)}
                  value={refundMethod}
                >
                  <View style={styles.radioRow}>
                    <RadioButton.Item label="Cash Refund" value="CASH" />
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton.Item
                      label={`Apply to Customer Balance${selectedCustomer ? ` (₱${selectedCustomer.balance.toFixed(2)})` : ''}`}
                      value="CREDIT"
                      disabled={!selectedCustomer}
                    />
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton.Item label="Store Credit" value="STORE_CREDIT" />
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
                  <Title>Total Refund:</Title>
                  <Title style={[styles.totalAmount, { color: theme.colors.error }]}>
                    ₱{calculateTotal().toFixed(2)}
                  </Title>
                </View>
                <Button
                  mode="contained"
                  onPress={processReturn}
                  loading={loading}
                  disabled={loading || returnItems.filter(i => i.quantity > 0).length === 0}
                  style={styles.processButton}
                  contentStyle={styles.processButtonContent}
                  icon="undo"
                >
                  Process Return
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
          <Title style={styles.modalTitle}>Select Product</Title>
          <Searchbar
            placeholder="Search products..."
            value={productSearch}
            onChangeText={setProductSearch}
            style={styles.searchBar}
          />
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => String(item.id)}
            style={styles.productList}
            renderItem={({ item }) => (
              <List.Item
                title={item.name}
                description={`₱${item.selling_price.toFixed(2)} | Stock: ${item.stock_quantity}`}
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

      {/* Customer Selection Modal */}
      <Portal>
        <Modal
          visible={showCustomerModal}
          onDismiss={() => setShowCustomerModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Title style={styles.modalTitle}>Select Customer</Title>
          <FlatList
            data={customers}
            keyExtractor={(item) => String(item.id)}
            style={styles.productList}
            renderItem={({ item }) => (
              <List.Item
                title={item.name}
                description={`Balance: ₱${(item.balance || 0).toFixed(2)}`}
                onPress={() => {
                  setSelectedCustomer(item);
                  if (item.balance > 0) {
                    setRefundMethod('CREDIT');
                  }
                  setShowCustomerModal(false);
                }}
                right={props => <List.Icon {...props} icon="chevron-right" />}
              />
            )}
            ItemSeparatorComponent={() => <Divider />}
            ListHeaderComponent={
              <List.Item
                title="Walk-in Customer"
                description="No customer record"
                onPress={() => {
                  setSelectedCustomer(null);
                  setRefundMethod('CASH');
                  setShowCustomerModal(false);
                }}
                left={props => <List.Icon {...props} icon="account-off" />}
              />
            }
          />
          <Button onPress={() => setShowCustomerModal(false)} style={styles.modalClose}>
            Cancel
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
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
  transactionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  foundChip: {
    backgroundColor: '#E8F5E9',
  },
  customerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceText: {
    color: '#E91E63',
    fontWeight: 'bold',
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
    backgroundColor: '#FFF3E0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
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
  searchBar: {
    marginBottom: 12,
  },
  productList: {
    maxHeight: 300,
  },
  modalClose: {
    marginTop: 16,
  },
});
