import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
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
  useTheme,
  Dialog,
  Portal,
  Divider,
  ProgressBar,
  IconButton,
  Chip,
  DataTable,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import { useAuth } from '../contexts/AuthContext';

type PhysicalInventoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PhysicalInventory'
>;

type Props = {
  navigation: PhysicalInventoryScreenNavigationProp;
};

interface Product {
  id: number;
  code: string;
  name: string;
  price: number;
  cost: number;
  stock_quantity: number;
  unit: string;
  category_name?: string;
}

interface PhysicalCountItem {
  product_id: number;
  product_code: string;
  product_name: string;
  system_quantity: number;
  physical_quantity: number;
  discrepancy: number;
  unit: string;
  unit_cost: number;
  value_discrepancy: number;
  status: 'pending' | 'counted' | 'reviewed';
  notes?: string;
}

interface CountSession {
  id: string;
  date: string;
  status: 'in_progress' | 'completed';
  total_items: number;
  counted_items: number;
  total_discrepancy_value: number;
}

export default function PhysicalInventoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [countItems, setCountItems] = useState<PhysicalCountItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [reportDialogVisible, setReportDialogVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PhysicalCountItem | null>(null);
  const [physicalQuantity, setPhysicalQuantity] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [currentSession, setCurrentSession] = useState<CountSession | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'pending' | 'discrepancies' | 'none'>('none');
  const theme = useTheme();

  useEffect(() => {
    initializeCount();
  }, []);

  const initializeCount = async () => {
    try {
      if (!user) {
        Alert.alert('Error', 'You must be logged in to perform physical inventory count.');
        return;
      }

      console.log('Initializing Physical Inventory Count...');
      const dbService = DatabaseService.getInstance();

      // Add timeout to prevent hanging
      const productList = await Promise.race([
        dbService.getProducts(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]) as any[];

      console.log(`Loaded ${productList.length} products for counting`);
      setProducts(productList);

      // Create session in database
      const sessionId = `COUNT_${Date.now()}`;
      await dbService.createPhysicalCountSession({
        session_id: sessionId,
        started_by: user.id,
        total_items: productList.length,
        notes: `Physical count started by ${user.full_name}`
      });

      // Create count details in database
      for (const product of productList) {
        await dbService.createPhysicalCountDetail({
          session_id: sessionId,
          product_id: product.id,
          product_code: product.code,
          product_name: product.name,
          system_quantity: product.stock_quantity,
          unit_cost: product.cost
        });
      }

      // Initialize count items for UI
      const items: PhysicalCountItem[] = productList.map(product => ({
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        system_quantity: product.stock_quantity,
        physical_quantity: 0,
        discrepancy: 0,
        unit: product.unit,
        unit_cost: product.cost,
        value_discrepancy: 0,
        status: 'pending',
      }));

      setCountItems(items);

      // Create count session for UI
      const session: CountSession = {
        id: sessionId,
        date: new Date().toISOString().split('T')[0],
        status: 'in_progress',
        total_items: items.length,
        counted_items: 0,
        total_discrepancy_value: 0,
      };

      setCurrentSession(session);
      console.log('Physical Inventory Count initialized successfully');
    } catch (error) {
      console.error('Error initializing count:', error);
      if (error.message === 'Timeout') {
        Alert.alert('Loading Error', 'The app is taking too long to load products. Please check your database connection and try again.');
      } else {
        Alert.alert('Initialization Error', 'Failed to initialize physical inventory count. Please restart the app.');
      }
    }
  };

  const handleCountProduct = (item: PhysicalCountItem) => {
    setSelectedItem(item);
    setPhysicalQuantity(item.physical_quantity.toString());
    setCountNotes(item.notes || '');
    setDialogVisible(true);
  };

  const handleUpdateCount = async () => {
    if (!selectedItem || physicalQuantity === '' || !user || !currentSession) {
      Alert.alert('Error', 'Please enter the physical quantity and ensure you are logged in');
      return;
    }

    const physical = parseInt(physicalQuantity);
    if (physical < 0) {
      Alert.alert('Error', 'Physical quantity cannot be negative');
      return;
    }

    try {
      const dbService = DatabaseService.getInstance();
      const discrepancy = physical - selectedItem.system_quantity;
      const valueDiscrepancy = discrepancy * selectedItem.unit_cost;

      // Update database
      await dbService.updatePhysicalCountDetail(currentSession.id, selectedItem.product_id, {
        physical_quantity: physical,
        discrepancy: discrepancy,
        value_discrepancy: valueDiscrepancy,
        status: 'counted',
        counted_by: user.id,
        notes: countNotes || null
      });

      // Update local state
      const updatedItems = countItems.map(item =>
        item.product_id === selectedItem.product_id
          ? {
              ...item,
              physical_quantity: physical,
              discrepancy: discrepancy,
              value_discrepancy: valueDiscrepancy,
              status: 'counted' as const,
              notes: countNotes,
            }
          : item
      );

      setCountItems(updatedItems);

      // Update session in database and local state
      const countedItems = updatedItems.filter(item => item.status === 'counted').length;
      const totalDiscrepancyValue = updatedItems.reduce((sum, item) => sum + item.value_discrepancy, 0);
      const discrepancyCount = updatedItems.filter(item => item.status === 'counted' && item.discrepancy !== 0).length;

      await dbService.updatePhysicalCountSession(currentSession.id, {
        counted_items: countedItems,
        total_discrepancy_value: totalDiscrepancyValue,
        discrepancy_count: discrepancyCount
      });

      setCurrentSession({
        ...currentSession,
        counted_items: countedItems,
        total_discrepancy_value: totalDiscrepancyValue,
      });

      setDialogVisible(false);
      setSelectedItem(null);
      setPhysicalQuantity('');
      setCountNotes('');
    } catch (error) {
      console.error('Error updating count:', error);
      Alert.alert('Error', 'Failed to update count. Please try again.');
    }
  };

  const handleCompleteCount = async () => {
    const uncountedItems = countItems.filter(item => item.status === 'pending');
    const countedItems = countItems.filter(item => item.status === 'counted');
    const discrepancyItems = countedItems.filter(item => item.discrepancy !== 0);
    const totalDiscrepancyValue = discrepancyItems.reduce((sum, item) => sum + item.value_discrepancy, 0);

    // Show comprehensive confirmation dialog
    Alert.alert(
      'Complete Physical Inventory Count',
      `Are you ready to finalize the physical inventory count?\n\n` +
      `📊 Summary:\n` +
      `✅ Counted Items: ${countedItems.length}\n` +
      `⏳ Uncounted Items: ${uncountedItems.length}\n` +
      `⚠️ Discrepancies Found: ${discrepancyItems.length}\n` +
      `💰 Total Discrepancy Value: ₱${totalDiscrepancyValue.toFixed(2)}\n\n` +
      `${uncountedItems.length > 0 ?
        '⚠️ Uncounted items will match system quantities.\n\n' :
        ''}` +
      `This will update all product quantities in your database and cannot be easily undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Yes, Complete Count',
          onPress: () => {
            if (uncountedItems.length > 0) {
              // Additional confirmation for uncounted items
              Alert.alert(
                'Incomplete Count Warning',
                `You have ${uncountedItems.length} products that haven't been counted. These will be assumed to match system quantities. Continue?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Continue', onPress: processInventoryCount },
                ]
              );
            } else {
              processInventoryCount();
            }
          },
          style: 'default'
        },
      ]
    );
  };

  const processInventoryCount = async () => {
    if (!user || !currentSession) {
      Alert.alert('Error', 'Session or user information is missing');
      return;
    }

    setLoading(true);

    try {
      const dbService = DatabaseService.getInstance();
      const db = dbService.getDatabase();

      await db.withTransactionAsync(async () => {
        // Update product quantities based on physical count
        for (const item of countItems) {
          const finalQuantity = item.status === 'counted' ? item.physical_quantity : item.system_quantity;

          if (item.discrepancy !== 0) {
            // Update product quantity
            await db.runAsync(
              'UPDATE products SET stock_quantity = ? WHERE id = ?',
              [finalQuantity, item.product_id]
            );

            // Record inventory movement for discrepancy
            await db.runAsync(
              `INSERT INTO inventory_movements (
                product_id, movement_type, quantity, reference_type,
                notes, created_by
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                item.product_id,
                item.discrepancy > 0 ? 'IN' : 'OUT',
                Math.abs(item.discrepancy),
                'MANUAL_ADJUSTMENT',
                `Physical count adjustment by ${user.full_name}: ${item.notes || 'No notes'}`,
                user.id
              ]
            );
          }
        }

        // Update session as completed
        await dbService.updatePhysicalCountSession(currentSession.id, {
          status: 'completed',
          completed_by: user.id
        });

        // Create eJournal entry for completion
        await dbService.createEJournalEntry({
          entry_type: 'SYSTEM',
          reference_number: currentSession.id,
          description: `Physical inventory count completed by ${user.full_name} - Total discrepancy value: ₱${currentSession?.total_discrepancy_value.toFixed(2)}`,
          amount: currentSession?.total_discrepancy_value || 0,
          cashier_id: user.id
        });
      });

      Alert.alert(
        'Count Complete',
        'Physical inventory count has been completed and system quantities have been updated.',
        [
          {
            text: 'View Report',
            onPress: () => setReportDialogVisible(true),
          },
          {
            text: 'View Products',
            onPress: () => navigation.navigate('Products'),
          },
        ]
      );

      setCurrentSession({
        ...currentSession,
        status: 'completed',
      });
    } catch (error) {
      console.error('Count completion error:', error);
      Alert.alert('Error', 'Failed to complete physical inventory count');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredItems = () => {
    let filteredItems = countItems;

    // Apply search filter first
    if (searchQuery && searchQuery.trim().length >= 3) {
      filteredItems = filteredItems.filter(item =>
        item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product_code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // If there's a search query with 3+ characters, show all matching items regardless of view mode
    if (searchQuery.trim() && searchQuery.trim().length >= 3) {
      return filteredItems;
    }

    // Performance optimization: Don't show any items if no search and no specific view
    if (!searchQuery.trim()) {
      // Only show specific view modes, not all items initially
      switch (viewMode) {
        case 'pending':
          return filteredItems.filter(item => item.status === 'pending');
        case 'discrepancies':
          return filteredItems.filter(item => item.status === 'counted' && item.discrepancy !== 0);
        case 'all':
          return filteredItems; // Show all only when explicitly requested
        case 'none':
        default:
          return []; // Don't show any items initially for performance
      }
    }

    return []; // Default: show nothing until user searches or selects view
  };

  const getProgressData = () => {
    const counted = countItems.filter(item => item.status === 'counted').length;
    const total = countItems.length;
    const progress = total > 0 ? counted / total : 0;
    return { counted, total, progress };
  };

  const getDiscrepancySummary = () => {
    const discrepancies = countItems.filter(item => item.discrepancy !== 0);
    const positiveDiscrepancies = discrepancies.filter(item => item.discrepancy > 0);
    const negativeDiscrepancies = discrepancies.filter(item => item.discrepancy < 0);
    const totalValueDiscrepancy = discrepancies.reduce((sum, item) => sum + item.value_discrepancy, 0);

    return {
      total: discrepancies.length,
      overages: positiveDiscrepancies.length,
      shortages: negativeDiscrepancies.length,
      totalValue: totalValueDiscrepancy,
    };
  };

  const progressData = getProgressData();
  const discrepancySummary = getDiscrepancySummary();
  const filteredItems = getFilteredItems();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.mainContainer}>
        {/* Header with Progress */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title style={styles.headerTitle}>Physical Inventory Count - v4.2 COPY REPORT STYLE</Title>
            <Paragraph style={styles.headerSubtitle}>
              Count physical inventory and identify discrepancies with system quantities.
            </Paragraph>

            <View style={styles.progressSection}>
              <View style={styles.progressInfo}>
                <Paragraph>Progress: {progressData.counted} of {progressData.total} products</Paragraph>
                <Paragraph style={styles.discrepancyValue}>
                  Discrepancy Value: ₱{discrepancySummary.totalValue.toFixed(2)}
                </Paragraph>
              </View>
              <ProgressBar
                progress={progressData.progress}
                style={styles.progressBar}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.filterChips}>
              <Chip
                selected={viewMode === 'pending'}
                onPress={() => setViewMode('pending')}
                style={styles.filterChip}
              >
                Pending ({countItems.filter(item => item.status === 'pending').length})
              </Chip>
              <Chip
                selected={viewMode === 'discrepancies'}
                onPress={() => setViewMode('discrepancies')}
                style={styles.filterChip}
              >
                Discrepancies ({discrepancySummary.total})
              </Chip>
              <Chip
                selected={viewMode === 'all'}
                onPress={() => setViewMode('all')}
                style={styles.filterChip}
              >
                All Items
              </Chip>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.bodyContainer}>
          {/* Search Section */}
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
                  console.log('Barcode scanned:', scannedValue);
                  setSearchQuery(scannedValue);
                  // Auto-focus and select the first matching product if only one result
                  setTimeout(() => {
                    const matches = getFilteredItems();
                    if (matches.length === 1) {
                      console.log('Single match found, auto-selecting for count:', matches[0].product_name);
                      handleCountProduct(matches[0]);
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
                🔍 Found {filteredItems.length} result(s) for "{searchQuery}"
              </Paragraph>
            )}
            {/* Debug info */}
            <Text style={styles.debugText}>
              Debug: v4.0 RESPONSIVE - {new Date().toLocaleTimeString()} - Products: {products.length}, Items: {countItems.length}, Filtered: {filteredItems.length}, ViewMode: {viewMode}
            </Text>
            {searchQuery.trim() && filteredItems.length === 1 && (
              <Text style={styles.barcodeHint}>
                💡 Single match found! Tap the product or it will auto-open after barcode scan.
              </Text>
            )}
          </View>

          {/* Product Count List */}
          <View style={styles.productSection}>
            <Title style={styles.sectionTitle}>
              Products to Count ({filteredItems.length})
            </Title>

            <View style={styles.productListContainer}>
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.product_id.toString()}
                renderItem={({ item }) => {
                  const statusIcon = item.status === 'counted'
                    ? (item.discrepancy === 0 ? "✓" : "⚠")
                    : "📦";
                  const statusColor = item.status === 'counted'
                    ? (item.discrepancy === 0 ? "#4CAF50" : "#FF9800")
                    : "#666";

                  return (
                    <TouchableOpacity
                      style={[
                        styles.productItem,
                        item.status === 'counted' && styles.countedProductItem,
                        item.discrepancy !== 0 && item.status === 'counted' && styles.discrepancyProductItem
                      ]}
                      onPress={() => handleCountProduct(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.productItemContent}>
                        <View style={[styles.productIcon, { backgroundColor: `${statusColor}15` }]}>
                          <Text style={[styles.productIconText, { color: statusColor }]}>
                            {statusIcon}
                          </Text>
                        </View>

                        <View style={styles.productInfo}>
                          <Text style={styles.productName} numberOfLines={2}>
                            {item.product_name}
                          </Text>
                          <Text style={styles.productCode}>
                            Code: {item.product_code}
                          </Text>
                          <View style={styles.productMetaRow}>
                            <Text style={styles.productSystem}>
                              System: {item.system_quantity} {item.unit}
                            </Text>
                            {item.status === 'counted' && (
                              <Text style={styles.productPhysical}>
                                Physical: {item.physical_quantity}
                              </Text>
                            )}
                          </View>
                          {item.status === 'counted' && item.discrepancy !== 0 && (
                            <Text style={[
                              styles.discrepancyDisplay,
                              { color: item.discrepancy > 0 ? '#4CAF50' : '#F44336' }
                            ]}>
                              Difference: {item.discrepancy >= 0 ? '+' : ''}{item.discrepancy} • Value: ₱{item.value_discrepancy.toFixed(2)}
                            </Text>
                          )}
                        </View>

                        <TouchableOpacity
                          style={styles.countButton}
                          onPress={() => handleCountProduct(item)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.countButtonText}>📊</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                style={styles.productList}
                contentContainerStyle={styles.productListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={() => (
                  <View style={styles.emptyProductsContainer}>
                    <Text style={styles.emptyIconText}>🔍</Text>
                    <Text style={styles.emptyProductsTitle}>
                      {searchQuery.trim() ? 'No Results Found' : 'No Products to Count'}
                    </Text>
                    <Text style={styles.emptyProductsText}>
                      {searchQuery.trim() ? 'Try a different search term' : 'All products have been counted'}
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>

        </View>

        {/* Summary Section - Enhanced Visibility */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <View style={styles.miniStatItem}>
              <Title style={styles.miniStatValue}>{progressData.counted}</Title>
              <Paragraph style={styles.miniStatLabel}>Done</Paragraph>
            </View>
            <View style={styles.miniStatItem}>
              <Title style={[styles.miniStatValue, { color: '#FF9800' }]}>{discrepancySummary.overages}</Title>
              <Paragraph style={styles.miniStatLabel}>Over</Paragraph>
            </View>
            <View style={styles.miniStatItem}>
              <Title style={[styles.miniStatValue, { color: '#F44336' }]}>{discrepancySummary.shortages}</Title>
              <Paragraph style={styles.miniStatLabel}>Short</Paragraph>
            </View>
            <View style={styles.discrepancyValueMini}>
              <Title style={[
                styles.miniDiscrepancyValue,
                { color: discrepancySummary.totalValue >= 0 ? '#4CAF50' : '#F44336' }
              ]}>
                ₱{discrepancySummary.totalValue.toFixed(2)}
              </Title>
            </View>
          </View>

          {/* Responsive Button Section */}
          <View style={styles.responsiveButtonContainer}>
            <Button
              mode="outlined"
              onPress={() => setReportDialogVisible(true)}
              style={styles.responsiveReportButton}
              contentStyle={styles.responsiveButtonContent}
              disabled={false}
              labelStyle={styles.responsiveButtonLabel}
            >
              📊 Report
            </Button>

            <Button
              mode="outlined"
              onPress={handleCompleteCount}
              style={[styles.responsiveCompleteButton, { backgroundColor: '#2196F3' }]}
              contentStyle={styles.responsiveButtonContent}
              loading={loading}
              disabled={loading || currentSession?.status === 'completed'}
              labelStyle={styles.responsiveCompleteLabel}
            >
              {currentSession?.status === 'completed' ? '✅ Completed' : '🏁 Complete Count'}
            </Button>
          </View>
        </View>
      </View>

      {/* Count Product Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Physical Count</Dialog.Title>
          <Dialog.Content>
            {selectedItem && (
              <>
                <Paragraph style={styles.selectedProductName}>
                  {selectedItem.product_name}
                </Paragraph>
                <Paragraph style={styles.selectedProductInfo}>
                  Code: {selectedItem.product_code} • System Qty: {selectedItem.system_quantity} {selectedItem.unit}
                </Paragraph>

                <TextInput
                  label={`Physical Quantity (${selectedItem.unit})`}
                  value={physicalQuantity}
                  onChangeText={setPhysicalQuantity}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.dialogInput}
                  autoFocus
                />

                <TextInput
                  label="Notes (Optional)"
                  value={countNotes}
                  onChangeText={setCountNotes}
                  mode="outlined"
                  multiline
                  style={styles.dialogInput}
                />

                {physicalQuantity !== '' && (
                  <View style={styles.discrepancyPreview}>
                    <Paragraph style={styles.discrepancyLabel}>
                      Discrepancy: {parseInt(physicalQuantity || '0') - selectedItem.system_quantity} {selectedItem.unit}
                    </Paragraph>
                    <Paragraph style={styles.valueDiscrepancy}>
                      Value Impact: ₱{((parseInt(physicalQuantity || '0') - selectedItem.system_quantity) * selectedItem.unit_cost).toFixed(2)}
                    </Paragraph>
                  </View>
                )}
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleUpdateCount}>
              Update Count
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Discrepancy Report Dialog */}
      <Portal>
        <Dialog visible={reportDialogVisible} onDismiss={() => setReportDialogVisible(false)} style={styles.reportDialog}>
          <Dialog.Title>Inventory Discrepancy Report</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.reportContent}>
              <View style={styles.reportHeader}>
                <Paragraph>Date: {new Date().toLocaleDateString()}</Paragraph>
                <Paragraph>Session: {currentSession?.id}</Paragraph>
                <Paragraph>Status: {currentSession?.status}</Paragraph>
              </View>

              <Divider style={styles.reportDivider} />

              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>Product</DataTable.Title>
                  <DataTable.Title numeric>System</DataTable.Title>
                  <DataTable.Title numeric>Physical</DataTable.Title>
                  <DataTable.Title numeric>Diff</DataTable.Title>
                  <DataTable.Title numeric>Value</DataTable.Title>
                </DataTable.Header>

                {countItems
                  .filter(item => item.status === 'counted' && item.discrepancy !== 0)
                  .map((item) => (
                    <DataTable.Row key={item.product_id}>
                      <DataTable.Cell>{item.product_name}</DataTable.Cell>
                      <DataTable.Cell numeric>{item.system_quantity}</DataTable.Cell>
                      <DataTable.Cell numeric>{item.physical_quantity}</DataTable.Cell>
                      <DataTable.Cell numeric>{item.discrepancy}</DataTable.Cell>
                      <DataTable.Cell numeric>₱{item.value_discrepancy.toFixed(2)}</DataTable.Cell>
                    </DataTable.Row>
                  ))}
              </DataTable>

              <View style={styles.reportSummary}>
                <Paragraph style={styles.reportSummaryText}>
                  Total Discrepancies: {discrepancySummary.total}
                </Paragraph>
                <Paragraph style={styles.reportSummaryText}>
                  Total Value Impact: ₱{discrepancySummary.totalValue.toFixed(2)}
                </Paragraph>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setReportDialogVisible(false)}>Close</Button>
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
    padding: 16,
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
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  discrepancyValue: {
    fontWeight: 'bold',
    color: '#FF9800',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  bodyContainer: {
    flex: 1,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: 'white',
  },
  searchIndicator: {
    marginTop: 8,
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: '#e3f2fd',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  searchGuidance: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
    fontStyle: 'italic',
    color: '#FF9800',
    textAlign: 'center',
    backgroundColor: '#fff3e0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  productSection: {
    flex: 1,
  },
  productListContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  productList: {
    flex: 1,
  },
  productListContent: {
    paddingBottom: 16,
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
    padding: 16,
  },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productIconText: {
    fontSize: 18,
    fontWeight: 'bold',
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
    marginBottom: 2,
  },
  productSystem: {
    fontSize: 14,
    color: '#666',
  },
  productPhysical: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500',
  },
  discrepancyDisplay: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  countButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countButtonText: {
    fontSize: 18,
  },
  countedProductItem: {
    backgroundColor: '#E8F5E8',
  },
  discrepancyProductItem: {
    backgroundColor: '#FFF3E0',
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
  debugText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  barcodeHint: {
    fontSize: 12,
    color: '#2196F3',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  summarySection: {
    backgroundColor: 'white',
    paddingHorizontal: '4%',
    paddingVertical: '3%',
    elevation: 8,
    marginTop: 8,
    minHeight: 120,
    borderTopWidth: 2,
    borderTopColor: '#2196F3',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  miniStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  miniStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  miniStatLabel: {
    fontSize: 10,
    opacity: 0.7,
  },
  discrepancyValueMini: {
    alignItems: 'center',
    flex: 2,
  },
  miniDiscrepancyValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  responsiveButtonContainer: {
    flexDirection: 'row',
    gap: '3%',
    marginTop: '2%',
    paddingHorizontal: '2%',
  },
  responsiveReportButton: {
    flex: 1,
    minHeight: 56,
    maxHeight: 64,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  responsiveCompleteButton: {
    flex: 2,
    minHeight: 56,
    maxHeight: 64,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  responsiveButtonContent: {
    paddingVertical: '2%',
    paddingHorizontal: '2%',
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  responsiveButtonLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
    lineHeight: 16,
    paddingVertical: 2,
  },
  responsiveCompleteLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    lineHeight: 16,
    paddingVertical: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  divider: {
    marginVertical: 12,
  },
  valueSection: {
    alignItems: 'center',
    marginVertical: 8,
  },
  valueLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  valueAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionSection: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  reportButton: {
    flex: 1,
    height: 36,
  },
  completeButton: {
    flex: 2,
    height: 36,
  },
  smallButtonContent: {
    paddingVertical: 4,
    height: 36,
  },
  compactReportButton: {
    flex: 1,
    height: 32,
  },
  compactCompleteButton: {
    flex: 2,
    height: 40,
    backgroundColor: '#2196F3',
  },
  ultraCompactButtonContent: {
    paddingVertical: 6,
    height: 40,
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
  discrepancyPreview: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  discrepancyLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  valueDiscrepancy: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  reportDialog: {
    maxHeight: '80%',
    minHeight: '60%',
  },
  reportContent: {
    paddingHorizontal: 24,
  },
  reportHeader: {
    marginBottom: 16,
  },
  reportDivider: {
    marginVertical: 16,
  },
  reportSummary: {
    marginTop: 16,
    alignItems: 'center',
  },
  reportSummaryText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: 4,
  },
});