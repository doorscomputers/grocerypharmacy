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
  useTheme,
  Dialog,
  Portal,
  Divider,
  ProgressBar,
  IconButton,
  SegmentedButtons,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import { Product } from '../database/schema';

type InitialInventoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'InitialInventory'
>;

type Props = {
  navigation: InitialInventoryScreenNavigationProp;
};

interface InventoryItem {
  product_id: number;
  product_code: string;
  product_name: string;
  current_quantity: number;
  initial_quantity: number;
  unit_cost: number;
  unit: string;
  status: 'pending' | 'completed';
}

export default function InitialInventoryScreen({ navigation }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [initialQuantity, setInitialQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const theme = useTheme();

  useEffect(() => {
    loadProducts();
    checkSetupStatus();
  }, []);

  const loadProducts = async () => {
    try {
      const dbService = DatabaseService.getInstance();
      const rawProductList = await dbService.getProducts();
      const productList = rawProductList as Product[];
      setProducts(productList);
      initializeInventoryItems(productList);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const initializeInventoryItems = (productList: Product[]) => {
    const items: InventoryItem[] = productList.map(product => ({
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      current_quantity: product.stock_quantity,
      initial_quantity: 0,
      unit_cost: product.cost,
      unit: product.unit,
      status: 'pending'
    }));
    setInventoryItems(items);
  };

  const checkSetupStatus = async () => {
    try {
      const dbService = DatabaseService.getInstance();
      const setupStatus = await dbService.getSetting('initial_inventory_setup');
      setSetupComplete(setupStatus === 'completed');
    } catch (error) {
      console.error('Error checking setup status:', error);
    }
  };

  const handleEditProduct = (product: Product) => {
    const inventoryItem = inventoryItems.find(item => item.product_id === product.id);
    setSelectedProduct(product);
    setInitialQuantity(inventoryItem?.initial_quantity.toString() || '');
    setUnitCost(inventoryItem?.unit_cost.toString() || product.cost.toString());
    setDialogVisible(true);
  };

  const handleUpdateInventory = () => {
    if (!selectedProduct || !initialQuantity || !unitCost) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const quantity = parseInt(initialQuantity);
    const cost = parseFloat(unitCost);

    if (quantity < 0 || cost <= 0) {
      Alert.alert('Error', 'Quantity must be 0 or greater and cost must be greater than 0');
      return;
    }

    setInventoryItems(inventoryItems.map(item =>
      item.product_id === selectedProduct.id
        ? {
            ...item,
            initial_quantity: quantity,
            unit_cost: cost,
            status: 'completed'
          }
        : item
    ));

    setDialogVisible(false);
    setSelectedProduct(null);
    setInitialQuantity('');
    setUnitCost('');
  };

  const handleCompleteSetup = async () => {
    const incompleteItems = inventoryItems.filter(item => item.status === 'pending');
    const completedItems = inventoryItems.filter(item => item.status === 'completed');

    // Show confirmation dialog with summary
    Alert.alert(
      'Complete Initial Inventory Setup',
      `Are you ready to finalize your inventory setup?\n\n` +
      `✅ Completed Items: ${completedItems.length}\n` +
      `⏳ Pending Items: ${incompleteItems.length}\n` +
      `💰 Total Value: ₱${getTotalValue().toFixed(2)}\n\n` +
      `${incompleteItems.length > 0 ?
        '⚠️ Pending items will be set to 0 quantity.\n\n' :
        ''}` +
      `This action will update your product database and cannot be easily undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Yes, Complete Setup',
          onPress: processInventorySetup,
          style: 'default'
        },
      ]
    );
  };

  const processInventorySetup = async () => {
    setLoading(true);

    try {
      const dbService = DatabaseService.getInstance();
      const db = dbService.getDatabase();

      await db.withTransactionAsync(async () => {
        // Update all product quantities and costs
        for (const item of inventoryItems) {
          await db.runAsync(
            'UPDATE products SET stock_quantity = ?, cost = ? WHERE id = ?',
            [item.initial_quantity, item.unit_cost, item.product_id]
          );

          // Only create inventory movement if quantity > 0
          if (item.initial_quantity > 0) {
            await db.runAsync(
              `INSERT INTO inventory_movements (
                product_id, movement_type, quantity, reference_type,
                notes, created_by
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                item.product_id,
                'IN',
                item.initial_quantity,
                'MANUAL_ADJUSTMENT',
                'Initial inventory setup',
                1 // Would get from user context
              ]
            );
          }
        }

        // Mark setup as completed
        const existingSetting = await db.getFirstAsync(
          'SELECT * FROM settings WHERE key = ?',
          ['initial_inventory_setup']
        );

        if (existingSetting) {
          await db.runAsync(
            'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
            ['completed', 'initial_inventory_setup']
          );
        } else {
          await db.runAsync(
            'INSERT INTO settings (key, value, description) VALUES (?, ?, ?)',
            ['initial_inventory_setup', 'completed', 'Initial inventory setup status']
          );
        }

        // Add eJournal entry
        await db.runAsync(
          `INSERT INTO ejournal (entry_type, reference_number, description, cashier_id)
           VALUES (?, ?, ?, ?)`,
          [
            'SYSTEM',
            `SETUP${Date.now()}`,
            'Initial inventory setup completed',
            1
          ]
        );
      });

      Alert.alert(
        'Setup Complete',
        'Initial inventory has been set up successfully. All product quantities have been updated.',
        [
          {
            text: 'View Products',
            onPress: () => navigation.navigate('Products'),
          },
          {
            text: 'Dashboard',
            onPress: () => navigation.navigate('Dashboard'),
          },
        ]
      );

      setSetupComplete(true);
    } catch (error) {
      console.error('Setup error:', error);
      Alert.alert('Error', 'Failed to complete initial inventory setup');
    } finally {
      setLoading(false);
    }
  };

  const getProgressData = () => {
    const completed = inventoryItems.filter(item => item.status === 'completed').length;
    const total = inventoryItems.length;
    const progress = total > 0 ? completed / total : 0;
    return { completed, total, progress };
  };

  const getTotalValue = () => {
    return inventoryItems.reduce((total, item) => total + (item.initial_quantity * item.unit_cost), 0);
  };

  const filteredProducts = products.filter(product => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      return false; // Don't show any products until user types 3+ characters
    }
    const query = searchQuery.toLowerCase().trim();
    const name = (product.name || '').toLowerCase();
    const code = (product.code || '').toLowerCase();
    return name.includes(query) || code.includes(query);
  });

  const progressData = getProgressData();
  const completedItems = inventoryItems
    .filter(item => item.status === 'completed')
    .sort((a, b) => a.product_name.localeCompare(b.product_name)); // Auto-sort alphabetically

  const renderSearchTab = () => (
    <>
      <TextInput
        label="Search Products / Scan Barcode"
        value={searchQuery}
        onChangeText={setSearchQuery}
        mode="outlined"
        style={styles.searchInput}
        placeholder="Type product name, code, or scan barcode..."
        autoCapitalize="none"
        autoCorrect={false}
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

      {/* Search guidance and results */}
      {!searchQuery.trim() ? (
        <Paragraph style={styles.searchGuidance}>
          💡 Type at least 3 characters to search for products
        </Paragraph>
      ) : searchQuery.trim().length < 3 ? (
        <Paragraph style={styles.searchGuidance}>
          ⌨️ Type {3 - searchQuery.trim().length} more character(s) to search...
        </Paragraph>
      ) : (
        <Paragraph style={styles.searchIndicator}>
          🔍 Found {filteredProducts.length} result(s) for "{searchQuery}"
        </Paragraph>
      )}

      {/* Debug info */}
      <Paragraph style={styles.debugText}>
        Debug: v2.1.8 Tabs - Products: {products.length}, Filtered: {filteredProducts.length}, Query: "{searchQuery}" ({searchQuery.length} chars)
      </Paragraph>

      {/* Spacing before product list */}
      <View style={styles.productListSpacer} />

      {/* Product list or empty state */}
      {searchQuery.trim().length >= 3 ? (
        filteredProducts.length > 0 ? (
          <View style={styles.productList}>
            {filteredProducts.map((item) => {
              const inventoryItem = inventoryItems.find(inv => inv.product_id === item.id);
              const isCompleted = inventoryItem?.status === 'completed';

              return (
                <List.Item
                  key={item.id.toString()}
                  title={item.name}
                  description={`Code: ${item.code} • Current: ${item.stock_quantity} ${item.unit}`}
                  left={props => (
                    <List.Icon
                      {...props}
                      icon={isCompleted ? "check-circle" : "package-variant"}
                      color={isCompleted ? "#4CAF50" : undefined}
                    />
                  )}
                  right={props => (
                    <View style={styles.listItemRight}>
                      {isCompleted && (
                        <Paragraph style={styles.initialQuantityText}>
                          Initial: {inventoryItem?.initial_quantity} {item.unit}
                        </Paragraph>
                      )}
                      <IconButton
                        {...props}
                        icon="pencil"
                        onPress={() => handleEditProduct(item)}
                      />
                    </View>
                  )}
                  onPress={() => handleEditProduct(item)}
                  style={[
                    styles.productItem,
                    isCompleted && styles.completedProductItem
                  ]}
                />
              );
            })}
          </View>
        ) : (
          // No results found for search
          <View style={styles.emptyStateContainer}>
            <Paragraph style={styles.emptyStateIcon}>🔍</Paragraph>
            <Paragraph style={styles.emptyStateTitle}>No products found</Paragraph>
            <Paragraph style={styles.emptyStateText}>
              Try a different search term for "{searchQuery}"
            </Paragraph>
          </View>
        )
      ) : (
        // Default state - waiting for search
        <View style={styles.emptyStateContainer}>
          <Paragraph style={styles.emptyStateIcon}>📦</Paragraph>
          <Paragraph style={styles.emptyStateTitle}>Ready to search products</Paragraph>
          <Paragraph style={styles.emptyStateText}>
            Start typing to find and set up your inventory items
          </Paragraph>
        </View>
      )}
    </>
  );

  const renderCompletedTab = () => (
    <>
      <Paragraph style={styles.completedTabHeader}>
        ✅ Completed Items ({completedItems.length})
      </Paragraph>
      <Paragraph style={styles.completedTabSubtitle}>
        📝 Review and edit items you've configured • 🔤 Auto-sorted alphabetically
      </Paragraph>

      {/* Spacing before completed list */}
      <View style={styles.productListSpacer} />

      {completedItems.length > 0 ? (
        <ScrollView
          style={styles.completedScrollView}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {completedItems.map((item) => {
            const product = products.find(p => p.id === item.product_id);
            if (!product) return null;

            return (
              <List.Item
                key={item.product_id.toString()}
                title={product.name}
                description={`Code: ${product.code} • Initial: ${item.initial_quantity} ${item.unit} • Cost: ₱${item.unit_cost}`}
                left={props => (
                  <List.Icon
                    {...props}
                    icon="check-circle"
                    color="#4CAF50"
                  />
                )}
                right={props => (
                  <View style={styles.listItemRight}>
                    <Paragraph style={styles.totalItemValue}>
                      ₱{(item.initial_quantity * item.unit_cost).toFixed(2)}
                    </Paragraph>
                    <IconButton
                      {...props}
                      icon="pencil"
                      onPress={() => handleEditProduct(product)}
                    />
                  </View>
                )}
                onPress={() => handleEditProduct(product)}
                style={styles.completedProductItem}
              />
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyStateContainer}>
          <Paragraph style={styles.emptyStateIcon}>📋</Paragraph>
          <Paragraph style={styles.emptyStateTitle}>No completed items yet</Paragraph>
          <Paragraph style={styles.emptyStateText}>
            Switch to "Search Products" tab to start setting up your inventory
          </Paragraph>
        </View>
      )}
    </>
  );

  if (setupComplete) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.completedContainer}>
          <Card style={styles.completedCard}>
            <Card.Content>
              <Title style={styles.completedTitle}>✅ Initial Inventory Setup Complete</Title>
              <Paragraph style={styles.completedMessage}>
                Your initial inventory has been successfully configured. You can now:
              </Paragraph>
              <View style={styles.actionsList}>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('Products')}
                  style={styles.actionButton}
                >
                  View Products
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => navigation.navigate('Purchase')}
                  style={styles.actionButton}
                >
                  Make Purchases
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => navigation.navigate('PhysicalInventory')}
                  style={styles.actionButton}
                >
                  Physical Count
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.mainContainer} contentContainerStyle={styles.scrollContent}>
        {/* Header with Progress */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title style={styles.headerTitle}>Initial Inventory Setup</Title>
            <View style={styles.versionContainer}>
              <Paragraph style={styles.versionText}>Version 2.2.0 - Production Ready</Paragraph>
              <Paragraph style={styles.buildText}>Build: {new Date().toISOString().split('T')[0]} - Removed test button, added confirmation dialog</Paragraph>
            </View>
            <Paragraph style={styles.headerSubtitle}>
              Set up your starting inventory quantities and costs for all products.
            </Paragraph>

            <View style={styles.progressSection}>
              <View style={styles.progressInfo}>
                <Paragraph>Progress: {progressData.completed} of {progressData.total} products</Paragraph>
                <Paragraph style={styles.totalValue}>
                  Total Value: ₱{getTotalValue().toFixed(2)}
                </Paragraph>
              </View>
              <ProgressBar
                progress={progressData.progress}
                style={styles.progressBar}
                color={theme.colors.primary}
              />
            </View>
          </Card.Content>
        </Card>

        <View style={styles.bodyContainer}>
          {/* Tabbed Product Interface */}
          <View style={styles.productSection}>
            <Card style={styles.productCard}>
              <Card.Content style={styles.productCardContent}>
                <View style={styles.productSectionHeader}>
                  <Title style={styles.sectionTitle}>Inventory Setup</Title>
                  <View style={styles.optimizedBadge}>
                    <Paragraph style={styles.optimizedText}>🚀 UX v2.1.8</Paragraph>
                  </View>
                </View>

                {/* Tab Selection */}
                <SegmentedButtons
                  value={activeTab}
                  onValueChange={setActiveTab}
                  buttons={[
                    {
                      value: 'search',
                      label: 'Search Products',
                      icon: 'magnify',
                    },
                    {
                      value: 'completed',
                      label: `Completed (${completedItems.length})`,
                      icon: 'check-circle',
                    },
                  ]}
                  style={styles.tabButtons}
                />

                {/* Tab Content */}
                {activeTab === 'search' ? renderSearchTab() : renderCompletedTab()}
              </Card.Content>
            </Card>
          </View>

          {/* Summary & Complete Button */}
          <View style={styles.summarySection}>
            <Card style={styles.summaryCard}>
              <Card.Content>
                <Title style={styles.sectionTitle}>Setup Summary</Title>

                <View style={styles.summaryStats}>
                  <View style={styles.statItem}>
                    <Title style={styles.statValue}>{progressData.completed}</Title>
                    <Paragraph style={styles.statLabel}>Completed</Paragraph>
                  </View>
                  <View style={styles.statItem}>
                    <Title style={styles.statValue}>{progressData.total - progressData.completed}</Title>
                    <Paragraph style={styles.statLabel}>Pending</Paragraph>
                  </View>
                  <View style={styles.statItem}>
                    <Title style={[styles.statValue, { color: '#4CAF50' }]}>
                      ₱{getTotalValue().toFixed(0)}
                    </Title>
                    <Paragraph style={styles.statLabel}>Total Value</Paragraph>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.actionSection}>
                  {/* Enhanced Complete Button */}
                  <Button
                    mode="outlined"
                    onPress={handleCompleteSetup}
                    style={[styles.completeButton, { backgroundColor: '#4CAF50' }]}
                    contentStyle={styles.buttonContent}
                    loading={loading}
                    disabled={loading}
                    labelStyle={[styles.buttonLabel, { color: 'white' }]}
                    icon="check-circle"
                  >
                    {loading ? "Completing Setup..." : "Complete Inventory Setup"}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </View>
        </View>
      </ScrollView>

      {/* Edit Product Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Set Initial Inventory</Dialog.Title>
          <Dialog.Content>
            {selectedProduct && (
              <>
                <Paragraph style={styles.selectedProductName}>
                  {selectedProduct.name}
                </Paragraph>
                <Paragraph style={styles.selectedProductInfo}>
                  Code: {selectedProduct.code} • Current Stock: {selectedProduct.stock_quantity} {selectedProduct.unit}
                </Paragraph>

                <TextInput
                  label={`Initial Quantity (${selectedProduct.unit})`}
                  value={initialQuantity}
                  onChangeText={setInitialQuantity}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.dialogInput}
                />

                <TextInput
                  label="Unit Cost (₱)"
                  value={unitCost}
                  onChangeText={setUnitCost}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.dialogInput}
                />

                {initialQuantity && unitCost && (
                  <Paragraph style={styles.totalValuePreview}>
                    Total Value: ₱{(parseInt(initialQuantity || '0') * parseFloat(unitCost || '0')).toFixed(2)}
                  </Paragraph>
                )}
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleUpdateInventory}>
              Update Inventory
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
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32, // Extra bottom padding for safe area
  },
  headerCard: {
    marginBottom: 16,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  versionContainer: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  versionText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 2,
  },
  buildText: {
    fontSize: 11,
    color: '#424242',
    fontStyle: 'italic',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  progressSection: {
    marginTop: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  bodyContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 16,
  },
  productSection: {
    flex: 2,
  },
  productCard: {
    flex: 1,
    elevation: 4,
  },
  productCardContent: {
    flex: 1,
  },
  productSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    margin: 0,
  },
  optimizedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  optimizedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
    margin: 0,
  },
  tabButtons: {
    marginBottom: 16,
  },
  completedTabHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  completedTabSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  totalItemValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'right',
  },
  searchInput: {
    marginBottom: 12,
  },
  searchIndicator: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 8,
    fontStyle: 'italic',
    color: '#4CAF50',
  },
  searchGuidance: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
    fontStyle: 'italic',
    color: '#FF9800',
    textAlign: 'center',
  },
  debugText: {
    fontSize: 10,
    opacity: 0.6,
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  productListSpacer: {
    height: 16,
    backgroundColor: 'transparent',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 20,
  },
  productList: {
    minHeight: 200,
    maxHeight: 500,
  },
  completedScrollView: {
    minHeight: 200,
    maxHeight: 400,
    flex: 1,
  },
  productItem: {
    paddingVertical: 8,
  },
  completedProductItem: {
    backgroundColor: '#E8F5E8',
  },
  listItemRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  initialQuantityText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  summarySection: {
    flex: 1,
    minHeight: 180,
    maxHeight: 250,
    marginBottom: 16, // Extra margin for bottom spacing
  },
  summaryCard: {
    elevation: 4,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  divider: {
    marginVertical: 8,
  },
  actionSection: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 24, // Extra bottom padding for button area
  },
  actionText: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  completeButton: {
    width: '100%',
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
  totalValuePreview: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    backgroundColor: '#E8F5E8',
    padding: 8,
    borderRadius: 4,
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  completedCard: {
    width: '100%',
    maxWidth: 400,
    elevation: 8,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#4CAF50',
  },
  completedMessage: {
    textAlign: 'center',
    marginBottom: 24,
  },
  actionsList: {
    gap: 12,
  },
  actionButton: {
    marginBottom: 8,
  },
});