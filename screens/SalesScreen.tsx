import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  Divider,
  List,
  IconButton,
  Chip,
  useTheme,
  Dialog,
  Portal,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import { useAuth } from '../contexts/AuthContext';
import { Product } from '../database/schema';
import { initializeSampleData } from '../utils/SampleData';

type SalesScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Sales'
>;

type Props = {
  navigation: SalesScreenNavigationProp;
};

interface CartItem {
  id: number;
  code: string;
  name: string;
  price: number;
  quantity: number;
  tax_rate: number;
  is_vat_inclusive: boolean;
}


export default function SalesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [amountTendered, setAmountTendered] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'CHECK' | 'ONLINE' | 'CHARGE_INVOICE'>('CASH');
  const [customers, setCustomers] = useState<any[]>([]);
  const [discountType, setDiscountType] = useState('none'); // 'none', 'percent', 'amount', 'senior'
  const [discountValue, setDiscountValue] = useState('');
  const [isSeniorCitizen, setIsSeniorCitizen] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  // Reload products when search query changes with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadProducts();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Reload products when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('SalesScreen focused, reloading products...');
      loadProducts();
    }, [])
  );

  const loadProducts = async () => {
    try {
      const dbService = DatabaseService.getInstance();

      // Use optimized getProducts with search term if available
      const rawProductList = await dbService.getProducts(true, 50, searchQuery.trim() || undefined);
      console.log('SalesScreen: Loaded active products:', rawProductList.length);
      setProducts(rawProductList as Product[]);
    } catch (error) {
      console.error('SalesScreen: Error loading products:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const dbService = DatabaseService.getInstance();
      const customerList = await dbService.getCustomers(true); // Only active customers
      setCustomers(customerList);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadSampleData = async () => {
    try {
      console.log('Loading sample data...');
      await initializeSampleData();
      await loadProducts();
      Alert.alert('Success', 'Sample products loaded successfully!');
    } catch (error) {
      console.error('Error loading sample data:', error);
      Alert.alert('Error', 'Failed to load sample data');
    }
  };

  const addToCart = (product: Product) => {
    console.log('Adding to cart:', product.name);

    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
      console.log(`Updated ${product.name} quantity to ${existingItem.quantity + 1}`);
    } else {
      setCart([...cart, {
        id: product.id,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: 1,
        tax_rate: product.tax_rate,
        is_vat_inclusive: product.is_vat_inclusive,
      }]);
      console.log(`Added ${product.name} to cart`);
    }
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    cart.forEach(item => {
      const itemTotal = item.price * item.quantity;

      if (item.is_vat_inclusive) {
        // VAT is included in the price
        const vatExclusive = itemTotal / (1 + item.tax_rate / 100);
        subtotal += vatExclusive;
        taxAmount += itemTotal - vatExclusive;
      } else {
        // VAT is added to the price
        subtotal += itemTotal;
        taxAmount += (itemTotal * item.tax_rate) / 100;
      }
    });

    const totalBeforeDiscount = subtotal + taxAmount;
    let discountAmount = 0;

    // Calculate discount
    if (isSeniorCitizen) {
      // Philippine Senior Citizen discount: 20% on goods, 12% VAT exemption
      discountAmount = subtotal * 0.20; // 20% discount on VAT-exclusive amount
      taxAmount = 0; // VAT exemption for senior citizens
    } else if (discountType === 'percent' && discountValue) {
      discountAmount = (totalBeforeDiscount * parseFloat(discountValue)) / 100;
    } else if (discountType === 'amount' && discountValue) {
      discountAmount = parseFloat(discountValue) || 0;
    }

    const total = Math.max(0, totalBeforeDiscount - discountAmount);

    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      totalBeforeDiscount: Number(totalBeforeDiscount.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }
    setPaymentVisible(true);
  };

  const processPayment = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to complete a sale');
      return;
    }

    const tendered = parseFloat(amountTendered);
    const totals = calculateTotals();

    // Skip validation for charge invoices
    if (paymentMethod !== 'CHARGE_INVOICE') {
      if (isNaN(tendered) || tendered < totals.total) {
        Alert.alert('Error', 'Invalid payment amount');
        return;
      }
    }

    // For charge invoices, require customer selection
    if (paymentMethod === 'CHARGE_INVOICE' && !selectedCustomer && !customerName.trim()) {
      Alert.alert('Error', 'Please select a customer or enter customer name for charge invoice');
      return;
    }

    setLoading(true);

    try {
      const dbService = DatabaseService.getInstance();
      const changeAmount = tendered - totals.total;

      const transactionData = {
        customer_id: selectedCustomer?.id,
        customer_name: customerName || selectedCustomer?.name,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        payment_method: paymentMethod,
        amount_tendered: paymentMethod === 'CHARGE_INVOICE' ? 0 : tendered,
        change_amount: paymentMethod === 'CHARGE_INVOICE' ? 0 : changeAmount,
        cashier_id: user.id,
        items: cart.map(item => ({
          product_id: item.id,
          product_code: item.code,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          tax_amount: item.is_vat_inclusive
            ? (item.price * item.quantity) - ((item.price * item.quantity) / (1 + item.tax_rate / 100))
            : (item.price * item.quantity * item.tax_rate) / 100,
          total_amount: item.price * item.quantity,
        })),
      };

      const result = await dbService.createTransaction(transactionData);

      Alert.alert(
        'Transaction Complete',
        `Invoice: ${result.invoiceNumber}\nChange: ₱${changeAmount.toFixed(2)}`,
        [
          {
            text: 'New Sale',
            onPress: () => {
              setCart([]);
              setAmountTendered('');
              setCustomerName('');
              setDiscountType('none');
              setDiscountValue('');
              setIsSeniorCitizen(false);
              setPaymentVisible(false);
            },
          },
          {
            text: 'Back to Dashboard',
            onPress: () => {
              setCart([]);
              setAmountTendered('');
              setCustomerName('');
              setDiscountType('none');
              setDiscountValue('');
              setIsSeniorCitizen(false);
              setPaymentVisible(false);
              navigation.navigate('Dashboard');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Transaction error:', error);
      Alert.alert('Error', 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    if (!searchQuery.trim()) {
      return true; // Show all products when no search query
    }

    const query = searchQuery.toLowerCase().trim();
    const name = (product.name || '').toLowerCase();
    const code = (product.code || '').toLowerCase();

    // For barcode scanning (exact match for codes)
    if (query.length >= 8 && /^[0-9]+$/.test(query)) {
      return code === query;
    }

    // For text search (contains match for names and codes)
    const matches = name.includes(query) || code.includes(query);
    console.log(`Product ${product.name} matches "${query}":`, matches);
    return matches;
  });

  console.log('Search query:', searchQuery);
  console.log('Total products:', products.length);
  console.log('Filtered products:', filteredProducts.length);

  const totals = calculateTotals();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.mainContainer}>
        {/* Product Search */}
        <View style={styles.searchSection}>
          <TextInput
            label="Search Products / Scan Barcode"
            value={searchQuery}
            onChangeText={setSearchQuery}
            mode="outlined"
            style={styles.searchInput}
            placeholder="Type product name, code, or scan barcode..."
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            onSubmitEditing={(event) => {
              // Handle barcode scanner input (usually ends with Enter/Return)
              const scannedValue = event.nativeEvent.text.trim();
              if (scannedValue) {
                console.log('Barcode scanned in Sales:', scannedValue);
                setSearchQuery(scannedValue);
                // Auto-add to cart if single product match found
                setTimeout(() => {
                  if (filteredProducts.length === 1) {
                    console.log('Single match found, auto-adding to cart:', filteredProducts[0].name);
                    addToCart(filteredProducts[0]);
                    setSearchQuery(''); // Clear search after adding
                  }
                }, 100);
              }
            }}
            right={
              searchQuery.trim() ? (
                <TextInput.Icon
                  icon="close"
                  onPress={() => setSearchQuery('')}
                />
              ) : (
                <TextInput.Icon icon="barcode-scan" />
              )
            }
          />
          {searchQuery.trim() && (
            <Paragraph style={styles.searchIndicator}>
              Searching for "{searchQuery}" - {filteredProducts.length} result(s) found
              {filteredProducts.length === 1 && (
                <Text style={styles.barcodeHint}>
                  {' '}💡 Single match - will auto-add to cart!
                </Text>
              )}
            </Paragraph>
          )}
        </View>

        {/* Product List - Only show when searching */}
        {searchQuery.trim() && (
          <View style={styles.productSection}>
            <Text style={styles.sectionTitle}>
              Products ({filteredProducts.length} of {products.length})
            </Text>

            <View style={styles.productListContainer}>
              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.productItem}
                    onPress={() => {
                      console.log('Product tapped:', item.name);
                      addToCart(item);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.productItemContent}>
                      <View style={styles.productIcon}>
                        <Text style={styles.productIconText}>📦</Text>
                      </View>

                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.productCode}>
                          Code: {item.code}
                        </Text>
                        <View style={styles.productMetaRow}>
                          <Text style={styles.productPrice}>
                            ₱{item.price.toFixed(2)}
                          </Text>
                          <Text style={styles.productStock}>
                            Stock: {item.stock_quantity}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => {
                          console.log('Add button tapped for:', item.name);
                          addToCart(item);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.addButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.productList}
                contentContainerStyle={styles.productListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={() => (
                  <View style={styles.emptyProductsContainer}>
                    <Text style={styles.emptyIconText}>🔍</Text>
                    <Text style={styles.emptyProductsTitle}>No Results Found</Text>
                    <Text style={styles.emptyProductsText}>
                      Try a different search term
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        )}

        {/* Search prompt when no search query */}
        {!searchQuery.trim() && cart.length === 0 && (
          <View style={styles.searchPrompt}>
            <Text style={styles.searchPromptIcon}>🔍</Text>
            <Text style={styles.searchPromptTitle}>Search for Products</Text>
            <Text style={styles.searchPromptText}>
              Type in the search box above to find and add products to your cart
            </Text>
          </View>
        )}

        {/* Cart Summary */}
        {cart.length > 0 && (
          <View style={[
            styles.cartSummary,
            !searchQuery.trim() && styles.cartSummaryExpanded
          ]}>
            <Text style={styles.cartTitle}>Cart ({cart.length} items)</Text>

            {/* Cart Items with ScrollView */}
            <ScrollView
              style={[
                styles.cartItems,
                !searchQuery.trim() && styles.cartItemsExpanded
              ]}
              contentContainerStyle={styles.cartItemsContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {cart.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.cartItemPrice}>
                      ₱{item.price.toFixed(2)} each
                    </Text>
                  </View>

                  <View style={styles.cartItemControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item.id, item.quantity - 1)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quantityButtonText}>−</Text>
                    </TouchableOpacity>

                    <TextInput
                      style={styles.quantityInput}
                      value={item.quantity.toString()}
                      onChangeText={(text) => {
                        const newQuantity = parseInt(text) || 0;
                        if (newQuantity >= 0) {
                          updateQuantity(item.id, newQuantity);
                        }
                      }}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                      maxLength={3}
                    />

                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item.id, item.quantity + 1)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeFromCart(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.cartTotalSection}>
              {/* Discount Controls */}
              <View style={styles.discountSection}>
                <View style={styles.discountRow}>
                  <TouchableOpacity
                    style={[styles.discountButton, isSeniorCitizen && styles.discountButtonActive]}
                    onPress={() => {
                      setIsSeniorCitizen(!isSeniorCitizen);
                      if (!isSeniorCitizen) {
                        setDiscountType('none');
                        setDiscountValue('');
                      }
                    }}
                  >
                    <Text style={[styles.discountButtonText, isSeniorCitizen && styles.discountButtonTextActive]}>
                      Senior Citizen (20% + VAT Exempt)
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isSeniorCitizen && (
                  <View style={styles.discountRow}>
                    <TouchableOpacity
                      style={[styles.discountTypeButton, discountType === 'percent' && styles.discountButtonActive]}
                      onPress={() => {
                        setDiscountType(discountType === 'percent' ? 'none' : 'percent');
                        setDiscountValue('');
                      }}
                    >
                      <Text style={[styles.discountButtonText, discountType === 'percent' && styles.discountButtonTextActive]}>
                        % Discount
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.discountTypeButton, discountType === 'amount' && styles.discountButtonActive]}
                      onPress={() => {
                        setDiscountType(discountType === 'amount' ? 'none' : 'amount');
                        setDiscountValue('');
                      }}
                    >
                      <Text style={[styles.discountButtonText, discountType === 'amount' && styles.discountButtonTextActive]}>
                        ₱ Amount
                      </Text>
                    </TouchableOpacity>

                    {(discountType === 'percent' || discountType === 'amount') && (
                      <TextInput
                        style={styles.discountInput}
                        placeholder={discountType === 'percent' ? '10' : '50.00'}
                        value={discountValue}
                        onChangeText={setDiscountValue}
                        keyboardType="numeric"
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Total Breakdown */}
              <View style={styles.totalBreakdown}>
                <Text style={styles.totalLine}>Subtotal: ₱{totals.subtotal.toFixed(2)}</Text>
                <Text style={styles.totalLine}>VAT (12%): ₱{totals.taxAmount.toFixed(2)}</Text>
                {totals.discountAmount > 0 && (
                  <Text style={styles.discountLine}>
                    Discount: -₱{totals.discountAmount.toFixed(2)}
                    {isSeniorCitizen && ' (Senior Citizen)'}
                  </Text>
                )}
                <Text style={styles.cartTotal}>Total: ₱{totals.total.toFixed(2)}</Text>
              </View>

              <Button
                mode="contained"
                onPress={handleCheckout}
                style={styles.checkoutButton}
                disabled={loading}
              >
                Checkout
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* Payment Dialog */}
      <Portal>
        <Dialog visible={paymentVisible} onDismiss={() => setPaymentVisible(false)}>
          <Dialog.Title>Process Payment</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Customer Name (Optional)"
              value={customerName}
              onChangeText={setCustomerName}
              mode="outlined"
              style={styles.input}
            />

            <View style={styles.paymentSummary}>
              <Paragraph>Total Amount: ₱{totals.total.toFixed(2)}</Paragraph>
            </View>

            <TextInput
              label="Amount Tendered"
              value={amountTendered}
              onChangeText={setAmountTendered}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />

            {amountTendered && !isNaN(parseFloat(amountTendered)) && (
              <Paragraph style={styles.change}>
                Change: ₱{(parseFloat(amountTendered) - totals.total).toFixed(2)}
              </Paragraph>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPaymentVisible(false)}>Cancel</Button>
            <Button
              onPress={processPayment}
              loading={loading}
              disabled={loading}
            >
              Complete Sale
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
  },
  searchSection: {
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  searchInput: {
    backgroundColor: 'white',
  },
  searchIndicator: {
    marginTop: '2%',
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: '#e3f2fd',
    paddingVertical: '2%',
    paddingHorizontal: '3%',
    borderRadius: 20,
  },
  productSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: '4%',
    color: '#333',
  },
  productListContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: '2%',
  },
  productList: {
    flex: 1,
  },
  productListContent: {
    paddingBottom: '4%',
  },
  productItem: {
    backgroundColor: 'white',
    marginVertical: 4,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  productItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '4%',
  },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productIconText: {
    fontSize: 18,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  productMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  productStock: {
    fontSize: 14,
    color: '#666',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cartSummary: {
    backgroundColor: 'white',
    paddingHorizontal: '4%',
    paddingTop: '4%',
    paddingBottom: '3%',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 4,
    maxHeight: '40%',
  },
  cartSummaryExpanded: {
    flex: 1,
    maxHeight: '95%',
    marginBottom: 0,
    paddingBottom: 8,
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  cartItems: {
    maxHeight: 200,
    marginBottom: 16,
  },
  cartItemsExpanded: {
    maxHeight: 600,
    flex: 1,
  },
  cartItemsContent: {
    paddingBottom: 8,
  },
  searchPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  searchPromptIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  searchPromptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  searchPromptText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginVertical: 4,
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#666',
  },
  cartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  quantityButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  quantityInput: {
    width: 50,
    height: 40,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 4,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    elevation: 2,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  cartTotalSection: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  discountSection: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  discountButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 4,
  },
  discountButtonActive: {
    backgroundColor: '#4CAF50',
  },
  discountTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 4,
    flex: 1,
    minWidth: 80,
  },
  discountButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  discountButtonTextActive: {
    color: 'white',
  },
  discountInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'white',
    minWidth: 80,
    textAlign: 'center',
    fontSize: 14,
  },
  totalBreakdown: {
    marginBottom: 12,
  },
  totalLine: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  discountLine: {
    fontSize: 16,
    color: '#f44336',
    fontWeight: '600',
    marginBottom: 4,
  },
  cartTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  checkoutButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  cartSection: {
    flex: 1,
    minWidth: 350,
  },
  cartCard: {
    flex: 1,
    elevation: 4,
  },
  cartCardContent: {
    flex: 1,
    paddingBottom: 8,
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  emptyCart: {
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 16,
  },
  cartContentContainer: {
    flex: 1,
  },
  cartList: {
    flex: 1,
    maxHeight: 200,
  },
  deleteButton: {
    margin: 0,
    width: 32,
    height: 32,
  },
  quantity: {
    marginHorizontal: 8,
    fontWeight: 'bold',
    fontSize: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  divider: {
    marginVertical: 12,
  },
  totals: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  totalFinal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalAmount: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 18,
  },
  buttonContent: {
    paddingVertical: 12,
  },
  input: {
    marginBottom: 16,
  },
  paymentSummary: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  change: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
  },
  emptyProductsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconText: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyProductsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyProductsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reloadButton: {
    marginLeft: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  debugTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8,
    color: '#333',
  },
  barcodeHint: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
  },
});