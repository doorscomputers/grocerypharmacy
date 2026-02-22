import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Searchbar,
  useTheme,
  Chip,
  Divider,
  IconButton,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'ProductTransactionReport'>;
};

export default function ProductTransactionReportScreen({ navigation }: Props) {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  useEffect(() => {
    loadProducts();
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

  useEffect(() => {
    if (selectedProduct) {
      loadMovements();
    }
  }, [selectedProduct, dateRange]);

  const loadProducts = async () => {
    try {
      const dbService = getDatabase();
      const data = await dbService.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadMovements = async () => {
    if (!selectedProduct) return;
    try {
      setLoading(true);
      const dbService = getDatabase();

      const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const data = await dbService.getInventoryMovements({
        product_id: selectedProduct.id,
        date_from: formatDate(dateRange.startDate),
        date_to: formatDate(dateRange.endDate),
        limit: 500,
      });

      setMovements(data);
    } catch (error) {
      console.error('Error loading movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setMovements([]);
  };

  const handleClearSelection = () => {
    setSelectedProduct(null);
    setMovements([]);
  };

  const getReferenceTypeLabel = (refType: string) => {
    switch (refType) {
      case 'SALE': return 'Sold';
      case 'PURCHASE': return 'Purchased';
      case 'DAMAGE': return 'Damaged';
      case 'DAMAGE_REVERSAL': return 'Damage Reversed';
      case 'SALES_RETURN': return 'Customer Return';
      case 'PURCHASE_RETURN': return 'Supplier Return';
      case 'PHYSICAL_COUNT': return 'Physical Count';
      case 'MANUAL_ADJUSTMENT': return 'Adjustment';
      case 'EXCHANGE': return 'Exchange';
      case 'VOID': return 'Voided';
      default: return refType;
    }
  };

  const getReferenceTypeColor = (refType: string) => {
    switch (refType) {
      case 'SALE': return '#F44336';
      case 'PURCHASE': return '#4CAF50';
      case 'DAMAGE': return '#FF9800';
      case 'DAMAGE_REVERSAL': return '#8BC34A';
      case 'SALES_RETURN': return '#2196F3';
      case 'PURCHASE_RETURN': return '#9C27B0';
      case 'PHYSICAL_COUNT': return '#607D8B';
      case 'MANUAL_ADJUSTMENT': return '#795548';
      case 'EXCHANGE': return '#00BCD4';
      case 'VOID': return '#9E9E9E';
      default: return '#757575';
    }
  };

  const getMovementIcon = (movementType: string) => {
    switch (movementType) {
      case 'IN': return 'arrow-down-bold';
      case 'OUT': return 'arrow-up-bold';
      case 'ADJUSTMENT': return 'swap-vertical';
      default: return 'help-circle';
    }
  };

  const getMovementColor = (movementType: string) => {
    switch (movementType) {
      case 'IN': return '#4CAF50';
      case 'OUT': return '#F44336';
      case 'ADJUSTMENT': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const formatDateStr = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Summary calculations
  const totalIn = movements
    .filter((m) => m.movement_type === 'IN')
    .reduce((sum, m) => sum + (m.quantity || 0), 0);
  const totalOut = movements
    .filter((m) => m.movement_type === 'OUT')
    .reduce((sum, m) => sum + (m.quantity || 0), 0);
  const netMovement = totalIn - totalOut;

  // Filtered product list
  const filteredProducts = searchQuery.length >= 1
    ? products.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
        );
      })
    : [];

  const renderProductItem = ({ item }: { item: any }) => (
    <Card
      style={styles.productCard}
      onPress={() => handleSelectProduct(item)}
    >
      <Card.Content style={styles.productRow}>
        <View style={styles.productInfo}>
          <Paragraph style={styles.productName}>{item.name}</Paragraph>
          <Paragraph style={styles.productCode}>{item.code}</Paragraph>
        </View>
        <View style={styles.productStock}>
          <Paragraph style={styles.stockLabel}>Stock</Paragraph>
          <Paragraph style={styles.stockValue}>{item.stock_quantity || 0}</Paragraph>
        </View>
      </Card.Content>
    </Card>
  );

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('PRODUCT TRANSACTION')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .println(formatPrinterDateTime(new Date()))
      .doubleSeparator()
      .align('left');

    // Date range
    builder
      .leftRight('From:', formatPrinterDate(dateRange.startDate))
      .leftRight('To:', formatPrinterDate(dateRange.endDate))
      .separator();

    // Product info
    if (selectedProduct) {
      builder
        .bold(true)
        .println('PRODUCT INFO')
        .bold(false)
        .leftRight('Name:', selectedProduct.name || '')
        .leftRight('Code:', selectedProduct.code || '')
        .leftRight('Current Stock:', String(selectedProduct.stock_quantity || 0))
        .separator();
    }

    // Summary
    builder
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .leftRight('Total IN:', `+${totalIn}`)
      .leftRight('Total OUT:', `-${totalOut}`)
      .leftRight('Net Movement:', `${netMovement >= 0 ? '+' : ''}${netMovement}`)
      .leftRight('Transactions:', String(movements.length))
      .doubleSeparator();

    // Transactions list
    builder
      .bold(true)
      .println('TRANSACTION DETAILS')
      .bold(false)
      .separator();

    for (const m of movements) {
      const movementDate = new Date(m.created_at);
      const dateTimeStr = formatPrinterDateTime(movementDate);

      const typeLabel = getReferenceTypeLabel(m.reference_type);
      const qtySign = m.movement_type === 'IN' ? '+' : m.movement_type === 'OUT' ? '-' : '';

      builder
        .leftRight(dateTimeStr, `${qtySign}${m.quantity}`)
        .println(`  ${typeLabel}`);

      if (m.reference_number) {
        builder.println(`  Ref: ${m.reference_number}`);
      }

      builder.println(`  Stock: ${m.quantity_before} -> ${m.quantity_after}`);

      if (m.total_value > 0) {
        builder.println(`  Value: P${(m.total_value || 0).toFixed(2)}`);
      }
    }

    builder
      .separator()
      .align('center')
      .println('*** END OF REPORT ***')
      .feed(2)
      .cut();

    return builder;
  };

  const formatCurrency = (amount: number) => `₱${(amount || 0).toFixed(2)}`;

  const buildPdfHtml = (): string => {
    const startDateStr = dateRange.startDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    const endDateStr = dateRange.endDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
          .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 16px; }
          .company-name { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
          .header-text { font-size: 11px; color: #666; }
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #673AB7; }
          .date-range { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          .product-info { background: #ede7f6; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
          .product-name { font-size: 16px; font-weight: bold; color: #673AB7; }
          .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 12px 0; }
          .summary-grid { display: flex; gap: 12px; margin: 12px 0; }
          .summary-item { flex: 1; background: #f5f5f5; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-label { font-size: 11px; color: #666; margin-bottom: 4px; }
          .summary-value { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { background-color: #f5f5f5; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .in { color: #4CAF50; }
          .out { color: #F44336; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name || 'IgoroTech POS'}</div>
          ${companySettings.address ? `<div class="header-text">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="header-text">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="report-title">PRODUCT TRANSACTION REPORT</div>
        <div class="date-range">Period: ${startDateStr} to ${endDateStr}</div>

        ${selectedProduct ? `
          <div class="product-info">
            <div class="product-name">${selectedProduct.name}</div>
            <div>Code: ${selectedProduct.code} | Current Stock: ${selectedProduct.stock_quantity || 0}</div>
          </div>
        ` : ''}

        <div class="section-title">Movement Summary</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total IN</div>
            <div class="summary-value in">+${totalIn}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total OUT</div>
            <div class="summary-value out">-${totalOut}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Net Movement</div>
            <div class="summary-value" style="color: ${netMovement >= 0 ? '#4CAF50' : '#F44336'};">${netMovement >= 0 ? '+' : ''}${netMovement}</div>
          </div>
        </div>

        <div class="section-title">Transaction Details (${movements.length})</div>
        <table>
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Qty</th>
              <th>Stock Change</th>
            </tr>
          </thead>
          <tbody>
            ${movements.map(m => {
              const movementDate = new Date(m.created_at);
              const dateStr = movementDate.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
              const qtyClass = m.movement_type === 'IN' ? 'in' : 'out';
              const qtySign = m.movement_type === 'IN' ? '+' : '-';
              return `
                <tr>
                  <td>${dateStr}</td>
                  <td>${getReferenceTypeLabel(m.reference_type)}</td>
                  <td>${m.reference_number || '-'}</td>
                  <td class="${qtyClass}">${qtySign}${m.quantity}</td>
                  <td>${m.quantity_before} → ${m.quantity_after}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Product Transaction Report</p>
        </div>
      </body>
      </html>
    `;
  };

  const renderMovementItem = ({ item }: { item: any }) => (
    <Card style={styles.movementCard}>
      <Card.Content>
        <View style={styles.movementRow}>
          <View style={styles.movementInfo}>
            <View style={styles.chipRow}>
              <Chip
                style={[styles.refChip, { backgroundColor: getReferenceTypeColor(item.reference_type) }]}
                textStyle={{ color: 'white', fontSize: 10 }}
                compact
              >
                {getReferenceTypeLabel(item.reference_type)}
              </Chip>
              <Chip
                style={[styles.moveChip, { backgroundColor: getMovementColor(item.movement_type) }]}
                textStyle={{ color: 'white', fontSize: 10 }}
                icon={getMovementIcon(item.movement_type)}
                compact
              >
                {item.movement_type}
              </Chip>
            </View>
            <Paragraph style={styles.movementDate}>
              {formatDateStr(item.created_at)}
            </Paragraph>
            {item.reference_number && (
              <Paragraph style={styles.movementRef}>
                Ref: {item.reference_number}
              </Paragraph>
            )}
            {item.notes && (
              <Paragraph style={styles.movementNotes}>{item.notes}</Paragraph>
            )}
          </View>
          <View style={styles.movementQtyContainer}>
            <Paragraph
              style={[
                styles.movementQty,
                { color: getMovementColor(item.movement_type) },
              ]}
            >
              {item.movement_type === 'IN' ? '+' : item.movement_type === 'OUT' ? '-' : ''}{item.quantity}
            </Paragraph>
            <Paragraph style={styles.stockBefore}>
              {item.quantity_before} {'\u2192'} {item.quantity_after}
            </Paragraph>
            {item.total_value > 0 && (
              <Paragraph style={styles.movementValue}>
                {'\u20B1'}{(item.total_value || 0).toFixed(2)}
              </Paragraph>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  // Product search view
  if (!selectedProduct) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <Title style={[styles.headerTitle, { fontSize: fs.h2 }]}>Product Transaction History</Title>
          <Paragraph style={styles.headerSubtitle}>
            Search for a product to view all its transactions
          </Paragraph>
        </View>

        <Searchbar
          placeholder="Search by product name, code, or barcode..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          autoFocus
        />

        {searchQuery.length >= 1 && (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderProductItem}
            contentContainerStyle={[styles.listContainer, { padding: lo.screenPadding }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Paragraph style={styles.emptyText}>
                  No products found matching "{searchQuery}"
                </Paragraph>
              </View>
            }
          />
        )}

        {searchQuery.length < 1 && (
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              Type a product name, code, or barcode to search
            </Paragraph>
          </View>
        )}
      </View>
    );
  }

  // Selected product — show movements
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Report Actions: Print, PDF, Email */}
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Product Transaction Report"
        reportFileName={`ProductTransaction_${selectedProduct?.code || 'report'}_${dateRange.startDate.toISOString().split('T')[0]}`}
        emailBody={`Please find attached the Product Transaction Report for ${selectedProduct?.name || 'product'}.\n\nPeriod: ${dateRange.startDate.toLocaleDateString('en-PH')} to ${dateRange.endDate.toLocaleDateString('en-PH')}\nTotal IN: +${totalIn}\nTotal OUT: -${totalOut}\nNet: ${netMovement >= 0 ? '+' : ''}${netMovement}\n\n---\nGenerated by IgoroTech POS`}
        disabled={movements.length === 0}
      />

      {/* Selected Product Header */}
      <Card style={styles.selectedProductCard}>
        <Card.Content>
          <View style={styles.selectedProductRow}>
            <View style={styles.selectedProductInfo}>
              <Title style={styles.selectedProductName}>{selectedProduct.name}</Title>
              <Paragraph style={styles.selectedProductCode}>
                {selectedProduct.code} | Stock: {selectedProduct.stock_quantity || 0}
              </Paragraph>
            </View>
            <IconButton
              icon="close-circle"
              size={28}
              onPress={handleClearSelection}
              iconColor="#F44336"
            />
          </View>
        </Card.Content>
      </Card>

      {/* Date Filter */}
      <Card style={styles.dateFilterCard}>
        <Card.Content>
          <DateRangeFilter
            onDateChange={handleDateChange}
            selectedPreset="this_month"
          />
        </Card.Content>
      </Card>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
          <Card.Content style={styles.summaryContent}>
            <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total IN</Paragraph>
            <Title style={[styles.summaryValue, { color: '#4CAF50' }]}>+{totalIn}</Title>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, { backgroundColor: '#FFEBEE' }]}>
          <Card.Content style={styles.summaryContent}>
            <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total OUT</Paragraph>
            <Title style={[styles.summaryValue, { color: '#F44336' }]}>-{totalOut}</Title>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
          <Card.Content style={styles.summaryContent}>
            <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Net</Paragraph>
            <Title style={[styles.summaryValue, { color: netMovement >= 0 ? '#4CAF50' : '#F44336' }]}>
              {netMovement >= 0 ? '+' : ''}{netMovement}
            </Title>
          </Card.Content>
        </Card>
      </View>

      <Divider />

      {/* Movements List */}
      <FlatList
        data={movements}
        keyExtractor={(item, index) => (item.id || index).toString()}
        renderItem={renderMovementItem}
        contentContainerStyle={[styles.listContainer, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadMovements}
        ListHeaderComponent={
          <Paragraph style={styles.recordCount}>
            {movements.length} transaction{movements.length !== 1 ? 's' : ''} found
          </Paragraph>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              No transactions found for the selected date range.
            </Paragraph>
          </View>
        }
      />

          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: -4,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  // Product search cards
  productCard: {
    marginBottom: 8,
    elevation: 2,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  productCode: {
    fontSize: 12,
    opacity: 0.7,
  },
  productStock: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  stockLabel: {
    fontSize: 10,
    opacity: 0.6,
  },
  stockValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  // Selected product header
  selectedProductCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 3,
    backgroundColor: '#F5F5F5',
  },
  selectedProductRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedProductInfo: {
    flex: 1,
  },
  selectedProductName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedProductCode: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: -4,
  },
  // Date filter
  dateFilterCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 2,
  },
  // Summary
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    elevation: 1,
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: -4,
  },
  recordCount: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
    textAlign: 'center',
  },
  // Movement cards
  movementCard: {
    marginBottom: 10,
    elevation: 2,
  },
  movementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  movementInfo: {
    flex: 1,
    marginRight: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  refChip: {
    alignSelf: 'flex-start',
  },
  moveChip: {
    alignSelf: 'flex-start',
  },
  movementDate: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  movementRef: {
    fontSize: 12,
    opacity: 0.7,
  },
  movementNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.6,
    marginTop: 2,
  },
  movementQtyContainer: {
    alignItems: 'flex-end',
  },
  movementQty: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  stockBefore: {
    fontSize: 11,
    opacity: 0.6,
  },
  movementValue: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
});
