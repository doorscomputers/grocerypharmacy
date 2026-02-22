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
  SegmentedButtons,
} from 'react-native-paper';

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder, PRINTER_WIDTH } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'TopCustomersReport'>;
};

interface TopCustomer {
  id: number;
  name: string;
  code?: string;
  phone?: string;
  transaction_count: number;
  total_purchases: number;
  total_items: number;
  average_transaction: number;
  last_purchase_date?: string;
}

export default function TopCustomersReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const [customers, setCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'purchases' | 'transactions'>('purchases');
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

      // Calculate date filter
      let dateFilter = '';
      const now = new Date();
      if (dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = `AND t.transaction_date >= '${weekAgo.toISOString().split('T')[0]}'`;
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = `AND t.transaction_date >= '${monthAgo.toISOString().split('T')[0]}'`;
      } else if (dateRange === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = `AND t.transaction_date >= '${yearStart.toISOString().split('T')[0]}'`;
      }

      const query = `
        SELECT
          COALESCE(c.id, 0) as id,
          COALESCE(c.name, t.customer_name, 'Walk-in Customer') as name,
          c.code,
          c.phone,
          COUNT(DISTINCT t.id) as transaction_count,
          COALESCE(SUM(t.total_amount), 0) as total_purchases,
          COALESCE(SUM(ti.total_items), 0) as total_items,
          CASE WHEN COUNT(DISTINCT t.id) > 0
            THEN SUM(t.total_amount) / COUNT(DISTINCT t.id)
            ELSE 0
          END as average_transaction,
          MAX(t.transaction_date) as last_purchase_date
        FROM transactions t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN (
          SELECT transaction_id, SUM(quantity) as total_items
          FROM transaction_items
          GROUP BY transaction_id
        ) ti ON t.id = ti.transaction_id
        WHERE t.status NOT IN ('VOID', 'CANCELLED')
          ${dateFilter}
        GROUP BY COALESCE(c.id, 0), COALESCE(c.name, t.customer_name, 'Walk-in Customer')
        HAVING total_purchases > 0
        ORDER BY total_purchases DESC
      `;

      const results = await db.getAllAsync(query) as TopCustomer[];
      setCustomers(results || []);
    } catch (err: any) {
      console.error('Error loading top customers data:', err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = [...customers];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.code?.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortBy === 'transactions') {
      filtered.sort((a, b) => b.transaction_count - a.transaction_count);
    } else {
      filtered.sort((a, b) => b.total_purchases - a.total_purchases);
    }

    return filtered;
  }, [customers, searchQuery, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.total_purchases, 0);
    const totalTransactions = customers.reduce((sum, c) => sum + c.transaction_count, 0);
    const top10Revenue = customers.slice(0, 10).reduce((sum, c) => sum + c.total_purchases, 0);
    const top10Percentage = totalRevenue > 0 ? (top10Revenue / totalRevenue) * 100 : 0;
    const avgPerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    return {
      totalCustomers,
      totalRevenue,
      totalTransactions,
      top10Percentage,
      avgPerCustomer,
    };
  }, [customers]);

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('TOP CUSTOMERS')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .println(getDateRangeLabel())
      .println(formatPrinterDateTime(now))
      .doubleSeparator();

    // Summary
    builder
      .align('left')
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .separator()
      .leftRight('Total Customers:', stats.totalCustomers.toString())
      .leftRight('Total Revenue:', `P${stats.totalRevenue.toFixed(2)}`)
      .leftRight('Total Transactions:', stats.totalTransactions.toLocaleString())
      .leftRight('Avg per Customer:', `P${stats.avgPerCustomer.toFixed(2)}`)
      .leftRight('Top 10 Share:', `${stats.top10Percentage.toFixed(1)}%`)
      .separator();

    // Top 20 customers
    const printCustomers = filteredCustomers.slice(0, 20);
    if (printCustomers.length > 0) {
      builder
        .bold(true)
        .println(`TOP ${printCustomers.length} CUSTOMERS`)
        .bold(false)
        .separator();

      printCustomers.forEach((customer, index) => {
        const rank = (index + 1).toString().padStart(2, ' ');
        const name = customer.name.length > printerWidth - 10
          ? customer.name.substring(0, printerWidth - 12) + '..'
          : customer.name;
        builder.println(`${rank}. ${name}`);
        builder.leftRight(`   ${customer.transaction_count} txns`, `P${customer.total_purchases.toFixed(2)}`);
      });

      if (filteredCustomers.length > 20) {
        builder.feed().println(`... and ${filteredCustomers.length - 20} more customers`);
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
          .date-range { font-size: 12px; color: #9C27B0; font-weight: bold; }
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
          <div class="report-title">TOP CUSTOMERS REPORT</div>
          <div class="date-range">${getDateRangeLabel()}</div>
          <div class="date-time">Generated: ${dateStr} ${timeStr}</div>
        </div>

        <div class="section">
          <div class="section-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total Customers</div>
              <div class="summary-value">${stats.totalCustomers}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Revenue</div>
              <div class="summary-value" style="color: #4CAF50;">${formatCurrency(stats.totalRevenue)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Transactions</div>
              <div class="summary-value" style="color: #2196F3;">${stats.totalTransactions.toLocaleString()}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Avg per Customer</div>
              <div class="summary-value" style="color: #FF9800;">${formatCurrency(stats.avgPerCustomer)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Top 10 Revenue Share</div>
              <div class="summary-value" style="color: #9C27B0;">${stats.top10Percentage.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Top Customers (${filteredCustomers.length})</div>
          <table>
            <thead>
              <tr>
                <th class="text-center">#</th>
                <th>Customer Name</th>
                <th>Code</th>
                <th>Phone</th>
                <th class="text-right">Transactions</th>
                <th class="text-right">Total Purchases</th>
                <th class="text-right">Avg Transaction</th>
                <th>Last Purchase</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCustomers.slice(0, 100).map((customer, index) => `
                <tr>
                  <td class="rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''}">${index + 1}</td>
                  <td>${customer.name}</td>
                  <td>${customer.code || '-'}</td>
                  <td>${customer.phone || '-'}</td>
                  <td class="text-right">${customer.transaction_count.toLocaleString()}</td>
                  <td class="text-right">${formatCurrency(customer.total_purchases)}</td>
                  <td class="text-right">${formatCurrency(customer.average_transaction)}</td>
                  <td>${formatDate(customer.last_purchase_date)}</td>
                </tr>
              `).join('')}
              ${filteredCustomers.length > 100 ? `<tr><td colspan="8" class="text-center"><em>...and ${filteredCustomers.length - 100} more customers</em></td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <div class="footer">
          Report generated on ${now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
        </div>
      </body>
      </html>
    `;
  };

  // Paginated customers
  const paginatedCustomers = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Top Customers"
        reportFileName="TopCustomers"
        disabled={filteredCustomers.length === 0}
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
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Customers</Paragraph>
                <Title style={styles.summaryValue}>{stats.totalCustomers}</Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Revenue</Paragraph>
                <Title style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  {formatCurrency(stats.totalRevenue)}
                </Title>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Transactions</Paragraph>
                <Title style={[styles.summaryValue, { color: '#2196F3' }]}>
                  {stats.totalTransactions.toLocaleString()}
                </Title>
              </View>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Avg per Customer</Paragraph>
                <Title style={[styles.summaryValue, { color: '#FF9800' }]}>
                  {formatCurrency(stats.avgPerCustomer)}
                </Title>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Top 10 Revenue Share</Paragraph>
                <Title style={[styles.summaryValue, { color: '#9C27B0' }]}>
                  {stats.top10Percentage.toFixed(1)}%
                </Title>
                <Paragraph style={styles.summaryNote}>(of total revenue)</Paragraph>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Customer List */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Customer Rankings</Title>
            <Divider style={styles.divider} />

            <TextInput
              mode="outlined"
              placeholder="Search customers..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              left={<TextInput.Icon icon="magnify" />}
              right={searchQuery ? <TextInput.Icon icon="close" onPress={() => setSearchQuery('')} /> : null}
            />

            <View style={styles.sortContainer}>
              <Paragraph style={styles.sortLabel}>Sort by:</Paragraph>
              <Chip
                selected={sortBy === 'purchases'}
                onPress={() => setSortBy('purchases')}
                style={styles.sortChip}
              >
                Total Purchases
              </Chip>
              <Chip
                selected={sortBy === 'transactions'}
                onPress={() => setSortBy('transactions')}
                style={styles.sortChip}
              >
                Transaction Count
              </Chip>
            </View>

            <Paragraph style={styles.resultCount}>
              Showing {paginatedCustomers.length} of {filteredCustomers.length} customers
            </Paragraph>

            {loading ? (
              <Paragraph>Loading...</Paragraph>
            ) : error ? (
              <View style={styles.emptyState}>
                <Title style={[styles.emptyTitle, { color: '#F44336' }]}>Error Loading Data</Title>
                <Paragraph style={styles.emptyText}>{error}</Paragraph>
                <Button mode="outlined" onPress={loadData} style={{ marginTop: 12 }}>Retry</Button>
              </View>
            ) : filteredCustomers.length === 0 ? (
              <View style={styles.emptyState}>
                <Title style={styles.emptyTitle}>No Customer Data</Title>
                <Paragraph style={styles.emptyText}>
                  No customer purchases found in the selected period.
                </Paragraph>
              </View>
            ) : (
              <>
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 0.5 }}>#</DataTable.Title>
                    <DataTable.Title style={{ flex: 2 }}>Customer</DataTable.Title>
                    <DataTable.Title numeric>Txns</DataTable.Title>
                    <DataTable.Title numeric>Total Purchases</DataTable.Title>
                  </DataTable.Header>

                  {paginatedCustomers.map((customer, index) => {
                    const rank = currentPage * itemsPerPage + index + 1;
                    return (
                      <DataTable.Row key={`${customer.id}-${customer.name}`}>
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
                            <Paragraph style={styles.customerName} numberOfLines={1}>{customer.name}</Paragraph>
                            {customer.phone && (
                              <Paragraph style={styles.customerPhone}>{customer.phone}</Paragraph>
                            )}
                          </View>
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                          <Paragraph style={styles.transactionText}>{customer.transaction_count}</Paragraph>
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                          <Paragraph style={styles.purchaseText}>{formatCurrency(customer.total_purchases)}</Paragraph>
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
  summaryNote: {
    fontSize: 10,
    opacity: 0.6,
    textAlign: 'center',
  },
  searchInput: {
    marginBottom: 12,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  sortLabel: {
    marginRight: 8,
    opacity: 0.7,
  },
  sortChip: {
    marginRight: 8,
    marginBottom: 4,
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
  customerName: {
    fontSize: 13,
    fontWeight: '500',
  },
  customerPhone: {
    fontSize: 10,
    opacity: 0.6,
  },
  transactionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2196F3',
  },
  purchaseText: {
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
