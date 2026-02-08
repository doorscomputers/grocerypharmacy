import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  Platform,
  TouchableOpacity,
  Text,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  Chip,
  DataTable,
  Searchbar,
  Portal,
  Dialog,
  Divider,
  IconButton,
  Menu,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import { ESCPOSBuilder, PRINTER_WIDTH } from '../utils/escpos';

type InventoryMovementsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'InventoryMovements'
>;

type Props = {
  navigation: InventoryMovementsScreenNavigationProp;
};

type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';
type ReferenceType = 'SALE' | 'PURCHASE' | 'MANUAL_ADJUSTMENT' | 'DAMAGE' | 'DAMAGE_REVERSAL' | 'PHYSICAL_COUNT';

export default function InventoryMovementsScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'movements' | 'summary'>('movements');
  const [movements, setMovements] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [filterType, setFilterType] = useState<MovementType | ''>('');
  const [filterReference, setFilterReference] = useState<ReferenceType | ''>('');

  // Product History Dialog
  const [historyDialogVisible, setHistoryDialogVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productHistory, setProductHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyDatePreset, setHistoryDatePreset] = useState<string>('last_30_days');

  // Print Menu
  const [printMenuVisible, setPrintMenuVisible] = useState(false);
  const [printing, setPrinting] = useState(false);

  const theme = useTheme();
  const printerService = BluetoothPrinterService.getInstance();

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      // Format dates for database query
      const dateFrom = dateRange.startDate.toISOString().split('T')[0];
      const dateTo = dateRange.endDate.toISOString().split('T')[0];

      const options: any = {
        date_from: dateFrom,
        date_to: dateTo,
        limit: 100
      };

      if (filterType) options.movement_type = filterType;
      if (filterReference) options.reference_type = filterReference;

      const [movementsData, summaryData] = await Promise.all([
        dbService.getInventoryMovements(options),
        dbService.getInventoryMovementsSummary(dateFrom, dateTo)
      ]);

      setMovements(movementsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading inventory movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHistoryDateRange = (preset: string) => {
    const today = new Date();
    let startDate: Date;

    switch (preset) {
      case 'last_7_days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last_30_days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'last_90_days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'this_year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      case 'all_time':
        startDate = new Date(2020, 0, 1); // Far back date
        break;
      default:
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
  };

  const loadProductHistory = async (productId: number, productName: string, productCode: string, preset?: string) => {
    try {
      setLoadingHistory(true);

      // Only set product and show dialog if it's a new product selection
      if (productName && productCode) {
        setSelectedProduct({ id: productId, name: productName, code: productCode });
        setHistoryDialogVisible(true);
      }

      const usePreset = preset || historyDatePreset;
      const { startDate, endDate } = getHistoryDateRange(usePreset);

      const dbService = getDatabase();
      const history = await dbService.getInventoryMovements({
        product_id: productId,
        date_from: startDate,
        date_to: endDate,
        limit: 100
      });

      setProductHistory(history);
    } catch (error) {
      console.error('Error loading product history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleHistoryDatePresetChange = (preset: string) => {
    setHistoryDatePreset(preset);
    if (selectedProduct) {
      loadProductHistory(selectedProduct.id, '', '', preset);
    }
  };

  // Generate HTML for printing
  const generatePrintHTML = () => {
    const dateFrom = dateRange.startDate.toLocaleDateString('en-PH');
    const dateTo = dateRange.endDate.toLocaleDateString('en-PH');

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Inventory Movements Report</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
          h2 { text-align: center; font-size: 14px; color: #666; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .in { color: #4CAF50; font-weight: bold; }
          .out { color: #F44336; font-weight: bold; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; }
          .summary { margin-top: 15px; padding: 10px; background-color: #f9f9f9; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>INVENTORY MOVEMENTS REPORT</h1>
        <h2>${dateFrom} - ${dateTo}</h2>

        <div class="summary">
          <strong>Total Movements:</strong> ${filteredMovements.length} |
          <strong>IN:</strong> ${filteredMovements.filter(m => m.movement_type === 'IN').reduce((sum, m) => sum + m.quantity, 0)} |
          <strong>OUT:</strong> ${filteredMovements.filter(m => m.movement_type === 'OUT').reduce((sum, m) => sum + m.quantity, 0)}
        </div>

        <table>
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>Product</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Before</th>
              <th>Qty</th>
              <th>After</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredMovements.forEach(item => {
      const date = new Date(item.created_at).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const qtyClass = item.movement_type === 'IN' ? 'in' : 'out';
      const qtySign = item.movement_type === 'IN' ? '+' : '-';

      html += `
        <tr>
          <td>${date}</td>
          <td>${item.product_name}<br><small>${item.product_code}</small></td>
          <td>${item.movement_type}</td>
          <td>${item.reference_type}<br><small>${item.reference_number || '-'}</small></td>
          <td>${item.quantity_before}</td>
          <td class="${qtyClass}">${qtySign}${item.quantity}</td>
          <td>${item.quantity_after}</td>
          <td>₱${(item.total_value || 0).toFixed(2)}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <div class="footer">
          Printed on: ${new Date().toLocaleString('en-PH')}<br>
          Generated by POS Mobile System
        </div>
      </body>
      </html>
    `;

    return html;
  };

  // Print to USB/System Printer (via expo-print)
  const printToSystemPrinter = async () => {
    try {
      setPrinting(true);
      setPrintMenuVisible(false);

      const html = generatePrintHTML();
      await Print.printAsync({ html });

      Alert.alert('Success', 'Report sent to printer');
    } catch (error: any) {
      console.error('Print error:', error);
      Alert.alert('Print Error', error.message || 'Failed to print');
    } finally {
      setPrinting(false);
    }
  };

  // Print to Bluetooth Thermal Printer
  const printToBluetoothPrinter = async () => {
    try {
      setPrinting(true);
      setPrintMenuVisible(false);

      if (!printerService.isConnected()) {
        Alert.alert(
          'Printer Not Connected',
          'Please connect to a Bluetooth printer first in Settings > Printer Settings',
          [{ text: 'OK' }]
        );
        setPrinting(false);
        return;
      }

      const settings = printerService.getSettings();
      const builder = new ESCPOSBuilder(settings.printerWidth);
      const dateFrom = dateRange.startDate.toLocaleDateString('en-PH');
      const dateTo = dateRange.endDate.toLocaleDateString('en-PH');

      // Header
      builder
        .align('center')
        .bold(true)
        .println('INVENTORY MOVEMENTS')
        .bold(false)
        .println(`${dateFrom} - ${dateTo}`)
        .feed()
        .separator();

      // Summary
      const totalIn = filteredMovements.filter(m => m.movement_type === 'IN').reduce((sum, m) => sum + m.quantity, 0);
      const totalOut = filteredMovements.filter(m => m.movement_type === 'OUT').reduce((sum, m) => sum + m.quantity, 0);

      builder
        .align('left')
        .leftRight('Total Movements:', filteredMovements.length.toString())
        .leftRight('Total IN:', `+${totalIn}`)
        .leftRight('Total OUT:', `-${totalOut}`)
        .separator();

      // Movement details (limited to fit on thermal paper)
      const maxItems = Math.min(filteredMovements.length, 20);

      for (let i = 0; i < maxItems; i++) {
        const item = filteredMovements[i];
        const date = new Date(item.created_at).toLocaleString('en-PH', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const qtySign = item.movement_type === 'IN' ? '+' : '-';

        builder
          .println(`${item.product_name}`)
          .leftRight(`${item.product_code}`, `${qtySign}${item.quantity}`)
          .leftRight(`${date}`, `${item.quantity_before}→${item.quantity_after}`)
          .println(`${item.reference_type}: ${item.reference_number || '-'}`)
          .separator('-');
      }

      if (filteredMovements.length > maxItems) {
        builder
          .align('center')
          .println(`... and ${filteredMovements.length - maxItems} more items`)
          .feed();
      }

      // Footer
      builder
        .align('center')
        .separator()
        .println(new Date().toLocaleString('en-PH'))
        .feed(2)
        .cut();

      await printerService.print(builder);
      Alert.alert('Success', 'Report printed successfully');
    } catch (error: any) {
      console.error('Bluetooth print error:', error);
      Alert.alert('Print Error', error.message || 'Failed to print to Bluetooth printer');
    } finally {
      setPrinting(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    try {
      setPrinting(true);
      setPrintMenuVisible(false);

      const html = generatePrintHTML();
      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export Inventory Movements Report',
        });
      } else {
        Alert.alert('Success', `PDF saved to: ${uri}`);
      }
    } catch (error: any) {
      console.error('Export PDF error:', error);
      Alert.alert('Error', error.message || 'Failed to export PDF');
    } finally {
      setPrinting(false);
    }
  };

  // Send PDF by Email
  const sendByEmail = async () => {
    try {
      setPrinting(true);
      setPrintMenuVisible(false);

      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Email is not available on this device. Please set up an email account first.');
        setPrinting(false);
        return;
      }

      const html = generatePrintHTML();
      const { uri } = await Print.printToFileAsync({ html });

      const dateFrom = dateRange.startDate.toLocaleDateString('en-PH');
      const dateTo = dateRange.endDate.toLocaleDateString('en-PH');

      // Copy to a named file for better attachment name
      const fileName = `Inventory_Movements_${dateFrom.replace(/\//g, '-')}_to_${dateTo.replace(/\//g, '-')}.pdf`;
      const newUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: newUri });

      await MailComposer.composeAsync({
        subject: `Inventory Movements Report (${dateFrom} - ${dateTo})`,
        body: `Please find attached the Inventory Movements Report for the period ${dateFrom} to ${dateTo}.\n\nTotal Movements: ${filteredMovements.length}\n\nGenerated by POS Mobile System`,
        attachments: [newUri],
      });
    } catch (error: any) {
      console.error('Email error:', error);
      Alert.alert('Error', error.message || 'Failed to send email');
    } finally {
      setPrinting(false);
    }
  };

  const getMovementTypeColor = (type: MovementType) => {
    switch (type) {
      case 'IN': return '#4CAF50';
      case 'OUT': return '#F44336';
      case 'ADJUSTMENT': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getReferenceTypeColor = (type: ReferenceType) => {
    switch (type) {
      case 'SALE': return '#2196F3';
      case 'PURCHASE': return '#4CAF50';
      case 'DAMAGE': return '#F44336';
      case 'DAMAGE_REVERSAL': return '#FF9800';
      case 'PHYSICAL_COUNT': return '#9C27B0';
      case 'MANUAL_ADJUSTMENT': return '#795548';
      default: return '#9E9E9E';
    }
  };

  const filteredMovements = movements.filter(movement => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      movement.product_name?.toLowerCase().includes(query) ||
      movement.product_code?.toLowerCase().includes(query) ||
      movement.reference_number?.toLowerCase().includes(query) ||
      movement.notes?.toLowerCase().includes(query)
    );
  });

  const renderMovement = ({ item }: { item: any }) => (
    <Card
      style={styles.movementCard}
      onPress={() => loadProductHistory(item.product_id, item.product_name, item.product_code)}
    >
      <Card.Content>
        <View style={styles.movementHeader}>
          <View style={styles.movementInfo}>
            <Paragraph style={styles.productName}>{item.product_name}</Paragraph>
            <Paragraph style={styles.productCode}>{item.product_code}</Paragraph>
            <Paragraph style={styles.movementDate}>
              {new Date(item.created_at).toLocaleString()}
            </Paragraph>
            <Paragraph style={styles.createdBy}>
              By: {item.created_by_name}
            </Paragraph>
          </View>
          <View style={styles.movementStats}>
            <Chip
              style={[styles.typeChip, { backgroundColor: getMovementTypeColor(item.movement_type) }]}
              textStyle={{ color: 'white', fontSize: 10 }}
              compact
            >
              {item.movement_type}
            </Chip>
            <Chip
              style={[styles.referenceChip, { backgroundColor: getReferenceTypeColor(item.reference_type) }]}
              textStyle={{ color: 'white', fontSize: 9 }}
              compact
            >
              {item.reference_type}
            </Chip>
          </View>
        </View>

        <View style={styles.quantityRow}>
          <View style={styles.quantityBadge}>
            <Paragraph style={styles.quantityLabel}>Before</Paragraph>
            <Paragraph style={styles.quantityValue}>{item.quantity_before}</Paragraph>
          </View>
          <View style={styles.quantityArrow}>
            <Paragraph style={styles.arrowText}>→</Paragraph>
          </View>
          <View style={styles.quantityBadge}>
            <Paragraph style={styles.quantityLabel}>After</Paragraph>
            <Paragraph style={styles.quantityValue}>{item.quantity_after}</Paragraph>
          </View>
          <View style={styles.quantityChange}>
            <Paragraph style={styles.changeLabel}>Change</Paragraph>
            <Paragraph style={[
              styles.changeValue,
              { color: item.movement_type === 'IN' ? '#4CAF50' : '#F44336' }
            ]}>
              {item.movement_type === 'IN' ? '+' : '-'}{item.quantity}
            </Paragraph>
          </View>
        </View>

        {item.reference_number && (
          <Paragraph style={styles.referenceNumber}>
            Ref: {item.reference_number}
          </Paragraph>
        )}

        {item.notes && (
          <Paragraph style={styles.notes}>{item.notes}</Paragraph>
        )}

        <View style={styles.cardFooter}>
          <Paragraph style={styles.totalValue}>
            Value: ₱{item.total_value?.toFixed(2) || '0.00'}
          </Paragraph>
          <Paragraph style={styles.tapHint}>Tap for full history</Paragraph>
        </View>
      </Card.Content>
    </Card>
  );

  const renderSummary = () => (
    <ScrollView contentContainerStyle={styles.summaryContainer}>
      {/* Date Filter */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <DateRangeFilter
            onDateChange={handleDateChange}
            selectedPreset="this_month"
          />
        </Card.Content>
      </Card>

      {/* Overall Summary */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={styles.summaryTitle}>Overall Summary</Title>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total Transactions</Paragraph>
              <Paragraph style={styles.summaryValue}>
                {summary?.overallTotals?.total_transactions || 0}
              </Paragraph>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total IN</Paragraph>
              <Paragraph style={[styles.summaryValue, { color: '#4CAF50' }]}>
                {summary?.overallTotals?.total_in_quantity || 0}
              </Paragraph>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total OUT</Paragraph>
              <Paragraph style={[styles.summaryValue, { color: '#F44336' }]}>
                {summary?.overallTotals?.total_out_quantity || 0}
              </Paragraph>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total Value</Paragraph>
              <Paragraph style={styles.summaryValue}>
                ₱{summary?.overallTotals?.total_value?.toFixed(2) || '0.00'}
              </Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Movement Type Summary */}
      <Card style={styles.reportCard}>
        <Card.Content>
          <Title style={styles.reportTitle}>By Movement Type</Title>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Type</DataTable.Title>
              <DataTable.Title>Reference</DataTable.Title>
              <DataTable.Title numeric>Count</DataTable.Title>
              <DataTable.Title numeric>Quantity</DataTable.Title>
              <DataTable.Title numeric>Value</DataTable.Title>
            </DataTable.Header>

            {summary?.movementTypeSummary?.map((item: any, index: number) => (
              <DataTable.Row key={index}>
                <DataTable.Cell>
                  <Chip
                    style={[styles.typeChip, { backgroundColor: getMovementTypeColor(item.movement_type) }]}
                    textStyle={{ color: 'white', fontSize: 9 }}
                    compact
                  >
                    {item.movement_type}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell>
                  <Chip
                    style={[styles.referenceChip, { backgroundColor: getReferenceTypeColor(item.reference_type) }]}
                    textStyle={{ color: 'white', fontSize: 8 }}
                    compact
                  >
                    {item.reference_type}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell numeric>{item.transaction_count}</DataTable.Cell>
                <DataTable.Cell numeric>{item.total_quantity}</DataTable.Cell>
                <DataTable.Cell numeric>₱{item.total_value?.toFixed(2)}</DataTable.Cell>
              </DataTable.Row>
            )) || []}
          </DataTable>
        </Card.Content>
      </Card>

      {/* Top Products */}
      <Card style={styles.reportCard}>
        <Card.Content>
          <Title style={styles.reportTitle}>Top Products by Activity</Title>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Product</DataTable.Title>
              <DataTable.Title numeric>Transactions</DataTable.Title>
              <DataTable.Title numeric>IN</DataTable.Title>
              <DataTable.Title numeric>OUT</DataTable.Title>
              <DataTable.Title numeric>Value</DataTable.Title>
            </DataTable.Header>

            {summary?.productSummary?.map((item: any, index: number) => (
              <DataTable.Row key={index}>
                <DataTable.Cell>
                  <View>
                    <Paragraph style={styles.productName}>{item.product_name}</Paragraph>
                    <Paragraph style={styles.productCode}>{item.product_code}</Paragraph>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell numeric>{item.transaction_count}</DataTable.Cell>
                <DataTable.Cell numeric>
                  <Paragraph style={{ color: '#4CAF50' }}>{item.total_in}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell numeric>
                  <Paragraph style={{ color: '#F44336' }}>{item.total_out}</Paragraph>
                </DataTable.Cell>
                <DataTable.Cell numeric>₱{item.total_value?.toFixed(2)}</DataTable.Cell>
              </DataTable.Row>
            )) || []}
          </DataTable>
        </Card.Content>
      </Card>
    </ScrollView>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'movements':
        return (
          <View style={styles.movementsContainer}>
            {/* Date Filter for Movements */}
            <View style={styles.movementsFilterContainer}>
              <DateRangeFilter
                onDateChange={handleDateChange}
                selectedPreset="this_month"
              />
            </View>
            <View style={styles.searchContainer}>
              <Searchbar
                placeholder="Search by product code/name..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
              />
              <IconButton
                icon="barcode-scan"
                mode="contained"
                size={24}
                onPress={() => {
                  navigation.navigate('BarcodeScanner', {
                    onScan: (barcode: string) => {
                      setSearchQuery(barcode);
                    }
                  });
                }}
                style={styles.scanButton}
              />
            </View>
            <FlatList
              data={filteredMovements}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMovement}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={loadData}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Paragraph style={styles.emptyText}>
                    No inventory movements found.
                  </Paragraph>
                </View>
              }
            />
          </View>
        );
      case 'summary':
        return renderSummary();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Title style={styles.headerTitle}>Inventory Movements</Title>
          <View style={styles.headerActions}>
            <Menu
              visible={printMenuVisible}
              onDismiss={() => setPrintMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => setPrintMenuVisible(true)}
                  disabled={printing || filteredMovements.length === 0}
                >
                  <Text style={styles.actionIconText}>🖨️</Text>
                </TouchableOpacity>
              }
            >
              <Menu.Item
                onPress={printToSystemPrinter}
                title="Print (USB/System)"
                leadingIcon="usb"
              />
              <Menu.Item
                onPress={printToBluetoothPrinter}
                title="Print (Bluetooth)"
                leadingIcon="bluetooth"
              />
            </Menu>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={exportToPDF}
              disabled={printing || filteredMovements.length === 0}
            >
              <Text style={styles.actionIconText}>📄</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={sendByEmail}
              disabled={printing || filteredMovements.length === 0}
            >
              <Text style={styles.actionIconText}>📧</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Button
            mode={activeTab === 'movements' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('movements')}
            style={styles.tabButton}
            compact
          >
            Movements
          </Button>
          <Button
            mode={activeTab === 'summary' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('summary')}
            style={styles.tabButton}
            compact
          >
            Summary
          </Button>
        </View>
      </View>

      {renderTabContent()}

      {/* Product History Dialog */}
      <Portal>
        <Dialog
          visible={historyDialogVisible}
          onDismiss={() => {
            setHistoryDialogVisible(false);
            setSelectedProduct(null);
            setProductHistory([]);
            setHistoryDatePreset('last_30_days');
          }}
          style={styles.historyDialog}
        >
          <Dialog.Title style={styles.historyTitle}>
            Product Movement History
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.historyScrollArea}>
            <ScrollView>
              {selectedProduct && (
                <View style={styles.historyProductInfo}>
                  <Title style={styles.historyProductName}>{selectedProduct.name}</Title>
                  <Paragraph style={styles.historyProductCode}>{selectedProduct.code}</Paragraph>
                </View>
              )}

              {/* Date Range Filter */}
              <View style={styles.historyDateFilter}>
                <Paragraph style={styles.historyFilterLabel}>Date Range:</Paragraph>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.historyDateChips}>
                    {[
                      { key: 'last_7_days', label: '7 Days' },
                      { key: 'last_30_days', label: '30 Days' },
                      { key: 'last_90_days', label: '90 Days' },
                      { key: 'this_year', label: 'This Year' },
                      { key: 'all_time', label: 'All Time' },
                    ].map((preset) => (
                      <Chip
                        key={preset.key}
                        selected={historyDatePreset === preset.key}
                        onPress={() => handleHistoryDatePresetChange(preset.key)}
                        style={[
                          styles.historyPresetChip,
                          historyDatePreset === preset.key && styles.historyPresetChipSelected
                        ]}
                        textStyle={{
                          fontSize: 11,
                          color: historyDatePreset === preset.key ? 'white' : '#333'
                        }}
                        compact
                      >
                        {preset.label}
                      </Chip>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <Divider style={{ marginBottom: 12 }} />

              <Paragraph style={styles.historyCount}>
                {productHistory.length} movement{productHistory.length !== 1 ? 's' : ''} found
              </Paragraph>

              {loadingHistory ? (
                <View style={styles.loadingContainer}>
                  <Paragraph>Loading history...</Paragraph>
                </View>
              ) : productHistory.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <Paragraph>No movement history found.</Paragraph>
                </View>
              ) : (
                productHistory.map((item, index) => (
                  <View key={item.id || index} style={styles.historyItem}>
                    <View style={styles.historyItemHeader}>
                      <View style={styles.historyItemDate}>
                        <Paragraph style={styles.historyDate}>
                          {new Date(item.created_at).toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Paragraph>
                      </View>
                      <View style={styles.historyChips}>
                        <Chip
                          style={[styles.historyTypeChip, { backgroundColor: getMovementTypeColor(item.movement_type) }]}
                          textStyle={{ color: 'white', fontSize: 9 }}
                          compact
                        >
                          {item.movement_type}
                        </Chip>
                      </View>
                    </View>

                    <View style={styles.historyQuantityRow}>
                      <View style={styles.historyQtyItem}>
                        <Paragraph style={styles.historyQtyLabel}>Before</Paragraph>
                        <Paragraph style={styles.historyQtyValue}>{item.quantity_before}</Paragraph>
                      </View>
                      <Paragraph style={styles.historyArrow}>→</Paragraph>
                      <View style={styles.historyQtyItem}>
                        <Paragraph style={styles.historyQtyLabel}>After</Paragraph>
                        <Paragraph style={styles.historyQtyValue}>{item.quantity_after}</Paragraph>
                      </View>
                      <View style={styles.historyQtyItem}>
                        <Paragraph style={styles.historyQtyLabel}>Change</Paragraph>
                        <Paragraph style={[
                          styles.historyChangeValue,
                          { color: item.movement_type === 'IN' ? '#4CAF50' : '#F44336' }
                        ]}>
                          {item.movement_type === 'IN' ? '+' : '-'}{item.quantity}
                        </Paragraph>
                      </View>
                    </View>

                    <Chip
                      style={[styles.historyRefChip, { backgroundColor: getReferenceTypeColor(item.reference_type) }]}
                      textStyle={{ color: 'white', fontSize: 8 }}
                      compact
                    >
                      {item.reference_type}
                    </Chip>

                    {item.reference_number && (
                      <Paragraph style={styles.historyRef}>Ref: {item.reference_number}</Paragraph>
                    )}

                    {item.notes && (
                      <Paragraph style={styles.historyNotes}>{item.notes}</Paragraph>
                    )}

                    {index < productHistory.length - 1 && <Divider style={{ marginTop: 12 }} />}
                  </View>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => {
              setHistoryDialogVisible(false);
              setSelectedProduct(null);
              setProductHistory([]);
              setHistoryDatePreset('last_30_days');
            }}>
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconText: {
    fontSize: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
  },
  movementsContainer: {
    flex: 1,
  },
  movementsFilterContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  searchBar: {
    flex: 1,
  },
  scanButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  movementCard: {
    marginBottom: 16,
    elevation: 4,
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  movementInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  productCode: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  movementDate: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 2,
  },
  createdBy: {
    fontSize: 12,
    opacity: 0.6,
  },
  movementStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  typeChip: {
    alignSelf: 'flex-end',
  },
  referenceChip: {
    alignSelf: 'flex-end',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  quantityBadge: {
    alignItems: 'center',
    flex: 1,
  },
  quantityLabel: {
    fontSize: 10,
    opacity: 0.7,
    marginBottom: 2,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  quantityArrow: {
    paddingHorizontal: 8,
  },
  arrowText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9E9E9E',
  },
  quantityChange: {
    alignItems: 'center',
    flex: 1,
  },
  changeLabel: {
    fontSize: 10,
    opacity: 0.7,
    marginBottom: 2,
  },
  changeValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  referenceNumber: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 4,
    opacity: 0.8,
  },
  notes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
    opacity: 0.7,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    textAlign: 'right',
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
  summaryContainer: {
    padding: 16,
    paddingTop: 8,
  },
  filterCard: {
    marginBottom: 16,
    elevation: 4,
  },
  summaryCard: {
    marginBottom: 16,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    minWidth: '45%',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
  },
  reportCard: {
    marginBottom: 16,
    elevation: 4,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapHint: {
    fontSize: 10,
    color: '#2196F3',
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  historyDialog: {
    maxHeight: '85%',
  },
  historyScrollArea: {
    maxHeight: 450,
    paddingHorizontal: 0,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyProductInfo: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 12,
  },
  historyProductName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  historyProductCode: {
    fontSize: 12,
    opacity: 0.7,
  },
  historyItem: {
    paddingVertical: 12,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyItemDate: {
    flex: 1,
  },
  historyDate: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  historyChips: {
    flexDirection: 'row',
    gap: 4,
  },
  historyTypeChip: {
    height: 22,
  },
  historyQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  historyQtyItem: {
    flex: 1,
    alignItems: 'center',
  },
  historyQtyLabel: {
    fontSize: 9,
    opacity: 0.7,
  },
  historyQtyValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  historyArrow: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9E9E9E',
    paddingHorizontal: 4,
  },
  historyChangeValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  historyRefChip: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    height: 20,
  },
  historyRef: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.8,
    marginTop: 4,
  },
  historyNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.7,
    marginTop: 4,
  },
  historyDateFilter: {
    marginBottom: 12,
  },
  historyFilterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    opacity: 0.7,
  },
  historyDateChips: {
    flexDirection: 'row',
    gap: 6,
  },
  historyPresetChip: {
    backgroundColor: '#E0E0E0',
    marginRight: 4,
  },
  historyPresetChipSelected: {
    backgroundColor: '#1976D2',
  },
  historyCount: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
    marginBottom: 8,
    textAlign: 'center',
  },
});