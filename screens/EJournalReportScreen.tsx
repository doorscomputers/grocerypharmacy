import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  Divider,
  Chip,
  Text,
  SegmentedButtons,
  ActivityIndicator,
  IconButton,
  Menu,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import { PRINTER_WIDTH, ESCPOSBuilder } from '../utils/escpos';
import PrintOptionsDialog from '../components/PrintOptionsDialog';
import {
  generateEJournalPdf,
  shareEJournalPdf,
  emailEJournalPdf,
} from '../utils/ReceiptPdfService';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'EJournalReport'>;
};

interface EJournalEntry {
  id: number;
  transaction_id: number | null;
  entry_type: string;
  reference_number: string;
  description: string;
  amount: number | null;
  cashier_id: number;
  cashier_name: string;
  timestamp: string;
  created_at: string;
}

interface EJournalSummary {
  totalEntries: number;
  totalSales: number;
  totalVoids: number;
  totalRefunds: number;
  totalReturns: number;
  totalPayments: number;
  byType: Array<{ entry_type: string; count: number; total_amount: number }>;
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  SALE: 'Sale',
  VOID: 'Void',
  REFUND: 'Refund',
  RETURN: 'Sales Return',
  PURCHASE_RETURN: 'Purchase Return',
  PAYMENT: 'Payment',
  Z_READING: 'Z-Reading',
  X_READING: 'X-Reading',
  SYSTEM: 'System',
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  SALE: '#4CAF50',
  VOID: '#F44336',
  REFUND: '#FF9800',
  RETURN: '#FF5722',
  PURCHASE_RETURN: '#E91E63',
  PAYMENT: '#2196F3',
  Z_READING: '#9C27B0',
  X_READING: '#673AB7',
  SYSTEM: '#607D8B',
};

