import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
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
  Menu,
} from 'react-native-paper';

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPrinterDate } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

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
  const { sp, fs, lo } = useResponsiveTheme();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<ReportView>('summary');
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [supplierMenuVisible, setSupplierMenuVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
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

      // Load ALL purchase details in a single batch query (not N+1)
      const allDetails = await dbService.getAllPurchaseDetails();
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

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('DELIVERED ITEMS')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .println(`Period: ${formatPrinterDate(dateRange.startDate)}`)
      .println(`to ${formatPrinterDate(dateRange.endDate)}`)
      .doubleSeparator();

    // Summary Section
    builder
      .align('left')
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .separator()
      .leftRight('Total POs:', summary.totalPOs.toString())
      .leftRight('Fully Received:', summary.fullyReceived.toString())
      .leftRight('Partial Received:', summary.partiallyReceived.toString())
      .leftRight('Unique Suppliers:', summary.uniqueSuppliers.toString())
      .leftRight('Unique Products:', summary.uniqueProducts.toString())
      .separator();

    // Quantity Summary
    builder
      .leftRight('Items Ordered:', summary.totalOrdered.toLocaleString())
      .leftRight('Items Received:', summary.totalReceived.toLocaleString())
      .leftRight('Pending Items:', summary.totalPending.toLocaleString())
      .leftRight('Fulfillment Rate:', `${summary.fulfillmentRate.toFixed(1)}%`)
      .doubleSeparator();

    // Value Summary
    builder
      .bold(true)
      .leftRight('Received Value:', `P${summary.totalValue.toFixed(2)}`)
      .bold(false)
      .separator();

    // Top Suppliers (first 10)
    if (supplierDeliveries.length > 0) {
      builder
        .bold(true)
        .println('TOP SUPPLIERS')
        .bold(false)
        .separator();

      supplierDeliveries.slice(0, 10).forEach((supplier, index) => {
        const name = supplier.supplier_name.length > printerWidth - 5
          ? supplier.supplier_name.substring(0, printerWidth - 7) + '..'
          : supplier.supplier_name;
        builder.println(`${index + 1}. ${name}`);
        builder.leftRight(`  POs: ${supplier.po_count}`, `P${supplier.total_value.toFixed(2)}`);
      });

      builder.separator();
    }

    // Top Products (first 10)
    if (productDeliveries.length > 0) {
      builder
        .bold(true)
        .println('TOP PRODUCTS')
        .bold(false)
        .separator();

      productDeliveries.slice(0, 10).forEach((product, index) => {
        const name = product.product_name.length > printerWidth - 5
          ? product.product_name.substring(0, printerWidth - 7) + '..'
          : product.product_name;
        builder.println(`${index + 1}. ${name}`);
        builder.leftRight(`  Qty: ${product.total_received}`, `P${product.total_value.toFixed(2)}`);
      });

      builder.separator();
    }

    // Footer
    builder
      .feed()
      .align('center')
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
          .summary-item { flex: 1; min-width: 100px; padding: 10px; background: #f9f9f9; border-radius: 5px; text-align: center; }
          .summary-label { font-size: 10px; color: #666; }
          .summary-value { font-size: 14px; font-weight: bold; }
          .positive { color: #4CAF50; }
          .negative { color: #F44336; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          ${companySettings.address ? `<div class="company-info">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
          <div class="report-title">DELIVERED ITEMS REPORT</div>
          <div class="date-time">Generated: ${dateStr} ${timeStr}</div>
          <div class="date-time">Period: ${dateRange.startDate.toLocaleDateString('en-PH')} to ${dateRange.endDate.toLocaleDateString('en-PH')}</div>
        </div>

        <div class="section">
          <div class="section-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total POs</div>
              <div class="summary-value">${summary.totalPOs}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Fully Received</div>
              <div class="summary-value positive">${summary.fullyReceived}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Partial</div>
              <div class="summary-value" style="color: #FF9800;">${summary.partiallyReceived}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Suppliers</div>
              <div class="summary-value">${summary.uniqueSuppliers}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Products</div>
              <div class="summary-value">${summary.uniqueProducts}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Received Value</div>
              <div class="summary-value positive">${formatCurrency(summary.totalValue)}</div>
            </div>
          </div>
          <table>
            <tr><td>Items Ordered</td><td class="text-right">${summary.totalOrdered.toLocaleString()}</td></tr>
            <tr><td>Items Received</td><td class="text-right">${summary.totalReceived.toLocaleString()}</td></tr>
            <tr><td>Pending Items</td><td class="text-right ${summary.totalPending > 0 ? 'negative' : ''}">${summary.totalPending.toLocaleString()}</td></tr>
            <tr><td>Fulfillment Rate</td><td class="text-right">${summary.fulfillmentRate.toFixed(1)}%</td></tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Top Suppliers by Value</div>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th class="text-right">POs</th>
                <th class="text-right">Items</th>
                <th class="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              ${supplierDeliveries.slice(0, 15).map(supplier => `
                <tr>
                  <td>${supplier.supplier_name}</td>
                  <td class="text-right">${supplier.po_count}</td>
                  <td class="text-right">${supplier.total_received}</td>
                  <td class="text-right">${formatCurrency(supplier.total_value)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Top Products Received</div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              ${productDeliveries.slice(0, 15).map(product => `
                <tr>
                  <td>${product.product_name}</td>
                  <td class="text-right">${product.total_received}</td>
                  <td class="text-right">${formatCurrency(product.total_value)}</td>
                </tr>
              `).join('')}
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
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Delivery Summary</Title>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryItem, { backgroundColor: '#E3F2FD' }]}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total POs</Paragraph>
              <Title style={[styles.summaryValue, { color: '#1976D2' }]}>
                {summary.totalPOs}
              </Title>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: '#E8F5E9' }]}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Fully Received</Paragraph>
              <Title style={[styles.summaryValue, { color: '#388E3C' }]}>
                {summary.fullyReceived}
              </Title>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: '#FFF3E0' }]}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Partial</Paragraph>
              <Title style={[styles.summaryValue, { color: '#F57C00' }]}>
                {summary.partiallyReceived}
              </Title>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: '#E1F5FE' }]}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Suppliers</Paragraph>
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
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Top Suppliers by Value</Title>
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
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Top Products Received</Title>
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
        <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>
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
        <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>
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
        <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Delivered Items Report"
        reportFileName="DeliveredItemsReport"
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
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
            <Menu
              visible={supplierMenuVisible}
              onDismiss={() => setSupplierMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setSupplierMenuVisible(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {selectedSupplier
                      ? suppliers.find(s => s.id === selectedSupplier)?.name || 'Unknown'
                      : 'All Suppliers'}
                  </Text>
                  <Text style={styles.dropdownChevron}>▼</Text>
                </TouchableOpacity>
              }
              contentStyle={styles.menuContent}
            >
              <Menu.Item
                onPress={() => {
                  setSelectedSupplier(null);
                  setSupplierMenuVisible(false);
                }}
                title="All Suppliers"
                leadingIcon={selectedSupplier === null ? 'check' : undefined}
              />
              <Divider />
              {[...suppliers]
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(supplier => (
                  <Menu.Item
                    key={supplier.id}
                    onPress={() => {
                      setSelectedSupplier(supplier.id);
                      setSupplierMenuVisible(false);
                    }}
                    title={supplier.name}
                    leadingIcon={selectedSupplier === supplier.id ? 'check' : undefined}
                  />
                ))}
            </Menu>
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
        ) : filteredPurchases.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Title style={{ color: '#757575', marginBottom: 8 }}>No Delivered Items Found</Title>
              <Paragraph style={{ textAlign: 'center', color: '#9E9E9E', marginBottom: 4 }}>
                No purchase orders with received items in the selected date range.
              </Paragraph>
              <Paragraph style={{ textAlign: 'center', color: '#9E9E9E' }}>
                Try changing the date range or check if items have been received in Purchase Orders.
              </Paragraph>
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
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  menuContent: {
    backgroundColor: '#fff',
    maxHeight: 300,
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
