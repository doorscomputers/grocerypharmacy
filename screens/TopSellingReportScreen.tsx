import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
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
import { formatPrinterDate, formatPrinterDateTime, toLocalDateString } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'TopSellingReport'>;
};

interface TopProduct {
  id: number;
  product_code: string;
  name: string;
  category_name?: string;
  quantity_sold: number;
  total_revenue: number;
  average_price: number;
  transaction_count: number;
}

export default function TopSellingReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'quantity' | 'revenue'>('quantity');
  const [dateRange, setDateRange] = useState<'all' | 'year' | 'month' | 'week'>('all');
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    loadCompanySettings();
  }, []);

  useEffect(() => {
    loadData();
  }, [dateRange]);

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
      setError(null);
      const dbService = getDatabase();
      const db = dbService.getDatabase();

      // Calculate date filter using device local date
      let dateFilter = '';
      const now = new Date();
      if (dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = `AND t.transaction_date >= '${toLocalDateString(weekAgo)}'`;
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = `AND t.transaction_date >= '${toLocalDateString(monthAgo)}'`;
      } else if (dateRange === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = `AND t.transaction_date >= '${toLocalDateString(yearStart)}'`;
      }

      const query = `
        SELECT
          p.id,
          p.code as product_code,
          p.name,
          c.name as category_name,
          SUM(ti.quantity) as quantity_sold,
          SUM(ti.total_amount) as total_revenue,
          CASE WHEN SUM(ti.quantity) > 0
            THEN SUM(ti.total_amount) / SUM(ti.quantity)
            ELSE 0
          END as average_price,
          COUNT(DISTINCT t.id) as transaction_count
        FROM transaction_items ti
        INNER JOIN transactions t ON ti.transaction_id = t.id
          AND t.status = 'COMPLETED'
          ${dateFilter}
        INNER JOIN products p ON ti.product_id = p.id
          AND p.is_active = 1
        LEFT JOIN categories c ON p.category_id = c.id
        GROUP BY p.id
        ORDER BY quantity_sold DESC
      `;

      const results = await db.getAllAsync(query) as TopProduct[];
      setProducts(results || []);
    } catch (err: any) {
      console.error('Error loading top selling data:', err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.product_code?.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortBy === 'revenue') {
      filtered.sort((a, b) => b.total_revenue - a.total_revenue);
    } else {
      filtered.sort((a, b) => b.quantity_sold - a.quantity_sold);
    }

    return filtered;
  }, [products, searchQuery, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalQuantity = products.reduce((sum, p) => sum + p.quantity_sold, 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.total_revenue, 0);
    const totalTransactions = new Set(products.flatMap(p => p.transaction_count)).size;
    const top10Revenue = products.slice(0, 10).reduce((sum, p) => sum + p.total_revenue, 0);
    const top10Percentage = totalRevenue > 0 ? (top10Revenue / totalRevenue) * 100 : 0;

    return {
      totalProducts: products.length,
      totalQuantity,
      totalRevenue,
      top10Percentage,
    };
  }, [products]);

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      default: return 'All Time';
    }
  };

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('TOP SELLING')
      .println('PRODUCTS')
      .normalSize()
      .bold(false)
      .feed()
      .println(getDateRangeLabel())
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
      .leftRight('Products Sold:', stats.totalProducts.toString())
      .leftRight('Total Quantity:', stats.totalQuantity.toLocaleString())
      .leftRight('Total Revenue:', `P${stats.totalRevenue.toFixed(2)}`)
      .leftRight('Top 10 Share:', `${stats.top10Percentage.toFixed(1)}%`)
      .separator();

    // Top 20 products
    const printProducts = filteredProducts.slice(0, 20);
    if (printProducts.length > 0) {
      builder
        .bold(true)
        .println(`TOP ${printProducts.length} PRODUCTS`)
        .bold(false)
        .separator();

      printProducts.forEach((product, index) => {
        const rank = (index + 1).toString().padStart(2, ' ');
        const name = product.name.length > printerWidth - 15
          ? product.name.substring(0, printerWidth - 17) + '..'
          : product.name;
        builder.println(`${rank}. ${name}`);
        builder.leftRight(`   Qty: ${product.quantity_sold}`, `P${product.total_revenue.toFixed(2)}`);
      });

      if (filteredProducts.length > 20) {
        builder.feed().println(`... and ${filteredProducts.length - 20} more products`);
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
    const dateStr = formatPrinterDate(now);
    const timeStr = formatPrinterDateTime(now).split(' ').slice(-2).join(' ');

    return `
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
          .date-range { font-size: 12px; color: #2196F3; font-weight: bold; }
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
          .rank-1 { background-color: #FFD700; color: #000; }
          .rank-2 { background-color: #C0C0C0; color: #000; }
          .rank-3 { background-color: #CD7F32; color: #fff; }
          .rank { font-weight: bold; width: 30px; text-align: center; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          ${companySettings.address ? `<div class="company-info">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
          <div class="report-title">TOP SELLING PRODUCTS REPORT</div>
          <div class="date-range">${getDateRangeLabel()}</div>
          <div class="date-time">Generated: ${dateStr} ${timeStr}</div>
        </div>

        <div class="section">
          <div class="section-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Products Sold</div>
              <div class="summary-value">${stats.totalProducts}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Quantity Sold</div>
              <div class="summary-value">${stats.totalQuantity.toLocaleString()}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Revenue</div>
              <div class="summary-value" style="color: #4CAF50;">${formatCurrency(stats.totalRevenue)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Top 10 Revenue Share</div>
              <div class="summary-value" style="color: #2196F3;">${stats.top10Percentage.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Top Selling Products (${filteredProducts.length})</div>
          <table>
            <thead>
              <tr>
                <th class="text-center">#</th>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th class="text-right">Qty Sold</th>
                <th class="text-right">Revenue</th>
                <th class="text-right">Avg Price</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts.slice(0, 100).map((product, index) => `
                <tr>
                  <td class="rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''}">${index + 1}</td>
                  <td>${product.product_code || '-'}</td>
                  <td>${product.name}</td>
                  <td>${product.category_name || 'Uncategorized'}</td>
                  <td class="text-right">${product.quantity_sold.toLocaleString()}</td>
                  <td class="text-right">${formatCurrency(product.total_revenue)}</td>
                  <td class="text-right">${formatCurrency(product.average_price)}</td>
                </tr>
              `).join('')}
              ${filteredProducts.length > 100 ? `<tr><td colspan="7" class="text-center"><em>...and ${filteredProducts.length - 100} more products</em></td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <div class="footer">
          Report generated on ${formatPrinterDateTime(now)}
        </div>
      </body>
      </html>
    `;
  };

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Top Selling Products"
        reportFileName="TopSellingProducts"
        disabled={filteredProducts.length === 0}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Date Range Filter */}
        <View style={styles.dateRangeContainer}>
          <SegmentedButtons
            value={dateRange}
            onValueChange={(value) => setDateRange(value as any)}
            buttons={[
              { value: 'all', label: 'All Time' },
              { value: 'year', label: 'This Year' },
              { value: 'month', label: 'This Month' },
              { value: 'week', label: 'This Week' },
            ]}
            style={styles.segmentedButtons}
          />
        </View>

        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Summary - {getDateRangeLabel()}</Title>
            <Divider style={styles.divider} />

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Products Sold</Paragraph>
                <Title style={styles.summaryValue}>{stats.totalProducts}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Quantity</Paragraph>
                <Title style={[styles.summaryValue, { color: '#2196F3' }]}>
                  {stats.totalQuantity.toLocaleString()}
                </Title>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Revenue</Paragraph>
                <Title style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  {formatCurrency(stats.totalRevenue)}
                </Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Top 10 Revenue Share</Paragraph>
                <Title style={[styles.summaryValue, { color: '#FF9800' }]}>
                  {stats.top10Percentage.toFixed(1)}%
                </Title>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Product List */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Product Rankings</Title>
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

            <View style={styles.sortContainer}>
              <Paragraph style={styles.sortLabel}>Sort by:</Paragraph>
              <Chip
                selected={sortBy === 'quantity'}
                onPress={() => setSortBy('quantity')}
                style={styles.sortChip}
              >
                Quantity Sold
              </Chip>
              <Chip
                selected={sortBy === 'revenue'}
                onPress={() => setSortBy('revenue')}
                style={styles.sortChip}
              >
                Revenue
              </Chip>
            </View>

            <Paragraph style={styles.resultCount}>
              Showing {paginatedProducts.length} of {filteredProducts.length} products
            </Paragraph>

            {loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Paragraph style={[styles.emptyText, { marginTop: 12 }]}>Loading report data...</Paragraph>
              </View>
            ) : error ? (
              <View style={styles.emptyState}>
                <Title style={[styles.emptyTitle, { color: '#F44336' }]}>Error Loading Data</Title>
                <Paragraph style={styles.emptyText}>{error}</Paragraph>
                <Button mode="outlined" onPress={loadData} style={{ marginTop: 12 }}>Retry</Button>
              </View>
            ) : filteredProducts.length === 0 ? (
              <View style={[styles.emptyState, { paddingVertical: 48 }]}>
                <Title style={[styles.emptyTitle, { fontSize: 20 }]}>No Sales Data</Title>
                <Paragraph style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
                  No completed transactions found{dateRange !== 'all' ? ` for "${getDateRangeLabel()}"` : ''}.{'\n'}
                  Process sales in the POS terminal first.
                </Paragraph>
                <Button mode="outlined" onPress={loadData} style={{ marginTop: 16 }} icon="refresh">
                  Refresh
                </Button>
              </View>
            ) : (
              <>
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 0.5 }}>#</DataTable.Title>
                    <DataTable.Title style={{ flex: 2 }}>Product</DataTable.Title>
                    <DataTable.Title>Category</DataTable.Title>
                    <DataTable.Title numeric>Qty Sold</DataTable.Title>
                    <DataTable.Title numeric>Revenue</DataTable.Title>
                  </DataTable.Header>

                  {paginatedProducts.map((product, index) => {
                    const rank = currentPage * itemsPerPage + index + 1;
                    return (
                      <DataTable.Row key={product.id}>
                        <DataTable.Cell style={{ flex: 0.5 }}>
                          <View style={[
                            styles.rankBadge,
                            rank === 1 && styles.rankGold,
                            rank === 2 && styles.rankSilver,
                            rank === 3 && styles.rankBronze,
                          ]}>
                            <Paragraph style={[
                              styles.rankText,
                              rank <= 3 && styles.rankTextTop
                            ]}>{rank}</Paragraph>
                          </View>
                        </DataTable.Cell>
                        <DataTable.Cell style={{ flex: 2 }}>
                          <View>
                            <Paragraph style={styles.productName} numberOfLines={1}>{product.name}</Paragraph>
                            <Paragraph style={styles.productCode}>{product.product_code || '-'}</Paragraph>
                          </View>
                        </DataTable.Cell>
                        <DataTable.Cell>{product.category_name || '-'}</DataTable.Cell>
                        <DataTable.Cell numeric>
                          <Paragraph style={styles.quantityText}>{product.quantity_sold.toLocaleString()}</Paragraph>
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                          <Paragraph style={styles.revenueText}>{formatCurrency(product.total_revenue)}</Paragraph>
                        </DataTable.Cell>
                      </DataTable.Row>
                    );
                  })}
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
  dateRangeContainer: {
    marginBottom: 16,
  },
  segmentedButtons: {
    marginBottom: 8,
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
  searchInput: {
    marginBottom: 12,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sortLabel: {
    marginRight: 8,
    opacity: 0.7,
  },
  sortChip: {
    marginRight: 8,
  },
  resultCount: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankGold: {
    backgroundColor: '#FFD700',
  },
  rankSilver: {
    backgroundColor: '#C0C0C0',
  },
  rankBronze: {
    backgroundColor: '#CD7F32',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  rankTextTop: {
    color: '#000',
  },
  productName: {
    fontSize: 13,
    fontWeight: '500',
  },
  productCode: {
    fontSize: 10,
    opacity: 0.6,
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2196F3',
  },
  revenueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#9E9E9E',
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
