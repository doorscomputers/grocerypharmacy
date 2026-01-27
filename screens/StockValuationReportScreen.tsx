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
  SegmentedButtons,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'StockValuationReport'>;
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

type ViewMode = 'summary' | 'byProduct' | 'byCategory';

export default function StockValuationReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

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
      console.error('Error loading stock valuation data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => p.is_active);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.product_code?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    return filtered;
  }, [products, searchQuery, selectedCategory]);

  // Calculate totals
  const totals = useMemo(() => {
    const activeProducts = products.filter(p => p.is_active);

    const totalCostValue = activeProducts.reduce(
      (sum, p) => sum + (p.cost_price || 0) * (p.stock_quantity || 0), 0
    );
    const totalRetailValue = activeProducts.reduce(
      (sum, p) => sum + (p.selling_price || 0) * (p.stock_quantity || 0), 0
    );
    const totalUnits = activeProducts.reduce(
      (sum, p) => sum + (p.stock_quantity || 0), 0
    );
    const potentialProfit = totalRetailValue - totalCostValue;
    const profitMargin = totalCostValue > 0 ? (potentialProfit / totalCostValue) * 100 : 0;

    return {
      totalCostValue,
      totalRetailValue,
      totalUnits,
      potentialProfit,
      profitMargin,
      productCount: activeProducts.length,
    };
  }, [products]);

  // Calculate by category
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<number, {
      category_id: number;
      category_name: string;
      product_count: number;
      total_units: number;
      cost_value: number;
      retail_value: number;
    }> = {};

    products.filter(p => p.is_active).forEach(p => {
      const catId = p.category_id || 0;
      const catName = p.category_name || 'Uncategorized';

      if (!breakdown[catId]) {
        breakdown[catId] = {
          category_id: catId,
          category_name: catName,
          product_count: 0,
          total_units: 0,
          cost_value: 0,
          retail_value: 0,
        };
      }

      breakdown[catId].product_count += 1;
      breakdown[catId].total_units += p.stock_quantity || 0;
      breakdown[catId].cost_value += (p.cost_price || 0) * (p.stock_quantity || 0);
      breakdown[catId].retail_value += (p.selling_price || 0) * (p.stock_quantity || 0);
    });

    return Object.values(breakdown).sort((a, b) => b.retail_value - a.retail_value);
  }, [products]);

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const renderSummaryView = () => (
    <View>
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Stock Valuation Summary</Title>
          <Divider style={styles.divider} />

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total Products</Paragraph>
              <Title style={styles.summaryValue}>{totals.productCount}</Title>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total Units</Paragraph>
              <Title style={styles.summaryValue}>{totals.totalUnits.toLocaleString()}</Title>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Cost Value</Paragraph>
              <Title style={[styles.summaryValue, { color: theme.colors.primary }]}>
                {formatCurrency(totals.totalCostValue)}
              </Title>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Retail Value</Paragraph>
              <Title style={[styles.summaryValue, { color: '#4CAF50' }]}>
                {formatCurrency(totals.totalRetailValue)}
              </Title>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Potential Profit</Paragraph>
              <Title style={[styles.summaryValue, { color: '#FF9800' }]}>
                {formatCurrency(totals.potentialProfit)}
              </Title>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Profit Margin</Paragraph>
              <Title style={[styles.summaryValue, { color: '#9C27B0' }]}>
                {totals.profitMargin.toFixed(1)}%
              </Title>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Valuation by Category</Title>
          <Divider style={styles.divider} />

          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Category</DataTable.Title>
              <DataTable.Title numeric>Products</DataTable.Title>
              <DataTable.Title numeric>Units</DataTable.Title>
              <DataTable.Title numeric>Cost Value</DataTable.Title>
              <DataTable.Title numeric>Retail Value</DataTable.Title>
            </DataTable.Header>

            {categoryBreakdown.map((cat) => (
              <DataTable.Row key={cat.category_id}>
                <DataTable.Cell>{cat.category_name}</DataTable.Cell>
                <DataTable.Cell numeric>{cat.product_count}</DataTable.Cell>
                <DataTable.Cell numeric>{cat.total_units}</DataTable.Cell>
                <DataTable.Cell numeric>{formatCurrency(cat.cost_value)}</DataTable.Cell>
                <DataTable.Cell numeric>{formatCurrency(cat.retail_value)}</DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </Card.Content>
      </Card>
    </View>
  );

  const renderProductView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={styles.sectionTitle}>Stock Valuation by Product</Title>
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

        <Paragraph style={styles.resultCount}>
          Showing {paginatedProducts.length} of {filteredProducts.length} products
        </Paragraph>

        <DataTable>
          <DataTable.Header>
            <DataTable.Title>Code</DataTable.Title>
            <DataTable.Title style={{ flex: 2 }}>Product Name</DataTable.Title>
            <DataTable.Title numeric>Stock</DataTable.Title>
            <DataTable.Title numeric>Cost</DataTable.Title>
            <DataTable.Title numeric>Retail</DataTable.Title>
            <DataTable.Title numeric>Cost Value</DataTable.Title>
            <DataTable.Title numeric>Retail Value</DataTable.Title>
          </DataTable.Header>

          {paginatedProducts.map((product) => (
            <DataTable.Row key={product.id}>
              <DataTable.Cell>{product.product_code || '-'}</DataTable.Cell>
              <DataTable.Cell style={{ flex: 2 }}>{product.name}</DataTable.Cell>
              <DataTable.Cell numeric>{product.stock_quantity}</DataTable.Cell>
              <DataTable.Cell numeric>{formatCurrency(product.cost_price || 0)}</DataTable.Cell>
              <DataTable.Cell numeric>{formatCurrency(product.selling_price || 0)}</DataTable.Cell>
              <DataTable.Cell numeric>
                {formatCurrency((product.cost_price || 0) * (product.stock_quantity || 0))}
              </DataTable.Cell>
              <DataTable.Cell numeric>
                {formatCurrency((product.selling_price || 0) * (product.stock_quantity || 0))}
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

        <Divider style={styles.divider} />

        <View style={styles.totalRow}>
          <Title style={styles.totalLabel}>Filtered Total:</Title>
          <View style={styles.totalValues}>
            <Paragraph>
              Cost: {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.cost_price || 0) * (p.stock_quantity || 0), 0))}
            </Paragraph>
            <Paragraph>
              Retail: {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.selling_price || 0) * (p.stock_quantity || 0), 0))}
            </Paragraph>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderCategoryView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={styles.sectionTitle}>Detailed Category Breakdown</Title>
        <Divider style={styles.divider} />

        {categoryBreakdown.map((cat) => {
          const profit = cat.retail_value - cat.cost_value;
          const margin = cat.cost_value > 0 ? (profit / cat.cost_value) * 100 : 0;

          return (
            <Card key={cat.category_id} style={styles.categoryCard}>
              <Card.Content>
                <Title style={styles.categoryTitle}>{cat.category_name}</Title>
                <View style={styles.categoryStats}>
                  <View style={styles.statItem}>
                    <Paragraph style={styles.statLabel}>Products</Paragraph>
                    <Paragraph style={styles.statValue}>{cat.product_count}</Paragraph>
                  </View>
                  <View style={styles.statItem}>
                    <Paragraph style={styles.statLabel}>Units</Paragraph>
                    <Paragraph style={styles.statValue}>{cat.total_units}</Paragraph>
                  </View>
                  <View style={styles.statItem}>
                    <Paragraph style={styles.statLabel}>Cost Value</Paragraph>
                    <Paragraph style={[styles.statValue, { color: theme.colors.primary }]}>
                      {formatCurrency(cat.cost_value)}
                    </Paragraph>
                  </View>
                  <View style={styles.statItem}>
                    <Paragraph style={styles.statLabel}>Retail Value</Paragraph>
                    <Paragraph style={[styles.statValue, { color: '#4CAF50' }]}>
                      {formatCurrency(cat.retail_value)}
                    </Paragraph>
                  </View>
                  <View style={styles.statItem}>
                    <Paragraph style={styles.statLabel}>Potential Profit</Paragraph>
                    <Paragraph style={[styles.statValue, { color: '#FF9800' }]}>
                      {formatCurrency(profit)}
                    </Paragraph>
                  </View>
                  <View style={styles.statItem}>
                    <Paragraph style={styles.statLabel}>Margin</Paragraph>
                    <Paragraph style={[styles.statValue, { color: '#9C27B0' }]}>
                      {margin.toFixed(1)}%
                    </Paragraph>
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <Title style={styles.pageTitle}>Stock Valuation Report</Title>
          <Paragraph style={styles.pageSubtitle}>
            Total inventory value at cost and retail prices
          </Paragraph>
        </View>

        <SegmentedButtons
          value={viewMode}
          onValueChange={(value) => setViewMode(value as ViewMode)}
          buttons={[
            { value: 'summary', label: 'Summary' },
            { value: 'byProduct', label: 'By Product' },
            { value: 'byCategory', label: 'By Category' },
          ]}
          style={styles.segmentedButtons}
        />

        {loading ? (
          <Card style={styles.card}>
            <Card.Content>
              <Paragraph>Loading stock valuation data...</Paragraph>
            </Card.Content>
          </Card>
        ) : (
          <>
            {viewMode === 'summary' && renderSummaryView()}
            {viewMode === 'byProduct' && renderProductView()}
            {viewMode === 'byCategory' && renderCategoryView()}
          </>
        )}

        <View style={styles.footer}>
          <Button mode="outlined" onPress={loadData} style={styles.refreshButton}>
            Refresh Data
          </Button>
        </View>
      </ScrollView>
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
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  pageSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  segmentedButtons: {
    marginBottom: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
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
  resultCount: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValues: {
    alignItems: 'flex-end',
  },
  categoryCard: {
    marginBottom: 12,
    elevation: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  categoryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '30%',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  refreshButton: {
    minWidth: 150,
  },
});
