import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  ScrollView,
  Platform,
  BackHandler,
  TouchableOpacity,
  Text,
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
  Chip,
  Appbar,
  Menu,
  Divider,
  TouchableRipple,
  Searchbar,
} from 'react-native-paper';
import { StableTextInput } from '../components/StableTextInput';
// Conditionally import camera - not available on web
let CameraView: any = null;
let Camera: any = null;
if (Platform.OS !== 'web') {
  const cameraModule = require('expo-camera');
  CameraView = cameraModule.CameraView;
  Camera = cameraModule.Camera;
}
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Product as BaseProduct, Category, Brand, Unit, Size } from '../database/schema';

interface Product extends BaseProduct {
  category_name?: string;
  brand_name?: string;
  unit_name?: string;
  unit_abbreviation?: string;
  size_name?: string;
}

type ProductsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Products'
>;

type Props = {
  navigation: ProductsScreenNavigationProp;
};

export default function ProductsScreen({ navigation }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    price: '',
    cost: '',
    stock_quantity: '',
    reorder_level: '',
    category_id: null as number | null,
    brand_id: null as number | null,
    unit_id: null as number | null,
    size_id: null as number | null,
    unit: 'pcs',
    vat_type: 'vatable' as 'vatable' | 'vat_exempt' | 'zero_rated',
    tax_rate: '12.00',
    is_vat_inclusive: true,
    is_active: true,
  });
  const [scannerVisible, setScannerVisible] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scannerMode, setScannerMode] = useState<'search' | 'fill'>('search'); // 'search' = search products, 'fill' = fill code field

  // Dropdown modal states
  const [activeDropdown, setActiveDropdown] = useState<'category' | 'brand' | 'unit' | 'size' | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState('');

  // Quick Add dialog states
  const [quickAddType, setQuickAddType] = useState<'category' | 'brand' | 'unit' | 'size' | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddAbbreviation, setQuickAddAbbreviation] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  // Initial form data for tracking unsaved changes
  const [initialFormData, setInitialFormData] = useState(formData);

  // Safe area insets for FAB positioning
  const insets = useSafeAreaInsets();

  // Filter states
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);
  const [filterBrandId, setFilterBrandId] = useState<number | null>(null);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  const theme = useTheme();

  useEffect(() => {
    loadProducts();
    loadMasterData();
    getCameraPermissions();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadProducts(searchQuery.trim() || undefined);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const getCameraPermissions = async () => {
    // Camera not available on web
    if (Platform.OS === 'web' || !Camera) {
      setHasPermission(false);
      return;
    }
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const loadMasterData = async () => {
    try {
      const dbService = getDatabase();
      const [categoryList, brandList, unitList, sizeList] = await Promise.all([
        dbService.getCategories(true),
        dbService.getBrands(true),
        dbService.getUnits(true),
        dbService.getSizes(true),
      ]);
      setCategories(categoryList);
      setBrands(brandList);
      setUnits(unitList);
      setSizes(sizeList);
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  };

  const loadProducts = async (searchTerm?: string) => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      // When searching, allow unlimited results; when browsing, limit to 100 for performance
      const limit = searchTerm && searchTerm.trim() !== '' ? undefined : 100;
      const rawProductList = await dbService.getProductsWithDetails(false, limit, searchTerm);
      console.log(`ProductsScreen: Loaded ${rawProductList.length} products${searchTerm ? ` (search: "${searchTerm}")` : ' (browsing)'}`);
      setProducts(rawProductList as Product[]);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      price: '',
      cost: '',
      stock_quantity: '',
      reorder_level: '',
      category_id: null,
      brand_id: null,
      unit_id: null,
      size_id: null,
      unit: 'pcs',
      vat_type: 'vatable' as 'vatable' | 'vat_exempt' | 'zero_rated',
      tax_rate: '12.00',
      is_vat_inclusive: true,
      is_active: true,
    });
    setEditingProduct(null);
  };

  const handleAddProduct = () => {
    const emptyForm = {
      code: '',
      name: '',
      description: '',
      price: '',
      cost: '',
      stock_quantity: '',
      reorder_level: '',
      category_id: null as number | null,
      brand_id: null as number | null,
      unit_id: null as number | null,
      size_id: null as number | null,
      unit: 'pcs',
      vat_type: 'vatable' as 'vatable' | 'vat_exempt' | 'zero_rated',
      tax_rate: '12.00',
      is_vat_inclusive: true,
      is_active: true,
    };
    setFormData(emptyForm);
    setInitialFormData(emptyForm);
    setEditingProduct(null);
    setDialogVisible(true);
  };

  const handleEditProduct = (product: Product) => {
    console.log('Editing product:', product);
    const editForm = {
      code: product.code || product.barcode || '',
      name: product.name || '',
      description: product.description || '',
      price: (product.price || product.selling_price || 0).toString(),
      cost: (product.cost || product.cost_price || 0).toString(),
      stock_quantity: (product.stock_quantity || 0).toString(),
      reorder_level: (product.reorder_level || 0).toString(),
      category_id: product.category_id || null,
      brand_id: product.brand_id || null,
      unit_id: product.unit_id || null,
      size_id: product.size_id || null,
      unit: product.unit || product.unit_abbreviation || 'pcs',
      vat_type: (product.vat_type || 'vatable') as 'vatable' | 'vat_exempt' | 'zero_rated',
      tax_rate: (product.tax_rate || 12).toString(),
      is_vat_inclusive: product.is_vat_inclusive ?? true,
      is_active: product.is_active ?? true,
    };
    setFormData(editForm);
    setInitialFormData(editForm);
    setEditingProduct(product);
    setDialogVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!formData.code || !formData.name || !formData.price) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate price and cost are valid numbers
    const price = parseFloat(formData.price);
    const cost = parseFloat(formData.cost) || 0;
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    if (cost < 0) {
      Alert.alert('Error', 'Cost cannot be negative');
      return;
    }

    // Validate stock quantity and reorder level
    const stockQty = parseInt(formData.stock_quantity) || 0;
    const reorderLevel = parseInt(formData.reorder_level) || 0;
    if (stockQty < 0) {
      Alert.alert('Error', 'Stock quantity cannot be negative');
      return;
    }
    if (reorderLevel < 0) {
      Alert.alert('Error', 'Reorder level cannot be negative');
      return;
    }

    // Validate tax rate
    const taxRate = parseFloat(formData.tax_rate);
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      Alert.alert('Error', 'Tax rate must be between 0 and 100');
      return;
    }

    setLoading(true);
    try {
      const dbService = getDatabase();

      // Check for duplicate product code or name
      const existingProducts = await dbService.getProducts();
      const duplicateCode = existingProducts.find(
        (p: any) => p.code.toLowerCase() === formData.code.trim().toLowerCase() &&
        (!editingProduct || p.id !== editingProduct.id)
      );

      if (duplicateCode) {
        Alert.alert('Error', `Product code "${formData.code}" already exists. Please use a unique code.`);
        setLoading(false);
        return;
      }

      const duplicateName = existingProducts.find(
        (p: any) => p.name.toLowerCase() === formData.name.trim().toLowerCase() &&
        (!editingProduct || p.id !== editingProduct.id)
      );

      if (duplicateName) {
        Alert.alert('Error', `Product name "${formData.name}" already exists. Please use a unique name.`);
        setLoading(false);
        return;
      }

      const productData = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        price: price,
        cost: cost,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        reorder_level: parseInt(formData.reorder_level) || 0,
        category_id: formData.category_id,
        brand_id: formData.brand_id,
        unit_id: formData.unit_id,
        size_id: formData.size_id,
        unit: formData.unit,
        vat_type: formData.vat_type,
        tax_rate: formData.vat_type === 'vatable' ? parseFloat(formData.tax_rate) : 0,
        is_vat_inclusive: formData.vat_type === 'vatable' ? formData.is_vat_inclusive : false,
        is_active: formData.is_active,
      };

      if (editingProduct) {
        await dbService.updateProductWithDetails(editingProduct.id, productData);
        Alert.alert('Success', 'Product updated successfully');
      } else {
        await dbService.createProductWithDetails(productData);
        Alert.alert('Success', 'Product added successfully');
      }

      setDialogVisible(false);
      resetForm();
      await loadProducts(searchQuery.trim() || undefined);
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setScannerVisible(false);

    // If in 'fill' mode (opened from Add/Edit dialog), just fill the code field
    if (scannerMode === 'fill') {
      setFormData(prev => ({ ...prev, code: data }));
      setDialogVisible(true); // Reopen the dialog
      setTimeout(() => setScanned(false), 500);
      return;
    }

    // In 'search' mode - search for existing product with this barcode
    const existingProduct = products.find(p => p.code === data);

    if (existingProduct) {
      // If product exists, show it
      setSearchQuery(data);
      Alert.alert(
        'Product Found',
        `Found existing product: ${existingProduct.name}`,
        [
          { text: 'View Product', onPress: () => {} },
          { text: 'Edit Product', onPress: () => handleEditProduct(existingProduct) }
        ]
      );
    } else {
      // If product doesn't exist, offer to create new one
      Alert.alert(
        'New Product',
        `Barcode scanned: ${data}\n\nThis product doesn't exist yet. Would you like to create it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Product',
            onPress: () => {
              resetForm();
              setFormData(prev => ({ ...prev, code: data }));
              setDialogVisible(true);
            }
          }
        ]
      );
    }

    // Reset scanner state after a delay
    setTimeout(() => setScanned(false), 2000);
  };

  const handleScannerPress = (mode: 'search' | 'fill' = 'search') => {
    if (hasPermission === null) {
      Alert.alert('Permission', 'Requesting camera permission...');
      getCameraPermissions();
      return;
    }

    if (hasPermission === false) {
      Alert.alert(
        'Camera Permission',
        'Camera permission is required for barcode scanning. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => getCameraPermissions() }
        ]
      );
      return;
    }

    setScannerMode(mode);
    setScannerVisible(true);
    setScanned(false);
  };

  const handleToggleActive = async (product: Product) => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      await dbService.toggleProductActive(product.id);

      Alert.alert(
        'Success',
        `Product "${product.name}" has been ${product.is_active ? 'deactivated' : 'activated'}`
      );

      await loadProducts(searchQuery.trim() || undefined);
    } catch (error) {
      console.error('Error toggling product status:', error);
      Alert.alert('Error', 'Failed to update product status');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to products
  const filteredProducts = products.filter(product => {
    if (filterCategoryId && product.category_id !== filterCategoryId) return false;
    if (filterBrandId && product.brand_id !== filterBrandId) return false;
    return true;
  });

  // Get display names for dropdowns
  const getSelectedCategoryName = () => {
    if (!formData.category_id) return 'Select Category';
    const category = categories.find(c => c.id === formData.category_id);
    return category ? category.name : 'Select Category';
  };

  const getSelectedBrandName = () => {
    if (!formData.brand_id) return 'Select Brand';
    const brand = brands.find(b => b.id === formData.brand_id);
    return brand ? brand.name : 'Select Brand';
  };

  const getSelectedUnitName = () => {
    if (!formData.unit_id) return 'Select Unit';
    const unit = units.find(u => u.id === formData.unit_id);
    return unit ? `${unit.name} (${unit.abbreviation})` : 'Select Unit';
  };

  const getSelectedSizeName = () => {
    if (!formData.size_id) return 'Select Size';
    const size = sizes.find(s => s.id === formData.size_id);
    return size ? size.name : 'Select Size';
  };

  // Filter display names
  const getFilterCategoryName = () => {
    if (!filterCategoryId) return 'All Categories';
    const category = categories.find(c => c.id === filterCategoryId);
    return category ? category.name : 'All Categories';
  };

  const getFilterBrandName = () => {
    if (!filterBrandId) return 'All Brands';
    const brand = brands.find(b => b.id === filterBrandId);
    return brand ? brand.name : 'All Brands';
  };

  // Filter functions for dropdown search
  const getFilteredCategories = () => {
    if (!dropdownSearch) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(dropdownSearch.toLowerCase()));
  };

  const getFilteredBrands = () => {
    if (!dropdownSearch) return brands;
    return brands.filter(b => b.name.toLowerCase().includes(dropdownSearch.toLowerCase()));
  };

  const getFilteredUnits = () => {
    if (!dropdownSearch) return units;
    return units.filter(u =>
      u.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
      u.abbreviation.toLowerCase().includes(dropdownSearch.toLowerCase())
    );
  };

  const getFilteredSizes = () => {
    if (!dropdownSearch) return sizes;
    return sizes.filter(s => s.name.toLowerCase().includes(dropdownSearch.toLowerCase()));
  };

  // Check for unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  // Handle dialog dismiss with confirmation
  const handleDialogDismiss = useCallback(() => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => setDialogVisible(false) }
        ]
      );
    } else {
      setDialogVisible(false);
    }
  }, [hasUnsavedChanges]);

  // Close dropdown modal
  const closeDropdown = () => {
    setActiveDropdown(null);
    setDropdownSearch('');
  };

  // Quick Add handlers
  const openQuickAdd = (type: 'category' | 'brand' | 'unit' | 'size') => {
    // Close dropdown first so Quick Add dialog is visible
    setActiveDropdown(null);
    setDropdownSearch('');
    // Then open Quick Add dialog
    setQuickAddType(type);
    setQuickAddName('');
    setQuickAddAbbreviation('');
  };

  const closeQuickAdd = () => {
    setQuickAddType(null);
    setQuickAddName('');
    setQuickAddAbbreviation('');
  };

  const handleQuickAdd = async () => {
    if (!quickAddName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (quickAddType === 'unit' && !quickAddAbbreviation.trim()) {
      Alert.alert('Error', 'Abbreviation is required for units');
      return;
    }

    setQuickAddLoading(true);
    try {
      const dbService = getDatabase();
      let newId: number | undefined;

      switch (quickAddType) {
        case 'category':
          newId = await dbService.createCategory({ name: quickAddName.trim() });
          setFormData(prev => ({ ...prev, category_id: newId || null }));
          break;
        case 'brand':
          newId = await dbService.createBrand({ name: quickAddName.trim() });
          setFormData(prev => ({ ...prev, brand_id: newId || null }));
          break;
        case 'unit':
          newId = await dbService.createUnit({
            name: quickAddName.trim(),
            abbreviation: quickAddAbbreviation.trim()
          });
          setFormData(prev => ({
            ...prev,
            unit_id: newId || null,
            unit: quickAddAbbreviation.trim()
          }));
          break;
        case 'size':
          newId = await dbService.createSize({ name: quickAddName.trim() });
          setFormData(prev => ({ ...prev, size_id: newId || null }));
          break;
      }

      // Reload master data to include new item
      await loadMasterData();

      Alert.alert('Success', `${quickAddType?.charAt(0).toUpperCase()}${quickAddType?.slice(1)} added successfully`);
      closeQuickAdd();
      closeDropdown();
    } catch (error: any) {
      console.error('Error in quick add:', error);
      if (error.message?.includes('UNIQUE constraint')) {
        Alert.alert('Error', 'An item with this name already exists');
      } else {
        Alert.alert('Error', 'Failed to add item');
      }
    } finally {
      setQuickAddLoading(false);
    }
  };

  const getQuickAddTitle = () => {
    switch (quickAddType) {
      case 'category': return 'Quick Add Category';
      case 'brand': return 'Quick Add Brand';
      case 'unit': return 'Quick Add Unit';
      case 'size': return 'Quick Add Size';
      default: return 'Quick Add';
    }
  };

  // BackHandler effect for dialog
  useEffect(() => {
    if (!dialogVisible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hasUnsavedChanges()) {
        Alert.alert(
          'Discard Changes?',
          'You have unsaved changes. Are you sure you want to discard them?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => setDialogVisible(false) }
          ]
        );
        return true;
      }
      setDialogVisible(false);
      return true;
    });

    return () => backHandler.remove();
  }, [dialogVisible, hasUnsavedChanges]);

  const renderProduct = ({ item }: { item: Product }) => (
    <Card style={[
      styles.productCard,
      !item.is_active && styles.inactiveProductCard
    ]}>
      <Card.Content>
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Title style={[
              styles.productName,
              !item.is_active && styles.inactiveText
            ]}>
              {item.name}
              {!item.is_active && ' (Inactive)'}
            </Title>
            <Paragraph style={styles.productCode}>Code: {item.code}</Paragraph>
            <View style={styles.chipRow}>
              {item.category_name && (
                <Chip compact style={styles.categoryChip} textStyle={styles.chipTextSmall}>
                  {item.category_name}
                </Chip>
              )}
              {item.brand_name && (
                <Chip compact style={styles.brandChip} textStyle={styles.chipTextSmall}>
                  {item.brand_name}
                </Chip>
              )}
              {item.size_name && item.size_name !== 'N/A' && (
                <Chip compact style={styles.sizeChip} textStyle={styles.chipTextSmall}>
                  {item.size_name}
                </Chip>
              )}
            </View>
            {!item.is_active && (
              <Chip compact style={styles.inactiveChip} icon="eye-off">
                Inactive
              </Chip>
            )}
          </View>
          <View style={styles.productActions}>
            <IconButton
              icon={item.is_active ? "eye" : "eye-off"}
              size={20}
              iconColor={item.is_active ? "#4CAF50" : "#F44336"}
              onPress={() => handleToggleActive(item)}
            />
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => handleEditProduct(item)}
            />
          </View>
        </View>

        <View style={styles.productDetails}>
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Status:</Paragraph>
            <Paragraph style={[
              styles.value,
              item.is_active ? styles.activeStatus : styles.inactiveStatus
            ]}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Paragraph>
          </View>
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Price:</Paragraph>
            <Paragraph style={styles.value}>P{(item.price || item.selling_price || 0).toFixed(2)}</Paragraph>
          </View>
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Stock:</Paragraph>
            <Paragraph style={[
              styles.value,
              item.stock_quantity <= (item.reorder_level || 10) ? styles.lowStock : null
            ]}>
              {item.stock_quantity} {item.unit_abbreviation || item.unit}
              {item.stock_quantity <= (item.reorder_level || 10) && ' (Low)'}
            </Paragraph>
          </View>
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>VAT:</Paragraph>
            <Paragraph style={styles.value}>
              {item.vat_type === 'vatable'
                ? `VATable 12% (${item.is_vat_inclusive ? 'Incl' : 'Excl'})`
                : item.vat_type === 'vat_exempt'
                  ? 'VAT-Exempt'
                  : 'Zero-Rated'}
            </Paragraph>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <TextInput
            label="Search Products / Scan Barcode"
            value={searchQuery}
            onChangeText={setSearchQuery}
            mode="outlined"
            style={styles.searchInput}
            placeholder="Type product name or scan barcode..."
            right={
              <View style={styles.searchIcons}>
                <TextInput.Icon
                  icon="barcode-scan"
                  onPress={() => handleScannerPress('search')}
                />
                {searchQuery.length > 0 && (
                  <TextInput.Icon
                    icon="close"
                    onPress={() => setSearchQuery('')}
                  />
                )}
              </View>
            }
          />

          {/* Filter Row */}
          <View style={styles.filterRow}>
            <Menu
              visible={filterMenuVisible}
              onDismiss={() => setFilterMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setFilterMenuVisible(true)}
                  compact
                  style={styles.filterButton}
                  icon="filter-variant"
                >
                  Filters
                </Button>
              }
              contentStyle={styles.menuContent}
              style={{ backgroundColor: '#ffffff' }}
            >
              <Menu.Item title="Category" disabled style={styles.menuItem} titleStyle={{ color: '#333333' }} />
              <Menu.Item
                title="All Categories"
                onPress={() => { setFilterCategoryId(null); setFilterMenuVisible(false); }}
                leadingIcon={filterCategoryId === null ? 'check' : undefined}
                style={styles.menuItem}
                titleStyle={{ color: '#333333' }}
              />
              {categories.map(cat => (
                <Menu.Item
                  key={cat.id}
                  title={cat.name}
                  onPress={() => { setFilterCategoryId(cat.id); setFilterMenuVisible(false); }}
                  leadingIcon={filterCategoryId === cat.id ? 'check' : undefined}
                  style={styles.menuItem}
                  titleStyle={{ color: '#333333' }}
                />
              ))}
              <Divider />
              <Menu.Item title="Brand" disabled style={styles.menuItem} titleStyle={{ color: '#333333' }} />
              <Menu.Item
                title="All Brands"
                onPress={() => { setFilterBrandId(null); setFilterMenuVisible(false); }}
                leadingIcon={filterBrandId === null ? 'check' : undefined}
                style={styles.menuItem}
                titleStyle={{ color: '#333333' }}
              />
              {brands.map(brand => (
                <Menu.Item
                  key={brand.id}
                  title={brand.name}
                  onPress={() => { setFilterBrandId(brand.id); setFilterMenuVisible(false); }}
                  leadingIcon={filterBrandId === brand.id ? 'check' : undefined}
                  style={styles.menuItem}
                  titleStyle={{ color: '#333333' }}
                />
              ))}
            </Menu>

            {(filterCategoryId || filterBrandId) && (
              <View style={styles.activeFilters}>
                {filterCategoryId && (
                  <Chip
                    compact
                    onClose={() => setFilterCategoryId(null)}
                    style={styles.filterChip}
                  >
                    {getFilterCategoryName()}
                  </Chip>
                )}
                {filterBrandId && (
                  <Chip
                    compact
                    onClose={() => setFilterBrandId(null)}
                    style={styles.filterChip}
                  >
                    {getFilterBrandName()}
                  </Chip>
                )}
              </View>
            )}
          </View>

          {!searchQuery && (
            <Paragraph style={styles.performanceNote}>
              Showing first 100 products for performance. Use search to access all products.
            </Paragraph>
          )}
          {searchQuery && (
            <Paragraph style={styles.searchInfo}>
              Searching for "{searchQuery}" - {filteredProducts.length} result(s)
            </Paragraph>
          )}
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProduct}
          style={styles.productList}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadProducts(searchQuery.trim() || undefined);
            await loadMasterData();
            setRefreshing(false);
          }}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Paragraph style={styles.emptyText}>
                {searchQuery ? 'No products found matching your search' : 'No products available'}
              </Paragraph>
              <Button mode="outlined" onPress={handleAddProduct}>
                Add First Product
              </Button>
            </View>
          }
        />
      </View>

      <FAB
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        icon="plus"
        label="Add Product"
        onPress={handleAddProduct}
      />

      {/* Add/Edit Product Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleDialogDismiss} style={styles.dialog}>
          <Dialog.Title>
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView showsVerticalScrollIndicator={true}>
              <View style={styles.dialogContent}>
                <TextInput
                  label="Product Code / Barcode *"
                  value={formData.code}
                  onChangeText={(text) => setFormData(prev => ({...prev, code: text}))}
                  mode="outlined"
                  style={styles.input}
                  right={
                    <TextInput.Icon
                      icon="barcode-scan"
                      onPress={() => {
                        setDialogVisible(false);
                        handleScannerPress('fill'); // Use 'fill' mode to just fill the code field
                      }}
                    />
                  }
                />

                <StableTextInput
                  label="Product Name *"
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({...prev, name: text}))}
                  mode="outlined"
                  style={styles.input}
                />

                <StableTextInput
                  label="Description"
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({...prev, description: text}))}
                  mode="outlined"
                  multiline
                  style={styles.input}
                />

                {/* Category Dropdown Button */}
                <View style={styles.dropdownContainer}>
                  <Paragraph style={styles.dropdownLabel}>Category</Paragraph>
                  <TouchableRipple
                    onPress={() => setActiveDropdown('category')}
                    style={styles.dropdownButton}
                  >
                    <View style={styles.dropdownButtonContent}>
                      <Paragraph style={styles.dropdownText}>{getSelectedCategoryName()}</Paragraph>
                      <IconButton icon="menu-down" size={20} style={styles.dropdownIcon} />
                    </View>
                  </TouchableRipple>
                </View>

                {/* Brand Dropdown Button */}
                <View style={styles.dropdownContainer}>
                  <Paragraph style={styles.dropdownLabel}>Brand</Paragraph>
                  <TouchableRipple
                    onPress={() => setActiveDropdown('brand')}
                    style={styles.dropdownButton}
                  >
                    <View style={styles.dropdownButtonContent}>
                      <Paragraph style={styles.dropdownText}>{getSelectedBrandName()}</Paragraph>
                      <IconButton icon="menu-down" size={20} style={styles.dropdownIcon} />
                    </View>
                  </TouchableRipple>
                </View>

                {/* Unit Dropdown Button */}
                <View style={styles.dropdownContainer}>
                  <Paragraph style={styles.dropdownLabel}>Unit of Measure</Paragraph>
                  <TouchableRipple
                    onPress={() => setActiveDropdown('unit')}
                    style={styles.dropdownButton}
                  >
                    <View style={styles.dropdownButtonContent}>
                      <Paragraph style={styles.dropdownText}>{getSelectedUnitName()}</Paragraph>
                      <IconButton icon="menu-down" size={20} style={styles.dropdownIcon} />
                    </View>
                  </TouchableRipple>
                </View>

                {/* Size Dropdown Button */}
                <View style={styles.dropdownContainer}>
                  <Paragraph style={styles.dropdownLabel}>Size</Paragraph>
                  <TouchableRipple
                    onPress={() => setActiveDropdown('size')}
                    style={styles.dropdownButton}
                  >
                    <View style={styles.dropdownButtonContent}>
                      <Paragraph style={styles.dropdownText}>{getSelectedSizeName()}</Paragraph>
                      <IconButton icon="menu-down" size={20} style={styles.dropdownIcon} />
                    </View>
                  </TouchableRipple>
                </View>

                <View style={styles.row}>
                  <TextInput
                    label="Selling Price *"
                    value={formData.price}
                    onChangeText={(text) => setFormData(prev => ({...prev, price: text}))}
                    mode="outlined"
                    keyboardType="numeric"
                    style={[styles.input, styles.halfWidth]}
                    left={<TextInput.Affix text="P" />}
                  />

                  <TextInput
                    label="Cost Price"
                    value={formData.cost}
                    onChangeText={(text) => setFormData(prev => ({...prev, cost: text}))}
                    mode="outlined"
                    keyboardType="numeric"
                    style={[styles.input, styles.halfWidth]}
                    left={<TextInput.Affix text="P" />}
                  />
                </View>

                <View style={styles.row}>
                  <StableTextInput
                    label={editingProduct ? "Stock Qty (Read Only)" : "Initial Stock Qty"}
                    value={formData.stock_quantity}
                    onChangeText={(text) => setFormData(prev => ({...prev, stock_quantity: text}))}
                    mode="outlined"
                    keyboardType="numeric"
                    style={[styles.input, styles.halfWidth]}
                    disabled={!!editingProduct}
                  />

                  <StableTextInput
                    label="Reorder Level"
                    value={formData.reorder_level}
                    onChangeText={(text) => setFormData(prev => ({...prev, reorder_level: text}))}
                    mode="outlined"
                    keyboardType="numeric"
                    style={[styles.input, styles.halfWidth]}
                  />
                </View>

                {editingProduct && (
                  <Paragraph style={styles.stockNote}>
                    Stock can only be modified through Sales, Purchases, or Inventory Adjustments.
                  </Paragraph>
                )}

                {/* VAT Type Selector */}
                <Paragraph style={styles.sectionLabel}>VAT Type:</Paragraph>
                <View style={styles.vatTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.vatTypeButton,
                      formData.vat_type === 'vatable' && styles.vatTypeButtonActive,
                    ]}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      vat_type: 'vatable',
                      tax_rate: '12.00',
                    }))}
                  >
                    <Text style={[
                      styles.vatTypeButtonText,
                      formData.vat_type === 'vatable' && styles.vatTypeButtonTextActive,
                    ]}>VATable (12%)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.vatTypeButton,
                      formData.vat_type === 'vat_exempt' && styles.vatTypeButtonActive,
                    ]}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      vat_type: 'vat_exempt',
                      tax_rate: '0',
                      is_vat_inclusive: false,
                    }))}
                  >
                    <Text style={[
                      styles.vatTypeButtonText,
                      formData.vat_type === 'vat_exempt' && styles.vatTypeButtonTextActive,
                    ]}>VAT-Exempt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.vatTypeButton,
                      formData.vat_type === 'zero_rated' && styles.vatTypeButtonActive,
                    ]}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      vat_type: 'zero_rated',
                      tax_rate: '0',
                      is_vat_inclusive: false,
                    }))}
                  >
                    <Text style={[
                      styles.vatTypeButtonText,
                      formData.vat_type === 'zero_rated' && styles.vatTypeButtonTextActive,
                    ]}>Zero-Rated</Text>
                  </TouchableOpacity>
                </View>

                {/* Only show VAT Inclusive toggle for VATable items */}
                {formData.vat_type === 'vatable' && (
                  <View style={styles.switchRow}>
                    <Paragraph>VAT Inclusive:</Paragraph>
                    <Button
                      mode={formData.is_vat_inclusive ? "contained" : "outlined"}
                      compact
                      onPress={() => setFormData({...formData, is_vat_inclusive: !formData.is_vat_inclusive})}
                    >
                      {formData.is_vat_inclusive ? "Yes" : "No"}
                    </Button>
                  </View>
                )}

                <View style={styles.switchRow}>
                  <Paragraph>Active Product:</Paragraph>
                  <Button
                    mode={formData.is_active ? "contained" : "outlined"}
                    compact
                    onPress={() => setFormData({...formData, is_active: !formData.is_active})}
                  >
                    {formData.is_active ? "Active" : "Inactive"}
                  </Button>
                </View>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleSaveProduct}
              loading={loading}
              disabled={loading}
            >
              {editingProduct ? 'Update' : 'Add'} Product
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerContainer}>
          <Appbar.Header>
            <Appbar.BackAction onPress={() => setScannerVisible(false)} />
            <Appbar.Content title="Scan Barcode" />
          </Appbar.Header>

          {hasPermission && (
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
              }}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Paragraph style={styles.scannerText}>
                  {scanned ? 'Barcode scanned! Processing...' : 'Point camera at barcode'}
                </Paragraph>
              </View>
            </CameraView>
          )}

          {!hasPermission && (
            <View style={styles.permissionContainer}>
              <Paragraph style={styles.permissionText}>
                Camera permission is required for barcode scanning
              </Paragraph>
              <Button mode="contained" onPress={getCameraPermissions}>
                Grant Permission
              </Button>
            </View>
          )}
        </View>
      </Modal>

      {/* Category Dropdown Modal */}
      <Modal
        visible={activeDropdown === 'category'}
        transparent
        animationType="fade"
        onRequestClose={closeDropdown}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeDropdown}>
          <View style={styles.dropdownModal}>
            <View style={styles.dropdownHeader}>
              <Title style={styles.dropdownTitle}>Select Category</Title>
              <Button
                mode="contained"
                compact
                icon="plus"
                onPress={() => openQuickAdd('category')}
                style={styles.quickAddButton}
              >
                Quick Add
              </Button>
            </View>
            <Searchbar
              placeholder="Search categories..."
              value={dropdownSearch}
              onChangeText={setDropdownSearch}
              style={styles.dropdownSearchBar}
            />
            <FlatList
              data={[{ id: null, name: 'None' }, ...getFilteredCategories()]}
              keyExtractor={(item) => String(item.id ?? 'none')}
              renderItem={({ item }) => (
                <TouchableRipple
                  style={[
                    styles.dropdownItem,
                    formData.category_id === item.id && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, category_id: item.id });
                    closeDropdown();
                  }}
                >
                  <Paragraph style={styles.dropdownItemText}>{item.name}</Paragraph>
                </TouchableRipple>
              )}
              ListEmptyComponent={<Paragraph style={styles.emptyDropdownText}>No categories found</Paragraph>}
              style={styles.dropdownList}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Brand Dropdown Modal */}
      <Modal
        visible={activeDropdown === 'brand'}
        transparent
        animationType="fade"
        onRequestClose={closeDropdown}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeDropdown}>
          <View style={styles.dropdownModal}>
            <View style={styles.dropdownHeader}>
              <Title style={styles.dropdownTitle}>Select Brand</Title>
              <Button
                mode="contained"
                compact
                icon="plus"
                onPress={() => openQuickAdd('brand')}
                style={styles.quickAddButton}
              >
                Quick Add
              </Button>
            </View>
            <Searchbar
              placeholder="Search brands..."
              value={dropdownSearch}
              onChangeText={setDropdownSearch}
              style={styles.dropdownSearchBar}
            />
            <FlatList
              data={[{ id: null, name: 'None' }, ...getFilteredBrands()]}
              keyExtractor={(item) => String(item.id ?? 'none')}
              renderItem={({ item }) => (
                <TouchableRipple
                  style={[
                    styles.dropdownItem,
                    formData.brand_id === item.id && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, brand_id: item.id });
                    closeDropdown();
                  }}
                >
                  <Paragraph style={styles.dropdownItemText}>{item.name}</Paragraph>
                </TouchableRipple>
              )}
              ListEmptyComponent={<Paragraph style={styles.emptyDropdownText}>No brands found</Paragraph>}
              style={styles.dropdownList}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Unit Dropdown Modal */}
      <Modal
        visible={activeDropdown === 'unit'}
        transparent
        animationType="fade"
        onRequestClose={closeDropdown}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeDropdown}>
          <View style={styles.dropdownModal}>
            <View style={styles.dropdownHeader}>
              <Title style={styles.dropdownTitle}>Select Unit</Title>
              <Button
                mode="contained"
                compact
                icon="plus"
                onPress={() => openQuickAdd('unit')}
                style={styles.quickAddButton}
              >
                Quick Add
              </Button>
            </View>
            <Searchbar
              placeholder="Search units..."
              value={dropdownSearch}
              onChangeText={setDropdownSearch}
              style={styles.dropdownSearchBar}
            />
            <FlatList
              data={[{ id: null, name: 'None', abbreviation: '' }, ...getFilteredUnits()]}
              keyExtractor={(item) => String(item.id ?? 'none')}
              renderItem={({ item }) => (
                <TouchableRipple
                  style={[
                    styles.dropdownItem,
                    formData.unit_id === item.id && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, unit_id: item.id, unit: item.abbreviation || 'pcs' });
                    closeDropdown();
                  }}
                >
                  <Paragraph style={styles.dropdownItemText}>
                    {item.id ? `${item.name} (${item.abbreviation})` : item.name}
                  </Paragraph>
                </TouchableRipple>
              )}
              ListEmptyComponent={<Paragraph style={styles.emptyDropdownText}>No units found</Paragraph>}
              style={styles.dropdownList}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Size Dropdown Modal */}
      <Modal
        visible={activeDropdown === 'size'}
        transparent
        animationType="fade"
        onRequestClose={closeDropdown}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeDropdown}>
          <View style={styles.dropdownModal}>
            <View style={styles.dropdownHeader}>
              <Title style={styles.dropdownTitle}>Select Size</Title>
              <Button
                mode="contained"
                compact
                icon="plus"
                onPress={() => openQuickAdd('size')}
                style={styles.quickAddButton}
              >
                Quick Add
              </Button>
            </View>
            <Searchbar
              placeholder="Search sizes..."
              value={dropdownSearch}
              onChangeText={setDropdownSearch}
              style={styles.dropdownSearchBar}
            />
            <FlatList
              data={[{ id: null, name: 'None' }, ...getFilteredSizes()]}
              keyExtractor={(item) => String(item.id ?? 'none')}
              renderItem={({ item }) => (
                <TouchableRipple
                  style={[
                    styles.dropdownItem,
                    formData.size_id === item.id && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, size_id: item.id });
                    closeDropdown();
                  }}
                >
                  <Paragraph style={styles.dropdownItemText}>{item.name}</Paragraph>
                </TouchableRipple>
              )}
              ListEmptyComponent={<Paragraph style={styles.emptyDropdownText}>No sizes found</Paragraph>}
              style={styles.dropdownList}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Quick Add Dialog */}
      <Portal>
        <Dialog visible={quickAddType !== null} onDismiss={closeQuickAdd}>
          <Dialog.Title>{getQuickAddTitle()}</Dialog.Title>
          <Dialog.Content>
            <StableTextInput
              label="Name *"
              value={quickAddName}
              onChangeText={setQuickAddName}
              mode="outlined"
              style={styles.quickAddInput}
              autoFocus
            />
            {quickAddType === 'unit' && (
              <StableTextInput
                label="Abbreviation *"
                value={quickAddAbbreviation}
                onChangeText={setQuickAddAbbreviation}
                mode="outlined"
                style={styles.quickAddInput}
                placeholder="e.g., pcs, kg, L"
                maxLength={10}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeQuickAdd}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleQuickAdd}
              loading={quickAddLoading}
              disabled={quickAddLoading}
            >
              Add
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchInput: {
    backgroundColor: 'white',
    marginBottom: 0,
  },
  performanceNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  searchInfo: {
    fontSize: 12,
    color: '#2196F3',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  productList: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 100,
  },
  productCard: {
    marginBottom: 12,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  categoryChip: {
    backgroundColor: '#E3F2FD',
    marginRight: 4,
    marginBottom: 4,
  },
  brandChip: {
    backgroundColor: '#F3E5F5',
    marginRight: 4,
    marginBottom: 4,
  },
  sizeChip: {
    backgroundColor: '#FFF3E0',
    marginRight: 4,
    marginBottom: 4,
  },
  chipTextSmall: {
    fontSize: 11,
  },
  productActions: {
    flexDirection: 'row',
  },
  productDetails: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  label: {
    fontSize: 14,
    opacity: 0.7,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  lowStock: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  inactiveChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFEBEE',
    marginTop: 4,
  },
  inactiveProductCard: {
    backgroundColor: '#F5F5F5',
    opacity: 0.8,
  },
  inactiveText: {
    color: '#757575',
  },
  activeStatus: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  inactiveStatus: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  dialog: {
    maxHeight: '90%',
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
  },
  dialogContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  vatTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vatTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  vatTypeButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  vatTypeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  vatTypeButtonTextActive: {
    color: '#fff',
  },
  searchContainer: {
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    marginRight: 8,
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  filterChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  searchIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownContainer: {
    marginBottom: 12,
  },
  dropdownLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 4,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 12,
    paddingVertical: 4,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownIcon: {
    margin: 0,
  },
  menuContent: {
    backgroundColor: '#ffffff',
    maxHeight: 300,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuItem: {
    backgroundColor: '#ffffff',
  },
  // Modal dropdown styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '85%',
    maxHeight: '70%',
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  quickAddButton: {
    marginLeft: 8,
  },
  dropdownSearchBar: {
    marginBottom: 12,
    elevation: 0,
    backgroundColor: '#f5f5f5',
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  emptyDropdownText: {
    textAlign: 'center',
    padding: 20,
    color: '#999',
    fontSize: 14,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  scannerText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  quickAddInput: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  stockNote: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    marginBottom: 12,
    marginTop: -8,
  },
});
