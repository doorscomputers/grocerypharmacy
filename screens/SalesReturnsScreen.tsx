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
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import ReturnReceiptPreview, { ReturnReceiptData } from '../components/ReturnReceiptPreview';
import * as Print from 'expo-print';
import { buildReturnReceipt } from '../utils/escpos';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import { useResponsiveTheme } from '../utils/responsive';

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
  code?: string;
  price: number;
  stock_quantity: number;
}

interface Customer {
  id: number;
  name: string;
  balance: number;
}

export default function SalesReturnsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
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

  // State for transaction lookup modal
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [transactionSearch, setTransactionSearch] = useState('');

  // Loading/error states
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Receipt preview state
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [receiptData, setReceiptData] = useState<ReturnReceiptData | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Printer service
  const printerService = BluetoothPrinterService.getInstance();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dbService = getDatabase();
      const [productsData, customersData, returnsData, receivablesData] = await Promise.all([
        dbService.getProducts(),
        dbService.getCustomers(),
        dbService.getSalesReturns(),
        dbService.getAccountsReceivable(),
      ]);
      setProducts(productsData);

      // Calculate total AR balance per customer from accounts receivable
      const customerBalances: Record<number, number> = {};
      receivablesData.forEach((ar: any) => {
        if (ar.customer_id && ar.balance_amount > 0) {
          customerBalances[ar.customer_id] = (customerBalances[ar.customer_id] || 0) + ar.balance_amount;
        }
      });

      // Merge AR balance into customer data
      const customersWithBalance = customersData.map((customer: any) => ({
        ...customer,
        balance: customerBalances[customer.id] || 0,
      }));

      setCustomers(customersWithBalance);
      setReturnHistory(returnsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const openTransactionLookup = async () => {
    setLookingUp(true);
    try {
      const dbService = getDatabase();
      const transactions = await dbService.getRecentTransactionsForReturn();
      setRecentTransactions(transactions);
      setTransactionSearch('');
      setShowTransactionModal(true);
    } catch (error) {
      console.error('Error loading recent transactions:', error);
      showAlert('Error', 'Failed to load recent transactions');
    } finally {
      setLookingUp(false);
    }
  };

  const selectTransaction = async (transaction: any) => {
    setShowTransactionModal(false);
    setLookingUp(true);
    try {
      const dbService = getDatabase();
      const fullTransaction = await dbService.getTransactionForReturn(transaction.transaction_number);

      if (fullTransaction) {
        setTransactionNumber(transaction.transaction_number);
        setOriginalTransaction(fullTransaction);
        // Pre-populate return items from transaction
        if (fullTransaction.items && fullTransaction.items.length > 0) {
          const items = fullTransaction.items.map((item: any) => ({
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
        if (fullTransaction.customer_id) {
          const customer = customers.find(c => c.id === fullTransaction.customer_id);
          if (customer) {
            setSelectedCustomer(customer);
            setRefundMethod('CREDIT'); // Default to credit for credit customers
          }
        }
      } else {
        showAlert('Error', 'Could not load transaction details');
      }
    } catch (error) {
      console.error('Error selecting transaction:', error);
      showAlert('Error', 'Failed to load transaction');
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
      unit_price: product.price || 0,
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

  const updateItemPrice = (productId: number, price: number) => {
    setReturnItems(returnItems.map(item => {
      if (item.product_id === productId) {
        return { ...item, unit_price: Math.max(0, price) };
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

          // Fetch business settings for receipt
          const businessName = await dbService.getSetting('business_name') || 'Store';
          const businessAddress = await dbService.getSetting('business_address') || '';
          const businessPhone = await dbService.getSetting('business_phone') || '';
          const tin = await dbService.getSetting('tin') || '';
          const footerText = await dbService.getSetting('receipt_footer') || '';

          // Prepare receipt data
          const receiptItems = itemsToReturn.map(item => ({
            productName: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            total: item.quantity * item.unit_price,
            reason: item.reason,
          }));

          const newReceiptData: ReturnReceiptData = {
            businessName,
            businessAddress,
            businessPhone,
            tin,
            returnNumber: result.returnNumber,
            returnDate: new Date(),
            processedBy: user?.full_name || user?.username || 'Cashier',
            originalTransactionNumber: originalTransaction?.transaction_number || transactionNumber || undefined,
            customerName: selectedCustomer?.name,
            items: receiptItems,
            totalAmount: total,
            refundMethod: refundMethod,
            notes: notes || undefined,
            footerText,
          };

          setReceiptData(newReceiptData);
          setShowReceiptPreview(true);
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

  const handleCloseReceiptPreview = () => {
    setShowReceiptPreview(false);
    setReceiptData(null);
    resetForm();
    loadData(); // Reload history
  };

  const handlePrintReceipt = async () => {
    if (!receiptData) return;

    setIsPrinting(true);
    try {
      if (printerService.isConnected()) {
        // Bluetooth thermal printer
        const printerWidth = printerService.getSettings().printerWidth;
        const builder = buildReturnReceipt({
          businessName: receiptData.businessName,
          businessAddress: receiptData.businessAddress,
          businessPhone: receiptData.businessPhone,
          tin: receiptData.tin,
          returnNumber: receiptData.returnNumber,
          returnDate: receiptData.returnDate,
          processedBy: receiptData.processedBy,
          originalTransactionNumber: receiptData.originalTransactionNumber,
          customerName: receiptData.customerName,
          items: receiptData.items,
          totalAmount: receiptData.totalAmount,
          refundMethod: receiptData.refundMethod,
          notes: receiptData.notes,
          footerText: receiptData.footerText,
        }, printerWidth);

        await printerService.print(builder);
        showAlert('Success', 'Receipt printed successfully!');
      } else {
        // Fallback: system print dialog
        const d = receiptData;
        const itemsHtml = d.items.map(i => `
          <tr>
            <td>${i.productName}</td>
            <td style="text-align:center;">${i.quantity}</td>
            <td style="text-align:right;">₱${(i.unitPrice || 0).toFixed(2)}</td>
            <td style="text-align:right;">₱${(i.total || 0).toFixed(2)}</td>
          </tr>
        `).join('');
        const html = `
          <html><head><meta charset="utf-8"/><style>
            body{font-family:monospace;font-size:12px;padding:20px;max-width:400px;margin:auto;}
            h2,h3{text-align:center;margin:4px 0;}
            table{width:100%;border-collapse:collapse;margin:8px 0;}
            td,th{padding:4px;border-bottom:1px solid #ddd;font-size:11px;}
            .right{text-align:right;} .center{text-align:center;}
          </style></head><body>
            <h2>${d.businessName}</h2>
            ${d.businessAddress ? `<p class="center">${d.businessAddress}</p>` : ''}
            ${d.tin ? `<p class="center">TIN: ${d.tin}</p>` : ''}
            <h3>SALES RETURN</h3>
            <p>Return #: ${d.returnNumber}</p>
            <p>Date: ${d.returnDate.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
            ${d.originalTransactionNumber ? `<p>Orig. Invoice: ${d.originalTransactionNumber}</p>` : ''}
            ${d.customerName ? `<p>Customer: ${d.customerName}</p>` : ''}
            <p>Processed by: ${d.processedBy}</p>
            <table>
              <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
              ${itemsHtml}
            </table>
            <p class="right"><strong>TOTAL REFUND: ₱${d.totalAmount.toFixed(2)}</strong></p>
            <p>Refund Method: ${d.refundMethod}</p>
            ${d.notes ? `<p>Notes: ${d.notes}</p>` : ''}
          </body></html>
        `;
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Print error:', error);
      showAlert('Print Error', 'Failed to print receipt. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendEmail = async (email: string) => {
    if (!receiptData) return;

    setIsSendingEmail(true);
    try {
      // For now, just simulate email sending
      // In a real implementation, this would call an API to send the email
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Sending return receipt to: ${email}`);
      // showAlert is handled in the component
    } catch (error) {
      console.error('Email error:', error);
      throw error;
    } finally {
      setIsSendingEmail(false);
    }
  };

  const filteredProducts = (() => {
    if (!productSearch.trim()) return products;

    const query = productSearch.toLowerCase().trim();

    // First try exact code/barcode match
    const exactMatch = products.filter(p =>
      (p.code || '').toLowerCase() === query
    );
    if (exactMatch.length > 0) {
      return exactMatch;
    }

    // Otherwise do contains search on name and code/barcode
    return products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const code = (p.code || '').toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  })();

  const filteredTransactions = recentTransactions.filter(t => {
    const searchLower = transactionSearch.toLowerCase();
    const customerName = t.customer_full_name || t.customer_name || 'Walk-in';
    return (
      t.transaction_number.toLowerCase().includes(searchLower) ||
      customerName.toLowerCase().includes(searchLower)
    );
  });

  const webContainerStyle = {};
  const webScrollStyle = {};

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }, webContainerStyle]}>
      <ScrollView style={[styles.scrollView, webScrollStyle]} contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}>
        {/* Header with History Toggle */}
        <View style={styles.header}>
          <Title style={[styles.pageTitle, { fontSize: fs.h2 }]}>Sales Returns</Title>
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
              <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Return History</Title>
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
                          {new Date(ret.created_at).toLocaleDateString('en-PH', {
                            timeZone: 'Asia/Manila',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Lookup Transaction (Optional)</Title>
                <View style={styles.lookupRow}>
                  <TextInput
                    label="Transaction Number"
                    value={transactionNumber}
                    onChangeText={setTransactionNumber}
                    style={styles.lookupInput}
                    placeholder="e.g., TXN-000001"
                    disabled={!!originalTransaction}
                    editable={false}
                  />
                  <Button
                    mode="contained"
                    onPress={openTransactionLookup}
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
                  <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Customer</Title>
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
                  <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Items to Return</Title>
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

                        <View style={styles.priceControl}>
                          <Paragraph style={styles.priceLabel}>@ ₱</Paragraph>
                          <TextInput
                            value={String(item.unit_price || 0)}
                            onChangeText={(text) => updateItemPrice(item.product_id, parseFloat(text) || 0)}
                            keyboardType="numeric"
                            style={styles.priceInput}
                            dense
                          />
                        </View>

                        <Paragraph style={styles.itemTotal}>
                          = ₱{((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Refund Method</Title>
                <RadioButton.Group
                  onValueChange={(value) => setRefundMethod(value as any)}
                  value={refundMethod}
                >
                  <View style={styles.radioRow}>
                    <RadioButton.Item label="Cash Refund" value="CASH" />
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton.Item
                      label={`Apply to Customer Balance${selectedCustomer ? ` (₱${(selectedCustomer.balance || 0).toFixed(2)})` : ''}`}
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
            placeholder="Search by name or barcode..."
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
                description={`${item.code ? `${item.code} | ` : ''}₱${(item.price || 0).toFixed(2)} | Stock: ${item.stock_quantity || 0}`}
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

      {/* Transaction Lookup Modal */}
      <Portal>
        <Modal
          visible={showTransactionModal}
          onDismiss={() => setShowTransactionModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Title style={styles.modalTitle}>Select Transaction (Last 30 Days)</Title>
          <Searchbar
            placeholder="Search by transaction # or customer..."
            value={transactionSearch}
            onChangeText={setTransactionSearch}
            style={styles.searchBar}
          />
          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => String(item.id)}
            style={styles.productList}
            renderItem={({ item }) => {
              const customerName = item.customer_full_name || item.customer_name || 'Walk-in';
              const dateStr = new Date(item.created_at).toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <List.Item
                  title={item.transaction_number}
                  description={`${customerName} | ₱${(item.total_amount || 0).toFixed(2)} | ${dateStr}`}
                  onPress={() => selectTransaction(item)}
                  right={props => <List.Icon {...props} icon="chevron-right" />}
                />
              );
            }}
            ItemSeparatorComponent={() => <Divider />}
            ListEmptyComponent={
              <Paragraph style={styles.emptyText}>
                No transactions found in the last 30 days
              </Paragraph>
            }
          />
          <Button onPress={() => setShowTransactionModal(false)} style={styles.modalClose}>
            Cancel
          </Button>
        </Modal>
      </Portal>

      {/* Return Receipt Preview */}
      {receiptData && (
        <ReturnReceiptPreview
          data={receiptData}
          visible={showReceiptPreview}
          onClose={handleCloseReceiptPreview}
          onPrint={handlePrintReceipt}
          onSendEmail={handleSendEmail}
          isPrinting={isPrinting}
          isSendingEmail={isSendingEmail}
        />
      )}
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
  priceControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  priceLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  priceInput: {
    width: 70,
    textAlign: 'right',
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
