import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Platform, TextInput as RNTextInput } from 'react-native';
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
  IconButton,
  SegmentedButtons,
  List,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange, DatePreset } from '../components/DateRangeFilter';
import PrintOptionsDialog from '../components/PrintOptionsDialog';
import { ESCPOSBuilder } from '../utils/escpos';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'SalesReport'>;
};

interface Transaction {
  id: number;
  transaction_number: string;
  invoice_number: string;
  customer_id?: number;
  customer_name?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  amount_tendered: number;
  change_amount: number;
  cashier_id: number;
  cashier_name?: string;
  status: string;
  transaction_date: string;
  created_at: string;
}

interface TransactionItem {
  id: number;
  transaction_id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

interface ProductSale {
  product_id: number;
  product_code: string;
  product_name: string;
  quantity_sold: number;
  total_sales: number;
  total_discount: number;
  total_tax: number;
  transaction_count: number;
}

interface CategorySale {
  category_id: number;
  category_name: string;
  quantity_sold: number;
  total_sales: number;
  product_count: number;
  transaction_count: number;
}

type ReportView = 'summary' | 'products' | 'categories' | 'transactions';

export default function SalesReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<ReportView>('summary');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [printDialogVisible, setPrintDialogVisible] = useState(false);

  // Pagination for transactions table
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    loadData();
  }, []);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
      setCurrentPage(0);
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      // Load all transactions
      const allTransactions = await dbService.getTransactions(500);
      setTransactions(allTransactions);

      // Load all transaction items in one query for product/category breakdown
      const items = await dbService.getAllTransactionItems();
      setTransactionItems(items);

      // Load products and categories
      const productsData = await dbService.getProducts();
      setProducts(productsData);

      const categoriesData = await dbService.getCategories(false);
      setCategories(categoriesData);

    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions by date range and search
  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(t => {
      const txnDate = new Date(t.transaction_date || t.created_at);
      return txnDate >= dateRange.startDate && txnDate <= dateRange.endDate;
    });

    // Payment method filter
    if (selectedPaymentMethod) {
      filtered = filtered.filter(t => t.payment_method === selectedPaymentMethod);
    }

    // Global search across multiple fields
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => {
        const searchableFields = [
          t.invoice_number,
          t.transaction_number,
          t.customer_name,
          t.payment_method,
          t.status,
          t.cashier_name,
          t.total_amount?.toString(),
        ].filter(Boolean).map(f => f?.toLowerCase() || '');

        return searchableFields.some(field => field.includes(query));
      });
    }

    return filtered.sort((a, b) =>
      new Date(b.transaction_date || b.created_at).getTime() -
      new Date(a.transaction_date || a.created_at).getTime()
    );
  }, [transactions, dateRange, searchQuery, selectedPaymentMethod]);

  // Calculate sales summary
  const salesSummary = useMemo(() => {
    const completed = filteredTransactions.filter(t => t.status === 'COMPLETED');
    const voided = filteredTransactions.filter(t => t.status === 'VOID');
    const refunded = filteredTransactions.filter(t => t.status === 'REFUNDED');

    const grossSales = completed.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const totalTax = completed.reduce((sum, t) => sum + (t.tax_amount || 0), 0);
    const totalDiscount = completed.reduce((sum, t) => sum + (t.discount_amount || 0), 0);
    const voidAmount = voided.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const refundAmount = refunded.reduce((sum, t) => sum + (t.total_amount || 0), 0);

    // By payment method
    const byPaymentMethod = completed.reduce((acc, t) => {
      const method = t.payment_method || 'CASH';
      if (!acc[method]) acc[method] = { count: 0, total: 0 };
      acc[method].count++;
      acc[method].total += t.total_amount || 0;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    // By payment status
    const byPaymentStatus = completed.reduce((acc, t) => {
      const status = t.payment_status || 'PAID';
      if (!acc[status]) acc[status] = { count: 0, total: 0 };
      acc[status].count++;
      acc[status].total += t.total_amount || 0;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    return {
      transactionCount: completed.length,
      grossSales,
      totalTax,
      totalDiscount,
      netSales: grossSales - totalDiscount,
      vatableSales: grossSales - totalTax, // VAT-exclusive base
      voidCount: voided.length,
      voidAmount,
      refundCount: refunded.length,
      refundAmount,
      byPaymentMethod,
      byPaymentStatus,
      averageTransaction: completed.length > 0 ? grossSales / completed.length : 0,
    };
  }, [filteredTransactions]);

  // Calculate sales by product
  const salesByProduct = useMemo(() => {
    const txnIds = new Set(filteredTransactions.filter(t => t.status === 'COMPLETED').map(t => t.id));
    const relevantItems = transactionItems.filter(item => txnIds.has(item.transaction_id));

    const productSales: Record<number, ProductSale> = {};

    relevantItems.forEach(item => {
      if (!productSales[item.product_id]) {
        productSales[item.product_id] = {
          product_id: item.product_id,
          product_code: item.product_code,
          product_name: item.product_name,
          quantity_sold: 0,
          total_sales: 0,
          total_discount: 0,
          total_tax: 0,
          transaction_count: 0,
        };
      }
      productSales[item.product_id].quantity_sold += item.quantity;
      productSales[item.product_id].total_sales += item.total_amount;
      productSales[item.product_id].total_discount += item.discount_amount || 0;
      productSales[item.product_id].total_tax += item.tax_amount || 0;
      productSales[item.product_id].transaction_count++;
    });

    // Filter by search
    let result = Object.values(productSales);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.product_name.toLowerCase().includes(query) ||
        p.product_code.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => b.total_sales - a.total_sales);
  }, [filteredTransactions, transactionItems, searchQuery]);

  // Calculate sales by category
  const salesByCategory = useMemo(() => {
    const txnIds = new Set(filteredTransactions.filter(t => t.status === 'COMPLETED').map(t => t.id));
    const relevantItems = transactionItems.filter(item => txnIds.has(item.transaction_id));

    const categorySales: Record<number, CategorySale> = {};

    relevantItems.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      const categoryId = product?.category_id || 0;
      const category = categories.find(c => c.id === categoryId);
      const categoryName = category?.name || 'Uncategorized';

      if (!categorySales[categoryId]) {
        categorySales[categoryId] = {
          category_id: categoryId,
          category_name: categoryName,
          quantity_sold: 0,
          total_sales: 0,
          product_count: 0,
          transaction_count: 0,
        };
      }
      categorySales[categoryId].quantity_sold += item.quantity;
      categorySales[categoryId].total_sales += item.total_amount;
      categorySales[categoryId].transaction_count++;
    });

    // Count unique products per category
    Object.keys(categorySales).forEach(catId => {
      const categoryProducts = new Set(
        relevantItems
          .filter(item => {
            const product = products.find(p => p.id === item.product_id);
            return (product?.category_id || 0) === parseInt(catId);
          })
          .map(item => item.product_id)
      );
      categorySales[parseInt(catId)].product_count = categoryProducts.size;
    });

    // Filter by search
    let result = Object.values(categorySales);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => c.category_name.toLowerCase().includes(query));
    }

    return result.sort((a, b) => b.total_sales - a.total_sales);
  }, [filteredTransactions, transactionItems, products, categories, searchQuery]);

  const formatCurrency = (amount: number) => `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#4CAF50';
      case 'VOID': return '#F44336';
      case 'REFUNDED': return '#FF9800';
      default: return '#757575';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'CASH': return '#4CAF50';
      case 'CARD': return '#2196F3';
      case 'GCASH': case 'ONLINE': return '#9C27B0';
      case 'CHECK': return '#FF9800';
      case 'CHARGE_INVOICE': return '#E91E63';
      default: return '#757575';
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CHARGE_INVOICE': return 'Charge';
      case 'ONLINE': return 'E-Wallet';
      default: return method;
    }
  };

  const paymentMethods = ['CASH', 'CARD', 'ONLINE', 'CHECK', 'CHARGE_INVOICE'];

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('SALES REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .println(now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }))
      .println(now.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' }))
      .feed()
      .println(`Period: ${dateRange.startDate.toLocaleDateString('en-PH')}`)
      .println(`to ${dateRange.endDate.toLocaleDateString('en-PH')}`)
      .doubleSeparator();

    // Summary
    builder
      .align('left')
      .bold(true)
      .println('SALES SUMMARY')
      .bold(false)
      .separator()
      .leftRight('Transactions:', salesSummary.transactionCount.toString())
      .leftRight('Gross Sales:', `P${salesSummary.grossSales.toFixed(2)}`)
      .leftRight('Discounts:', `P${salesSummary.totalDiscount.toFixed(2)}`)
      .leftRight('Net Sales:', `P${salesSummary.netSales.toFixed(2)}`)
      .separator()
      .leftRight('VATable Sales:', `P${salesSummary.vatableSales.toFixed(2)}`)
      .leftRight('VAT (12%):', `P${salesSummary.totalTax.toFixed(2)}`)
      .leftRight('Avg Transaction:', `P${salesSummary.averageTransaction.toFixed(2)}`)
      .separator();

    // Voids & Refunds
    builder
      .leftRight('Void Count:', salesSummary.voidCount.toString())
      .leftRight('Void Amount:', `P${salesSummary.voidAmount.toFixed(2)}`)
      .leftRight('Refund Count:', salesSummary.refundCount.toString())
      .leftRight('Refund Amount:', `P${salesSummary.refundAmount.toFixed(2)}`)
      .doubleSeparator();

    // By Payment Method
    builder
      .bold(true)
      .println('BY PAYMENT METHOD')
      .bold(false)
      .separator();

    Object.entries(salesSummary.byPaymentMethod).forEach(([method, data]) => {
      builder.leftRight(method, `${data.count} - P${data.total.toFixed(2)}`);
    });

    builder
      .feed()
      .align('center')
      .separator()
      .println('*** END OF REPORT ***')
      .feed(2)
      .cut();

    return builder;
  };

  // Pagination
  const paginatedTransactions = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const renderSummaryView = () => (
    <>
      {/* Summary Cards */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Sales Summary</Title>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryItem, { backgroundColor: '#E3F2FD' }]}>
              <Paragraph style={styles.summaryLabel}>Transactions</Paragraph>
              <Title style={[styles.summaryValue, { color: '#1976D2' }]}>
                {salesSummary.transactionCount}
              </Title>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: '#E8F5E9' }]}>
              <Paragraph style={styles.summaryLabel}>Gross Sales</Paragraph>
              <Title style={[styles.summaryValue, { color: '#388E3C' }]}>
                {formatCurrency(salesSummary.grossSales)}
              </Title>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: '#FFF3E0' }]}>
              <Paragraph style={styles.summaryLabel}>Discounts</Paragraph>
              <Title style={[styles.summaryValue, { color: '#F57C00' }]}>
                {formatCurrency(salesSummary.totalDiscount)}
              </Title>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: '#E1F5FE' }]}>
              <Paragraph style={styles.summaryLabel}>Net Sales</Paragraph>
              <Title style={[styles.summaryValue, { color: '#0288D1' }]}>
                {formatCurrency(salesSummary.netSales)}
              </Title>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* VAT Summary */}
          <View style={styles.vatSection}>
            <View style={styles.vatRow}>
              <Paragraph style={styles.vatLabel}>VATable Sales:</Paragraph>
              <Paragraph style={styles.vatValue}>{formatCurrency(salesSummary.vatableSales)}</Paragraph>
            </View>
            <View style={styles.vatRow}>
              <Paragraph style={styles.vatLabel}>VAT (12%):</Paragraph>
              <Paragraph style={styles.vatValue}>{formatCurrency(salesSummary.totalTax)}</Paragraph>
            </View>
            <View style={styles.vatRow}>
              <Paragraph style={styles.vatLabel}>Average Transaction:</Paragraph>
              <Paragraph style={styles.vatValue}>{formatCurrency(salesSummary.averageTransaction)}</Paragraph>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Voids & Refunds */}
          <View style={styles.voidSection}>
            <View style={[styles.voidItem, { backgroundColor: '#FFEBEE' }]}>
              <Paragraph style={styles.voidLabel}>Void ({salesSummary.voidCount})</Paragraph>
              <Paragraph style={[styles.voidValue, { color: '#C62828' }]}>
                {formatCurrency(salesSummary.voidAmount)}
              </Paragraph>
            </View>
            <View style={[styles.voidItem, { backgroundColor: '#FFF8E1' }]}>
              <Paragraph style={styles.voidLabel}>Refund ({salesSummary.refundCount})</Paragraph>
              <Paragraph style={[styles.voidValue, { color: '#F57F17' }]}>
                {formatCurrency(salesSummary.refundAmount)}
              </Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* By Payment Method */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>By Payment Method</Title>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={{ flex: 2 }}>Method</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>Count</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1.5 }}>Amount</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>%</DataTable.Title>
            </DataTable.Header>

            {Object.entries(salesSummary.byPaymentMethod).map(([method, data]) => (
              <DataTable.Row key={method}>
                <DataTable.Cell style={{ flex: 2 }}>
                  <Chip
                    compact
                    textStyle={{ fontSize: 11, color: '#fff' }}
                    style={{ backgroundColor: getPaymentMethodColor(method) }}
                  >
                    {getPaymentMethodLabel(method)}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>{data.count}</DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.5 }}>{formatCurrency(data.total)}</DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  {salesSummary.grossSales > 0
                    ? `${((data.total / salesSummary.grossSales) * 100).toFixed(1)}%`
                    : '0%'}
                </DataTable.Cell>
              </DataTable.Row>
            ))}

            <DataTable.Row style={styles.totalRow}>
              <DataTable.Cell style={{ flex: 2 }}>
                <Paragraph style={styles.bold}>TOTAL</Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 1 }}>
                <Paragraph style={styles.bold}>{salesSummary.transactionCount}</Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 1.5 }}>
                <Paragraph style={styles.bold}>{formatCurrency(salesSummary.grossSales)}</Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 1 }}>
                <Paragraph style={styles.bold}>100%</Paragraph>
              </DataTable.Cell>
            </DataTable.Row>
          </DataTable>
        </Card.Content>
      </Card>

      {/* By Payment Status */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>By Payment Status</Title>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={{ flex: 2 }}>Status</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>Count</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1.5 }}>Amount</DataTable.Title>
            </DataTable.Header>

            {Object.entries(salesSummary.byPaymentStatus).map(([status, data]) => (
              <DataTable.Row key={status}>
                <DataTable.Cell style={{ flex: 2 }}>
                  <Chip
                    compact
                    textStyle={{ fontSize: 11, color: status === 'PAID' ? '#fff' : '#333' }}
                    style={{
                      backgroundColor: status === 'PAID' ? '#4CAF50' :
                                       status === 'PARTIAL' ? '#FFE082' : '#FFCDD2'
                    }}
                  >
                    {status}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>{data.count}</DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.5 }}>{formatCurrency(data.total)}</DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </Card.Content>
      </Card>
    </>
  );

  const renderProductsView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={styles.sectionTitle}>
          Sales by Product ({salesByProduct.length} items)
        </Title>

        {salesByProduct.length === 0 ? (
          <Paragraph style={styles.emptyText}>No product sales found</Paragraph>
        ) : (
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={{ flex: 0.8 }}>Code</DataTable.Title>
              <DataTable.Title style={{ flex: 2 }}>Product</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 0.8 }}>Qty</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1.2 }}>Sales</DataTable.Title>
            </DataTable.Header>

            {salesByProduct.slice(0, 50).map((product) => (
              <DataTable.Row key={product.product_id}>
                <DataTable.Cell style={{ flex: 0.8 }}>
                  <Paragraph style={styles.smallText}>{product.product_code}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell style={{ flex: 2 }}>
                  <Paragraph numberOfLines={1}>{product.product_name}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.8 }}>
                  {product.quantity_sold}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.2 }}>
                  {formatCurrency(product.total_sales)}
                </DataTable.Cell>
              </DataTable.Row>
            ))}

            <DataTable.Row style={styles.totalRow}>
              <DataTable.Cell style={{ flex: 0.8 }}></DataTable.Cell>
              <DataTable.Cell style={{ flex: 2 }}>
                <Paragraph style={styles.bold}>TOTAL</Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 0.8 }}>
                <Paragraph style={styles.bold}>
                  {salesByProduct.reduce((sum, p) => sum + p.quantity_sold, 0)}
                </Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 1.2 }}>
                <Paragraph style={styles.bold}>
                  {formatCurrency(salesByProduct.reduce((sum, p) => sum + p.total_sales, 0))}
                </Paragraph>
              </DataTable.Cell>
            </DataTable.Row>
          </DataTable>
        )}

        {salesByProduct.length > 50 && (
          <Paragraph style={styles.moreText}>
            Showing top 50 of {salesByProduct.length} products
          </Paragraph>
        )}
      </Card.Content>
    </Card>
  );

  const renderCategoriesView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={styles.sectionTitle}>
          Sales by Category ({salesByCategory.length} categories)
        </Title>

        {salesByCategory.length === 0 ? (
          <Paragraph style={styles.emptyText}>No category sales found</Paragraph>
        ) : (
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={{ flex: 2 }}>Category</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>Products</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>Qty</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1.2 }}>Sales</DataTable.Title>
            </DataTable.Header>

            {salesByCategory.map((category) => (
              <DataTable.Row key={category.category_id}>
                <DataTable.Cell style={{ flex: 2 }}>
                  {category.category_name}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  {category.product_count}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  {category.quantity_sold}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.2 }}>
                  {formatCurrency(category.total_sales)}
                </DataTable.Cell>
              </DataTable.Row>
            ))}

            <DataTable.Row style={styles.totalRow}>
              <DataTable.Cell style={{ flex: 2 }}>
                <Paragraph style={styles.bold}>TOTAL</Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 1 }}>
                <Paragraph style={styles.bold}>
                  {salesByCategory.reduce((sum, c) => sum + c.product_count, 0)}
                </Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 1 }}>
                <Paragraph style={styles.bold}>
                  {salesByCategory.reduce((sum, c) => sum + c.quantity_sold, 0)}
                </Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 1.2 }}>
                <Paragraph style={styles.bold}>
                  {formatCurrency(salesByCategory.reduce((sum, c) => sum + c.total_sales, 0))}
                </Paragraph>
              </DataTable.Cell>
            </DataTable.Row>
          </DataTable>
        )}
      </Card.Content>
    </Card>
  );

  const renderTransactionsView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={styles.sectionTitle}>
          Transaction Details ({filteredTransactions.length} transactions)
        </Title>

        {paginatedTransactions.length === 0 ? (
          <Paragraph style={styles.emptyText}>No transactions found</Paragraph>
        ) : (
          <>
            {paginatedTransactions.map((txn) => (
              <View key={txn.id} style={styles.txnCard}>
                <View style={styles.txnCardHeader}>
                  <View style={styles.txnCardHeaderLeft}>
                    <Paragraph style={styles.txnInvoice}>{txn.invoice_number}</Paragraph>
                    <Paragraph style={styles.txnDate}>
                      {formatDateTime(txn.transaction_date || txn.created_at)}
                    </Paragraph>
                  </View>
                  <View style={styles.txnCardHeaderRight}>
                    <Paragraph style={styles.txnAmount}>{formatCurrency(txn.total_amount)}</Paragraph>
                  </View>
                </View>
                <View style={styles.txnCardFooter}>
                  {txn.customer_name ? (
                    <Paragraph style={styles.txnCustomer} numberOfLines={1}>{txn.customer_name}</Paragraph>
                  ) : (
                    <View />
                  )}
                  <View style={styles.txnChips}>
                    <Chip
                      compact
                      textStyle={{ fontSize: 10, color: '#fff' }}
                      style={{ backgroundColor: getPaymentMethodColor(txn.payment_method), height: 22 }}
                    >
                      {getPaymentMethodLabel(txn.payment_method)}
                    </Chip>
                    <Chip
                      compact
                      textStyle={{ fontSize: 10, color: '#fff' }}
                      style={{ backgroundColor: getStatusColor(txn.status), height: 22 }}
                    >
                      {txn.status}
                    </Chip>
                  </View>
                </View>
              </View>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={styles.pagination}>
                <IconButton
                  icon="chevron-left"
                  disabled={currentPage === 0}
                  onPress={() => setCurrentPage(p => p - 1)}
                />
                <Paragraph>
                  Page {currentPage + 1} of {totalPages}
                </Paragraph>
                <IconButton
                  icon="chevron-right"
                  disabled={currentPage >= totalPages - 1}
                  onPress={() => setCurrentPage(p => p + 1)}
                />
              </View>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitles}>
              <Title style={styles.pageTitle}>Sales Report</Title>
              <Paragraph style={styles.pageSubtitle}>
                Comprehensive sales analysis and transactions
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

        {/* Date Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <DateRangeFilter
              onDateChange={handleDateChange}
              selectedPreset="this_month"
            />
          </Card.Content>
        </Card>

        {/* Search Bar */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <TextInput
              label="Search (Invoice, Customer, Product, etc.)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              mode="outlined"
              dense
              left={<TextInput.Icon icon="magnify" />}
              right={searchQuery ? (
                <TextInput.Icon icon="close" onPress={() => setSearchQuery('')} />
              ) : null}
              style={styles.searchInput}
            />
          </Card.Content>
        </Card>

        {/* Payment Method Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Paragraph style={styles.filterLabel}>Payment Method:</Paragraph>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipContainer}>
                <Chip
                  selected={selectedPaymentMethod === null}
                  onPress={() => setSelectedPaymentMethod(null)}
                  style={styles.chip}
                >
                  All
                </Chip>
                {paymentMethods.map(method => (
                  <Chip
                    key={method}
                    selected={selectedPaymentMethod === method}
                    onPress={() => setSelectedPaymentMethod(method)}
                    style={[styles.chip, { borderColor: getPaymentMethodColor(method) }]}
                    selectedColor={getPaymentMethodColor(method)}
                  >
                    {getPaymentMethodLabel(method)}
                  </Chip>
                ))}
              </View>
            </ScrollView>
          </Card.Content>
        </Card>

        {/* View Selector */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <SegmentedButtons
              value={activeView}
              onValueChange={(value) => setActiveView(value as ReportView)}
              buttons={[
                { value: 'summary', label: 'Summary', icon: 'chart-pie' },
                { value: 'products', label: 'Products', icon: 'package-variant' },
                { value: 'categories', label: 'Categories', icon: 'shape' },
                { value: 'transactions', label: 'Details', icon: 'format-list-bulleted' },
              ]}
              style={styles.segmentedButtons}
            />
          </Card.Content>
        </Card>

        {/* Content based on active view */}
        {loading ? (
          <Card style={styles.card}>
            <Card.Content>
              <Paragraph style={styles.emptyText}>Loading sales data...</Paragraph>
            </Card.Content>
          </Card>
        ) : (
          <>
            {activeView === 'summary' && renderSummaryView()}
            {activeView === 'products' && renderProductsView()}
            {activeView === 'categories' && renderCategoriesView()}
            {activeView === 'transactions' && renderTransactionsView()}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            Report generated on {new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
          </Paragraph>
        </View>
      </ScrollView>

      <PrintOptionsDialog
        visible={printDialogVisible}
        onDismiss={() => setPrintDialogVisible(false)}
        title="Print Sales Report"
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
    flexGrow: 1,
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
  filterCard: {
    marginBottom: 12,
    elevation: 2,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  summaryCard: {
    marginBottom: 16,
    elevation: 3,
    backgroundColor: '#FAFAFA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    marginRight: 4,
  },
  segmentedButtons: {
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryItem: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.8,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
  },
  vatSection: {
    paddingHorizontal: 8,
  },
  vatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vatLabel: {
    fontSize: 13,
    opacity: 0.8,
  },
  vatValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  voidSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  voidItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  voidLabel: {
    fontSize: 11,
    opacity: 0.8,
  },
  voidValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalRow: {
    backgroundColor: '#E8F5E9',
  },
  bold: {
    fontWeight: 'bold',
  },
  smallText: {
    fontSize: 11,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    padding: 20,
  },
  moreText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  txnCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  txnCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  txnCardHeaderLeft: {
    flex: 1,
  },
  txnCardHeaderRight: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  txnInvoice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
  },
  txnDate: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  txnCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txnCustomer: {
    fontSize: 12,
    color: '#616161',
    flex: 1,
  },
  txnChips: {
    flexDirection: 'row',
    gap: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footer: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
});
