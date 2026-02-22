import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DatabaseService } from '../../database/DatabaseService';
import { useResponsiveTheme } from '../../utils/responsive';

// Date preset options
const DATE_PRESETS = [
  { label: 'Today', days: 0, type: 'days' },
  { label: 'Yesterday', days: 1, type: 'days' },
  { label: 'Last 2 Days', days: 2, type: 'days' },
  { label: 'Last 3 Days', days: 3, type: 'days' },
  { label: 'Last 4 Days', days: 4, type: 'days' },
  { label: 'Last 5 Days', days: 5, type: 'days' },
  { label: 'Last 6 Days', days: 6, type: 'days' },
  { label: 'Last 7 Days', days: 7, type: 'days' },
  { label: 'This Week', days: 0, type: 'week' },
] as const;

export interface InvoiceTransaction {
  id: number;
  invoice_number: string;
  transaction_number: string;
  customer_id?: number;
  customer_name?: string;
  customer_full_name?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  status: string;
  sc_pwd_id?: string;
  sc_pwd_name?: string;
  sc_pwd_type?: 'SENIOR' | 'PWD';
  transaction_date: string;
  created_at: string;
  cashier_id: number;
  cashier_name?: string;
  items?: any[];
}

interface POSInvoiceListPickerProps {
  onSelectInvoice: (transaction: InvoiceTransaction) => void;
  onSearchInvoice: (invoiceNumber: string) => void;
  isSearching?: boolean;
  accentColor?: string; // For different modal themes (void=red, refund=orange, exchange=blue)
  excludeWithReturns?: boolean; // When true, excludes transactions with associated refunds/exchanges (used for void modal)
  cashierId?: number; // Filter by specific cashier (for void modal to show only same cashier)
  todayOnly?: boolean; // When true, only shows "Today" preset and forces today filter (for void modal)
  excludeClosedShifts?: boolean; // When true, excludes transactions from closed shifts (void modal only)
}

