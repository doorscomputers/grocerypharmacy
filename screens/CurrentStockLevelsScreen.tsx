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
} from 'react-native-paper';

import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder, PRINTER_WIDTH } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'CurrentStockLevels'>;
  route: RouteProp<RootStackParamList, 'CurrentStockLevels'>;
};

interface Product {
  id: number;
  name: string;
  stock_quantity: number;
  category_id?: number;
  category_name?: string;
  is_active: boolean;
}

interface Category {
  id: number;
  name: string;
}

export default function CurrentStockLevelsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const lowStockOnly = route.params?.lowStock || false;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

      const db = (dbService as any).getDatabase ? (dbService as any).getDatabase() : null;
      if (db) {
        const query = lowStockOnly
          ? `SELECT p.id, p.name, p.stock_quantity, p.category_id, c.name as category_name, p.is_active, p.reorder_level
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_active = 1 AND p.stock_quantity <= p.reorder_level AND p.stock_quantity > 0
             ORDER BY p.stock_quantity ASC, p.name`
          : `SELECT p.id, p.name, p.stock_quantity, p.category_id, c.name as category_name, p.is_active
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_active = 1
             ORDER BY p.name`;
        const productsData = await db.getAllAsync(query);
        setProducts(productsData);
      } else {
        const productsData = await dbService.getProducts(false);
        setProducts(productsData.filter((p: any) => p.is_active));
      }

      const categoriesData = await dbService.getCategories(false);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading stock levels:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    return filtered;
  }, [products, searchQuery, selectedCategory]);

  const totalQty = useMemo(() => {
    return filteredProducts.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
  }, [filteredProducts]);

  const paginatedProducts = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedCategory]);

  const reportTitle = lowStockOnly ? 'Low Stock Alert' : 'Current Stock Levels';

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println(lowStockOnly ? 'LOW STOCK ALERT' : 'CURRENT STOCK LEVELS')
      .normalSize()
      .bold(false)
      .feed()
      .println(formatPrinterDate(now))
      .println(formatPrinterDateTime(now).split(' ').slice(-2).join(' '))
      .doubleSeparator();

    builder
      .align('left')
      .bold(true)
      .leftRight('PRODUCT', 'QTY')
      .bold(false)
      .separator();

    const printProducts = filteredProducts.slice(0, 50);
    for (const product of printProducts) {
      const maxNameLen = printerWidth - 8;
      const name = product.name.length > maxNameLen
        ? product.name.substring(0, maxNameLen - 2) + '..'
        : product.name;
      builder.leftRight(name, String(product.stock_quantity || 0));
    }

    if (filteredProducts.length > 50) {
      builder.feed().println(`... and ${filteredProducts.length - 50} more items`);
    }

    builder
      .separator()
      .bold(true)
      .leftRight('TOTAL ITEMS:', filteredProducts.length.toString())
      .leftRight('TOTAL QTY:', totalQty.toString())
      .bold(false)
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
    const timeStr = now.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour12: true });

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
          .date-time { font-size: 11px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 11px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
          .summary { margin: 10px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          ${companySettings.address ? `<div class="company-info">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
          <div class="report-title">${reportTitle.toUpperCase()}</div>
          <div class="date-time">Generated: ${dateStr} ${timeStr}</div>
        </div>

        <div class="summary">Total Products: ${filteredProducts.length} | Total Quantity: ${totalQty.toLocaleString()}</div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th class="text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${filteredProducts.map((product, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${product.name}</td>
                <td class="text-right">${product.stock_quantity || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Report generated on ${now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
        </div>
      </body>
      </html>
    `;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle={reportTitle}
        reportFileName={lowStockOnly ? 'LowStockAlert' : 'CurrentStockLevels'}
        disabled={filteredProducts.length === 0}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { padding: sp.md }]}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.bodySmall }]}>Total Products</Paragraph>
                <Title style={[styles.summaryValue, { color: theme.colors.primary }]}>
                  {filteredProducts.length}
                </Title>
              </View>
              <View style={[styles.summaryItem, { padding: sp.md }]}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.bodySmall }]}>Total Quantity</Paragraph>
                <Title style={[styles.summaryValue, { color: theme.colors.primary }]}>
                  {totalQty.toLocaleString()}
                </Title>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Product List */}
        <Card style={styles.card}>
          <Card.Content>
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
                  All
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

            <Paragraph style={[styles.resultCount, { fontSize: fs.caption }]}>
              Showing {paginatedProducts.length} of {filteredProducts.length} products
            </Paragraph>

            {loading ? (
              <Paragraph>Loading...</Paragraph>
            ) : filteredProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Title style={styles.emptyTitle}>No products found</Title>
              </View>
            ) : (
              <>
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 3 }}>Product</DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}>Qty</DataTable.Title>
                  </DataTable.Header>

                  {paginatedProducts.map((product) => (
                    <DataTable.Row key={product.id}>
                      <DataTable.Cell style={{ flex: 3 }}>{product.name}</DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}>{product.stock_quantity || 0}</DataTable.Cell>
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
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    opacity: 0.5,
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  refreshButton: {
    minWidth: 150,
  },
});
