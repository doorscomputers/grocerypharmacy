import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Searchbar,
  useTheme,
  Chip,
} from 'react-native-paper';

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Picker } from '@react-native-picker/picker';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'CustomerReport'>;
};

export default function CustomerReportScreen({ navigation }: Props) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<string>('INVOICES');
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

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

      const [customersData, receivablesData] = await Promise.all([
        dbService.getCustomers(),
        dbService.getAccountsReceivable(),
      ]);

      setCustomers(customersData);
      setReceivables(receivablesData);
    } catch (error) {
      console.error('Error loading customer report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCustomerBalance = (customerId: number): number => {
    const customerReceivables = receivables.filter(
      (r) => r.customer_id === customerId && r.status !== 'PAID'
    );
    return customerReceivables.reduce((sum, r) => sum + (r.balance_amount || 0), 0);
  };

  const handleSelectCustomer = (customerId: number) => {
    setSelectedCustomerId(customerId === selectedCustomerId ? null : customerId);
  };

  const handleViewReport = () => {
    if (!selectedCustomerId) {
      Alert.alert('Select Customer', 'Please select a customer first.');
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) return;

    navigation.navigate('CustomerReportDetail' as any, {
      customerId: selectedCustomerId,
      customerName: customer.name,
      reportType: selectedReportType,
    });
  };

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(query) ||
      customer.code?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query)
    );
  });

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    // Calculate summary totals
    const totalCustomers = filteredCustomers.length;
    let totalOutstanding = 0;
    let customersWithBalance = 0;
    let customersCleared = 0;

    filteredCustomers.forEach((customer) => {
      const balance = getCustomerBalance(customer.id);
      totalOutstanding += balance;
      if (balance > 0) {
        customersWithBalance++;
      } else if (balance === 0) {
        customersCleared++;
      }
    });

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('CUSTOMER REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .doubleSeparator();

    // Date/Time
    builder
      .align('left')
      .leftRight('Date:', formatPrinterDate(now))
      .separator();

    // Summary Section
    builder
      .bold(true)
      .align('center')
      .println('SUMMARY')
      .bold(false)
      .align('left')
      .leftRight('Total Customers:', totalCustomers.toString())
      .leftRight('With Balance:', customersWithBalance.toString())
      .leftRight('Cleared:', customersCleared.toString())
      .separator()
      .bold(true)
      .leftRight('Total Outstanding:', `P${totalOutstanding.toFixed(2)}`)
      .bold(false)
      .doubleSeparator();

    // Customer List
    builder
      .bold(true)
      .align('center')
      .println('CUSTOMER LIST')
      .bold(false)
      .align('left')
      .separator();

    filteredCustomers.forEach((customer) => {
      const balance = getCustomerBalance(customer.id);
      const status = balance > 0 ? 'HAS BALANCE' : balance === 0 ? 'CLEAR' : 'CREDIT';

      builder
        .bold(true)
        .println(customer.name || 'N/A')
        .bold(false);

      if (customer.code) {
        builder.leftRight('Code:', customer.code);
      }
      if (customer.phone) {
        builder.leftRight('Phone:', customer.phone);
      }
      builder
        .leftRight('Balance:', `P${balance.toFixed(2)}`)
        .leftRight('Status:', status)
        .separator();
    });

    // Footer
    builder
      .feed()
      .align('center')
      .println('*** END OF REPORT ***')
      .println(formatPrinterDateTime(now))
      .feed(2)
      .cut();

    return builder;
  };

  const buildPdfHtml = (): string => {
    // Calculate summary totals
    let totalOutstanding = 0;
    let customersWithBalance = 0;
    let customersCleared = 0;

    filteredCustomers.forEach((customer) => {
      const balance = getCustomerBalance(customer.id);
      totalOutstanding += balance;
      if (balance > 0) customersWithBalance++;
      else if (balance === 0) customersCleared++;
    });

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
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #2196F3; }
          .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 12px 0; }
          .summary-grid { display: flex; gap: 12px; margin: 12px 0; }
          .summary-item { flex: 1; background: #f5f5f5; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-label { font-size: 11px; color: #666; margin-bottom: 4px; }
          .summary-value { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { background-color: #f5f5f5; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .balance-positive { color: #F44336; }
          .balance-clear { color: #4CAF50; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name || 'IgoroTech POS'}</div>
          ${companySettings.address ? `<div class="header-text">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="header-text">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="report-title">CUSTOMER REPORT</div>

        <div class="section-title">Summary</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total Customers</div>
            <div class="summary-value" style="color: #2196F3;">${filteredCustomers.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">With Balance</div>
            <div class="summary-value" style="color: #F44336;">${customersWithBalance}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Cleared</div>
            <div class="summary-value" style="color: #4CAF50;">${customersCleared}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Outstanding</div>
            <div class="summary-value" style="color: #E91E63;">₱${totalOutstanding.toFixed(2)}</div>
          </div>
        </div>

        <div class="section-title">Customer List</div>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCustomers.map(customer => {
              const balance = getCustomerBalance(customer.id);
              const statusClass = balance > 0 ? 'balance-positive' : 'balance-clear';
              const status = balance > 0 ? 'HAS BALANCE' : balance === 0 ? 'CLEAR' : 'CREDIT';
              return `
                <tr>
                  <td>${customer.code || '-'}</td>
                  <td>${customer.name || 'N/A'}</td>
                  <td>${customer.phone || '-'}</td>
                  <td class="${statusClass}">₱${balance.toFixed(2)}</td>
                  <td>${status}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Customer Report</p>
        </div>
      </body>
      </html>
    `;
  };

  const renderCustomerCard = ({ item }: { item: any }) => {
    const balance = getCustomerBalance(item.id);
    const isSelected = selectedCustomerId === item.id;

    return (
      <Card
        style={[
          styles.customerCard,
          isSelected && { borderColor: '#2196F3', borderWidth: 2 },
        ]}
        onPress={() => handleSelectCustomer(item.id)}
      >
        <Card.Content>
          <View style={styles.customerRow}>
            <View style={styles.customerInfo}>
              <Paragraph style={[styles.customerName, { fontSize: fs.body }]}>{item.name}</Paragraph>
              <Paragraph style={styles.customerCode}>{item.code}</Paragraph>
              {item.phone && (
                <Paragraph style={styles.customerPhone}>{item.phone}</Paragraph>
              )}
            </View>
            <View style={styles.balanceContainer}>
              <Paragraph style={styles.balanceLabel}>Outstanding</Paragraph>
              <Paragraph
                style={[
                  styles.balanceAmount,
                  { color: balance > 0 ? '#F44336' : '#4CAF50' },
                ]}
              >
                {'\u20B1'}{balance.toFixed(2)}
              </Paragraph>
              {balance > 0 && (
                <Chip
                  style={[styles.statusChip, { backgroundColor: '#F44336' }]}
                  textStyle={{ color: 'white', fontSize: 9 }}
                  compact
                >
                  HAS BALANCE
                </Chip>
              )}
              {balance === 0 && (
                <Chip
                  style={[styles.statusChip, { backgroundColor: '#4CAF50' }]}
                  textStyle={{ color: 'white', fontSize: 9 }}
                  compact
                >
                  CLEAR
                </Chip>
              )}
              {balance < 0 && (
                <Chip
                  style={[styles.statusChip, { backgroundColor: '#2196F3' }]}
                  textStyle={{ color: 'white', fontSize: 9 }}
                  compact
                >
                  CREDIT
                </Chip>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Report Actions: Print, PDF, Email */}
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Customer Report"
        reportFileName={`CustomerReport_${new Date().toISOString().split('T')[0]}`}
        disabled={filteredCustomers.length === 0}
      />

      {/* Report Type Selector */}
      <View style={styles.reportTypeContainer}>
        <Title style={styles.sectionLabel}>Report Type:</Title>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedReportType}
            onValueChange={(value) => setSelectedReportType(value)}
            style={styles.picker}
          >
            <Picker.Item label="Sales / Invoices" value="INVOICES" />
            <Picker.Item label="Sales Returns" value="RETURNS" />
            <Picker.Item label="Payments" value="PAYMENTS" />
          </Picker>
        </View>
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder="Search customers..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* Customer List */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCustomerCard}
        contentContainerStyle={[styles.listContainer, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>No customers found.</Paragraph>
          </View>
        }
      />

      {/* View Report Button */}
      <View style={styles.bottomBar}>
        <Button
          mode="contained"
          onPress={handleViewReport}
          disabled={!selectedCustomerId}
          style={styles.viewButton}
          labelStyle={styles.viewButtonLabel}
          icon="file-chart"
        >
          View Report
        </Button>
      </View>

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
    alignItems: 'flex-start',
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
  reportTypeContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
  },
  picker: {
    height: 50,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 80,
  },
  customerCard: {
    marginBottom: 10,
    elevation: 3,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  customerCode: {
    fontSize: 12,
    opacity: 0.7,
  },
  customerPhone: {
    fontSize: 12,
    opacity: 0.7,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 11,
    opacity: 0.6,
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusChip: {
    marginTop: 4,
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
  bottomBar: {
    padding: 16,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  viewButton: {
    paddingVertical: 6,
  },
  viewButtonLabel: {
    fontSize: 16,
  },
});
