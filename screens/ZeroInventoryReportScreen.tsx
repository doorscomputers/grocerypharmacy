import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  DataTable,
  Divider,
  Chip,
  TextInput,
  List,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import PrintOptionsDialog from '../components/PrintOptionsDialog';
import { ESCPOSBuilder, PRINTER_WIDTH } from '../utils/escpos';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'ZeroInventoryReport'>;
};

interface Product {
  id: number;
  product_code: string;
  name: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  reorder_level: number;
  is_active: boolean;
}

interface Category {
  id: number;
  name: string;
}

export default function ZeroInventoryReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showInactiveProducts, setShowInactiveProducts] = useState(false);
  const [printDialogVisible, setPrintDialogVisible] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const productsData = await dbService.getProducts();
      setProducts(productsData);

      const categoriesData = await dbService.getCategories(false);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading zero inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter products with zero stock
  const zeroStockProducts = useMemo(() => {
    let filtered = products.filter(p => (p.stock_quantity || 0) === 0);

    // Filter by active status
    if (!showInactiveProducts) {
      filtered = filtered.filter(p => p.is_active);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.product_code?.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    return filtered;
  }, [products, searchQuery, selectedCategory, showInactiveProducts]);

  // Calculate statistics
  const stats = useMemo(() => {
    const activeZeroStock = products.filter(p => p.is_active && (p.stock_quantity || 0) === 0);
    const totalProducts = products.filter(p => p.is_active).length;

    // Group by category
    const byCategory: Record<string, number> = {};
    activeZeroStock.forEach(p => {
      const catName = p.category_name || 'Uncategorized';
      byCategory[catName] = (byCategory[catName] || 0) + 1;
    });

    // Calculate lost potential revenue (based on selling price)
    const lostPotentialRevenue = activeZeroStock.reduce(
      (sum, p) => sum + (p.selling_price || 0), 0
    );

    return {
      zeroStockCount: activeZeroStock.length,
      totalProducts,
      percentage: totalProducts > 0 ? (activeZeroStock.length / totalProducts) * 100 : 0,
      byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1]),
      lostPotentialRevenue,
    };
  }, [products]);

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('ZERO INVENTORY')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .println(now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }))
      .println(now.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' }))
      .doubleSeparator();

    // Summary
    builder
      .align('left')
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .separator()
      .leftRight('Zero Stock Items:', stats.zeroStockCount.toString())
      .leftRight('Total Products:', stats.totalProducts.toString())
      .leftRight('Out of Stock Rate:', `${stats.percentage.toFixed(1)}%`)
      .leftRight('Lost Potential:', `P${stats.lostPotentialRevenue.toFixed(2)}`)
      .separator();

    // Category breakdown
    if (stats.byCategory.length > 0) {
      builder
        .bold(true)
        .println('BY CATEGORY')
        .bold(false)
        .separator();

      for (const [category, count] of stats.byCategory) {
        builder.leftRight(category, count.toString());
      }
      builder.separator();
    }

    // Product list (first 30 items to fit on thermal paper)
    const printProducts = zeroStockProducts.slice(0, 30);
    if (printProducts.length > 0) {
      builder
        .bold(true)
        .println('PRODUCTS WITH ZERO STOCK')
        .bold(false)
        .separator();

      for (const product of printProducts) {
        const name = product.name.length > printerWidth - 12
          ? product.name.substring(0, printerWidth - 14) + '..'
          : product.name;
        builder.println(name);
        builder.leftRight(`  ${product.product_code || '-'}`, `P${(product.selling_price || 0).toFixed(2)}`);
      }

      if (zeroStockProducts.length > 30) {
        builder.feed().println(`... and ${zeroStockProducts.length - 30} more items`);
      }
    }

    builder
      .feed()
      .align('center')
      .separator()
      .println('*** END OF REPORT ***')
      .feed(2)
      .cut();

    return builder;
  };

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return zeroStockProducts.slice(start, start + itemsPerPage);
  }, [zeroStockProducts, currentPage]);

  const totalPages = Math.ceil(zeroStockProducts.length / itemsPerPage);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitles}>
              <Title style={styles.pageTitle}>Zero Inventory Report</Title>
              <Paragraph style={styles.pageSubtitle}>
                Products with no stock available
              </Paragraph>
            </View>
            <Button
              mode="contained"
              icon="printer"
              onPress={() => setPrintDialogVisible(true)}
              compact
            >
              Print
            </Button>
          </View>
        </View>

        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Summary</Title>
            <Divider style={styles.divider} />

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Products with Zero Stock</Paragraph>
                <Title style={[styles.summaryValue, { color: '#F44336' }]}>
                  {stats.zeroStockCount}
                </Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Total Active Products</Paragraph>
                <Title style={styles.summaryValue}>{stats.totalProducts}</Title>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Out of Stock Rate</Paragraph>
                <Title style={[styles.summaryValue, { color: stats.percentage > 20 ? '#F44336' : '#FF9800' }]}>
                  {stats.percentage.toFixed(1)}%
                </Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={styles.summaryLabel}>Potential Lost Revenue</Paragraph>
                <Title style={[styles.summaryValue, { color: '#9C27B0' }]}>
                  {formatCurrency(stats.lostPotentialRevenue)}
                </Title>
                <Paragraph style={styles.summaryNote}>(per unit at retail)</Paragraph>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Category Breakdown */}
        {stats.byCategory.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Zero Stock by Category</Title>
              <Divider style={styles.divider} />

              {stats.byCategory.map(([category, count]) => (
                <List.Item
                  key={category}
                  title={category}
                  description={`${count} product${count !== 1 ? 's' : ''} out of stock`}
                  left={(props) => <List.Icon {...props} icon="alert-circle" color="#F44336" />}
                  right={() => (
                    <Chip style={styles.countChip}>{count}</Chip>
                  )}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Product List */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Zero Stock Products</Title>
            <Divider style={styles.divider} />

            <TextInput
              mode="outlined"
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              left={<TextInput.Icon icon="magnify" />}
              right={searchQuery ? <TextInput.Icon icon="close" onPress={() => setSearchQuery('')} /> : null}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={styles.chipContainer}>
                <Chip
                  selected={!selectedCategory}
                  onPress={() => setSelectedCategory(null)}
                  style={styles.chip}
                >
                  All Categories
                </Chip>
                {categories.map((cat) => (
                  <Chip
                    key={cat.id}
                    selected={selectedCategory === cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={styles.chip}
                  >
                    {cat.name}
                  </Chip>
                ))}
              </View>
            </ScrollView>

            <View style={styles.filterRow}>
              <Chip
                selected={showInactiveProducts}
                onPress={() => setShowInactiveProducts(!showInactiveProducts)}
                style={styles.filterChip}
                icon={showInactiveProducts ? 'check' : 'close'}
              >
                Include Inactive Products
              </Chip>
            </View>

            <Paragraph style={styles.resultCount}>
              Showing {paginatedProducts.length} of {zeroStockProducts.length} products with zero stock
            </Paragraph>

            {loading ? (
              <Paragraph>Loading...</Paragraph>
            ) : zeroStockProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <List.Icon icon="check-circle" color="#4CAF50" />
                <Title style={styles.emptyTitle}>All Products in Stock!</Title>
                <Paragraph style={styles.emptyText}>
                  Great news! All your products have inventory available.
                </Paragraph>
              </View>
            ) : (
              <>
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>Code</DataTable.Title>
                    <DataTable.Title style={{ flex: 2 }}>Product Name</DataTable.Title>
                    <DataTable.Title>Category</DataTable.Title>
                    <DataTable.Title numeric>Cost Price</DataTable.Title>
                    <DataTable.Title numeric>Selling Price</DataTable.Title>
                    <DataTable.Title numeric>Reorder Level</DataTable.Title>
                    <DataTable.Title>Status</DataTable.Title>
                  </DataTable.Header>

                  {paginatedProducts.map((product) => (
                    <DataTable.Row key={product.id}>
                      <DataTable.Cell>{product.product_code || '-'}</DataTable.Cell>
                      <DataTable.Cell style={{ flex: 2 }}>{product.name}</DataTable.Cell>
                      <DataTable.Cell>{product.category_name || 'Uncategorized'}</DataTable.Cell>
                      <DataTable.Cell numeric>{formatCurrency(product.cost_price || 0)}</DataTable.Cell>
                      <DataTable.Cell numeric>{formatCurrency(product.selling_price || 0)}</DataTable.Cell>
                      <DataTable.Cell numeric>{product.reorder_level || 0}</DataTable.Cell>
                      <DataTable.Cell>
                        <Chip
                          compact
                          style={[
                            styles.statusChip,
                            { backgroundColor: product.is_active ? '#E8F5E9' : '#FFEBEE' }
                          ]}
                          textStyle={{
                            fontSize: 10,
                            color: product.is_active ? '#4CAF50' : '#F44336'
                          }}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Chip>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>

                {totalPages > 1 && (
                  <DataTable.Pagination
                    page={currentPage}
                    numberOfPages={totalPages}
                    onPageChange={setCurrentPage}
                    label={`${currentPage + 1} of ${totalPages}`}
                    showFastPaginationControls
                  />
                )}
              </>
            )}
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Button mode="outlined" onPress={loadData} style={styles.refreshButton}>
            Refresh Data
          </Button>
        </View>
      </ScrollView>

      <PrintOptionsDialog
        visible={printDialogVisible}
        onDismiss={() => setPrintDialogVisible(false)}
        title="Print Zero Inventory Report"
        onPrint={buildPrintReport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...Platform.select({
      web: {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      },
    }),
  },
  scrollView: {
    flex: 1,
    ...Platform.select({
      web: {
        height: '100%',
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitles: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  pageSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  summaryCard: {
    marginBottom: 16,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  summaryNote: {
    fontSize: 10,
    opacity: 0.6,
    textAlign: 'center',
  },
  searchInput: {
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginBottom: 12,
  },
  chip: {
    marginRight: 8,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  filterChip: {
    marginRight: 8,
  },
  resultCount: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  countChip: {
    backgroundColor: '#FFEBEE',
  },
  statusChip: {
    height: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 4,
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  refreshButton: {
    minWidth: 150,
  },
});