// Format currency with commas
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Format date for display (Philippines timezone)
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Get start date based on preset
const getDateRange = (preset: typeof DATE_PRESETS[number]): { startDate: string; endDate: string } => {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate = new Date(now);

  if (preset.type === 'week') {
    // This week - start from Sunday
    const dayOfWeek = now.getDay();
    startDate.setDate(now.getDate() - dayOfWeek);
  } else {
    // Days ago
    startDate.setDate(now.getDate() - preset.days);
  }
  startDate.setHours(0, 0, 0, 0);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

export default function POSInvoiceListPicker({
  onSelectInvoice,
  onSearchInvoice,
  isSearching = false,
  accentColor = '#1976D2',
  excludeWithReturns = false,
  cashierId,
  todayOnly = false,
  excludeClosedShifts = false,
}: POSInvoiceListPickerProps) {
  const { sp, fs, lo } = useResponsiveTheme();
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search');
  const [searchText, setSearchText] = useState('');
  // Default to "Today" (index 0) if todayOnly=true, otherwise "Last 7 Days" (index 7)
  const [selectedPreset, setSelectedPreset] = useState(todayOnly ? 0 : 7);
  const [invoices, setInvoices] = useState<InvoiceTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customerFilter, setCustomerFilter] = useState('');

  // Function to load invoices from database
  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const db = DatabaseService.getInstance();
      const preset = DATE_PRESETS[selectedPreset];
      const { startDate, endDate } = getDateRange(preset);
      const transactions = await db.getTransactionsForDateRange(startDate, endDate, excludeWithReturns, cashierId, excludeClosedShifts);
      setInvoices(transactions);
    } catch (error) {
      console.error('Error loading invoices:', error);
      Alert.alert('Error', 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  // Load invoices on component mount (for when modal reopens)
  useEffect(() => {
    if (activeTab === 'browse') {
      loadInvoices();
    }
  }, []);

  // Load invoices when browse tab is active or preset changes
  useEffect(() => {
    if (activeTab === 'browse') {
      loadInvoices();
    }
  }, [activeTab, selectedPreset, excludeWithReturns, cashierId, excludeClosedShifts]);


  const handleSearch = () => {
    if (!searchText.trim()) {
      Alert.alert('Error', 'Please enter an invoice number');
      return;
    }
    onSearchInvoice(searchText.trim());
  };

  const handleSelectInvoice = (invoice: InvoiceTransaction) => {
    onSelectInvoice(invoice);
  };

  // Filter invoices by customer name
  const filteredInvoices = customerFilter.trim()
    ? invoices.filter(inv => {
        const name = (inv.customer_full_name || inv.customer_name || 'Walk-in Customer').toLowerCase();
        return name.includes(customerFilter.trim().toLowerCase());
      })
    : invoices;

  // Render a single invoice item
  const renderInvoiceItem = (item: InvoiceTransaction) => {
    const hasDiscount = item.discount_amount > 0;
    const customerDisplay = item.customer_full_name || item.customer_name || 'Walk-in Customer';

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.invoiceItem, hasDiscount && styles.invoiceItemWithDiscount]}
        onPress={() => handleSelectInvoice(item)}
        activeOpacity={0.7}
      >
        <View style={styles.invoiceHeader}>
          <View style={styles.invoiceMainInfo}>
            <Text style={[styles.invoiceNumber, { fontSize: fs.body }]}>{item.invoice_number || item.transaction_number}</Text>
            {hasDiscount && (
              <View style={styles.discountBadge}>
                <MaterialCommunityIcons name="tag" size={12} color="#E65100" />
                <Text style={styles.discountBadgeText}>Discount</Text>
              </View>
            )}
          </View>
          <Text style={[styles.invoiceAmount, { color: accentColor }]}>
            ₱{formatCurrency(item.total_amount)}
          </Text>
        </View>

        <View style={styles.invoiceDetails}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="account" size={14} color="#757575" />
            <Text style={styles.detailText}>{customerDisplay}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color="#757575" />
            <Text style={styles.detailText}>{formatDate(item.transaction_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="account-tie" size={14} color="#757575" />
            <Text style={styles.detailText}>{item.cashier_name || 'Unknown Cashier'}</Text>
          </View>
        </View>

        {hasDiscount && (
          <View style={styles.discountInfo}>
            <Text style={styles.discountInfoText}>
              Discount: ₱{formatCurrency(item.discount_amount)}
              {item.sc_pwd_type && ` (${item.sc_pwd_type === 'SENIOR' ? 'SC' : 'PWD'})`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { padding: sp.sm }]}>
      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'search' && [styles.activeTab, { borderBottomColor: accentColor }]
          ]}
          onPress={() => setActiveTab('search')}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color={activeTab === 'search' ? accentColor : '#757575'}
          />
          <Text style={[
            styles.tabText,
            activeTab === 'search' && [styles.activeTabText, { color: accentColor }]
          ]}>
            Search Invoice
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'browse' && [styles.activeTab, { borderBottomColor: accentColor }]
          ]}
          onPress={() => setActiveTab('browse')}
        >
          <MaterialCommunityIcons
            name="format-list-bulleted"
            size={18}
            color={activeTab === 'browse' ? accentColor : '#757575'}
          />
          <Text style={[
            styles.tabText,
            activeTab === 'browse' && [styles.activeTabText, { color: accentColor }]
          ]}>
            Browse Invoices
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Mode */}
      {activeTab === 'search' && (
        <View style={styles.searchContainer}>
          <Text style={styles.label}>Invoice/Transaction Number</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Enter invoice number"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.searchBtn, { backgroundColor: accentColor }]}
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.searchBtnText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Browse Mode */}
      {activeTab === 'browse' && (
        <View style={styles.browseContainer}>
          {/* Date Presets */}
          <Text style={styles.label}>Select Date Range</Text>
          <View style={styles.presetsContainer}>
            {(todayOnly ? DATE_PRESETS.slice(0, 1) : DATE_PRESETS).map((preset, index) => {
              // When todayOnly=true, we only show the first preset (Today), so always use index 0
              const actualIndex = todayOnly ? 0 : index;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.presetChip,
                    selectedPreset === actualIndex && [styles.presetChipActive, { backgroundColor: accentColor + '20', borderColor: accentColor }]
                  ]}
                  onPress={() => setSelectedPreset(actualIndex)}
                >
                  <Text style={[
                    styles.presetChipText,
                    selectedPreset === actualIndex && [styles.presetChipTextActive, { color: accentColor }]
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Customer Name Filter */}
          <View style={styles.customerFilterContainer}>
            <View style={styles.customerFilterRow}>
              <MaterialCommunityIcons name="account-search" size={18} color="#757575" />
              <TextInput
                style={styles.customerFilterInput}
                value={customerFilter}
                onChangeText={setCustomerFilter}
                placeholder="Filter by customer name..."
                placeholderTextColor="#9E9E9E"
              />
              {customerFilter.length > 0 && (
                <TouchableOpacity onPress={() => setCustomerFilter('')} style={styles.customerFilterClear}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#9E9E9E" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Invoice List */}
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {filteredInvoices.length}{customerFilter.trim() ? ` of ${invoices.length}` : ''} Invoice{filteredInvoices.length !== 1 ? 's' : ''} Found
            </Text>
            {isLoading && <ActivityIndicator size="small" color={accentColor} />}
          </View>

          <ScrollView
            style={styles.invoiceList}
            contentContainerStyle={invoices.length === 0 ? styles.emptyListContainer : { paddingBottom: 16 }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {filteredInvoices.length === 0 && !isLoading ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="receipt" size={48} color="#BDBDBD" />
                <Text style={styles.emptyText}>No invoices found</Text>
                <Text style={styles.emptySubtext}>
                  {customerFilter.trim() ? 'Try a different customer name' : 'Try selecting a different date range'}
                </Text>
              </View>
            ) : (
              filteredInvoices.map(item => renderInvoiceItem(item))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  // Search mode styles
  searchContainer: {
    paddingTop: 8,
    minHeight: 100,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  searchBtn: {
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Browse mode styles
  browseContainer: {
    flex: 1,
    minHeight: 380,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  presetChipActive: {
    borderWidth: 1.5,
  },
  presetChipText: {
    fontSize: 12,
    color: '#616161',
  },
  presetChipTextActive: {
    fontWeight: '600',
  },
  customerFilterContainer: {
    marginBottom: 12,
  },
  customerFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FAFAFA',
  },
  customerFilterInput: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  customerFilterClear: {
    padding: 4,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 13,
    color: '#757575',
    fontWeight: '500',
  },
  invoiceList: {
    flex: 1,
    minHeight: 250,
    maxHeight: 300,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 200,
  },
  // Invoice item styles
  invoiceItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  invoiceItemWithDiscount: {
    borderColor: '#FFE0B2',
    backgroundColor: '#FFFAF5',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  invoiceMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  discountBadgeText: {
    fontSize: 10,
    color: '#E65100',
    fontWeight: '600',
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  invoiceDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#616161',
  },
  discountInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
  },
  discountInfoText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '500',
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9E9E9E',
    marginTop: 4,
  },
});