export default function EJournalReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const [entries, setEntries] = useState<EJournalEntry[]>([]);
  const [summary, setSummary] = useState<EJournalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printDialogVisible, setPrintDialogVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [menuVisible, setMenuVisible] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('today');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  // Company settings for reports
  const [companySettings, setCompanySettings] = useState({
    name: '',
    address: '',
    tin: '',
    minNumber: '',
  });

  useEffect(() => {
    loadData();
    loadCompanySettings();
  }, []);

  useEffect(() => {
    loadData();
  }, [dateRange, selectedType]);

  const loadCompanySettings = async () => {
    try {
      const dbService = getDatabase();
      const name = await dbService.getSetting('company_name') || 'IgoroTech POS';
      const address = await dbService.getSetting('company_address') || '';
      const tin = await dbService.getSetting('company_tin') || '';
      const minNumber = await dbService.getSetting('min_number') || '';
      setCompanySettings({ name, address, tin, minNumber });
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const startDateStr = dateRange.startDate.toISOString().split('T')[0];
      const endDateStr = dateRange.endDate.toISOString().split('T')[0];

      // Load entries
      const result = await dbService.getEJournalEntries({
        startDate: startDateStr,
        endDate: endDateStr,
        entryType: selectedType,
        limit: 500,
      });
      setEntries(result.entries);

      // Load summary
      const summaryData = await dbService.getEJournalSummary(startDateStr, endDateStr);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading eJournal data:', error);
      Alert.alert('Error', 'Failed to load eJournal data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatPeso = (amount: number | null): string => {
    if (amount === null) return '-';
    return `₱${Math.abs(amount).toFixed(2)}`;
  };

  // Build print data for thermal printer
  const buildPrintData = (): string => {
    const width = 48; // 80mm printer
    const line = (char: string) => char.repeat(width);
    const center = (text: string) => {
      const padding = Math.max(0, Math.floor((width - text.length) / 2));
      return ' '.repeat(padding) + text;
    };
    const leftRight = (left: string, right: string) => {
      const spaces = Math.max(1, width - left.length - right.length);
      return left + ' '.repeat(spaces) + right;
    };

    const startDateStr = dateRange.startDate.toLocaleDateString('en-PH');
    const endDateStr = dateRange.endDate.toLocaleDateString('en-PH');

    let output = '';
    output += center(companySettings.name) + '\n';
    if (companySettings.address) output += center(companySettings.address) + '\n';
    if (companySettings.tin) output += center(`TIN: ${companySettings.tin}`) + '\n';
    if (companySettings.minNumber) output += center(`MIN: ${companySettings.minNumber}`) + '\n';
    output += line('=') + '\n';
    output += center('ELECTRONIC JOURNAL') + '\n';
    output += center('(BIR AUDIT TRAIL)') + '\n';
    output += line('=') + '\n';
    output += `Date Range: ${startDateStr} - ${endDateStr}\n`;
    output += `Generated: ${new Date().toLocaleString('en-PH')}\n`;
    output += line('-') + '\n';

    // Summary Section
    if (summary) {
      output += center('SUMMARY') + '\n';
      output += line('-') + '\n';
      output += leftRight('Total Entries:', summary.totalEntries.toString()) + '\n';
      output += leftRight('Total Sales:', formatPeso(summary.totalSales)) + '\n';
      output += leftRight('Total Voids:', formatPeso(summary.totalVoids)) + '\n';
      output += leftRight('Total Refunds:', formatPeso(summary.totalRefunds)) + '\n';
      output += leftRight('Total Returns:', formatPeso(summary.totalReturns)) + '\n';
      output += leftRight('Total Payments:', formatPeso(summary.totalPayments)) + '\n';
      output += line('-') + '\n';

      // By Type
      output += center('BREAKDOWN BY TYPE') + '\n';
      for (const item of summary.byType) {
        output += leftRight(
          `${ENTRY_TYPE_LABELS[item.entry_type] || item.entry_type} (${item.count})`,
          formatPeso(item.total_amount)
        ) + '\n';
      }
      output += line('=') + '\n';
    }

    // Entries Detail
    output += center('TRANSACTION DETAILS') + '\n';
    output += line('-') + '\n';

    for (const entry of entries) {
      output += `${formatDate(entry.timestamp)} ${formatTime(entry.timestamp)}\n`;
      output += `${entry.entry_type}: ${entry.reference_number}\n`;
      output += `${entry.description}\n`;
      if (entry.amount !== null) {
        output += `Amount: ${entry.amount >= 0 ? '' : '-'}${formatPeso(entry.amount)}\n`;
      }
      output += `Cashier: ${entry.cashier_name}\n`;
      output += line('-') + '\n';
    }

    output += '\n';
    output += center('*** END OF REPORT ***') + '\n';
    output += '\n\n\n';

    return output;
  };

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();
    const startDateStr = dateRange.startDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    const endDateStr = dateRange.endDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });

    // Header
    builder
      .align('center')
      .bold(true)
      .println(companySettings.name || 'IgoroTech POS')
      .bold(false);

    if (companySettings.address) builder.println(companySettings.address);
    if (companySettings.tin) builder.println(`TIN: ${companySettings.tin}`);
    if (companySettings.minNumber) builder.println(`MIN: ${companySettings.minNumber}`);

    builder
      .doubleSeparator()
      .bold(true)
      .doubleSize()
      .println('E-JOURNAL')
      .normalSize()
      .println('(BIR AUDIT TRAIL)')
      .bold(false)
      .doubleSeparator()
      .align('left')
      .leftRight('Period:', `${startDateStr}`)
      .leftRight('To:', `${endDateStr}`)
      .leftRight('Generated:', now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }))
      .separator();

    // Summary Section
    if (summary) {
      builder
        .bold(true)
        .align('center')
        .println('SUMMARY')
        .align('left')
        .bold(false)
        .separator()
        .leftRight('Total Entries:', summary.totalEntries.toString())
        .leftRight('Total Sales:', formatPeso(summary.totalSales))
        .leftRight('Total Voids:', formatPeso(summary.totalVoids))
        .leftRight('Total Refunds:', formatPeso(summary.totalRefunds))
        .leftRight('Total Returns:', formatPeso(summary.totalReturns))
        .leftRight('Total Payments:', formatPeso(summary.totalPayments))
        .separator();

      // By Type breakdown
      builder
        .bold(true)
        .println('BY TYPE')
        .bold(false);

      for (const item of summary.byType) {
        builder.leftRight(
          `${ENTRY_TYPE_LABELS[item.entry_type] || item.entry_type} (${item.count})`,
          formatPeso(item.total_amount)
        );
      }
      builder.doubleSeparator();
    }

    // Entry details (limit to first 30 for thermal paper)
    const printEntries = entries.slice(0, 30);
    if (printEntries.length > 0) {
      builder
        .bold(true)
        .align('center')
        .println('TRANSACTION DETAILS')
        .align('left')
        .bold(false)
        .separator();

      for (const entry of printEntries) {
        builder
          .println(`${formatDate(entry.timestamp)} ${formatTime(entry.timestamp)}`)
          .println(`${entry.entry_type}: ${entry.reference_number}`);

        const desc = entry.description.length > printerWidth - 2
          ? entry.description.substring(0, printerWidth - 4) + '..'
          : entry.description;
        builder.println(desc);

        if (entry.amount !== null) {
          builder.leftRight('Amount:', `${entry.amount >= 0 ? '' : '-'}${formatPeso(entry.amount)}`);
        }
        builder.leftRight('Cashier:', entry.cashier_name);
        builder.separator();
      }

      if (entries.length > 30) {
        builder.println(`... and ${entries.length - 30} more entries`);
      }
    }

    builder
      .feed()
      .align('center')
      .println('*** END OF REPORT ***')
      .feed(2)
      .cut();

    return builder;
  };

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      const startDateStr = dateRange.startDate.toISOString().split('T')[0];
      const endDateStr = dateRange.endDate.toISOString().split('T')[0];

      await shareEJournalPdf({
        companyName: companySettings.name,
        companyAddress: companySettings.address,
        companyTin: companySettings.tin,
        minNumber: companySettings.minNumber,
        startDate: startDateStr,
        endDate: endDateStr,
        entries,
        summary: summary!,
      });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to export eJournal PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleEmail = async () => {
    try {
      setExporting(true);
      const startDateStr = dateRange.startDate.toISOString().split('T')[0];
      const endDateStr = dateRange.endDate.toISOString().split('T')[0];

      await emailEJournalPdf({
        companyName: companySettings.name,
        companyAddress: companySettings.address,
        companyTin: companySettings.tin,
        minNumber: companySettings.minNumber,
        startDate: startDateStr,
        endDate: endDateStr,
        entries,
        summary: summary!,
      });
    } catch (error) {
      console.error('Email error:', error);
      Alert.alert('Email Error', 'Failed to send eJournal via email');
    } finally {
      setExporting(false);
    }
  };

  const renderEntry = ({ item }: { item: EJournalEntry }) => (
    <Card style={styles.entryCard} mode="outlined">
      <Card.Content style={styles.entryContent}>
        <View style={styles.entryHeader}>
          <Chip
            mode="flat"
            style={[
              styles.typeChip,
              { backgroundColor: ENTRY_TYPE_COLORS[item.entry_type] || '#607D8B' },
            ]}
            textStyle={styles.typeChipText}
          >
            {ENTRY_TYPE_LABELS[item.entry_type] || item.entry_type}
          </Chip>
          <Text style={styles.entryTime}>
            {formatDate(item.timestamp)} {formatTime(item.timestamp)}
          </Text>
        </View>
        <Text style={styles.referenceNumber}>{item.reference_number}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <View style={styles.entryFooter}>
          <Text style={styles.cashierName}>Cashier: {item.cashier_name}</Text>
          {item.amount !== null && (
            <Text style={[
              styles.amount,
              { color: item.amount >= 0 ? '#4CAF50' : '#F44336' }
            ]}>
              {item.amount >= 0 ? '' : '-'}{formatPeso(item.amount)}
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const renderSummary = () => {
    if (!summary) return null;

    return (
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={styles.summaryTitle}>Summary</Title>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Entries</Text>
              <Text style={styles.summaryValue}>{summary.totalEntries}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Sales</Text>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                {formatPeso(summary.totalSales)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Voids</Text>
              <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                {formatPeso(summary.totalVoids)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Returns</Text>
              <Text style={[styles.summaryValue, { color: '#FF5722' }]}>
                {formatPeso(summary.totalReturns)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Payments</Text>
              <Text style={[styles.summaryValue, { color: '#2196F3' }]}>
                {formatPeso(summary.totalPayments)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const entryTypeOptions = [
    { value: 'ALL', label: 'All' },
    { value: 'SALE', label: 'Sales' },
    { value: 'VOID', label: 'Voids' },
    { value: 'RETURN', label: 'Returns' },
    { value: 'PAYMENT', label: 'Payments' },
    { value: 'SYSTEM', label: 'System' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header with Actions */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Title style={styles.headerTitle}>eJournal Report</Title>
        </View>
        <View style={styles.headerActions}>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                setPrintDialogVisible(true);
              }}
              title="Print (58mm/80mm)"
              leadingIcon="printer"
              disabled={entries.length === 0}
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                handleExportPdf();
              }}
              title="Export PDF"
              leadingIcon="file-pdf-box"
              disabled={exporting || entries.length === 0}
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                handleEmail();
              }}
              title="Send via Email"
              leadingIcon="email-outline"
              disabled={exporting || entries.length === 0}
            />
          </Menu>
        </View>
      </View>

      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        onDateChange={handleDateChange}
        showPresets
      />

      {/* Type Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
          {entryTypeOptions.map((option) => (
            <Chip
              key={option.value}
              selected={selectedType === option.value}
              onPress={() => setSelectedType(option.value)}
              style={[
                styles.filterChip,
                selectedType === option.value && styles.filterChipSelected,
              ]}
              textStyle={selectedType === option.value ? styles.filterChipTextSelected : undefined}
            >
              {option.label}
            </Chip>
          ))}
        </View>
      </ScrollView>

      {/* Quick Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          mode="contained"
          icon="printer"
          onPress={() => setPrintDialogVisible(true)}
          disabled={exporting || entries.length === 0}
          style={styles.actionButton}
          compact
        >
          Print
        </Button>
        <Button
          mode="contained"
          icon="file-pdf-box"
          onPress={handleExportPdf}
          loading={exporting}
          disabled={printing || exporting || entries.length === 0}
          style={[styles.actionButton, { backgroundColor: '#F44336' }]}
          compact
        >
          PDF
        </Button>
        <Button
          mode="contained"
          icon="email-outline"
          onPress={handleEmail}
          loading={exporting}
          disabled={printing || exporting || entries.length === 0}
          style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
          compact
        >
          Email
        </Button>
      </View>

      <Divider />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading eJournal...</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={renderSummary}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No entries found for the selected date range</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <PrintOptionsDialog
        visible={printDialogVisible}
        onDismiss={() => setPrintDialogVisible(false)}
        title="Print eJournal Report"
        onPrint={buildPrintReport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterScroll: {
    backgroundColor: '#FFFFFF',
    maxHeight: 56,
  },
  filterRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#F5F5F5',
  },
  filterChipSelected: {
    backgroundColor: '#1976D2',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  actionButton: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 8,
  },
  summaryCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  entryCard: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  entryContent: {
    paddingVertical: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeChip: {
    height: 24,
  },
  typeChipText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  entryTime: {
    fontSize: 11,
    color: '#666',
  },
  referenceNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cashierName: {
    fontSize: 11,
    color: '#999',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
