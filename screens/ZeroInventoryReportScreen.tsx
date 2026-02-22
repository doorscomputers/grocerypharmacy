import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
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
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder, PRINTER_WIDTH } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'ZeroInventoryReport'>;
};

interface Product {
  id: number;
  code: string;
  name: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  cost: number;
  price: number;
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
  const { sp, fs, lo } = useResponsiveTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showInactiveProducts, setShowInactiveProducts] = useState(false);
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    loadData();
    loadCompanySettings();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const dbService = getDatabase();
      const name = await dbService.getSetting('company_name') || 'IgoroTech POS';
      const address = await dbService.getSetting('company_address') || '';
      const tin = await dbService.getSetting('company_tin') || '';
      setCompanySettings({ name, address, tin });
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      // Get ALL products with category_name joined - no limit since we need to find all zero-stock items
      const db = (dbService as any).getDatabase ? (dbService as any).getDatabase() : null;
      if (db) {
        const productsData = await db.getAllAsync(
          `SELECT p.id, p.code, p.name, p.description, p.price, p.cost, p.category_id,
                  c.name as category_name, p.stock_quantity, p.reorder_level, p.is_active
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           ORDER BY p.name`
        );
        setProducts(productsData);
      } else {
        // Fallback for web mock
        const productsData = await dbService.getProducts(false);
        setProducts(productsData);
      }

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
        p.code?.toLowerCase().includes(query)
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
      (sum, p) => sum + (p.price || 0), 0
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
      .println(formatPrinterDate(now))
      .println(formatPrinterDateTime(now).split(' ').slice(-2).join(' '))
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
        builder.leftRight(`  ${product.code || '-'}`, `P${(product.price || 0).toFixed(2)}`);
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

  const buildPdfHtml = (): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    const timeStr = now.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' });

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 18px; font-weight: bold; }
          .company-info { font-size: 11px; color: #666; }
          .report-title { font-size: 16px; font-weight: bold; margin: 15px 0; }
          .date-time { font-size: 11px; color: #666; }
          .section { margin: 15px 0; }
          .section-title { font-size: 13px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 11px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .summary-grid { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
          .summary-item { flex: 1; min-width: 120px; padding: 10px; background: #f9f9f9; border-radius: 5px; text-align: center; }
          .summary-label { font-size: 10px; color: #666; }
          .summary-value { font-size: 14px; font-weight: bold; }
          .danger { color: #F44336; }
          .warning { color: #FF9800; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
          .status-active { color: #4CAF50; }
          .status-inactive { color: #F44336; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          ${companySettings.address ? `<div class="company-info">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
          <div class="report-title">ZERO INVENTORY REPORT</div>
          <div class="date-time">Generated: ${dateStr} ${timeStr}</div>
        </div>

        <div class="section">
          <div class="section-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Products with Zero Stock</div>
              <div class="summary-value danger">${stats.zeroStockCount}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Active Products</div>
              <div class="summary-value">${stats.totalProducts}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Out of Stock Rate</div>
              <div class="summary-value ${stats.percentage > 20 ? 'danger' : 'warning'}">${stats.percentage.toFixed(1)}%</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Potential Lost Revenue</div>
              <div class="summary-value" style="color: #9C27B0;">${formatCurrency(stats.lostPotentialRevenue)}</div>
            </div>
          </div>
        </div>

        ${stats.byCategory.length > 0 ? `
          <div class="section">
            <div class="section-title">Zero Stock by Category</div>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th class="text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                ${stats.byCategory.map(([category, count]) => `
                  <tr>
                    <td>${category}</td>
                    <td class="text-right danger">${count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Zero Stock Products (${zeroStockProducts.length})</div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th class="text-right">Cost</th>
                <th class="text-right">Selling</th>
                <th class="text-right">Reorder</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${zeroStockProducts.slice(0, 50).map(product => `
                <tr>
                  <td>${product.code || '-'}</td>
                  <td>${product.name}</td>
                  <td>${product.category_name || 'Uncategorized'}</td>
                  <td class="text-right">${formatCurrency(product.cost || 0)}</td>
                  <td class="text-right">${formatCurrency(product.price || 0)}</td>
                  <td class="text-right">${product.reorder_level || 0}</td>
                  <td class="text-center ${product.is_active ? 'status-active' : 'status-inactive'}">${product.is_active ? 'Active' : 'Inactive'}</td>
                </tr>
              `).join('')}
              ${zeroStockProducts.length > 50 ? `<tr><td colspan="7" class="text-center"><em>...and ${zeroStockProducts.length - 50} more products</em></td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <div class="footer">
          Report generated on ${now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
        </div>
      </body>
      </html>
    `;
    return html;
  };

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return zeroStockProducts.slice(start, start + itemsPerPage);
  }, [zeroStockProducts, currentPage]);

  const totalPages = Math.ceil(zeroStockProducts.length / itemsPerPage);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Zero Inventory Report"
        reportFileName="ZeroInventoryReport"
        disabled={zeroStockProducts.length === 0}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
      >

        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Summary</Title>
            <Divider style={styles.divider} />

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.bodySmall }]}>Products with Zero Stock</Paragraph>
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
              <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Zero Stock by Category</Title>
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
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Zero Stock Products</Title>
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
                      <DataTable.Cell>{product.code || '-'}</DataTable.Cell>
                      <DataTable.Cell style={{ flex: 2 }}>{product.name}</DataTable.Cell>
                      <DataTable.Cell>{product.category_name || 'Uncategorized'}</DataTable.Cell>
                      <DataTable.Cell numeric>{formatCurrency(product.cost || 0)}</DataTable.Cell>
                      <DataTable.Cell numeric>{formatCurrency(product.price || 0)}</DataTable.Cell>
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
    paddingBottom: 100,
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
