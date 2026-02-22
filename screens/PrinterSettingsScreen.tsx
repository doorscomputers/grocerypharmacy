import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  List,
  Switch,
  RadioButton,
  Divider,
  useTheme,
  ActivityIndicator,
  Chip,
  IconButton,
  Text,
} from 'react-native-paper';

import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import BluetoothPrinterService, {
  PrinterDevice,
  PrinterState,
  PrinterSettings,
} from '../utils/BluetoothPrinterService';
import { PRINTER_WIDTH } from '../utils/escpos';
import { useResponsiveTheme } from '../utils/responsive';

type PrinterSettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PrinterSettings'
>;

type Props = {
  navigation: PrinterSettingsScreenNavigationProp;
};

export default function PrinterSettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const [printerState, setPrinterState] = useState<PrinterState>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [discoveredDevices, setDiscoveredDevices] = useState<PrinterDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<PrinterDevice | null>(null);
  const [settings, setSettings] = useState<PrinterSettings>({
    printerWidth: PRINTER_WIDTH.MM_58,
    autoConnect: false,
    autoCut: true,
    lastPrinterId: null,
    lastPrinterName: null,
  });
  const [isScanning, setIsScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const printerService = BluetoothPrinterService.getInstance();

  // Load settings and state on mount
  useEffect(() => {
    loadPrinterState();

    // Listen for state changes
    const unsubscribe = printerService.addStateListener((state, message) => {
      setPrinterState(state);
      setStatusMessage(message || '');

      if (state === 'connected') {
        setConnectedDevice(printerService.getConnectedDevice());
      } else if (state === 'disconnected') {
        setConnectedDevice(null);
      }
    });

    // Listen for device discovery
    const unsubscribeDevices = printerService.addDeviceFoundListener((device) => {
      setDiscoveredDevices((prev) => {
        const exists = prev.some((d) => d.id === device.id);
        if (exists) return prev;
        return [...prev, device];
      });
    });

    return () => {
      unsubscribe();
      unsubscribeDevices();
    };
  }, []);

  // Reload when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadPrinterState();
    }, [])
  );

  const loadPrinterState = () => {
    const currentSettings = printerService.getSettings();
    setSettings(currentSettings);

    // Use isConnected() to get accurate state - it verifies actual connection
    const isActuallyConnected = printerService.isConnected();
    const device = printerService.getConnectedDevice();

    // Set state based on actual connection status
    setPrinterState(isActuallyConnected ? 'connected' : 'disconnected');
    setConnectedDevice(isActuallyConnected ? device : null);
    setDiscoveredDevices(printerService.getDiscoveredDevices());
  };

  const handleScanForPrinters = async () => {
    try {
      setIsScanning(true);
      setDiscoveredDevices([]);
      setStatusMessage('Scanning for printers...');

      const devices = await printerService.startScan(15000); // 15 seconds scan

      if (devices.length === 0) {
        Alert.alert(
          'No Printers Found',
          'Make sure your printer is turned on and in pairing mode. The printer should be paired in your device\'s Bluetooth settings first.'
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Scan Failed', errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectDevice = async (device: PrinterDevice) => {
    try {
      setStatusMessage(`Connecting to ${device.name}...`);
      await printerService.connect(device.id);
      Alert.alert('Connected', `Successfully connected to ${device.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Connection Failed', errorMessage);
    }
  };

  const handleDisconnect = async () => {
    try {
      await printerService.disconnect();
      setConnectedDevice(null);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const handleTestPrint = async () => {
    if (!printerService.isConnected()) {
      Alert.alert('Not Connected', 'Please connect to a printer first.');
      return;
    }

    try {
      setIsPrinting(true);
      setStatusMessage('Printing test page...');
      await printerService.printTestPage();
      Alert.alert('Success', 'Test page printed successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Print Failed', errorMessage);
    } finally {
      setIsPrinting(false);
      setStatusMessage('');
    }
  };

  const handlePrinterWidthChange = async (width: number) => {
    await printerService.updateSettings({ printerWidth: width });
    setSettings((prev) => ({ ...prev, printerWidth: width }));
  };

  const handleAutoConnectChange = async (value: boolean) => {
    await printerService.updateSettings({ autoConnect: value });
    setSettings((prev) => ({ ...prev, autoConnect: value }));
  };

  const handleAutoCutChange = async (value: boolean) => {
    await printerService.updateSettings({ autoCut: value });
    setSettings((prev) => ({ ...prev, autoCut: value }));
  };

  const getStateColor = (state: PrinterState): string => {
    switch (state) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
      case 'scanning':
        return '#FF9800';
      case 'error':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStateLabel = (state: PrinterState): string => {
    switch (state) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'scanning':
        return 'Scanning...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  const renderDeviceItem = ({ item }: { item: PrinterDevice }) => {
    const isConnected = connectedDevice?.id === item.id;

    return (
      <List.Item
        title={item.name || 'Unknown Device'}
        description={`Signal: ${item.rssi ? `${item.rssi} dBm` : 'N/A'}`}
        left={(props) => (
          <List.Icon
            {...props}
            icon={isConnected ? 'printer-check' : 'printer'}
            color={isConnected ? '#4CAF50' : theme.colors.primary}
          />
        )}
        right={() => (
          isConnected ? (
            <Button
              mode="outlined"
              onPress={handleDisconnect}
              compact
              style={styles.deviceButton}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={() => handleConnectDevice(item)}
              compact
              disabled={printerState === 'connecting'}
              style={styles.deviceButton}
            >
              Connect
            </Button>
          )
        )}
        style={[
          styles.deviceItem,
          isConnected && styles.deviceItemConnected,
        ]}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
      >
      {/* Status Card */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.statusHeader}>
            <Title>Printer Status</Title>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStateColor(printerState) }]}
              textStyle={styles.statusChipText}
            >
              {getStateLabel(printerState)}
            </Chip>
          </View>

          {connectedDevice && (
            <View style={styles.connectedInfo}>
              <Paragraph style={styles.connectedLabel}>Connected to:</Paragraph>
              <Text style={styles.connectedName}>{connectedDevice.name}</Text>
            </View>
          )}

          {statusMessage && (
            <Paragraph style={styles.statusMessage}>{statusMessage}</Paragraph>
          )}

          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={handleTestPrint}
              disabled={!printerService.isConnected() || isPrinting}
              loading={isPrinting}
              style={styles.actionButton}
              icon="printer"
            >
              Test Print
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Scan for Printers */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <Title>Available Printers</Title>
            <Button
              mode="outlined"
              onPress={handleScanForPrinters}
              loading={isScanning}
              disabled={isScanning}
              icon="magnify"
              compact
            >
              {isScanning ? 'Scanning...' : 'Scan'}
            </Button>
          </View>

          {isScanning && (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Paragraph style={styles.scanningText}>
                Searching for Bluetooth printers...
              </Paragraph>
            </View>
          )}

          {discoveredDevices.length > 0 ? (
            <FlatList
              data={discoveredDevices}
              keyExtractor={(item) => item.id}
              renderItem={renderDeviceItem}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <Divider />}
              style={styles.deviceList}
            />
          ) : !isScanning ? (
            <View style={styles.emptyState}>
              <Paragraph style={styles.emptyText}>
                No Bluetooth devices found.
              </Paragraph>
              <Paragraph style={styles.hintText}>
                Note: This app uses Bluetooth Low Energy (BLE). Some printers use Classic Bluetooth which may not appear here.
              </Paragraph>
              <Paragraph style={styles.hintText}>
                Tips: Turn printer off and on, ensure it's in pairing mode, and try scanning again.
              </Paragraph>
            </View>
          ) : null}
        </Card.Content>
      </Card>

      {/* Printer Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Printer Settings</Title>

          {/* Printer Width */}
          <View style={styles.settingItem}>
            <Paragraph style={styles.settingLabel}>Paper Width</Paragraph>
            <RadioButton.Group
              onValueChange={(value) => handlePrinterWidthChange(parseInt(value, 10))}
              value={settings.printerWidth.toString()}
            >
              <View style={styles.radioRow}>
                <View style={styles.radioOption}>
                  <RadioButton.Android value={PRINTER_WIDTH.MM_58.toString()} />
                  <Paragraph>58mm (32 chars)</Paragraph>
                </View>
                <View style={styles.radioOption}>
                  <RadioButton.Android value={PRINTER_WIDTH.MM_80.toString()} />
                  <Paragraph>80mm (48 chars)</Paragraph>
                </View>
              </View>
            </RadioButton.Group>
          </View>

          <Divider style={styles.divider} />

          {/* Auto Connect */}
          <View style={styles.switchItem}>
            <View style={styles.switchLabel}>
              <Paragraph style={styles.settingLabel}>Auto Connect</Paragraph>
              <Paragraph style={styles.settingDescription}>
                Automatically connect to last used printer on app start
              </Paragraph>
            </View>
            <Switch
              value={settings.autoConnect}
              onValueChange={handleAutoConnectChange}
              color={theme.colors.primary}
            />
          </View>

          <Divider style={styles.divider} />

          {/* Auto Cut */}
          <View style={styles.switchItem}>
            <View style={styles.switchLabel}>
              <Paragraph style={styles.settingLabel}>Auto Cut Paper</Paragraph>
              <Paragraph style={styles.settingDescription}>
                Automatically cut paper after printing receipt
              </Paragraph>
            </View>
            <Switch
              value={settings.autoCut}
              onValueChange={handleAutoCutChange}
              color={theme.colors.primary}
            />
          </View>
        </Card.Content>
      </Card>

      {/* Last Connected Printer */}
      {settings.lastPrinterName && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Last Connected</Title>
            <List.Item
              title={settings.lastPrinterName}
              description="Previously connected printer"
              left={(props) => <List.Icon {...props} icon="history" />}
              right={() => (
                settings.lastPrinterId && !connectedDevice ? (
                  <Button
                    mode="outlined"
                    onPress={() => settings.lastPrinterId && handleConnectDevice({
                      id: settings.lastPrinterId,
                      name: settings.lastPrinterName,
                      rssi: null,
                      isConnectable: true,
                    })}
                    compact
                    disabled={printerState === 'connecting'}
                  >
                    Reconnect
                  </Button>
                ) : null
              )}
            />
          </Card.Content>
        </Card>
      )}

      {/* Help Section */}
      <Card style={[styles.card, styles.helpCard]}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Troubleshooting</Title>
          <Paragraph style={styles.helpText}>
            1. Turn on your Bluetooth printer and put it in pairing mode
          </Paragraph>
          <Paragraph style={styles.helpText}>
            2. Make sure Bluetooth is enabled on your device
          </Paragraph>
          <Paragraph style={styles.helpText}>
            3. Tap "Scan" to search for nearby devices
          </Paragraph>
          <Paragraph style={styles.helpText}>
            4. Select your printer from the list to connect
          </Paragraph>
          <Paragraph style={styles.helpText}>
            5. If printer doesn't appear, it may use Classic Bluetooth (not BLE)
          </Paragraph>
          <Paragraph style={[styles.helpText, { fontStyle: 'italic', marginTop: 8 }]}>
            Note: This app requires BLE-compatible thermal printers (most modern 58mm/80mm receipt printers support BLE).
          </Paragraph>
        </Card.Content>
      </Card>
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
    paddingBottom: 32,
    flexGrow: 1,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    minHeight: 28,
    paddingHorizontal: 12,
  },
  statusChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  connectedInfo: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  connectedLabel: {
    fontSize: 12,
    color: '#666',
  },
  connectedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  statusMessage: {
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  scanningText: {
    marginLeft: 12,
    color: '#666',
  },
  deviceList: {
    maxHeight: 250,
  },
  deviceItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginVertical: 4,
  },
  deviceItemConnected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  deviceButton: {
    marginRight: 8,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 8,
  },
  hintText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    marginVertical: 12,
  },
  switchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  helpCard: {
    backgroundColor: '#FFF8E1',
  },
  helpText: {
    fontSize: 14,
    marginBottom: 8,
    color: '#5D4037',
  },
});
