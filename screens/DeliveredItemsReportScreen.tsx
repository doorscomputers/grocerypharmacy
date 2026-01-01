import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  IconButton,
  SegmentedButtons,
  List,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'DeliveredItemsReport'>;
};

interface PurchaseOrder {
  id: number;
  purchase_number: string;
  supplier_id: number;
  supplier_name: string;
  purchase_date: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  created_by_name?: string;
  received_by?: number;
  created_at: string;
  updated_at: string;
}

interface PurchaseDetail {
  id: number;
  purchase_id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_amount: number;
}

interface ProductDelivery {
  product_id: number;
  product_code: string;
  product_name: string;
  total_ordered: number;
  total_received: number;
  total_pending: number;
  total_value: number;
  delivery_count: number;
  suppliers: string[];
}

interface SupplierDelivery {
  supplier_id: number;
  supplier_name: string;
  delivery_count: number;
  total_ordered: number;
  total_received: number;
  total_value: number;
  po_count: number;
}

type ReportView = 'summary' | 'deliveries' | 'products' | 'suppliers';

export default function DeliveredItemsReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<ReportView>('summary');
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  // Pagination
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

      // Load suppliers
      const suppliersData = await dbService.getSuppliers(false);
      setSuppliers(suppliersData);

      // Load all purchase orders
      const purchasesData = await dbService.getPurchaseOrders(500);
      setPurchases(purchasesData);

      // Load purchase details for all purchases
      const allDetails: PurchaseDetail[] = [];
      for (const po of purchasesData) {
        try {
          const poWithDetails = await dbService.getPurchaseOrderById(po.id);
          if (poWithDetails?.items) {
            allDetails.push(...poWithDetails.items.map((item: any) => ({
              ...item,
              purchase_id: po.id
            })));
          }
        } catch (e) {
          // Skip if error
        }
      }
      setPurchaseDetails(allDetails);

    } catch (error) {
      console.error('Error loading delivery data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter purchases that have received items (status is RECEIVED or PARTIALLY_RECEIVED)
  const filteredPurchases = useMemo(() => {
    let filtered = purchases.filter(p => {
      // Only include purchases with received items
      if (!['RECEIVED', 'PARTIALLY_RECEIVED'].includes(p.status)) {
        return false;
      }

      // Date filter
      const poDate = new Date(p.purchase_date || p.created_at);
      if (poDate < dateRange.startDate || poDate > dateRange.endDate) {
        return false;
      }

      return true;
    });

    // Supplier filter
    if (selectedSupplier) {
      filtered = filtered.filter(p => p.supplier_id === selectedSupplier);
    }

    // Status filter
    if (selectedStatus) {
      filtered = filtered.filter(p => p.status === selectedStatus);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => {
        const searchableFields = [
          p.purchase_number,
          p.supplier_name,
          p.status,
        ].filter(Boolean).map(f => f?.toLowerCase() || '');

        // Also search in purchase details
        const relatedDetails = purchaseDetails.filter(d => d.purchase_id === p.id);
        const productNames = relatedDetails.map(d => d.product_name?.toLowerCase() || '');
        const productCodes = relatedDetails.map(d => d.product_code?.toLowerCase() || '');

        return [...searchableFields, ...productNames, ...productCodes].some(field => field.includes(query));
      });
    }

    return filtered.sort((a, b) =>
      new Date(b.purchase_date || b.created_at).getTime() -
      new Date(a.purchase_date || a.created_at).getTime()
    );
  }, [purchases, purchaseDetails, dateRange, searchQuery, selectedSupplier, selectedStatus]);

  // Get received details for filtered purchases
  const filteredDetails = useMemo(() => {
    const poIds = new Set(filteredPurchases.map(p => p.id));
    return purchaseDetails.filter(d => poIds.has(d.purchase_id) && d.quantity_received > 0);
  }, [filteredPurchases, purchaseDetails]);

  // Calculate summary
  const summary = useMemo(() => {
    const totalPOs = filteredPurchases.length;
    const fullyReceived = filteredPurchases.filter(p => p.status === 'RECEIVED').length;
    const partiallyReceived = filteredPurchases.filter(p => p.status === 'PARTIALLY_RECEIVED').length;

    const totalOrdered = filteredDetails.reduce((sum, d) => sum + d.quantity_ordered, 0);
    const totalReceived = filteredDetails.reduce((sum, d) => sum + d.quantity_received, 0);
    const totalPending = totalOrdered - totalReceived;

    const totalValue = filteredDetails.reduce((sum, d) => sum + (d.quantity_received * d.unit_cost), 0);
    const totalOrderValue = filteredDetails.reduce((sum, d) => sum + (d.quantity_ordered * d.unit_cost), 0);

    const uniqueProducts = new Set(filteredDetails.map(d => d.product_id)).size;
    const uniqueSuppliers = new Set(filteredPurchases.map(p => p.supplier_id)).size;

    return {
      totalPOs,
      fullyReceived,
      partiallyReceived,
      totalOrdered,
      totalReceived,
      totalPending,
      totalValue,
      totalOrderValue,
      uniqueProducts,
      uniqueSuppliers,
      fulfillmentRate: totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0,
    };
  }, [filteredPurchases, filteredDetails]);

  // Products breakdown
  const productDeliveries = useMemo(() => {
    const productMap: Record<number, ProductDelivery> = {};

    filteredDetails.forEach(detail => {
      const po = filteredPurchases.find(p => p.id === detail.purchase_id);
      if (!po) return;

      if (!productMap[detail.product_id]) {
        productMap[detail.product_id] = {
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          total_ordered: 0,
          total_received: 0,
          total_pending: 0,
          total_value: 0,
          delivery_count: 0,
          suppliers: [],
        };
      }

      productMap[detail.product_id].total_ordered += detail.quantity_ordered;
      productMap[detail.product_id].total_received += detail.quantity_received;
      productMap[detail.product_id].total_pending += (detail.quantity_ordered - detail.quantity_received);
      productMap[detail.product_id].total_value += detail.quantity_received * detail.unit_cost;
      productMap[detail.product_id].delivery_count++;

      if (po.supplier_name && !productMap[detail.product_id].suppliers.includes(po.supplier_name)) {
        productMap[detail.product_id].suppliers.push(po.supplier_name);
      }
    });

    let result = Object.values(productMap);

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.product_name.toLowerCase().includes(query) ||
        p.product_code.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => b.total_received - a.total_received);
  }, [filteredDetails, filteredPurchases, searchQuery]);

  // Suppliers breakdown
  const supplierDeliveries = useMemo(() => {
    const supplierMap: Record<number, SupplierDelivery> = {};

    filteredPurchases.forEach(po => {
      if (!supplierMap[po.supplier_id]) {
        supplierMap[po.supplier_id] = {
          supplier_id: po.supplier_id,
          supplier_name: po.supplier_name,
          delivery_count: 0,
          total_ordered: 0,
          total_received: 0,
          total_value: 0,
          po_count: 0,
        };
      }

      supplierMap[po.supplier_id].po_count++;

      const poDetails = filteredDetails.filter(d => d.purchase_id === po.id);
      poDetails.forEach(detail => {
        supplierMap[po.supplier_id].total_ordered += detail.quantity_ordered;
        supplierMap[po.supplier_id].total_received += detail.quantity_received;
        supplierMap[po.supplier_id].total_value += detail.quantity_received * detail.unit_cost;
        supplierMap[po.supplier_id].delivery_count++;
      });
    });

    let result = Object.values(supplierMap);

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => s.supplier_name.toLowerCase().includes(query));
    }

    return result.sort((a, b) => b.total_value - a.total_value);
  }, [filteredPurchases, filteredDetails, searchQuery]);

  const formatCurrency = (amount: number) =>
    `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED': return '#4CAF50';
      case 'PARTIALLY_RECEIVED': return '#FF9800';
      case 'ORDERED': return '#2196F3';
      case 'DRAFT': return '#9E9E9E';
      case 'CANCELLED': return '#F44336';
      default: return '#757575';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'RECEIVED': return 'Received';
      case 'PARTIALLY_RECEIVED': return 'Partial';
      case 'ORDERED': return 'Ordered';
      case 'DRAFT': return 'Draft';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  };

  // Pagination for deliveries table
  const paginatedPurchases = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredPurchases.slice(start, start + itemsPerPage);
  }, [filteredPurchases, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);

  const renderSummaryView = () => (
    <>
      {/* Summary Cards */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Delivery Summary</Title>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryItem, { backgroundColor: '#E3F2FD' }]}>
              <Paragraph style={styles.summaryLabel}>Total POs</Paragraph>
              <Title style={[styles.summaryValue, { color: '#1976D2' }]}>
                {summary.totalPOs}
              </Title>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: '#E8F5E9' }]}>
              <Paragraph style={styles.summaryLabel}>Fully Received</Paragraph>
              <Title style={[styles.summaryValue, { color: '#388E3C' }]}>
                {summary.fullyReceived}
              </Title>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: '#FFF3E0' }]}>
              <Paragraph style={styles.summaryLabel}>Partial</Paragraph>
              <Title style={[styles.summaryValue, { color: '#F57C00' }]}>
                {summary.partiallyReceived}
              </Title>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: '#E1F5FE' }]}>
              <Paragraph style={styles.summaryLabel}>Suppliers</Paragraph>
              <Title style={[styles.summaryValue, { color: '#0288D1' }]}>
                {summary.uniqueSuppliers}
              </Title>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Quantity Summary */}
          <View style={styles.quantitySection}>
            <View style={styles.quantityRow}>
              <Paragraph style={styles.quantityLabel}>Total Items Ordered:</Paragraph>
              <Paragraph style={styles.quantityValue}>{summary.totalOrdered.toLocaleString()}</Paragraph>
            </View>
            <View style={styles.quantityRow}>
              <Paragraph style={styles.quantityLabel}>Total Items Received:</Paragraph>
              <Paragraph style={[styles.quantityValue, { color: '#4CAF50' }]}>
                {summary.totalReceived.toLocaleString()}
              </Paragraph>
            </View>
            <View style={styles.quantityRow}>
              <Paragraph style={styles.quantityLabel}>Pending Items:</Paragraph>
              <Paragraph style={[styles.quantityValue, { color: summary.totalPending > 0 ? '#F44336' : '#4CAF50' }]}>
                {summary.totalPending.toLocaleString()}
              </Paragraph>
            </View>
            <View style={styles.quantityRow}>
              <Paragraph style={styles.quantityLabel}>Fulfillment Rate:</Paragraph>
              <Paragraph style={[styles.quantityValue, { color: summary.fulfillmentRate >= 90 ? '#4CAF50' : '#FF9800' }]}>
                {summary.fulfillmentRate.toFixed(1)}%
              </Paragraph>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Value Summary */}
          <View style={styles.valueSection}>
            <View style={[styles.valueItem, { backgroundColor: '#E8F5E9' }]}>
              <Paragraph style={styles.valueLabel}>Received Value</Paragraph>
              <Title style={[styles.valueAmount, { color: '#2E7D32' }]}>
                {formatCurrency(summary.totalValue)}
              </Title>
            </View>
            <View style={[styles.valueItem, { backgroundColor: '#E3F2FD' }]}>
              <Paragraph style={styles.valueLabel}>Products Received</Paragraph>
              <Title style={[styles.valueAmount, { color: '#1565C0' }]}>
                {summary.uniqueProducts}
              </Title>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Top Suppliers */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Top Suppliers by Value</Title>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={{ flex: 2 }}>Supplier</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>POs</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>Items</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1.2 }}>Value</DataTable.Title>
            </DataTable.Header>

            {supplierDeliveries.slice(0, 5).map((supplier) => (
              <DataTable.Row key={supplier.supplier_id}>
                <DataTable.Cell style={{ flex: 2 }}>
                  <Paragraph numberOfLines={1}>{supplier.supplier_name}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>{supplier.po_count}</DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>{supplier.total_received}</DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.2 }}>
                  {formatCurrency(supplier.total_value)}
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </Card.Content>
      </Card>

      {/* Top Products */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Top Products Received</Title>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={{ flex: 2 }}>Product</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 0.8 }}>Qty</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1.2 }}>Value</DataTable.Title>
            </DataTable.Header>

            {productDeliveries.slice(0, 5).map((product) => (
              <DataTable.Row key={product.product_id}>
                <DataTable.Cell style={{ flex: 2 }}>
                  <Paragraph numberOfLines={1}>{product.product_name}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.8 }}>{product.total_received}</DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.2 }}>
                  {formatCurrency(product.total_value)}
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </Card.Content>
      </Card>
    </>
  );

  const renderDeliveriesView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={styles.sectionTitle}>
          Delivery Details ({filteredPurchases.length} POs)
        </Title>

        {paginatedPurchases.length === 0 ? (
          <Paragraph style={styles.emptyText}>No deliveries found</Paragraph>
        ) : (
          <>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={{ flex: 1.2 }}>PO #</DataTable.Title>
                <DataTable.Title style={{ flex: 1.5 }}>Supplier</DataTable.Title>
                <DataTable.Title style={{ flex: 1 }}>Date</DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}>Value</DataTable.Title>
                <DataTable.Title style={{ flex: 0.8 }}>Status</DataTable.Title>
              </DataTable.Header>

              {paginatedPurchases.map((po) => {
                const poDetails = filteredDetails.filter(d => d.purchase_id === po.id);
                const receivedValue = poDetails.reduce((sum, d) => sum + (d.quantity_received * d.unit_cost), 0);

                return (
                  <DataTable.Row key={po.id}>
                    <DataTable.Cell style={{ flex: 1.2 }}>
                      <Paragraph style={styles.smallText}>{po.purchase_number}</Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.5 }}>
                      <Paragraph style={styles.smallText} numberOfLines={1}>
                        {po.supplier_name}
                      </Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1 }}>
                      <Paragraph style={styles.smallText}>
                        {formatDate(po.purchase_date || po.created_at)}
                      </Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>
                      <Paragraph style={styles.smallText}>
                        {formatCurrency(receivedValue)}
                      </Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 0.8 }}>
                      <Chip
                        compact
                        textStyle={{ fontSize: 8, color: '#fff' }}
                        style={{
                          backgroundColor: getStatusColor(po.status),
                          height: 20,
                        }}
                      >
                        {getStatusLabel(po.status).substring(0, 6)}
                      </Chip>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>

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

  const renderProductsView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={styles.sectionTitle}>
          Products Received ({productDeliveries.length} items)
        </Title>

        {productDeliveries.length === 0 ? (
          <Paragraph style={styles.emptyText}>No products found</Paragraph>
        ) : (
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={{ flex: 0.8 }}>Code</DataTable.Title>
              <DataTable.Title style={{ flex: 2 }}>Product</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 0.7 }}>Ord</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 0.7 }}>Rcvd</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1 }}>Value</DataTable.Title>
            </DataTable.Header>

            {productDeliveries.slice(0, 50).map((product) => (
              <DataTable.Row key={product.product_id}>
                <DataTable.Cell style={{ flex: 0.8 }}>
                  <Paragraph style={styles.smallText}>{product.product_code}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell style={{ flex: 2 }}>
                  <Paragraph numberOfLines={1}>{product.product_name}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.7 }}>
                  {product.total_ordered}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.7 }}>
                  <Paragraph style={{ color: product.total_received >= product.total_ordered ? '#4CAF50' : '#FF9800' }}>
                    {product.total_received}
                  </Paragraph>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  {formatCurrency(product.total_value)}
                </DataTable.Cell>
              </DataTable.Row>
            ))}

            <DataTable.Row style={styles.totalRow}>
              <DataTable.Cell style={{ flex: 0.8 }}></DataTable.Cell>
              <DataTable.Cell style={{ flex: 2 }}>
                <Paragraph style={styles.bold}>TOTAL</Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 0.7 }}>
                <Paragraph style={styles.bold}>
                  {productDeliveries.reduce((sum, p) => sum + p.total_ordered, 0)}
                </Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 0.7 }}>
                <Paragraph style={styles.bold}>
                  {productDeliveries.reduce((sum, p) => sum + p.total_received, 0)}
                </Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 1 }}>
                <Paragraph style={styles.bold}>
                  {formatCurrency(productDeliveries.reduce((sum, p) => sum + p.total_value, 0))}
                </Paragraph>
              </DataTable.Cell>
            </DataTable.Row>
          </DataTable>
        )}

        {productDeliveries.length > 50 && (
          <Paragraph style={styles.moreText}>
            Showing top 50 of {productDeliveries.length} products
          </Paragraph>
        )}
      </Card.Content>
    </Card>
  );

  const renderSuppliersView = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={styles.sectionTitle}>
          Deliveries by Supplier ({supplierDeliveries.length} suppliers)
        </Title>

        {supplierDeliveries.length === 0 ? (
          <Paragraph style={styles.emptyText}>No suppliers found</Paragraph>
        ) : (
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={{ flex: 2 }}>Supplier</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 0.7 }}>POs</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 0.8 }}>Items</DataTable.Title>
              <DataTable.Title numeric style={{ flex: 1.2 }}>Value</DataTable.Title>
            </DataTable.Header>

            {supplierDeliveries.map((supplier) => (
              <DataTable.Row key={supplier.supplier_id}>
                <DataTable.Cell style={{ flex: 2 }}>
                  <Paragraph numberOfLines={1}>{supplier.supplier_name}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.7 }}>
                  {supplier.po_count}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.8 }}>
                  {supplier.total_received}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1.2 }}>
                  {formatCurrency(supplier.total_value)}
                </DataTable.Cell>
              </DataTable.Row>
            ))}

            <DataTable.Row style={styles.totalRow}>
              <DataTable.Cell style={{ flex: 2 }}>
                <Paragraph style={styles.bold}>TOTAL</Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 0.7 }}>
                <Paragraph style={styles.bold}>
                  {supplierDeliveries.reduce((sum, s) => sum + s.po_count, 0)}
                </Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 0.8 }}>
                <Paragraph style={styles.bold}>
                  {supplierDeliveries.reduce((sum, s) => sum + s.total_received, 0)}
                </Paragraph>
              </DataTable.Cell>
              <DataTable.Cell numeric style={{ flex: 1.2 }}>
                <Paragraph style={styles.bold}>
                  {formatCurrency(supplierDeliveries.reduce((sum, s) => sum + s.total_value, 0))}
                </Paragraph>
              </DataTable.Cell>
            </DataTable.Row>
          </DataTable>
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
          <Title style={styles.pageTitle}>Delivered Items Report</Title>
          <Paragraph style={styles.pageSubtitle}>
            Items received from suppliers
          </Paragraph>
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
              label="Search (PO#, Supplier, Product, etc.)"
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

        {/* Supplier Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Paragraph style={styles.filterLabel}>Supplier:</Paragraph>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipContainer}>
                <Chip
                  selected={selectedSupplier === null}
                  onPress={() => setSelectedSupplier(null)}
                  style={styles.chip}
                >
                  All
                </Chip>
                {suppliers.slice(0, 10).map(supplier => (
                  <Chip
                    key={supplier.id}
                    selected={selectedSupplier === supplier.id}
                    onPress={() => setSelectedSupplier(supplier.id)}
                    style={styles.chip}
                  >
                    {supplier.name}
                  </Chip>
                ))}
              </View>
            </ScrollView>
          </Card.Content>
        </Card>

        {/* Status Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Paragraph style={styles.filterLabel}>Status:</Paragraph>
            <View style={styles.chipContainer}>
              <Chip
                selected={selectedStatus === null}
                onPress={() => setSelectedStatus(null)}
                style={styles.chip}
              >
                All
              </Chip>
              <Chip
                selected={selectedStatus === 'RECEIVED'}
                onPress={() => setSelectedStatus('RECEIVED')}
                style={[styles.chip, { borderColor: '#4CAF50' }]}
                selectedColor="#4CAF50"
              >
                Received
              </Chip>
              <Chip
                selected={selectedStatus === 'PARTIALLY_RECEIVED'}
                onPress={() => setSelectedStatus('PARTIALLY_RECEIVED')}
                style={[styles.chip, { borderColor: '#FF9800' }]}
                selectedColor="#FF9800"
              >
                Partial
              </Chip>
            </View>
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
                { value: 'deliveries', label: 'Deliveries', icon: 'truck-delivery' },
                { value: 'products', label: 'Products', icon: 'package-variant' },
                { value: 'suppliers', label: 'Suppliers', icon: 'account-group' },
              ]}
              style={styles.segmentedButtons}
            />
          </Card.Content>
        </Card>

        {/* Content based on active view */}
        {loading ? (
          <Card style={styles.card}>
            <Card.Content>
              <Paragraph style={styles.emptyText}>Loading delivery data...</Paragraph>
            </Card.Content>
          </Card>
        ) : (
          <>
            {activeView === 'summary' && renderSummaryView()}
            {activeView === 'deliveries' && renderDeliveriesView()}
            {activeView === 'products' && renderProductsView()}
            {activeView === 'suppliers' && renderSuppliersView()}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            Report generated on {new Date().toLocaleString('en-PH')}
          </Paragraph>
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
    flexGrow: 1,
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
    flexWrap: 'wrap',
  },
  chip: {
    marginRight: 4,
    marginBottom: 4,
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
  quantitySection: {
    paddingHorizontal: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  quantityLabel: {
    fontSize: 13,
    opacity: 0.8,
  },
  quantityValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  valueSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  valueItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: 11,
    opacity: 0.8,
  },
  valueAmount: {
    fontSize: 16,
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
