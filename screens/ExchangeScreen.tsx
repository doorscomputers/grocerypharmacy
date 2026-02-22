import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Checkbox } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import POSInvoiceListPicker, { InvoiceTransaction } from '../components/pos/POSInvoiceListPicker';
import POSDiscountWarningBanner from '../components/pos/POSDiscountWarningBanner';
import POSTransactionCompleteDialog, { TransactionCompleteData } from '../components/pos/POSTransactionCompleteDialog';
import { useResponsiveTheme, useLandscapeLayout } from '../utils/responsive';

type ExchangeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Exchange'>;
type ExchangeScreenRouteProp = RouteProp<RootStackParamList, 'Exchange'>;

interface Props {
  navigation: ExchangeScreenNavigationProp;
  route: ExchangeScreenRouteProp;
}

interface ReturnItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  return_quantity: number;
  selected: boolean;
}

interface NewItem {
  id: number;
  code: string;
  name: string;
  price: number;
  quantity: number;
}

export default function ExchangeScreen({ navigation, route }: Props) {
  const cashierId = route.params.cashierId;
  const { sp, fs } = useResponsiveTheme();
  const { canSplit, leftPanelWidth, rightPanelWidth } = useLandscapeLayout({ leftRatio: 0.45 });
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'search' | 'select_returns' | 'add_new'>('search');
  const [transaction, setTransaction] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [exchangeReason, setExchangeReason] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeData, setCompleteData] = useState<TransactionCompleteData | null>(null);
  const [cashierName, setCashierName] = useState<string>('');
  const [editingReturnQty, setEditingReturnQty] = useState<number | null>(null);
  const [editingReturnQtyText, setEditingReturnQtyText] = useState('');
  const [editingNewQty, setEditingNewQty] = useState<number | null>(null);
  const [editingNewQtyText, setEditingNewQtyText] = useState('');

  // Load cashier name
  useEffect(() => {
    const loadCashierName = async () => {
      try {
        const db = DatabaseService.getInstance();
        const user = await db.getUserById(cashierId);
        if (user) {
          setCashierName(user.full_name || user.username);
        }
      } catch (error) {
        console.error('Error loading cashier name:', error);
      }
    };
    if (cashierId) {
      loadCashierName();
    }
  }, [cashierId]);

  const setupTransactionForExchange = (result: any) => {
    setTransaction(result);
    setReturnItems(result.items.map((item: any) => ({
      ...item,
      return_quantity: 0,
      selected: false,
    })));
    setStep('select_returns');
  };

  const handleSearchInvoice = async (invoiceNumber: string) => {
    setIsSearching(true);
    try {
      const db = DatabaseService.getInstance();
      const result = await db.searchTransactionByInvoice(invoiceNumber);

      if (!result) {
        Alert.alert('Not Found', 'No transaction found');
        return;
      }
      if (result.status === 'VOID') {
        Alert.alert('Invalid', 'Cannot exchange from voided transaction');
        return;
      }

      setupTransactionForExchange(result);
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'Failed to search');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectInvoice = async (invoice: InvoiceTransaction) => {
    setIsSearching(true);
    try {
      const db = DatabaseService.getInstance();
      const result = await db.searchTransactionByInvoice(invoice.invoice_number || invoice.transaction_number);
      if (result && result.status !== 'VOID') {
        setupTransactionForExchange(result);
      } else if (result?.status === 'VOID') {
        Alert.alert('Invalid', 'Cannot exchange from voided transaction');
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      Alert.alert('Error', 'Failed to load transaction details');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleReturnItem = (index: number) => {
    const items = [...returnItems];
    items[index].selected = !items[index].selected;
    if (items[index].selected && items[index].return_quantity === 0) {
      items[index].return_quantity = items[index].quantity;
    } else if (!items[index].selected) {
      items[index].return_quantity = 0;
    }
    setReturnItems(items);
  };

  const updateReturnQuantity = (index: number, qty: number) => {
    const items = [...returnItems];
    items[index].return_quantity = Math.min(Math.max(0, qty), items[index].quantity);
    items[index].selected = items[index].return_quantity > 0;
    setReturnItems(items);
  };

  const searchProducts = async () => {
    if (!productSearch.trim()) return;
    setIsSearchingProducts(true);
    try {
      const db = DatabaseService.getInstance();
      const results = await db.getProductsWithDetails(true, 20, productSearch);
      setProducts(results);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch.trim()) {
        searchProducts();
      } else {
        setProducts([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const addNewItem = (product: any) => {
    const existing = newItems.find(i => i.id === product.id);
    if (existing) {
      setNewItems(newItems.map(i =>
        i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setNewItems([...newItems, {
        id: product.id,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: 1,
      }]);
    }
    setProductSearch('');
    setProducts([]);
  };

  const updateNewItemQty = (id: number, delta: number) => {
    setNewItems(newItems.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeNewItem = (id: number) => {
    setNewItems(newItems.filter(i => i.id !== id));
  };

  const calculateReturnTotal = () => {
    return returnItems.reduce((sum, item) =>
      sum + (item.selected ? item.unit_price * item.return_quantity : 0), 0);
  };

  const calculateNewTotal = () => {
    return newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateDifference = () => {
    return calculateNewTotal() - calculateReturnTotal();
  };

  const handleExchange = async () => {
    const selectedReturns = returnItems.filter(i => i.selected && i.return_quantity > 0);
    if (selectedReturns.length === 0) {
      Alert.alert('Error', 'Select items to return');
      return;
    }
    if (newItems.length === 0) {
      Alert.alert('Error', 'Add replacement items');
      return;
    }
    if (!exchangeReason.trim()) {
      Alert.alert('Error', 'Enter exchange reason');
      return;
    }

    const difference = calculateDifference();
    const isCreditTransaction = transaction.payment_method === 'CHARGE_INVOICE';

    let differenceText = '';
    if (difference > 0) {
      differenceText = isCreditTransaction
        ? `Customer balance increases by: ${formatCurrency(difference)}`
        : `Customer pays additional: ${formatCurrency(difference)}`;
    } else if (difference < 0) {
      differenceText = isCreditTransaction
        ? `Customer balance decreases by: ${formatCurrency(Math.abs(difference))}`
        : `Customer receives: ${formatCurrency(Math.abs(difference))}`;
    } else {
      differenceText = 'No payment difference';
    }

    const hasDiscount = transaction.discount_amount > 0;
    const discountWarning = hasDiscount
      ? `\n\n⚠️ NOTE: Original transaction had a ₱${transaction.discount_amount.toFixed(2)} discount. Exchange values are based on actual paid amounts.`
      : '';

    Alert.alert(
      'Confirm Exchange',
      `Return ${selectedReturns.length} item(s) for ${newItems.length} new item(s).\n\n${differenceText}${discountWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process Exchange',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const db = DatabaseService.getInstance();

              const returnResult = await db.processSalesReturn({
                original_transaction_id: transaction.id,
                original_transaction_number: transaction.invoice_number,
                customer_id: transaction.customer_id,
                customer_name: transaction.customer_name,
                items: selectedReturns.map(item => ({
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: item.return_quantity,
                  unit_price: item.unit_price,
                  reason: `Exchange: ${exchangeReason}`,
                })),
                refund_method: 'EXCHANGE',
                notes: `Exchange for ${newItems.map(i => i.name).join(', ')}`,
                created_by: cashierId,
              });

              // Deduct inventory for replacement items
              for (const item of newItems) {
                await db.recordInventoryMovement({
                  product_id: item.id,
                  movement_type: 'OUT',
                  quantity: item.quantity,
                  reference_type: 'EXCHANGE',
                  reference_id: returnResult.returnId,
                  reference_number: returnResult.returnNumber,
                  notes: `Exchange replacement: ${item.name}`,
                  created_by: cashierId,
                });
              }

              // Handle difference based on payment method
              if (difference !== 0) {
                const isCreditTx = transaction.payment_method === 'CHARGE_INVOICE';

                if (isCreditTx) {
                  await db.adjustAccountsReceivableForExchange(
                    transaction.id,
                    difference,
                    `Exchange adjustment - ${returnResult.returnNumber}`,
                    cashierId
                  );
                } else {
                  if (difference < 0) {
                    await db.createCashMovement({
                      movement_type: 'CASH_REFUND',
                      amount: Math.abs(difference),
                      description: `Exchange difference refund - ${transaction.invoice_number}`,
                      reference_number: transaction.invoice_number,
                      cashier_id: cashierId,
                    });
                  } else {
                    await db.createCashMovement({
                      movement_type: 'CASH_IN',
                      amount: difference,
                      description: `Exchange additional payment - ${transaction.invoice_number}`,
                      reference_number: transaction.invoice_number,
                      cashier_id: cashierId,
                    });
                  }
                }
              }

              const isCreditTx = transaction.payment_method === 'CHARGE_INVOICE';
              setCompleteData({
                transactionType: 'EXCHANGE',
                referenceNumber: returnResult.returnNumber,
                originalInvoice: transaction.invoice_number,
                customerName: transaction.customer_name,
                totalAmount: calculateReturnTotal(),
                reason: exchangeReason.trim(),
                items: selectedReturns.map(item => ({
                  name: item.product_name,
                  quantity: item.return_quantity,
                  unitPrice: item.unit_price,
                  totalAmount: item.unit_price * item.return_quantity,
                })),
                newItems: newItems.map(item => ({
                  name: item.name,
                  quantity: item.quantity,
                  unitPrice: item.price,
                  totalAmount: item.price * item.quantity,
                })),
                difference: difference,
                isCreditTransaction: isCreditTx,
                refundMethod: 'EXCHANGE',
                cashierName: cashierName,
                transactionDate: new Date(),
              });
              setShowCompleteDialog(true);
            } catch (error) {
              console.error('Error processing exchange:', error);
              Alert.alert('Error', 'Failed to process exchange');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleCompleteDialogClose = () => {
    setShowCompleteDialog(false);
    setCompleteData(null);
    navigation.goBack();
  };

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  // ===== Render return items (left panel in landscape) =====
  const renderReturnItems = () => (
    <>
      {/* Discount Warning Banner */}
      {transaction?.discount_amount > 0 && (
        <POSDiscountWarningBanner
          discountAmount={transaction.discount_amount}
          totalAmount={transaction.total_amount}
          originalAmount={(transaction.subtotal || 0) + (transaction.tax_amount || 0)}
          scPwdId={transaction.sc_pwd_id}
          scPwdName={transaction.sc_pwd_name}
          scPwdType={transaction.sc_pwd_type}
        />
      )}

      <View style={styles.infoBox}>
        <Text style={styles.invoiceLabel}>{transaction?.invoice_number}</Text>
        <Text style={styles.customerLabel}>{transaction?.customer_name || 'Walk-in'}</Text>
      </View>

      {/* Return Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items to Return</Text>
        {returnItems.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Checkbox
              status={item.selected ? 'checked' : 'unchecked'}
              onPress={() => toggleReturnItem(index)}
              color="#2196F3"
            />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.unit_price)}</Text>
            </View>
            <View style={styles.qtyControl}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateReturnQuantity(index, item.return_quantity - 1)}>
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              {editingReturnQty === index ? (
                <TextInput
                  style={styles.qtyInput}
                  value={editingReturnQtyText}
                  onChangeText={setEditingReturnQtyText}
                  onBlur={() => {
                    const val = parseInt(editingReturnQtyText) || 0;
                    updateReturnQuantity(index, val);
                    setEditingReturnQty(null);
                  }}
                  keyboardType="numeric"
                  autoFocus
                  selectTextOnFocus
                />
              ) : (
                <TouchableOpacity onPress={() => {
                  setEditingReturnQty(index);
                  setEditingReturnQtyText(String(item.return_quantity));
                }}>
                  <Text style={styles.qtyValue}>{item.return_quantity}/{item.quantity}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateReturnQuantity(index, item.return_quantity + 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Return Value</Text>
          <Text style={styles.subtotalValue}>{formatCurrency(calculateReturnTotal())}</Text>
        </View>
      </View>
    </>
  );

  // ===== Render replacement items + difference + reason (right panel in landscape) =====
  const renderReplacementItems = () => (
    <>
      {/* New Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Replacement Items</Text>
        <View style={styles.productSearchWrapper}>
          <TextInput
            style={styles.productSearchInput}
            value={productSearch}
            onChangeText={setProductSearch}
            placeholder="Search products to add..."
            placeholderTextColor="#9E9E9E"
          />
          {productSearch.length > 0 && (
            <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setProductSearch('')}>
              <Text style={styles.clearSearchText}>x</Text>
            </TouchableOpacity>
          )}
        </View>
        {isSearchingProducts && <ActivityIndicator size="small" style={{ marginVertical: 10 }} />}
        {products.length > 0 && (
          <View style={styles.productResults}>
            {products.slice(0, 5).map(product => (
              <TouchableOpacity key={product.id} style={styles.productItem} onPress={() => addNewItem(product)}>
                <Text style={styles.productItemName}>{product.name}</Text>
                <Text style={styles.productItemPrice}>{formatCurrency(product.price)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {newItems.map(item => (
          <View key={item.id} style={styles.newItemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
            </View>
            <View style={styles.qtyControl}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateNewItemQty(item.id, -1)}>
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              {editingNewQty === item.id ? (
                <TextInput
                  style={styles.qtyInput}
                  value={editingNewQtyText}
                  onChangeText={setEditingNewQtyText}
                  onBlur={() => {
                    const val = parseInt(editingNewQtyText) || 1;
                    const clamped = Math.max(1, val);
                    setNewItems(newItems.map(i =>
                      i.id === item.id ? { ...i, quantity: clamped } : i
                    ));
                    setEditingNewQty(null);
                  }}
                  keyboardType="numeric"
                  autoFocus
                  selectTextOnFocus
                />
              ) : (
                <TouchableOpacity onPress={() => {
                  setEditingNewQty(item.id);
                  setEditingNewQtyText(String(item.quantity));
                }}>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateNewItemQty(item.id, 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => removeNewItem(item.id)}>
              <Text style={styles.removeBtn}>X</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>New Items Value</Text>
          <Text style={styles.subtotalValue}>{formatCurrency(calculateNewTotal())}</Text>
        </View>
      </View>

      {/* Difference */}
      <View style={[styles.differenceBox, calculateDifference() > 0 ? styles.diffPositive : calculateDifference() < 0 ? styles.diffNegative : styles.diffZero]}>
        <Text style={styles.diffLabel}>
          {(() => {
            const diff = calculateDifference();
            const isCreditTx = transaction?.payment_method === 'CHARGE_INVOICE';
            if (diff === 0) return 'Even Exchange';
            if (isCreditTx) {
              return diff > 0 ? 'Balance Increases:' : 'Balance Reduced By:';
            }
            return diff > 0 ? 'Customer Pays:' : 'Customer Receives:';
          })()}
        </Text>
        <Text style={styles.diffValue}>{formatCurrency(Math.abs(calculateDifference()))}</Text>
      </View>

      {/* Reason */}
      <View style={styles.section}>
        <Text style={styles.label}>Exchange Reason *</Text>
        <TextInput
          style={styles.reasonInput}
          value={exchangeReason}
          onChangeText={setExchangeReason}
          placeholder="e.g., Damaged, Wrong size"
          placeholderTextColor="#9E9E9E"
        />
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Invoice Picker (search step) */}
      {step === 'search' && (
        <ScrollView style={styles.contentPadding} contentContainerStyle={{ flexGrow: 1 }}>
          <POSInvoiceListPicker
            onSelectInvoice={handleSelectInvoice}
            onSearchInvoice={handleSearchInvoice}
            isSearching={isSearching}
            accentColor="#2196F3"
            excludeWithReturns={true}
          />
        </ScrollView>
      )}

      {/* Transaction Selected - Show return items + replacement items */}
      {(step === 'select_returns' || step === 'add_new') && transaction && (
        <>
          {canSplit ? (
            /* Landscape two-column layout */
            <View style={styles.splitRow}>
              <ScrollView style={[styles.splitLeft, { width: leftPanelWidth }]} contentContainerStyle={styles.splitPanelContent}>
                {renderReturnItems()}
              </ScrollView>
              <ScrollView style={[styles.splitRight, { width: rightPanelWidth }]} contentContainerStyle={styles.splitPanelContent} keyboardShouldPersistTaps="handled">
                {renderReplacementItems()}
              </ScrollView>
            </View>
          ) : (
            /* Portrait single-column layout */
            <ScrollView style={styles.contentPadding} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {renderReturnItems()}
              {renderReplacementItems()}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setTransaction(null); setStep('search'); setReturnItems([]); setNewItems([]); }}
              disabled={isProcessing}
            >
              <Text style={styles.cancelBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exchangeBtn, isProcessing && styles.exchangeBtnDisabled]}
              onPress={handleExchange}
              disabled={isProcessing}
            >
              <Text style={[styles.exchangeBtnText, { fontSize: fs.button }]}>
                {isProcessing ? 'Processing...' : 'Process Exchange'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Transaction Complete Dialog */}
      <POSTransactionCompleteDialog
        visible={showCompleteDialog}
        onClose={handleCompleteDialogClose}
        data={completeData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentPadding: {
    flex: 1,
    padding: 16,
  },

  // Landscape split
  splitRow: {
    flex: 1,
    flexDirection: 'row',
  },
  splitLeft: {
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  splitRight: {
    backgroundColor: '#FAFAFA',
  },
  splitPanelContent: {
    padding: 16,
    paddingBottom: 24,
  },

  // Info box
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  invoiceLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
  },
  customerLabel: {
    fontSize: 13,
    color: '#42A5F5',
  },

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#424242',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },

  // Item rows
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  itemPrice: {
    fontSize: 12,
    color: '#757575',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#424242',
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'center',
  },
  qtyInput: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2196F3',
    paddingVertical: 2,
    color: '#212121',
  },

  // Subtotal
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
  },
  subtotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1565C0',
  },

  // Product search
  productSearchWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  productSearchInput: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    paddingRight: 36,
    backgroundColor: '#FAFAFA',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
  },
  clearSearchText: {
    fontSize: 20,
    color: '#757575',
    fontWeight: '600',
  },
  productResults: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 10,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  productItemName: {
    fontSize: 14,
    color: '#212121',
  },
  productItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  newItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  removeBtn: {
    color: '#D32F2F',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },

  // Difference box
  differenceBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diffPositive: {
    backgroundColor: '#FFEBEE',
  },
  diffNegative: {
    backgroundColor: '#E8F5E9',
  },
  diffZero: {
    backgroundColor: '#F5F5F5',
  },
  diffLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  diffValue: {
    fontSize: 22,
    fontWeight: '700',
  },

  // Reason
  reasonInput: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  exchangeBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  exchangeBtnDisabled: {
    backgroundColor: '#90CAF9',
  },
  exchangeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
