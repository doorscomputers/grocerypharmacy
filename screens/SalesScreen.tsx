import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Modal,
  TextInput as RNTextInput,
  TouchableOpacity,
  Keyboard,
  Alert,
} from 'react-native';
import {
  TextInput,
  useTheme,
  IconButton,
  Text,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { Product } from '../database/schema';
import StartShiftDialog from '../components/StartShiftDialog';

// POS Components
import {
  POSCartItem,
  POSPaymentModal,
  POSSearchDropdown,
  POSProductBrowser,
  POSDiscountModal,
  POSQuantityModal,
  POSHamburgerMenu,
  POSCashFundModal,
  POSPettyCashModal,
  POSXReadingModal,
  POSVoidModal,
  POSRefundModal,
  POSExchangeModal,
  POSQuickCustomerModal,
  POSUnterminatedSessionModal,
} from '../components/pos';
import POSSeniorDiscountModal from '../components/pos/POSSeniorDiscountModal';
import { CartItem } from '../hooks/usePOSCart';
import ReceiptPreview, { ReceiptData } from '../components/ReceiptPreview';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import { buildReceipt, PRINTER_WIDTH } from '../utils/escpos';
import { generateReceiptPdf } from '../utils/ReceiptPdfService';

// Hooks
import usePOSCart from '../hooks/usePOSCart';
import usePOSProducts from '../hooks/usePOSProducts';

type SalesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Sales'>;
type SalesScreenRouteProp = RouteProp<RootStackParamList, 'Sales'>;

interface Props {
  navigation: SalesScreenNavigationProp;
  route: SalesScreenRouteProp;
}

export default function SalesScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const theme = useTheme();
  const printerService = BluetoothPrinterService.getInstance();
  const searchInputRef = useRef<RNTextInput>(null);
  const productsRef = useRef<Product[]>([]);

  // Custom hooks for state management
  const {
    cart,
    totals,
    discount,
    priceType,
    setPriceType,
    addItem,
    removeItem,
    updateQuantity,
    incrementQuantity,
    decrementQuantity,
    clearCart,
    setDiscountType,
    setDiscountValue,
    setSeniorDiscount,
    clearSeniorDiscount,
    getItemQuantity,
  } = usePOSCart();

  const {
    products,
    categories,
    searchQuery,
    filteredProducts,
    loading,
    setSearchQuery,
    refreshProducts,
    findProductByBarcode,
  } = usePOSProducts();

  // Keep productsRef in sync with products (to avoid stale closure in callbacks)
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Local state
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactionType, setTransactionType] = useState<'CASH' | 'CREDIT'>('CASH');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [browseVisible, setBrowseVisible] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [seniorDiscountModalVisible, setSeniorDiscountModalVisible] = useState(false);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [selectedItemForQty, setSelectedItemForQty] = useState<CartItem | null>(null);
  const [hamburgerMenuVisible, setHamburgerMenuVisible] = useState(false);
  const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);

  // POS Operation Modal States
  const [cashFundModalVisible, setCashFundModalVisible] = useState(false);
  const [pettyCashModalVisible, setPettyCashModalVisible] = useState(false);
  const [xReadingModalVisible, setXReadingModalVisible] = useState(false);
  const [xReadingTargetDate, setXReadingTargetDate] = useState<string | undefined>(undefined);
  const [voidModalVisible, setVoidModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [exchangeModalVisible, setExchangeModalVisible] = useState(false);
  const [quickCustomerModalVisible, setQuickCustomerModalVisible] = useState(false);

  // Shift Management State
  const [currentShift, setCurrentShift] = useState<{id: number; beginning_cash: number} | null>(null);
  const [shiftDialogVisible, setShiftDialogVisible] = useState(false);
  const [checkingShift, setCheckingShift] = useState(true);

  // Unterminated Session State
  const [unterminatedSessions, setUnterminatedSessions] = useState<{date: string; transaction_count: number; total_sales: number}[]>([]);
  const [unterminatedModalVisible, setUnterminatedModalVisible] = useState(false);

  // Check for active shift on mount
  useEffect(() => {
    checkActiveShift();
  }, [user?.id]);

  const checkActiveShift = async () => {
    if (!user?.id) return;
    setCheckingShift(true);
    try {
      const dbService = getDatabase();

      // Check if database is ready
      if (!dbService.isReady()) {
        console.warn('Database not ready, skipping shift check');
        setCheckingShift(false);
        return;
      }

      // First check for unterminated sessions from previous days
      const unterminated = await dbService.getUnterminatedSalesDates();
      if (unterminated.length > 0) {
        setUnterminatedSessions(unterminated);
        setUnterminatedModalVisible(true);
        setCheckingShift(false);
        return; // Don't check shift until unterminated sessions are resolved
      }

      const shift = await dbService.getCurrentShift(user.id);
      if (shift) {
        setCurrentShift({ id: shift.id, beginning_cash: shift.beginning_cash });
        setShiftDialogVisible(false);
      } else {
        setCurrentShift(null);
        // No active shift - show dialog to start shift
        setShiftDialogVisible(true);
      }
    } catch (error) {
      console.error('Error checking active shift:', error);
      // Allow sales even if shift check fails (fallback behavior)
      setShiftDialogVisible(false);
    } finally {
      setCheckingShift(false);
    }
  };

  const handleShiftStarted = (shiftId: number) => {
    setCurrentShift({ id: shiftId, beginning_cash: 0 });
    setShiftDialogVisible(false);
    // Refresh after shift start
    refreshProducts();
  };

  // Handle unterminated session actions
  const handleUnterminatedXReading = () => {
    setUnterminatedModalVisible(false);
    // Pass the oldest unterminated date for X-Reading view
    const oldestDate = unterminatedSessions.length > 0 ? unterminatedSessions[0].date : undefined;
    setXReadingTargetDate(oldestDate);
    setXReadingModalVisible(true);
  };

  const handleUnterminatedZReading = () => {
    setUnterminatedModalVisible(false);
    // Pass the oldest unterminated date to close that specific day
    const oldestDate = unterminatedSessions.length > 0 ? unterminatedSessions[0].date : undefined;
    navigation.navigate('EndOfDay', { targetDate: oldestDate });
  };

  // Load customers
  useEffect(() => {
    loadCustomers();
  }, []);

  // Refresh on focus and auto-focus search
  useFocusEffect(
    useCallback(() => {
      refreshProducts();
      // Re-check for unterminated sessions when returning to this screen
      checkActiveShift();
      // Auto-focus search field for barcode scanning
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }, [refreshProducts])
  );

  // Show/hide search dropdown based on query
  useEffect(() => {
    setShowSearchDropdown(searchQuery.length >= 1 && filteredProducts.length > 0);
  }, [searchQuery, filteredProducts.length]);

  const loadCustomers = async () => {
    try {
      const dbService = getDatabase();
      const customerList = await dbService.getCustomers(true);
      setCustomers(customerList);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  // Filter customers for dropdown
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return true;
    const search = customerSearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(search) ||
      c.phone?.toLowerCase().includes(search) ||
      c.code?.toLowerCase().includes(search)
    );
  });

  // Handle barcode scan / search submit
  const handleSearchSubmit = useCallback(() => {
    if (filteredProducts.length === 1) {
      // Exact match - add to cart
      addItem(filteredProducts[0]);
      setSearchQuery('');
      setShowSearchDropdown(false);
    } else if (filteredProducts.length > 1) {
      // Multiple matches - keep dropdown open
      setShowSearchDropdown(true);
    }
    // Keep focus for next scan
    searchInputRef.current?.focus();
  }, [filteredProducts, addItem, setSearchQuery]);

  // Handle product selection from dropdown
  const handleSelectFromDropdown = useCallback((product: Product) => {
    addItem(product);
    setSearchQuery('');
    setShowSearchDropdown(false);
    // Keep focus on search field for faster selling
    searchInputRef.current?.focus();
  }, [addItem, setSearchQuery]);

  // Handle product selection from browser
  const handleSelectFromBrowser = useCallback((product: Product) => {
    addItem(product);
    setBrowseVisible(false);
    // Re-focus for next scan
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [addItem]);

  // Handle barcode scanned from camera
  const handleBarcodeScan = useCallback((barcode: string) => {
    console.log('Barcode scanned:', barcode);
    const currentProducts = productsRef.current;
    const barcodeUpper = barcode.toUpperCase().trim();

    // Try multiple matching strategies
    let product = currentProducts.find(p =>
      (p.code || '').toUpperCase().trim() === barcodeUpper
    );

    // Try with leading 0 added (UPC-A to EAN-13)
    if (!product) {
      const withLeadingZero = '0' + barcodeUpper;
      product = currentProducts.find(p =>
        (p.code || '').toUpperCase().trim() === withLeadingZero
      );
    }

    // Try with leading 0 removed
    if (!product && barcodeUpper.startsWith('0')) {
      const withoutLeadingZero = barcodeUpper.substring(1);
      product = currentProducts.find(p =>
        (p.code || '').toUpperCase().trim() === withoutLeadingZero
      );
    }

    // Try partial match (barcode ends with product code or vice versa)
    if (!product) {
      product = currentProducts.find(p => {
        const code = (p.code || '').toUpperCase().trim();
        return code.endsWith(barcodeUpper) || barcodeUpper.endsWith(code);
      });
    }

    console.log('Match found:', product ? product.name : 'NONE');
    if (product) {
      addItem(product);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery(barcode);
      setShowSearchDropdown(true);
    }
  }, [addItem, setSearchQuery]);

  // Handle checkout button
  const handleCheckout = useCallback(() => {
    if (cart.length === 0) return;

    // For credit sales, require customer selection
    if (transactionType === 'CREDIT' && !selectedCustomer) {
      setShowCustomerDropdown(true);
      return;
    }

    setPaymentVisible(true);
  }, [cart.length, transactionType, selectedCustomer]);

  // Process payment
  const handlePaymentComplete = useCallback(async (data: {
    paymentMethod: 'CASH' | 'CARD' | 'CHECK' | 'ONLINE' | 'CHARGE_INVOICE';
    amountTendered: number;
    customerId?: number;
    customerName?: string;
  }) => {
    if (!user) return;

    setIsProcessing(true);

    try {
      const dbService = getDatabase();
      const changeAmount = data.amountTendered - totals.total;

      const transactionData = {
        customer_id: data.customerId,
        customer_name: data.customerName,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: totals.discountAmount || 0,  // Save discount amount to database
        total_amount: totals.total,
        payment_method: data.paymentMethod,
        amount_tendered: data.paymentMethod === 'CHARGE_INVOICE' ? 0 : data.amountTendered,
        change_amount: data.paymentMethod === 'CHARGE_INVOICE' ? 0 : changeAmount,
        cashier_id: user.id,
        // BIR Compliance: SC/PWD discount info
        sc_pwd_id: discount.scPwdId,
        sc_pwd_name: discount.scPwdName,
        sc_pwd_type: discount.scPwdType,
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
          price_type: item.price_type,
        })),
      };

      const result = await dbService.createTransaction(transactionData);

      // Get store settings for receipt
      const storeName = await dbService.getSetting('company_name') || 'IgoroTech POS';
      const storeAddress = await dbService.getSetting('company_address') || '';
      const storePhone = await dbService.getSetting('store_phone') || '';
      const tin = await dbService.getSetting('company_tin') || '';
      const permitNumber = await dbService.getSetting('permit_number') || '';
      // BIR Compliance: Additional required fields
      const minNumber = await dbService.getSetting('min_number') || '';
      const ptuNumber = await dbService.getSetting('ptu_number') || '';
      const ptuDate = await dbService.getSetting('ptu_date') || '';
      const atpNumber = await dbService.getSetting('atp_number') || '';
      const atpDate = await dbService.getSetting('atp_date') || '';
      const accreditationNumber = await dbService.getSetting('accreditation_number') || '';
      const accreditationDate = await dbService.getSetting('accreditation_date') || '';
      const serialNumberFrom = await dbService.getSetting('serial_number_from') || '';
      const serialNumberTo = await dbService.getSetting('serial_number_to') || '';
      const supplierName = await dbService.getSetting('supplier_name') || '';
      const supplierAddress = await dbService.getSetting('supplier_address') || '';
      const supplierTin = await dbService.getSetting('supplier_tin') || '';
      const supplierAccreditation = await dbService.getSetting('supplier_accreditation') || '';

      // Prepare receipt data with BIR VAT breakdown
      const newReceiptData: ReceiptData = {
        businessName: storeName,
        businessAddress: storeAddress,
        businessPhone: storePhone,
        tin: tin,
        permitNumber: permitNumber,
        // BIR Compliance fields
        minNumber: minNumber,
        ptuNumber: ptuNumber,
        ptuDate: ptuDate,
        atpNumber: atpNumber,
        atpDate: atpDate,
        accreditationNumber: accreditationNumber,
        accreditationDate: accreditationDate,
        serialNumberFrom: serialNumberFrom,
        serialNumberTo: serialNumberTo,
        supplierName: supplierName,
        supplierAddress: supplierAddress,
        supplierTin: supplierTin,
        supplierAccreditation: supplierAccreditation,
        invoiceNumber: result.invoiceNumber,
        transactionDate: new Date(),
        cashierName: user.full_name || user.username,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
        })),
        subtotal: totals.grossTotal || 0,  // Use gross total (sum of item prices)
        taxAmount: totals.taxAmount || 0,
        discountAmount: totals.discountAmount || 0,
        discountLabel: discount.isSeniorCitizen ? 'SC/PWD Discount' : 'Discount',
        total: totals.total || 0,
        // BIR VAT Breakdown
        vatableSales: totals.vatableSales || 0,
        vatExemptSales: totals.vatExemptSales || 0,
        zeroRatedSales: totals.zeroRatedSales || 0,
        vatAmount: totals.vatAmount || 0,
        // BIR Compliance: SC/PWD info for receipt
        scPwdId: discount.scPwdId,
        scPwdName: discount.scPwdName,
        scPwdType: discount.scPwdType,
        paymentMethod: data.paymentMethod,
        amountTendered: data.paymentMethod === 'CHARGE_INVOICE' ? 0 : data.amountTendered,
        changeAmount: data.paymentMethod === 'CHARGE_INVOICE' ? 0 : changeAmount,
        customerName: data.customerName,
      };

      setReceiptData(newReceiptData);
      setLastReceiptData(newReceiptData);  // Store for reprint
      setPaymentVisible(false);
      setReceiptVisible(true);

      // Clear cart and reset state immediately after successful transaction
      // This ensures everything is reset even if receipt modal is dismissed unexpectedly
      clearCart();
      refreshProducts();
      setTransactionType('CASH');
      setSelectedCustomer(null);
      setShowCustomerDropdown(false);
      setCustomerSearch('');
    } catch (error) {
      console.error('Transaction error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [user, cart, totals, discount]);

  // Print receipt
  const handlePrintReceipt = async () => {
    if (!receiptData) {
      Alert.alert('Print Error', 'No receipt data available.');
      return;
    }

    if (!printerService.isConnected()) {
      Alert.alert(
        'Printer Not Connected',
        'No printer is connected. Would you like to set up a printer?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Setup Printer', onPress: () => navigation.navigate('PrinterSettings') },
        ]
      );
      return;
    }

    try {
      setIsPrinting(true);
      const settings = printerService.getSettings();
      const printerWidth = settings.printerWidth || PRINTER_WIDTH.MM_58;
      const receiptBuilder = buildReceipt(receiptData, printerWidth);
      await printerService.print(receiptBuilder);
      Alert.alert('Success', 'Receipt printed successfully.');
    } catch (error: any) {
      console.error('Print error:', error);
      Alert.alert('Print Failed', error?.message || 'Failed to print receipt. Please check printer connection and try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Email/Share PDF receipt
  const handleEmailReceipt = async () => {
    if (!receiptData) return;

    try {
      setIsPrinting(true);
      await generateReceiptPdf(receiptData);
    } catch (error: any) {
      console.error('Email receipt error:', error);
      Alert.alert('Error', error?.message || 'Failed to generate PDF receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Close receipt and reset
  const handleCloseReceipt = useCallback(() => {
    setReceiptVisible(false);
    setReceiptData(null);
    clearCart();
    refreshProducts();
    // Reset transaction type and customer for next sale
    setTransactionType('CASH');
    setSelectedCustomer(null);
    setShowCustomerDropdown(false);
    setCustomerSearch('');
    // Re-focus for next customer
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [clearCart, refreshProducts]);

  // Handle quantity press (manual input)
  const handleQuantityPress = useCallback((item: CartItem) => {
    setSelectedItemForQty(item);
    setQuantityModalVisible(true);
  }, []);

  // Handle quantity confirm from modal
  const handleQuantityConfirm = useCallback((productId: number, quantity: number) => {
    updateQuantity(productId, quantity);
    setQuantityModalVisible(false);
    setSelectedItemForQty(null);
  }, [updateQuantity]);

  // Render cart item
  const renderCartItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <POSCartItem
      item={item}
      index={index + 1}
      onIncrement={incrementQuantity}
      onDecrement={decrementQuantity}
      onRemove={removeItem}
      onQuantityPress={handleQuantityPress}
    />
  ), [incrementQuantity, decrementQuantity, removeItem, handleQuantityPress]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F5F5F5' }]}>
      {/* ===== SEARCH BAR SECTION ===== */}
      <View style={styles.searchSection}>
        {/* Price Type Selector */}
        <View style={styles.priceTypeRow}>
          <Text style={styles.priceTypeLabel}>Price Type:</Text>
          <View style={styles.priceTypeButtons}>
            <TouchableOpacity
              style={[
                styles.priceTypeButton,
                priceType === 'retail' && styles.priceTypeButtonActive
              ]}
              onPress={() => setPriceType('retail')}
            >
              <Text style={[
                styles.priceTypeButtonText,
                priceType === 'retail' && styles.priceTypeButtonTextActive
              ]}>Retail</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.priceTypeButton,
                priceType === 'wholesale' && styles.priceTypeButtonActive
              ]}
              onPress={() => setPriceType('wholesale')}
            >
              <Text style={[
                styles.priceTypeButtonText,
                priceType === 'wholesale' && styles.priceTypeButtonTextActive
              ]}>Wholesale</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.searchRow}>
          {/* Search Input */}
          <View style={styles.searchInputWrapper}>
            <TextInput
              ref={searchInputRef}
              placeholder="Scan barcode or search..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              mode="outlined"
              style={styles.searchInput}
              dense
              left={<TextInput.Icon icon="magnify" />}
              right={searchQuery ? (
                <TextInput.Icon
                  icon="close"
                  onPress={() => {
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                />
              ) : null}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />

            {/* Search Dropdown */}
            <POSSearchDropdown
              products={filteredProducts.slice(0, 10)}
              visible={showSearchDropdown}
              onSelect={handleSelectFromDropdown}
              searchQuery={searchQuery}
            />
          </View>

          {/* Barcode Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('BarcodeScanner', { onScan: handleBarcodeScan })}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonIcon}>📷</Text>
          </TouchableOpacity>

          {/* Browse Products Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.browseButton]}
            onPress={() => setBrowseVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonIcon}>📦</Text>
          </TouchableOpacity>

          {/* Hamburger Menu Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.menuButton]}
            onPress={() => setHamburgerMenuVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== CART SECTION (80% of screen) ===== */}
      <View style={styles.cartSection}>
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>🛒 Cart</Text>
          <Text style={styles.cartCount}>
            {cart.length} item{cart.length !== 1 ? 's' : ''}
          </Text>
          {cart.length > 0 && (
            <TouchableOpacity onPress={clearCart} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cart Items List */}
        <FlatList
          data={cart}
          keyExtractor={item => item.id.toString()}
          renderItem={renderCartItem}
          style={styles.cartList}
          contentContainerStyle={styles.cartListContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCart}>
              <Text style={styles.emptyCartIcon}>🛒</Text>
              <Text style={styles.emptyCartTitle}>Cart is empty</Text>
              <Text style={styles.emptyCartSubtitle}>
                Scan a barcode or search for products
              </Text>
            </View>
          }
        />
      </View>

      {/* ===== TOTALS & CHECKOUT SECTION ===== */}
      <View style={styles.checkoutSection}>
        {/* Transaction Type Selector */}
        <View style={styles.transactionTypeRow}>
          <TouchableOpacity
            style={[
              styles.transactionTypeButton,
              transactionType === 'CASH' && styles.transactionTypeButtonActive,
            ]}
            onPress={() => {
              setTransactionType('CASH');
              setSelectedCustomer(null);
              setShowCustomerDropdown(false);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.transactionTypeIcon}>💵</Text>
            <Text style={[
              styles.transactionTypeText,
              transactionType === 'CASH' && styles.transactionTypeTextActive,
            ]}>Cash Sale</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.transactionTypeButton,
              transactionType === 'CREDIT' && styles.transactionTypeCreditActive,
            ]}
            onPress={() => setTransactionType('CREDIT')}
            activeOpacity={0.7}
          >
            <Text style={styles.transactionTypeIcon}>📋</Text>
            <Text style={[
              styles.transactionTypeText,
              transactionType === 'CREDIT' && styles.transactionTypeCreditTextActive,
            ]}>Credit Sale</Text>
          </TouchableOpacity>
        </View>

        {/* Customer Selection for Credit Sales */}
        {transactionType === 'CREDIT' && (
          <View style={styles.customerSelectionSection}>
            {selectedCustomer ? (
              <View style={styles.selectedCustomerRow}>
                <View style={styles.selectedCustomerInfo}>
                  <Text style={styles.selectedCustomerName}>👤 {selectedCustomer.name}</Text>
                  {selectedCustomer.outstanding_balance > 0 && (
                    <Text style={styles.selectedCustomerBalance}>
                      Balance: ₱{selectedCustomer.outstanding_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.changeCustomerBtn}
                  onPress={() => {
                    setSelectedCustomer(null);
                    setShowCustomerDropdown(true);
                  }}
                >
                  <Text style={styles.changeCustomerBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectCustomerBtn}
                onPress={() => setShowCustomerDropdown(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectCustomerBtnText}>👤 Select Customer (Required)</Text>
              </TouchableOpacity>
            )}

            {/* Customer Dropdown */}
            {showCustomerDropdown && (
              <View style={styles.customerDropdown}>
                <View style={styles.customerDropdownHeader}>
                  <RNTextInput
                    placeholder="Search customer..."
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    style={styles.customerSearchInput}
                  />
                  <TouchableOpacity
                    style={styles.quickAddCustomerBtn}
                    onPress={() => {
                      setShowCustomerDropdown(false);
                      setQuickCustomerModalVisible(true);
                    }}
                  >
                    <Text style={styles.quickAddCustomerBtnText}>+ Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeCustomerDropdownBtn}
                    onPress={() => {
                      setShowCustomerDropdown(false);
                      setCustomerSearch('');
                    }}
                  >
                    <Text style={styles.closeCustomerDropdownBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={filteredCustomers.slice(0, 5)}
                  keyExtractor={item => item.id.toString()}
                  style={styles.customerDropdownList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.customerDropdownItem}
                      onPress={() => {
                        setSelectedCustomer(item);
                        setShowCustomerDropdown(false);
                        setCustomerSearch('');
                      }}
                    >
                      <Text style={styles.customerDropdownName}>{item.name}</Text>
                      {item.outstanding_balance > 0 && (
                        <Text style={styles.customerDropdownBalance}>
                          Bal: ₱{item.outstanding_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.noCustomersText}>No customers found</Text>
                  }
                />
              </View>
            )}
          </View>
        )}

        {/* Discount Buttons */}
        <View style={styles.discountRow}>
          <TouchableOpacity
            style={[
              styles.discountButton,
              discount.isSeniorCitizen && styles.discountButtonActive,
              cart.length === 0 && styles.discountButtonDisabled,
            ]}
            onPress={cart.length === 0 ? undefined : () => setSeniorDiscountModalVisible(true)}
            activeOpacity={cart.length === 0 ? 1 : 0.7}
            disabled={cart.length === 0}
          >
            <Text style={[
              styles.discountButtonText,
              discount.isSeniorCitizen && styles.discountButtonTextActive,
              cart.length === 0 && styles.discountButtonTextDisabled,
            ]}>
              {discount.isSeniorCitizen
                ? `👴 SC/PWD (${discount.seniorCount}/${discount.totalCustomers})`
                : '👴 SC/PWD'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.discountButton,
              (discount.type === 'percent' || discount.type === 'amount') && !discount.isSeniorCitizen && styles.discountButtonActive,
              cart.length === 0 && styles.discountButtonDisabled,
            ]}
            onPress={cart.length === 0 ? undefined : () => setDiscountModalVisible(true)}
            activeOpacity={cart.length === 0 ? 1 : 0.7}
            disabled={cart.length === 0}
          >
            <Text style={[
              styles.discountButtonText,
              (discount.type === 'percent' || discount.type === 'amount') && !discount.isSeniorCitizen && styles.discountButtonTextActive,
              cart.length === 0 && styles.discountButtonTextDisabled,
            ]}>
              {(discount.type === 'percent' || discount.type === 'amount') && !discount.isSeniorCitizen
                ? `Discount: ${discount.type === 'percent' ? discount.value + '%' : '₱' + discount.value}`
                : 'Discount'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          {(totals.discountAmount || 0) > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Sub-Total</Text>
                <Text style={styles.totalValue}>₱{(totals.grossTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={[styles.totalValue, { color: '#F44336' }]}>
                  -₱{(totals.discountAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </>
          )}
          <View style={[styles.totalRow, (totals.discountAmount || 0) > 0 && styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>₱{(totals.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {/* Checkout Button */}
        <TouchableOpacity
          style={[
            styles.checkoutButton,
            cart.length === 0 && styles.checkoutButtonDisabled,
          ]}
          onPress={handleCheckout}
          disabled={cart.length === 0 || isProcessing}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutButtonText}>
            💳 CHECKOUT ₱{(totals.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ===== MODALS ===== */}

      {/* Product Browser Modal */}
      <POSProductBrowser
        visible={browseVisible}
        products={products}
        categories={categories}
        onSelect={handleSelectFromBrowser}
        onClose={() => setBrowseVisible(false)}
        getCartQuantity={getItemQuantity}
      />

      {/* Payment Modal */}
      <POSPaymentModal
        visible={paymentVisible}
        totals={totals}
        discount={discount}
        customers={customers}
        onClose={() => setPaymentVisible(false)}
        onComplete={handlePaymentComplete}
        onQuickAddCustomer={() => {
          setQuickCustomerModalVisible(true);
        }}
        loading={isProcessing}
        initialPaymentMethod={transactionType === 'CREDIT' ? 'CHARGE_INVOICE' : 'CASH'}
        initialCustomer={selectedCustomer}
      />

      {/* Discount Modal */}
      <POSDiscountModal
        visible={discountModalVisible}
        subtotal={totals.subtotal + totals.taxAmount}
        currentType={discount.type}
        currentValue={discount.value}
        onApply={(type, value) => {
          clearSeniorDiscount();  // Clear SC discount first
          setDiscountType(type);
          setDiscountValue(value);
        }}
        onClear={() => {
          setDiscountType('none');
          setDiscountValue('');
        }}
        onClose={() => setDiscountModalVisible(false)}
      />

      {/* Quantity Modal */}
      <POSQuantityModal
        visible={quantityModalVisible}
        item={selectedItemForQty}
        onConfirm={handleQuantityConfirm}
        onClose={() => {
          setQuantityModalVisible(false);
          setSelectedItemForQty(null);
        }}
      />

      {/* Senior Discount Modal */}
      <POSSeniorDiscountModal
        visible={seniorDiscountModalVisible}
        subtotal={totals.subtotal}
        vatAmount={totals.vatAmount}
        currentTotalCustomers={discount.totalCustomers}
        currentSeniorCount={discount.seniorCount}
        isSeniorApplied={discount.isSeniorCitizen}
        currentScPwdInfo={discount.scPwdId ? { id: discount.scPwdId, name: discount.scPwdName || '', type: discount.scPwdType || 'SENIOR' } : undefined}
        onApply={(totalCustomers, seniorCount, scPwdInfo) => {
          setDiscountType('none');  // Clear regular discount first
          setDiscountValue('');
          setSeniorDiscount(totalCustomers, seniorCount, scPwdInfo);
        }}
        onClear={clearSeniorDiscount}
        onClose={() => setSeniorDiscountModalVisible(false)}
      />

      {/* Receipt Modal */}
      <Modal
        visible={receiptVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseReceipt}
      >
        <View style={styles.receiptOverlay}>
          <View style={styles.receiptContainer}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptTitle}>Transaction Complete</Text>
              <IconButton icon="close" size={24} onPress={handleCloseReceipt} />
            </View>

            {receiptData && (
              <ReceiptPreview
                data={receiptData}
                width={printerService.getSettings().printerWidth === PRINTER_WIDTH.MM_80 ? '80mm' : '58mm'}
                onPrint={handlePrintReceipt}
                onEmail={handleEmailReceipt}
                onClose={handleCloseReceipt}
                isPrinting={isPrinting}
                showActions={true}
              />
            )}

            <View style={styles.receiptFooter}>
              <Text style={styles.receiptFooterText}>
                Tap "New Sale" to start another transaction
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hamburger Menu */}
      <POSHamburgerMenu
        visible={hamburgerMenuVisible}
        onClose={() => setHamburgerMenuVisible(false)}
        hasLastTransaction={lastReceiptData !== null}
        onReprint={() => {
          if (lastReceiptData) {
            setReceiptData(lastReceiptData);
            setReceiptVisible(true);
          }
        }}
        onXReading={() => {
          setHamburgerMenuVisible(false);
          setXReadingModalVisible(true);
        }}
        onZReading={() => {
          setHamburgerMenuVisible(false);
          navigation.navigate('EndOfDay');
        }}
        onCashFund={() => {
          setHamburgerMenuVisible(false);
          setCashFundModalVisible(true);
        }}
        onPettyCash={() => {
          setHamburgerMenuVisible(false);
          setPettyCashModalVisible(true);
        }}
        onCashCount={() => {
          setHamburgerMenuVisible(false);
          navigation.navigate('CashCount');
        }}
        onRefund={() => {
          setHamburgerMenuVisible(false);
          setRefundModalVisible(true);
        }}
        onExchange={() => {
          setHamburgerMenuVisible(false);
          setExchangeModalVisible(true);
        }}
        onVoid={() => {
          setHamburgerMenuVisible(false);
          setVoidModalVisible(true);
        }}
        onQuickAddCustomer={() => {
          setHamburgerMenuVisible(false);
          setQuickCustomerModalVisible(true);
        }}
      />

      {/* Cash Fund Modal */}
      <POSCashFundModal
        visible={cashFundModalVisible}
        onClose={() => setCashFundModalVisible(false)}
        onSuccess={() => {
          setCashFundModalVisible(false);
        }}
        cashierId={user?.id || 0}
      />

      {/* Petty Cash Modal */}
      <POSPettyCashModal
        visible={pettyCashModalVisible}
        onClose={() => setPettyCashModalVisible(false)}
        onSuccess={() => {
          setPettyCashModalVisible(false);
        }}
        cashierId={user?.id || 0}
      />

      {/* X-Reading Modal */}
      <POSXReadingModal
        visible={xReadingModalVisible}
        onClose={() => {
          setXReadingModalVisible(false);
          setXReadingTargetDate(undefined);  // Clear target date when closing
        }}
        cashierId={user?.id || 0}
        targetDate={xReadingTargetDate}
      />

      {/* Void Transaction Modal */}
      <POSVoidModal
        visible={voidModalVisible}
        onClose={() => setVoidModalVisible(false)}
        onSuccess={() => {
          setVoidModalVisible(false);
          refreshProducts();
        }}
        cashierId={user?.id || 0}
      />

      {/* Refund Modal */}
      <POSRefundModal
        visible={refundModalVisible}
        onClose={() => setRefundModalVisible(false)}
        onSuccess={() => {
          setRefundModalVisible(false);
          refreshProducts();
        }}
        cashierId={user?.id || 0}
      />

      {/* Exchange Modal */}
      <POSExchangeModal
        visible={exchangeModalVisible}
        onClose={() => setExchangeModalVisible(false)}
        onSuccess={() => {
          setExchangeModalVisible(false);
          refreshProducts();
        }}
        cashierId={user?.id || 0}
      />

      {/* Quick Add Customer Modal */}
      <POSQuickCustomerModal
        visible={quickCustomerModalVisible}
        onClose={() => setQuickCustomerModalVisible(false)}
        onCustomerCreated={(customer) => {
          setQuickCustomerModalVisible(false);
          loadCustomers();
          // If credit sale, auto-select the newly created customer
          if (transactionType === 'CREDIT' && customer) {
            setSelectedCustomer(customer);
            setShowCustomerDropdown(false);
          }
        }}
        userId={user?.id || 0}
      />

      {/* Unterminated Session Modal - Must close previous day's session */}
      <POSUnterminatedSessionModal
        visible={unterminatedModalVisible}
        sessions={unterminatedSessions}
        onDoXReading={handleUnterminatedXReading}
        onDoZReading={handleUnterminatedZReading}
      />

      {/* Start Shift Dialog - Required before sales can be made */}
      <StartShiftDialog
        visible={shiftDialogVisible && !checkingShift && !unterminatedModalVisible}
        userId={user?.id || 0}
        onShiftStarted={handleShiftStarted}
        onCancel={() => {
          setShiftDialogVisible(false);
          // Navigate back to Dashboard when user cancels
          navigation.navigate('Dashboard');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Search Section
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  priceTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginRight: 10,
  },
  priceTypeButtons: {
    flexDirection: 'row',
    flex: 1,
  },
  priceTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  priceTypeButtonActive: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  priceTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  priceTypeButtonTextActive: {
    color: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    marginRight: 8,
    position: 'relative',
    zIndex: 1000,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  browseButton: {
    backgroundColor: '#FFF3E0',
  },
  menuButton: {
    backgroundColor: '#F3E5F5',
  },
  actionButtonIcon: {
    fontSize: 22,
  },

  // Cart Section
  cartSection: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  cartCount: {
    fontSize: 14,
    color: '#616161',
    marginLeft: 12,
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
  },
  cartList: {
    flex: 1,
  },
  cartListContent: {
    padding: 12,
    paddingBottom: 16,
  },
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyCartIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyCartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },
  emptyCartSubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },

  // Checkout Section
  checkoutSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  discountRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  discountButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    alignItems: 'center',
  },
  discountButtonActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  discountButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
  },
  discountButtonTextActive: {
    color: '#2E7D32',
  },
  discountButtonDisabled: {
    backgroundColor: '#E0E0E0',
    opacity: 0.6,
  },
  discountButtonTextDisabled: {
    color: '#9E9E9E',
  },
  totalsContainer: {
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: '#616161',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E7D32',
  },
  checkoutButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Receipt Modal
  receiptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  receiptContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '95%',
    elevation: 8,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
  },
  receiptFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  receiptFooterText: {
    fontSize: 14,
    color: '#616161',
  },

  // Transaction Type Selector
  transactionTypeRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  transactionTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  transactionTypeButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  transactionTypeCreditActive: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  transactionTypeIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  transactionTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
  },
  transactionTypeTextActive: {
    color: '#2E7D32',
  },
  transactionTypeCreditTextActive: {
    color: '#E65100',
  },

  // Customer Selection
  customerSelectionSection: {
    marginBottom: 12,
  },
  selectCustomerBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  selectCustomerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  selectedCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectedCustomerInfo: {
    flex: 1,
  },
  selectedCustomerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  selectedCustomerBalance: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 2,
  },
  changeCustomerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  changeCustomerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
  },
  customerDropdown: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  customerDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  customerSearchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    fontSize: 14,
  },
  quickAddCustomerBtn: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
  },
  quickAddCustomerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  closeCustomerDropdownBtn: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeCustomerDropdownBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  customerDropdownList: {
    maxHeight: 150,
  },
  customerDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  customerDropdownName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  customerDropdownBalance: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F44336',
  },
  noCustomersText: {
    textAlign: 'center',
    paddingVertical: 16,
    color: '#9E9E9E',
    fontSize: 14,
  },
});
