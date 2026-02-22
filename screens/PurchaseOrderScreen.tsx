import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
  Modal,
  TouchableOpacity,
  TextInput as RNTextInput,
  Keyboard,
} from 'react-native';
import {
  Card,
  Paragraph,
  Button,
  TextInput,
  IconButton,
  useTheme,
  Divider,
  Chip,
  Menu,
  Text,
} from 'react-native-paper';

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Product, Supplier } from '../database/schema';
import * as Print from 'expo-print';
import { generatePurchaseOrderPdf, PurchaseOrderPdfData } from '../utils/ReceiptPdfService';
import { buildPurchaseOrder, PurchaseOrderPrintData } from '../utils/escpos';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import { useResponsiveTheme } from '../utils/responsive';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);

  // Purchase Order Creation
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierMenuVisible, setSupplierMenuVisible] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 days');
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);

  // Product Selection (inline in Create PO)
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const searchInputRef = useRef<RNTextInput>(null);

  // Edit Item
  const [editItemDialogVisible, setEditItemDialogVisible] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editItemQuantity, setEditItemQuantity] = useState('');
  const [editItemUnitCost, setEditItemUnitCost] = useState('');

  // Quick Add Supplier
  const [quickAddSupplierVisible, setQuickAddSupplierVisible] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');

  // Quick Add Product
  const [quickAddProductVisible, setQuickAddProductVisible] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductCost, setNewProductCost] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');

  // UI State
  const [showDetails, setShowDetails] = useState(false);
  const [addProductDialogVisible, setAddProductDialogVisible] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'RECEIVED'>('ALL');
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const [purchaseOrdersData, suppliersData, productsData] = await Promise.all([
        dbService.getPurchaseOrders(500),
        dbService.getSuppliers(true),
        dbService.getProducts(true)
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

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      // Status filter
      if (statusFilter !== 'ALL' && po.status !== statusFilter) return false;
      // Date filter
      const poDate = new Date(po.purchase_date || po.created_at);
      return poDate >= dateRange.startDate && poDate <= dateRange.endDate;
    });
  }, [purchaseOrders, statusFilter, dateRange]);

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
    setSelectedSupplier(null);
    setReferenceNumber('');
    setExpectedDeliveryDate('');
    setPaymentTerms('30 days');
    setNotes('');
    setPurchaseItems([]);
    setIsEditing(false);
    setEditingPurchaseId(null);
    setProductSearchQuery('');
    setSupplierSearchQuery('');
    setSupplierMenuVisible(false);
    setShowDetails(false);
    setCreateDialogVisible(true);
  };

  const closeCreateDialog = () => {
    setCreateDialogVisible(false);
    setIsEditing(false);
    setEditingPurchaseId(null);
    setProductSearchQuery('');
    setSupplierSearchQuery('');
    setSupplierMenuVisible(false);
  };

  const openEditDialog = async (purchase: any) => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const purchaseDetails = await dbService.getPurchaseOrderById(purchase.id);

      if (!purchaseDetails) {
        Alert.alert('Error', 'Could not load purchase order details');
        return;
      }

      const supplier = suppliers.find(s => s.id === purchaseDetails.supplier_id);
      setSelectedSupplier(supplier || null);
      setReferenceNumber(purchaseDetails.reference_number || '');
      setExpectedDeliveryDate(purchaseDetails.expected_delivery_date || '');
      setPaymentTerms(purchaseDetails.payment_terms || '30 days');
      setNotes(purchaseDetails.notes || '');

      const items: PurchaseItem[] = purchaseDetails.items?.map((item: any) => ({
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        quantity_ordered: item.quantity_ordered,
        unit_cost: item.unit_cost,
        discount_amount: item.discount_amount || 0,
        tax_amount: item.tax_amount || 0,
        total_amount: item.total_amount || (item.quantity_ordered * item.unit_cost),
      })) || [];
      setPurchaseItems(items);

      setIsEditing(true);
      setEditingPurchaseId(purchase.id);
      setProductSearchQuery('');
      setShowDetails(true);
      setCreateDialogVisible(true);
    } catch (error) {
      console.error('Error loading purchase order for edit:', error);
      Alert.alert('Error', 'Failed to load purchase order for editing');
    } finally {
      setLoading(false);
    }
  };

  // === INLINE PRODUCT ADD (like SalesScreen cart) ===
  const addProductInline = (product: Product) => {
    const existingIndex = purchaseItems.findIndex(item => item.product_id === product.id);

    if (existingIndex >= 0) {
      const updatedItems = [...purchaseItems];
      const item = updatedItems[existingIndex];
      const newQty = item.quantity_ordered + 1;
      const taxAmount = product.is_vat_inclusive ? 0 : item.unit_cost * newQty * 0.12;
      const totalAmount = (item.unit_cost * newQty) + taxAmount;
      updatedItems[existingIndex] = {
        ...item,
        quantity_ordered: newQty,
        tax_amount: taxAmount,
        total_amount: totalAmount
      };
      setPurchaseItems(updatedItems);
    } else {
      const cost = product.cost;
      const taxAmount = product.is_vat_inclusive ? 0 : cost * 0.12;
      const totalAmount = cost + taxAmount;
      const newItem: PurchaseItem = {
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        quantity_ordered: 1,
        unit_cost: cost,
        discount_amount: 0,
        tax_amount: taxAmount,
        total_amount: totalAmount
      };
      setPurchaseItems(prev => [...prev, newItem]);
    }

    setProductSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleSearchSubmit = () => {
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      product.code.toLowerCase().includes(productSearchQuery.toLowerCase())
    );
    if (filtered.length === 1) {
      addProductInline(filtered[0]);
    }
    searchInputRef.current?.focus();
  };

  const handleBarcodeScanInline = () => {
    setCreateDialogVisible(false);
    setTimeout(() => {
      navigation.navigate('BarcodeScanner', {
        onScan: (barcode: string) => {
          const barcodeUpper = barcode.toUpperCase().trim();
          const product = products.find(p =>
            (p.code || '').toUpperCase().trim() === barcodeUpper
          );

          if (product) {
            addProductInline(product);
            setCreateDialogVisible(true);
          } else {
            Alert.alert(
              'Product Not Found',
              `No product found with barcode "${barcode}".\nWould you like to add it as a new product?`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => setCreateDialogVisible(true)
                },
                {
                  text: 'Add New Product',
                  onPress: () => {
                    setNewProductCode(barcode);
                    setQuickAddProductVisible(true);
                  }
                }
              ]
            );
          }
        }
      });
    }, 400);
  };

  // === EXISTING BUSINESS LOGIC (unchanged) ===

  const handleQuickAddSupplier = async () => {
    if (!newSupplierName.trim()) {
      Alert.alert('Error', 'Supplier name is required');
      return;
    }

    try {
      const dbService = getDatabase();
      const code = newSupplierName.trim().substring(0, 3).toUpperCase() + Date.now().toString().slice(-4);

      await dbService.createSupplier({
        code,
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim() || undefined,
        address: newSupplierAddress.trim() || undefined,
        is_active: true,
      });

      const suppliersData = await dbService.getSuppliers(true);
      setSuppliers(suppliersData);

      const createdSupplier = suppliersData.find((s: Supplier) => s.code === code);
      if (createdSupplier) {
        setSelectedSupplier(createdSupplier);
      }

      setNewSupplierName('');
      setNewSupplierPhone('');
      setNewSupplierAddress('');
      setQuickAddSupplierVisible(false);
      Alert.alert('Success', `Supplier "${newSupplierName}" added successfully`);
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      Alert.alert('Error', error?.message || 'Failed to create supplier');
    }
  };

  const handleScanForQuickAdd = () => {
    setQuickAddProductVisible(false);
    setTimeout(() => {
      navigation.navigate('BarcodeScanner', {
        onScan: (barcode: string) => {
          setNewProductCode(barcode);
          setQuickAddProductVisible(true);
        }
      });
    }, 400);
  };

  const handleQuickAddProduct = async () => {
    if (!newProductName.trim()) {
      Alert.alert('Error', 'Product name is required');
      return;
    }
    if (!newProductCost.trim() || parseFloat(newProductCost) <= 0) {
      Alert.alert('Error', 'Valid cost is required');
      return;
    }
    if (!newProductPrice.trim() || parseFloat(newProductPrice) <= 0) {
      Alert.alert('Error', 'Valid selling price is required');
      return;
    }

    try {
      const dbService = getDatabase();
      const code = newProductCode.trim() || newProductName.trim().substring(0, 3).toUpperCase() + Date.now().toString().slice(-4);

      await dbService.createProduct({
        code,
        name: newProductName.trim(),
        cost: parseFloat(newProductCost),
        price: parseFloat(newProductPrice),
        stock_quantity: 0,
        is_active: true,
      });

      const productsData = await dbService.getProducts(true);
      setProducts(productsData as Product[]);

      // Auto-add the newly created product to the PO
      const createdProduct = (productsData as Product[]).find(p => p.code === code);
      if (createdProduct) {
        addProductInline(createdProduct);
      }

      setNewProductName('');
      setNewProductCode('');
      setNewProductCost('');
      setNewProductPrice('');
      setQuickAddProductVisible(false);
      Alert.alert('Success', `Product "${newProductName.trim()}" added successfully`);
    } catch (error: any) {
      console.error('Error creating product:', error);
      Alert.alert('Error', error?.message || 'Failed to create product');
    }
  };

  const removeProductFromPurchase = (productId: number) => {
    setPurchaseItems(purchaseItems.filter(item => item.product_id !== productId));
  };

  const openEditItemDialog = (index: number) => {
    const item = purchaseItems[index];
    setEditingItemIndex(index);
    setEditItemQuantity(item.quantity_ordered.toString());
    setEditItemUnitCost(item.unit_cost.toString());
    setEditItemDialogVisible(true);
  };

  const saveEditedItem = () => {
    if (editingItemIndex === null) return;

    const qty = parseInt(editItemQuantity);
    const cost = parseFloat(editItemUnitCost);

    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Quantity must be greater than 0');
      return;
    }

    if (isNaN(cost) || cost <= 0) {
      Alert.alert('Error', 'Unit cost must be greater than 0');
      return;
    }

    const updatedItems = [...purchaseItems];
    const item = updatedItems[editingItemIndex];

    const product = products.find(p => p.id === item.product_id);
    const taxAmount = product?.is_vat_inclusive ? 0 : cost * qty * 0.12;
    const totalAmount = (cost * qty) + taxAmount;

    updatedItems[editingItemIndex] = {
      ...item,
      quantity_ordered: qty,
      unit_cost: cost,
      tax_amount: taxAmount,
      total_amount: totalAmount
    };

    setPurchaseItems(updatedItems);
    setEditItemDialogVisible(false);
    setEditingItemIndex(null);
    setEditItemQuantity('');
    setEditItemUnitCost('');
  };

  const calculatePurchaseTotal = () => {
    return purchaseItems.reduce((total, item) => total + item.total_amount, 0);
  };

  const savePurchaseOrder = async () => {
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
      const dbService = getDatabase();

      const purchaseData = {
        supplier_id: selectedSupplier.id,
        expected_delivery_date: expectedDeliveryDate || undefined,
        reference_number: referenceNumber || undefined,
        payment_terms: paymentTerms,
        notes: notes || undefined,
        created_by: 1,
        items: purchaseItems
      };

      if (isEditing && editingPurchaseId) {
        const result = await dbService.updatePurchaseOrder(editingPurchaseId, purchaseData);

        if (result.success) {
          Alert.alert('Success', 'Purchase order updated successfully', [
            { text: 'OK', onPress: () => { closeCreateDialog(); loadData(); } }
          ]);
        } else {
          Alert.alert('Error', result.message);
        }
      } else {
        const result = await dbService.createPurchaseOrder(purchaseData);

        Alert.alert('Success', `Purchase order ${result.purchaseNumber} created successfully`, [
          { text: 'OK', onPress: () => { closeCreateDialog(); loadData(); } }
        ]);
      }
    } catch (error) {
      console.error('Error saving purchase order:', error);
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'create'} purchase order`);
    } finally {
      setLoading(false);
    }
  };

  const openReceiveDialog = async (purchase: any) => {
    try {
      setLoading(true);
      const dbService = getDatabase();
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
      const dbService = getDatabase();

      const items = selectedPurchase.items.map((item: any) => ({
        product_id: item.product_id,
        quantity_received: item.quantity_ordered - item.quantity_received
      }));

      await dbService.receivePurchaseOrder(selectedPurchase.id, 1, items);

      Alert.alert('Success', 'Purchase order received successfully', [
        { text: 'OK', onPress: () => { setReceiveDialogVisible(false); setSelectedPurchase(null); loadData(); } }
      ]);
    } catch (error) {
      console.error('Error receiving purchase order:', error);
      Alert.alert('Error', 'Failed to receive purchase order');
    } finally {
      setLoading(false);
    }
  };

  // === PRINT / PDF / EMAIL HANDLERS ===

  const buildPoPrintData = async (purchase: any): Promise<PurchaseOrderPrintData> => {
    const dbService = getDatabase();
    const details = await dbService.getPurchaseOrderById(purchase.id);
    // Load business settings
    let businessName = '', businessAddress = '', businessPhone = '';
    try {
      businessName = await dbService.getSetting('business_name') || '';
      businessAddress = await dbService.getSetting('business_address') || '';
      businessPhone = await dbService.getSetting('business_phone') || '';
    } catch (e) {}

    return {
      purchaseNumber: purchase.purchase_number,
      supplierName: purchase.supplier_name,
      purchaseDate: new Date(purchase.purchase_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }),
      referenceNumber: purchase.reference_number,
      expectedDeliveryDate: purchase.expected_delivery_date ? new Date(purchase.expected_delivery_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : undefined,
      paymentTerms: purchase.payment_terms,
      notes: purchase.notes,
      status: purchase.status,
      items: (details?.items || []).map((item: any) => ({
        productName: item.product_name,
        productCode: item.product_code,
        quantityOrdered: item.quantity_ordered,
        quantityReceived: item.quantity_received,
        unitCost: item.unit_cost,
        totalAmount: item.total_amount || (item.quantity_ordered * item.unit_cost),
      })),
      totalAmount: purchase.total_amount,
      businessName,
      businessAddress,
      businessPhone,
    };
  };

  const handlePrintPO = async (purchase: any) => {
    try {
      const printer = BluetoothPrinterService.getInstance();
      const data = await buildPoPrintData(purchase);

      if (!printer.isConnected()) {
        // Fallback: system print dialog via PDF
        let tin = '';
        try { tin = await getDatabase().getSetting('tin') || ''; } catch (e) {}
        const pdfData: PurchaseOrderPdfData = { ...data, tin };
        await generatePurchaseOrderPdf(pdfData);
        return;
      }

      const printerWidth = printer.getSettings().printerWidth;
      const builder = buildPurchaseOrder(data, printerWidth);
      await printer.print(builder);
      Alert.alert('Success', 'Purchase order printed successfully');
    } catch (error) {
      console.error('Error printing PO:', error);
      Alert.alert('Error', 'Failed to print purchase order');
    }
  };

  const handleExportPdf = async (purchase: any) => {
    try {
      const data = await buildPoPrintData(purchase);
      let tin = '';
      try { tin = await getDatabase().getSetting('tin') || ''; } catch (e) {}
      const pdfData: PurchaseOrderPdfData = { ...data, tin };
      await generatePurchaseOrderPdf(pdfData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.code.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
    (supplier.code || '').toLowerCase().includes(supplierSearchQuery.toLowerCase())
  );

  // === RENDER: PO LIST ITEM ===
  const renderPurchaseOrder = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.poCard}
      onPress={() => item.status === 'DRAFT' ? openEditDialog(item) : openReceiveDialog(item)}
      activeOpacity={0.7}
    >
      <View style={styles.poCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.poNumber}>{item.purchase_number}</Text>
          <Text style={styles.poSupplier}>{item.supplier_name}</Text>
          <Text style={styles.poDate}>{new Date(item.purchase_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusBadgeText}>{item.status.replace('_', ' ')}</Text>
          </View>
          <Text style={styles.poTotal}>₱{item.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>
      {(item.reference_number || item.payment_terms) && (
        <View style={styles.poCardFooter}>
          {item.reference_number && <Text style={styles.poDetail}>Ref: {item.reference_number}</Text>}
          <Text style={styles.poDetail}>Terms: {item.payment_terms}</Text>
        </View>
      )}
      <View style={styles.poCardActions}>
        {item.status === 'DRAFT' && (
          <TouchableOpacity style={styles.poActionBtn} onPress={() => openEditDialog(item)} activeOpacity={0.7}>
            <Text style={styles.poActionBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
        {item.status !== 'RECEIVED' && item.status !== 'CANCELLED' && (
          <TouchableOpacity
            style={[styles.poActionBtn, styles.poActionBtnReceive]}
            onPress={() => openReceiveDialog(item)}
            activeOpacity={0.7}
          >
            <Text style={[styles.poActionBtnText, { color: '#4CAF50' }]}>Receive</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.poActionBtn} onPress={() => handlePrintPO(item)} activeOpacity={0.7}>
          <Text style={styles.poActionBtnText}>Print</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.poActionBtn, styles.poActionBtnPdf]} onPress={() => handleExportPdf(item)} activeOpacity={0.7}>
          <Text style={[styles.poActionBtnText, { color: '#1976D2' }]}>PDF / Email</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // === RENDER: CART-STYLE ITEM ROW ===
  const renderPurchaseItem = ({ item, index }: { item: PurchaseItem; index: number }) => (
    <TouchableOpacity
      style={styles.cartItem}
      onPress={() => openEditItemDialog(index)}
      activeOpacity={0.7}
    >
      <View style={styles.cartItemLeft}>
        <Text style={styles.cartItemIndex}>{index + 1}</Text>
      </View>
      <View style={styles.cartItemCenter}>
        <Text style={styles.cartItemName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.cartItemDetail}>
          {item.quantity_ordered} x ₱{item.unit_cost.toFixed(2)}
        </Text>
      </View>
      <View style={styles.cartItemRight}>
        <Text style={styles.cartItemTotal}>₱{item.total_amount.toFixed(2)}</Text>
        <TouchableOpacity
          style={styles.cartItemRemove}
          onPress={() => removeProductFromPurchase(item.product_id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.cartItemRemoveText}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* ===== FILTERS ===== */}
      <View style={[styles.filterSection, { paddingHorizontal: lo.screenPadding }]}>
        <DateRangeFilter onDateChange={handleDateChange} selectedPreset="this_month" />
        <View style={styles.statusFilterRow}>
          <Text style={styles.statusFilterLabel}>Status:</Text>
          {(['ALL', 'DRAFT', 'RECEIVED'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusChip,
                statusFilter === status && styles.statusChipActive,
              ]}
              onPress={() => setStatusFilter(status)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.statusChipText,
                statusFilter === status && styles.statusChipTextActive,
              ]}>
                {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.filterResultCount}>
          {filteredPurchaseOrders.length} of {purchaseOrders.length} orders
        </Text>
      </View>

      {/* ===== MAIN: PURCHASE ORDER LIST ===== */}
      <FlatList
        data={filteredPurchaseOrders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPurchaseOrder}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Purchase Orders</Text>
            <Text style={styles.emptySubtitle}>
              {purchaseOrders.length > 0 ? 'Try adjusting your filters' : 'Tap the button below to create one'}
            </Text>
          </View>
        }
      />

      {/* Bottom: New PO Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.newPoButton} onPress={openCreateDialog} activeOpacity={0.8}>
          <Text style={styles.newPoButtonText}>+ New Purchase Order</Text>
        </TouchableOpacity>
      </View>

      {/* ===== MODAL: CREATE/EDIT PURCHASE ORDER (Full Screen) ===== */}
      <Modal visible={createDialogVisible} animationType="slide" onRequestClose={closeCreateDialog}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeCreateDialog} style={styles.modalHeaderBtn}>
              <Text style={styles.modalHeaderBtnText}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{isEditing ? 'Edit PO' : 'New PO'}</Text>
            <TouchableOpacity onPress={savePurchaseOrder} style={styles.modalHeaderBtn} disabled={loading}>
              <Text style={[styles.modalHeaderBtnText, { color: '#2196F3' }]}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Supplier Row */}
          <View style={styles.supplierSection}>
            <View style={styles.supplierInputWrapper}>
              {selectedSupplier && !supplierMenuVisible ? (
                <TouchableOpacity
                  style={styles.supplierSelector}
                  onPress={() => {
                    setSupplierMenuVisible(true);
                    setSupplierSearchQuery('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.supplierSelectedText}>{selectedSupplier.name}</Text>
                  <Text style={styles.supplierChevron}>▼</Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  placeholder="Search supplier..."
                  value={supplierSearchQuery}
                  onChangeText={(text) => {
                    setSupplierSearchQuery(text);
                    setSupplierMenuVisible(true);
                  }}
                  onFocus={() => setSupplierMenuVisible(true)}
                  mode="outlined"
                  style={styles.supplierSearchInput}
                  dense
                  left={<TextInput.Icon icon="magnify" />}
                  right={supplierMenuVisible ? (
                    <TextInput.Icon icon="close" onPress={() => {
                      setSupplierMenuVisible(false);
                      setSupplierSearchQuery('');
                    }} />
                  ) : undefined}
                  autoFocus={supplierMenuVisible && !selectedSupplier}
                />
              )}

              {supplierMenuVisible && (
                <View style={styles.supplierDropdown}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                    {filteredSuppliers.map(supplier => (
                      <TouchableOpacity
                        key={supplier.id}
                        style={styles.supplierDropdownItem}
                        onPress={() => {
                          setSelectedSupplier(supplier);
                          setSupplierMenuVisible(false);
                          setSupplierSearchQuery('');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.supplierDropdownName}>{supplier.name}</Text>
                        {supplier.code && <Text style={styles.supplierDropdownCode}>{supplier.code}</Text>}
                      </TouchableOpacity>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <View style={styles.supplierDropdownEmpty}>
                        <Text style={{ color: '#9E9E9E', fontSize: 13 }}>No suppliers found</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.supplierAddBtn}
              onPress={() => setQuickAddSupplierVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.supplierAddBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar (like SalesScreen) */}
          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrapper}>
                <TextInput
                  ref={searchInputRef as any}
                  placeholder="Search product to add..."
                  value={productSearchQuery}
                  onChangeText={setProductSearchQuery}
                  onSubmitEditing={handleSearchSubmit}
                  mode="outlined"
                  style={styles.searchInput}
                  dense
                  left={<TextInput.Icon icon="magnify" />}
                  right={productSearchQuery ? (
                    <TextInput.Icon icon="close" onPress={() => setProductSearchQuery('')} />
                  ) : undefined}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />

                {/* Search Dropdown */}
                {productSearchQuery.length > 0 && filteredProducts.length > 0 && (
                  <View style={styles.searchDropdown}>
                    <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                      {filteredProducts.slice(0, 10).map((product) => (
                        <TouchableOpacity
                          key={product.id}
                          style={styles.searchDropdownItem}
                          onPress={() => addProductInline(product)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.searchDropdownName}>{product.name}</Text>
                            <Text style={styles.searchDropdownDetail}>
                              {product.code} | Stock: {product.stock_quantity} | Cost: ₱{product.cost.toFixed(2)}
                            </Text>
                          </View>
                          <Text style={styles.searchDropdownAdd}>+</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.iconBtn} onPress={handleBarcodeScanInline} activeOpacity={0.7}>
                <Text style={styles.iconBtnText}>📷</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: '#E8F5E9' }]}
                onPress={() => setQuickAddProductVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.iconBtnText, { fontSize: 20 }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Details Toggle */}
          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => setShowDetails(!showDetails)}
            activeOpacity={0.7}
          >
            <Text style={styles.detailsToggleText}>
              {showDetails ? '▼' : '▶'} PO Details (Ref#, Date, Terms)
            </Text>
          </TouchableOpacity>

          {showDetails && (
            <View style={styles.detailsSection}>
              <TextInput
                label="Reference Number"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                mode="outlined"
                style={styles.detailInput}
                dense
              />
              <TextInput
                label="Expected Delivery Date"
                value={expectedDeliveryDate}
                onChangeText={setExpectedDeliveryDate}
                mode="outlined"
                style={styles.detailInput}
                dense
                placeholder="YYYY-MM-DD"
              />
              <View style={styles.quickDateRow}>
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Tomorrow', days: 1 },
                  { label: '+7 Days', days: 7 },
                  { label: '+30 Days', days: 30 },
                ].map(({ label, days }) => (
                  <TouchableOpacity
                    key={label}
                    style={styles.quickDateChip}
                    onPress={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      setExpectedDeliveryDate(d.toISOString().split('T')[0]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickDateChipText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                label="Payment Terms"
                value={paymentTerms}
                onChangeText={setPaymentTerms}
                mode="outlined"
                style={styles.detailInput}
                dense
              />
              <TextInput
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                style={styles.detailInput}
                dense
                multiline
                numberOfLines={2}
              />
            </View>
          )}

          {/* Items List (Cart-style) */}
          <View style={styles.itemsSection}>
            <View style={styles.itemsHeader}>
              <Text style={styles.itemsTitle}>Items ({purchaseItems.length})</Text>
              {purchaseItems.length > 0 && (
                <TouchableOpacity onPress={() => setPurchaseItems([])} style={styles.clearAllBtn}>
                  <Text style={styles.clearAllBtnText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={purchaseItems}
              keyExtractor={(item, index) => `${item.product_id}-${index}`}
              renderItem={renderPurchaseItem}
              style={styles.itemsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyItems}>
                  <Text style={styles.emptyItemsIcon}>📦</Text>
                  <Text style={styles.emptyItemsText}>No items yet</Text>
                  <Text style={styles.emptyItemsSubtext}>Search or scan products above to add</Text>
                </View>
              }
            />
          </View>

          {/* Bottom: Total + Save */}
          <View style={styles.createBottomBar}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>
                ₱{calculatePurchaseTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.saveButton, purchaseItems.length === 0 && styles.saveButtonDisabled]}
              onPress={savePurchaseOrder}
              disabled={purchaseItems.length === 0 || loading}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>
                {isEditing ? 'UPDATE PURCHASE ORDER' : 'SAVE PURCHASE ORDER'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL: RECEIVE PURCHASE ORDER ===== */}
      <Modal visible={receiveDialogVisible} transparent={true} animationType="fade" onRequestClose={() => setReceiveDialogVisible(false)}>
        <View style={styles.overlayContainer}>
          <View style={[styles.overlayCard, { maxWidth: 440 }]}>
            <Text style={styles.overlayTitle}>
              {selectedPurchase?.status === 'RECEIVED' ? 'Received Items' : 'Receive Purchase Order'}
            </Text>
            {selectedPurchase && (
              <>
                <Text style={styles.overlaySubtitle}>
                  {selectedPurchase.purchase_number} - {selectedPurchase.supplier_name}
                </Text>
                {selectedPurchase.status === 'RECEIVED' && (
                  <View style={styles.receivedBadge}>
                    <Text style={styles.receivedBadgeText}>ALL ITEMS RECEIVED</Text>
                  </View>
                )}
                <ScrollView style={{ maxHeight: 300 }}>
                  {selectedPurchase.items?.map((item: any, index: number) => (
                    <View key={index} style={styles.receiveItem}>
                      <Text style={styles.receiveItemName}>{item.product_name}</Text>
                      <Text style={styles.receiveItemDetail}>
                        Ordered: {item.quantity_ordered} | Received: {item.quantity_received} | Pending: {item.quantity_ordered - item.quantity_received}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
            {/* Print / PDF actions for received items */}
            {selectedPurchase?.status === 'RECEIVED' && (
              <View style={styles.receiveExportRow}>
                <TouchableOpacity
                  style={styles.receiveExportBtn}
                  onPress={() => { setReceiveDialogVisible(false); handlePrintPO(selectedPurchase); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.receiveExportBtnText}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.receiveExportBtn, { backgroundColor: '#E3F2FD' }]}
                  onPress={() => { setReceiveDialogVisible(false); handleExportPdf(selectedPurchase); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.receiveExportBtnText, { color: '#1976D2' }]}>PDF / Email</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.overlayActions}>
              <TouchableOpacity style={styles.overlayBtnCancel} onPress={() => setReceiveDialogVisible(false)}>
                <Text style={styles.overlayBtnCancelText}>Close</Text>
              </TouchableOpacity>
              {selectedPurchase?.status !== 'RECEIVED' && selectedPurchase?.status !== 'CANCELLED' && (
                <TouchableOpacity style={styles.overlayBtnConfirm} onPress={receivePurchaseOrder}>
                  <Text style={styles.overlayBtnConfirmText}>{loading ? 'Receiving...' : 'Receive All'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL: QUICK ADD SUPPLIER ===== */}
      <Modal visible={quickAddSupplierVisible} transparent={true} animationType="fade" onRequestClose={() => setQuickAddSupplierVisible(false)}>
        <View style={styles.overlayContainer}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Quick Add Supplier</Text>
            <TextInput label="Supplier Name *" value={newSupplierName} onChangeText={setNewSupplierName} mode="outlined" style={styles.overlayInput} dense autoFocus />
            <TextInput label="Phone Number" value={newSupplierPhone} onChangeText={setNewSupplierPhone} mode="outlined" style={styles.overlayInput} dense keyboardType="phone-pad" />
            <TextInput label="Address" value={newSupplierAddress} onChangeText={setNewSupplierAddress} mode="outlined" style={styles.overlayInput} dense multiline numberOfLines={2} />
            <View style={styles.overlayActions}>
              <TouchableOpacity style={styles.overlayBtnCancel} onPress={() => { setNewSupplierName(''); setNewSupplierPhone(''); setNewSupplierAddress(''); setQuickAddSupplierVisible(false); }}>
                <Text style={styles.overlayBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.overlayBtnConfirm} onPress={handleQuickAddSupplier}>
                <Text style={styles.overlayBtnConfirmText}>Add Supplier</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL: EDIT ITEM ===== */}
      <Modal visible={editItemDialogVisible} transparent={true} animationType="fade" onRequestClose={() => { setEditItemDialogVisible(false); setEditingItemIndex(null); }}>
        <View style={styles.overlayContainer}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Edit Item</Text>
            {editingItemIndex !== null && purchaseItems[editingItemIndex] && (
              <>
                <View style={styles.editItemHeader}>
                  <Text style={styles.editItemHeaderText}>{purchaseItems[editingItemIndex].product_name}</Text>
                </View>
                <TextInput label="Quantity" value={editItemQuantity} onChangeText={setEditItemQuantity} mode="outlined" style={styles.overlayInput} dense keyboardType="numeric" autoFocus />
                <TextInput label="Unit Cost (₱)" value={editItemUnitCost} onChangeText={setEditItemUnitCost} mode="outlined" style={styles.overlayInput} dense keyboardType="numeric" />
              </>
            )}
            <View style={styles.overlayActions}>
              <TouchableOpacity style={styles.overlayBtnCancel} onPress={() => { setEditItemDialogVisible(false); setEditingItemIndex(null); }}>
                <Text style={styles.overlayBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.overlayBtnConfirm} onPress={saveEditedItem}>
                <Text style={styles.overlayBtnConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL: QUICK ADD PRODUCT ===== */}
      <Modal visible={quickAddProductVisible} transparent={true} animationType="fade" onRequestClose={() => { setQuickAddProductVisible(false); setCreateDialogVisible(true); }}>
        <View style={styles.overlayContainer}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Quick Add Product</Text>
            <TextInput label="Product Name *" value={newProductName} onChangeText={setNewProductName} mode="outlined" style={styles.overlayInput} dense autoFocus />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput label="Barcode / Code" value={newProductCode} onChangeText={setNewProductCode} mode="outlined" style={[styles.overlayInput, { flex: 1 }]} dense placeholder="Auto-generate if blank" />
              <TouchableOpacity style={[styles.iconBtn, { marginBottom: 8 }]} onPress={handleScanForQuickAdd} activeOpacity={0.7}>
                <Text style={styles.iconBtnText}>📷</Text>
              </TouchableOpacity>
            </View>
            <TextInput label="Cost Price (₱) *" value={newProductCost} onChangeText={setNewProductCost} mode="outlined" style={styles.overlayInput} dense keyboardType="numeric" />
            <TextInput label="Selling Price (₱) *" value={newProductPrice} onChangeText={setNewProductPrice} mode="outlined" style={styles.overlayInput} dense keyboardType="numeric" />
            <View style={styles.overlayActions}>
              <TouchableOpacity style={styles.overlayBtnCancel} onPress={() => { setNewProductName(''); setNewProductCode(''); setNewProductCost(''); setNewProductPrice(''); setQuickAddProductVisible(false); setCreateDialogVisible(true); }}>
                <Text style={styles.overlayBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.overlayBtnConfirm} onPress={() => { handleQuickAddProduct(); }}>
                <Text style={styles.overlayBtnConfirmText}>Add Product</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },

  // === FILTERS ===
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statusFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 4,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statusChipActive: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },
  filterResultCount: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 6,
  },

  // === PO LIST ===
  listContainer: {
    padding: 12,
    paddingBottom: 80,
  },
  poCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  poCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  poNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  poSupplier: {
    fontSize: 13,
    color: '#616161',
    marginTop: 2,
  },
  poDate: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  poTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  poCardFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  poDetail: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  poCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  poActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  poActionBtnReceive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  poActionBtnPdf: {
    backgroundColor: '#E3F2FD',
    borderColor: '#BBDEFB',
  },
  poActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
  },

  // === EMPTY STATE ===
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
  },

  // === BOTTOM BAR ===
  bottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 8,
  },
  newPoButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  newPoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // === CREATE PO MODAL ===
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalHeaderBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalHeaderBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F44336',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },

  // Supplier Section
  supplierSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  supplierSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  supplierSelectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  supplierPlaceholderText: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  supplierChevron: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  supplierInputWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 999,
  },
  supplierSearchInput: {
    backgroundColor: '#FFFFFF',
  },
  supplierDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 1002,
  },
  supplierDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  supplierDropdownName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  supplierDropdownCode: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 2,
  },
  supplierDropdownEmpty: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  supplierAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supplierAddBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Search Section
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchInputWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 1000,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
  },
  searchDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 1001,
  },
  searchDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  searchDropdownName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  searchDropdownDetail: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 2,
  },
  searchDropdownAdd: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
    paddingLeft: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnText: {
    fontSize: 22,
  },

  // Details Section
  detailsToggle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailsToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
  },
  detailsSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailInput: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  quickDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  quickDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
  },
  quickDateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },

  // Items Section
  itemsSection: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  clearAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
  },
  clearAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
  },
  itemsList: {
    flex: 1,
  },
  emptyItems: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyItemsIcon: {
    fontSize: 48,
    opacity: 0.4,
    marginBottom: 12,
  },
  emptyItemsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  emptyItemsSubtext: {
    fontSize: 13,
    color: '#BDBDBD',
    marginTop: 4,
  },

  // Cart Item
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cartItemLeft: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cartItemIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976D2',
  },
  cartItemCenter: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  cartItemDetail: {
    fontSize: 12,
    color: '#616161',
    marginTop: 2,
  },
  cartItemRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  cartItemRemove: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cartItemRemoveText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },

  // Bottom Bar (Create PO)
  createBottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E7D32',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // === OVERLAY MODALS ===
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    padding: 20,
    elevation: 8,
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
    textAlign: 'center',
  },
  overlaySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
    textAlign: 'center',
    marginBottom: 12,
  },
  overlayInput: {
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  overlayActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  overlayBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  overlayBtnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
  },
  overlayBtnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  overlayBtnConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Receive Item
  receiveItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  receiveItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  receiveItemDetail: {
    fontSize: 12,
    color: '#616161',
  },
  receivedBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  receivedBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  receiveExportRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  receiveExportBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  receiveExportBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
  },

  // Edit Item Header
  editItemHeader: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  editItemHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
