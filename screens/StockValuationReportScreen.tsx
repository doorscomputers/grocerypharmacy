import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
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

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'StockValuationReport'>;
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

type ViewMode = 'summary' | 'byProduct' | 'byCategory';

export default function StockValuationReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
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

      // Get all products with details (no limit for valuation report)
      const productsData = await dbService.getProductsWithDetails(true, 10000, '');
      console.log('Stock Valuation - Loaded products:', productsData.length);
      setProducts(productsData);

      const categoriesData = await dbService.getCategories(false);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading stock valuation data:', error);
      Alert.alert('Error', 'Failed to load stock valuation data. Please try again.');
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
        p.code?.toLowerCase().includes(query)
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
    console.log('Stock Valuation - Active products:', activeProducts.length);

    const totalCostValue = activeProducts.reduce(
      (sum, p) => sum + (p.cost || 0) * (p.stock_quantity || 0), 0
    );
    const totalRetailValue = activeProducts.reduce(
      (sum, p) => sum + (p.price || 0) * (p.stock_quantity || 0), 0
    );
    const totalUnits = activeProducts.reduce(
      (sum, p) => sum + (p.stock_quantity || 0), 0
    );
    const potentialProfit = totalRetailValue - totalCostValue;
    const profitMargin = totalCostValue > 0 ? (potentialProfit / totalCostValue) * 100 : 0;

    console.log('Stock Valuation - Totals:', {
      totalCostValue,
      totalRetailValue,
      totalUnits,
      productCount: activeProducts.length
    });

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
      breakdown[catId].cost_value += (p.cost || 0) * (p.stock_quantity || 0);
      breakdown[catId].retail_value += (p.price || 0) * (p.stock_quantity || 0);
    });

    return Object.values(breakdown).sort((a, b) => b.retail_value - a.retail_value);
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
      .println('STOCK VALUATION')
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
      .leftRight('Total Products:', totals.productCount.toString())
      .leftRight('Total Units:', totals.totalUnits.toLocaleString())
      .separator()
      .leftRight('Cost Value:', `P${totals.totalCostValue.toFixed(2)}`)
      .leftRight('Retail Value:', `P${totals.totalRetailValue.toFixed(2)}`)
      .separator()
      .bold(true)
      .leftRight('Potential Profit:', `P${totals.potentialProfit.toFixed(2)}`)
      .leftRight('Profit Margin:', `${totals.profitMargin.toFixed(1)}%`)
      .bold(false)
      .doubleSeparator();

    // Category breakdown
    builder
      .bold(true)
      .println('BY CATEGORY')
      .bold(false)
      .separator();

    for (const cat of categoryBreakdown) {
      const catName = cat.category_name.length > printerWidth - 15
        ? cat.category_name.substring(0, printerWidth - 17) + '..'
        : cat.category_name;
      builder.println(catName);
      builder.leftRight(`  Units: ${cat.total_units}`, `P${cat.retail_value.toFixed(2)}`);
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
    const dateStr = formatPrinterDate(now);
    const timeStr = formatPrinterDateTime(now).split(' ').slice(-2).join(' ');

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
          .primary { color: #1976D2; }
          .success { color: #4CAF50; }
          .warning { color: #FF9800; }
          .purple { color: #9C27B0; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
          .total-row { background-color: #E8F5E9; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          ${companySettings.address ? `<div class="company-info">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
          <div class="report-title">STOCK VALUATION REPORT</div>
          <div class="date-time">Generated: ${dateStr} ${timeStr}</div>
        </div>

        <div class="section">
          <div class="section-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total Products</div>
              <div class="summary-value">${totals.productCount}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Units</div>
              <div class="summary-value">${totals.totalUnits.toLocaleString()}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Cost Value</div>
              <div class="summary-value primary">${formatCurrency(totals.totalCostValue)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Retail Value</div>
              <div class="summary-value success">${formatCurrency(totals.totalRetailValue)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Potential Profit</div>
              <div class="summary-value warning">${formatCurrency(totals.potentialProfit)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Profit Margin</div>
              <div class="summary-value purple">${totals.profitMargin.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Valuation by Category</div>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th class="text-right">Products</th>
                <th class="text-right">Units</th>
                <th class="text-right">Cost Value</th>
                <th class="text-right">Retail Value</th>
                <th class="text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              ${categoryBreakdown.map(cat => {
                const profit = cat.retail_value - cat.cost_value;
                return `
                  <tr>
                    <td>${cat.category_name}</td>
                    <td class="text-right">${cat.product_count}</td>
                    <td class="text-right">${cat.total_units}</td>
                    <td class="text-right">${formatCurrency(cat.cost_value)}</td>
                    <td class="text-right">${formatCurrency(cat.retail_value)}</td>
                    <td class="text-right warning">${formatCurrency(profit)}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td class="text-right"><strong>${totals.productCount}</strong></td>
                <td class="text-right"><strong>${totals.totalUnits.toLocaleString()}</strong></td>
                <td class="text-right"><strong>${formatCurrency(totals.totalCostValue)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(totals.totalRetailValue)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(totals.potentialProfit)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Top Products by Value (${filteredProducts.length} total)</div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Name</th>
                <th class="text-right">Stock</th>
                <th class="text-right">Cost</th>
                <th class="text-right">Retail</th>
                <th class="text-right">Cost Value</th>
                <th class="text-right">Retail Value</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts.slice(0, 30).map(product => `
                <tr>
                  <td>${product.code || '-'}</td>
                  <td>${product.name}</td>
                  <td class="text-right">${product.stock_quantity}</td>
                  <td class="text-right">${formatCurrency(product.cost || 0)}</td>
                  <td class="text-right">${formatCurrency(product.price || 0)}</td>
                  <td class="text-right">${formatCurrency((product.cost || 0) * (product.stock_quantity || 0))}</td>
                  <td class="text-right">${formatCurrency((product.price || 0) * (product.stock_quantity || 0))}</td>
                </tr>
              `).join('')}
              ${filteredProducts.length > 30 ? `<tr><td colspan="7" class="text-center"><em>...and ${filteredProducts.length - 30} more products</em></td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <div class="footer">
          Report generated on ${formatPrinterDateTime(now)}
        </div>
      </body>
      </html>
    `;
    return html;
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
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Stock Valuation Summary</Title>
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
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Valuation by Category</Title>
          <Divider style={styles.divider} />

          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <DataTable style={{ minWidth: 700 }}>
              <DataTable.Header>
                <DataTable.Title style={{ width: 180 }}>Category</DataTable.Title>
                <DataTable.Title numeric style={{ width: 100 }}>Products</DataTable.Title>
                <DataTable.Title numeric style={{ width: 80 }}>Units</DataTable.Title>
                <DataTable.Title numeric style={{ width: 150 }}>Cost Value</DataTable.Title>
                <DataTable.Title numeric style={{ width: 150 }}>Retail Value</DataTable.Title>
              </DataTable.Header>

              {categoryBreakdown.map((cat) => (
                <DataTable.Row key={cat.category_id}>
                  <DataTable.Cell style={{ width: 180 }}>{cat.category_name}</DataTable.Cell>
                  <DataTable.Cell numeric style={{ width: 100 }}>{cat.product_count}</DataTable.Cell>
                  <DataTable.Cell numeric style={{ width: 80 }}>{cat.total_units}</DataTable.Cell>
                  <DataTable.Cell numeric style={{ width: 150 }}>{formatCurrency(cat.cost_value)}</DataTable.Cell>
                  <DataTable.Cell numeric style={{ width: 150 }}>{formatCurrency(cat.retail_value)}</DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>
    </View>
  );

  const renderProductView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Stock Valuation by Product</Title>
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
              <DataTable.Title style={{ flex: 1 }}>Code</DataTable.Title>
              <DataTable.Title style={{ flex: 2 }}>Product</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 0.7 }}>Stock</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>Cost</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>Retail</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1.2 }}>Cost Val.</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1.2 }}>Retail Val.</DataTable.Title>
            </DataTable.Header>

            {paginatedProducts.map((product) => (
              <DataTable.Row key={product.id}>
                <DataTable.Cell style={{ flex: 1 }}>
                  <Paragraph numberOfLines={1} style={styles.cellSmall}>{product.code || '-'}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell style={{ flex: 2 }}>
                  <Paragraph numberOfLines={1}>{product.name}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.7 }}>{product.stock_quantity}</DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>{formatCurrency(product.cost || 0)}</DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>{formatCurrency(product.price || 0)}</DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.2 }}>
                  {formatCurrency((product.cost || 0) * (product.stock_quantity || 0))}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.2 }}>
                  {formatCurrency((product.price || 0) * (product.stock_quantity || 0))}
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
              Cost: {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.cost || 0) * (p.stock_quantity || 0), 0))}
            </Paragraph>
            <Paragraph>
              Retail: {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.price || 0) * (p.stock_quantity || 0), 0))}
            </Paragraph>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderCategoryView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Detailed Category Breakdown</Title>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Stock Valuation Report"
        reportFileName="StockValuationReport"
        disabled={products.length === 0}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
      >
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
            <Card.Content style={{ alignItems: 'center', paddingVertical: 48 }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Paragraph style={{ marginTop: 12, opacity: 0.7 }}>Loading stock valuation data...</Paragraph>
            </Card.Content>
          </Card>
        ) : products.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Title style={[styles.emptyTitle, { fontSize: 20 }]}>No Products Found</Title>
              <Paragraph style={[styles.emptyText, { fontSize: 14 }]}>
                There are no active products in your inventory.{'\n'}
                Add products first to see the stock valuation report.
              </Paragraph>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('Products')}
                style={{ marginTop: 16 }}
                icon="plus"
              >
                Add Products
              </Button>
              <Button mode="outlined" onPress={loadData} style={{ marginTop: 8 }} icon="refresh">
                Refresh
              </Button>
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
  cellSmall: {
    fontSize: 11,
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 16,
  },
});
