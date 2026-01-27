import React, { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, DefaultTheme, Title, Paragraph, Button } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Conditional imports to avoid SQLite issues on web
let DatabaseService: any = null;
let initializeSampleData: any = null;

if (Platform.OS !== 'web') {
  DatabaseService = require('./database/DatabaseService').DatabaseService;
  initializeSampleData = require('./utils/SampleData').initializeSampleData;
} else {
  // Use mock database service for web testing
  DatabaseService = require('./database/WebMockDatabaseService').WebMockDatabaseService;
}
import { AuthProvider } from './contexts/AuthContext';
import { DeviceBindingService } from './utils/DeviceBindingService';
import ActivationScreen from './screens/ActivationScreen';

// Import screens
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import SalesScreen from './screens/SalesScreen';
import ProductsScreen from './screens/ProductsScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';
import PurchaseScreen from './screens/PurchaseScreen';
import InitialInventoryScreen from './screens/InitialInventoryScreen';
import PhysicalInventoryScreen from './screens/PhysicalInventoryScreen';
import PhysicalCountReportScreen from './screens/PhysicalCountReportScreen';
import DatabaseViewerScreen from './screens/DatabaseViewerScreen';
import UserManagementScreen from './screens/UserManagementScreen';
import PermissionManagementScreen from './screens/PermissionManagementScreen';
import TestDataScreen from './screens/TestDataScreen';
import SupplierManagementScreen from './screens/SupplierManagementScreen';
import PurchaseOrderScreen from './screens/PurchaseOrderScreen';
import SupplierPaymentsScreen from './screens/SupplierPaymentsScreen';
import DamagedItemsScreen from './screens/DamagedItemsScreen';
import DamagedItemsHistoryScreen from './screens/DamagedItemsHistoryScreen';
import InventoryMovementsScreen from './screens/InventoryMovementsScreen';
import CustomerManagementScreen from './screens/CustomerManagementScreen';
import CustomerPaymentsScreen from './screens/CustomerPaymentsScreen';
import PrinterSettingsScreen from './screens/PrinterSettingsScreen';
import BarcodeScannerScreen from './screens/BarcodeScannerScreen';
import CategoriesScreen from './screens/CategoriesScreen';
import BrandsScreen from './screens/BrandsScreen';
import UnitsScreen from './screens/UnitsScreen';
import SizesScreen from './screens/SizesScreen';
import MasterDataScreen from './screens/MasterDataScreen';
import ReportsHubScreen from './screens/ReportsHubScreen';
import SalesReturnsScreen from './screens/SalesReturnsScreen';
import PurchaseReturnsScreen from './screens/PurchaseReturnsScreen';
import EndOfDayScreen from './screens/EndOfDayScreen';
import CashCountScreen from './screens/CashCountScreen';
import PurchaseReportScreen from './screens/PurchaseReportScreen';
import SalesReturnsReportScreen from './screens/SalesReturnsReportScreen';
import PurchaseReturnsReportScreen from './screens/PurchaseReturnsReportScreen';
import AccountsReceivableReportScreen from './screens/AccountsReceivableReportScreen';
import AccountsPayableReportScreen from './screens/AccountsPayableReportScreen';
import SalesReportScreen from './screens/SalesReportScreen';
import DeliveredItemsReportScreen from './screens/DeliveredItemsReportScreen';
import ResetDataScreen from './screens/ResetDataScreen';
import PDCTrackingScreen from './screens/PDCTrackingScreen';
import LicenseGeneratorScreen from './screens/LicenseGeneratorScreen';
import StockValuationReportScreen from './screens/StockValuationReportScreen';
import ZeroInventoryReportScreen from './screens/ZeroInventoryReportScreen';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Sales: undefined;
  Products: undefined;
  Reports: undefined;
  Settings: undefined;
  Purchase: undefined;
  InitialInventory: undefined;
  PhysicalInventory: undefined;
  PhysicalCountReport: undefined;
  DatabaseViewer: undefined;
  UserManagement: undefined;
  PermissionManagement: undefined;
  TestData: undefined;
  SupplierManagement: undefined;
  PurchaseOrder: undefined;
  SupplierPayments: undefined;
  DamagedItems: undefined;
  DamagedItemsHistory: undefined;
  InventoryMovements: undefined;
  CustomerManagement: undefined;
  CustomerPayments: undefined;
  PrinterSettings: undefined;
  BarcodeScanner: { onScan?: (barcode: string) => void } | undefined;
  Categories: undefined;
  Brands: undefined;
  Units: undefined;
  Sizes: undefined;
  MasterData: undefined;
  ReportsHub: undefined;
  SalesReturns: undefined;
  PurchaseReturns: undefined;
  EndOfDay: undefined;
  CashCount: undefined;
  PurchaseReport: undefined;
  SalesReturnsReport: undefined;
  PurchaseReturnsReport: undefined;
  AccountsReceivableReport: undefined;
  AccountsPayableReport: undefined;
  SalesReport: undefined;
  DeliveredItemsReport: undefined;
  ResetData: undefined;
  PDCTracking: undefined;
  LicenseGenerator: undefined;
  StockValuationReport: undefined;
  ZeroInventoryReport: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

// Custom theme with proper contrast for mobile POS
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2196F3',
    accent: '#FF9800',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#212121',
    onSurface: '#757575',
    placeholder: '#9E9E9E',
    disabled: '#BDBDBD',
  },
};

export default function App() {
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isDeviceActivated, setIsDeviceActivated] = useState(false);
  const [isCheckingActivation, setIsCheckingActivation] = useState(true);

  useEffect(() => {
    console.log('App component mounted, Platform:', Platform.OS);
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Starting app initialization...');

      // Check if running on web platform - use mock database
      if (Platform.OS === 'web') {
        console.warn('Web platform detected - Using mock database for testing');
        if (DatabaseService) {
          const dbService = DatabaseService.getInstance();
          await dbService.initialize();
          console.log('[Web] Mock database initialized successfully');
        }
        setIsDbInitialized(true);
        setIsDeviceActivated(true); // Web doesn't require activation
        setIsCheckingActivation(false);
        return;
      }

      // Check if DatabaseService is available
      if (!DatabaseService) {
        setInitializationError('Database service not available');
        setIsDbInitialized(true);
        setIsCheckingActivation(false);
        return;
      }

      // Add a small delay to help with debugging
      await new Promise(resolve => setTimeout(resolve, 100));

      const dbService = DatabaseService.getInstance();
      console.log('DatabaseService instance created');

      await dbService.initialize();
      console.log('Database initialized successfully');

      // Initialize DeviceBindingService with database
      const db = dbService.getDatabase();
      DeviceBindingService.initialize(db);
      console.log('DeviceBindingService initialized');

      // Check device activation status
      console.log('Checking device activation...');
      const verificationResult = await DeviceBindingService.verifyDevice();
      console.log('Device verification result:', verificationResult);

      if (verificationResult.isValid) {
        setIsDeviceActivated(true);
        console.log('Device is activated');
      } else {
        setIsDeviceActivated(false);
        console.log('Device not activated:', verificationResult.message);
      }
      setIsCheckingActivation(false);

      // Only initialize sample data if no products exist
      const existingProducts = await dbService.getProducts();
      console.log('Existing products found:', existingProducts.length);

      if (existingProducts.length === 0) {
        console.log('No products found, initializing sample data...');
        await initializeSampleData();
        console.log('Sample data initialized successfully');
      } else {
        console.log('Products already exist, skipping sample data initialization');
      }

      console.log('App initialization completed, setting state...');
      setIsDbInitialized(true);
      console.log('State updated - isDbInitialized set to true');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      console.error('Error details:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('wa-sqlite') || errorMessage.includes('wasm')) {
        setInitializationError('Database initialization failed: This app requires a mobile device or emulator to run properly. Web browsers are not fully supported due to SQLite limitations.');
      } else {
        setInitializationError(`Database initialization failed: ${errorMessage}`);
      }

      // Still set as initialized to show the error screen
      setIsDbInitialized(true);
      setIsCheckingActivation(false);
    }
  };

  const handleActivationSuccess = async () => {
    setIsDeviceActivated(true);
  };

  if (!isDbInitialized || isCheckingActivation) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
            <Title>Loading...</Title>
            <Paragraph>{isCheckingActivation ? 'Verifying device...' : 'Initializing database...'}</Paragraph>
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  // Show activation screen if device is not activated
  if (!isDeviceActivated && Platform.OS !== 'web') {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <ActivationScreen onActivationSuccess={handleActivationSuccess} />
          <StatusBar style="dark" />
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  // Show error screen if initialization failed
  if (initializationError) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: theme.colors.background }}>
            <Title style={{ textAlign: 'center', marginBottom: 16, color: theme.colors.error }}>
              Initialization Error
            </Title>
            <Paragraph style={{ textAlign: 'center', marginBottom: 20 }}>
              {initializationError}
            </Paragraph>
            <Paragraph style={{ textAlign: 'center', marginBottom: 20, fontStyle: 'italic' }}>
              For the best experience, please run this app on:
              • Android emulator or device
              • iOS simulator or device
              • Expo Go app
            </Paragraph>
            <Button
              mode="contained"
              onPress={() => {
                setInitializationError(null);
                setIsDbInitialized(false);
                initializeApp();
              }}
            >
              Try Again
            </Button>
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NavigationContainer>
            <Stack.Navigator
              id={undefined}
              initialRouteName="Login"
              screenOptions={{
                headerStyle: {
                  backgroundColor: theme.colors.primary,
                },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ title: 'IgoroTech POS Dashboard' }}
            />
            <Stack.Screen
              name="Sales"
              component={SalesScreen}
              options={{ title: 'Sales Terminal' }}
            />
            <Stack.Screen
              name="Products"
              component={ProductsScreen}
              options={{ title: 'Product Management' }}
            />
            <Stack.Screen
              name="Reports"
              component={ReportsScreen}
              options={{ title: 'Sales Reports' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            <Stack.Screen
              name="Purchase"
              component={PurchaseScreen}
              options={{ title: 'Purchase Orders' }}
            />
            <Stack.Screen
              name="InitialInventory"
              component={InitialInventoryScreen}
              options={{ title: 'Initial Inventory Setup' }}
            />
            <Stack.Screen
              name="PhysicalInventory"
              component={PhysicalInventoryScreen}
              options={{ title: 'Physical Inventory Count' }}
            />
            <Stack.Screen
              name="PhysicalCountReport"
              component={PhysicalCountReportScreen}
              options={{ title: 'Physical Count Reports' }}
            />
            <Stack.Screen
              name="DatabaseViewer"
              component={DatabaseViewerScreen}
              options={{ title: 'Database Viewer' }}
            />
            <Stack.Screen
              name="UserManagement"
              component={UserManagementScreen}
              options={{ title: 'User Management' }}
            />
            <Stack.Screen
              name="PermissionManagement"
              component={PermissionManagementScreen}
              options={{ title: 'Permission Management' }}
            />
            <Stack.Screen
              name="TestData"
              component={TestDataScreen}
              options={{ title: 'Test Data Generator' }}
            />
            <Stack.Screen
              name="SupplierManagement"
              component={SupplierManagementScreen}
              options={{ title: 'Supplier Management' }}
            />
            <Stack.Screen
              name="PurchaseOrder"
              component={PurchaseOrderScreen}
              options={{ title: 'Purchase Orders' }}
            />
            <Stack.Screen
              name="SupplierPayments"
              component={SupplierPaymentsScreen}
              options={{ title: 'Supplier Payments' }}
            />
            <Stack.Screen
              name="PDCTracking"
              component={PDCTrackingScreen}
              options={{ title: 'PDC Tracking' }}
            />
            <Stack.Screen
              name="DamagedItems"
              component={DamagedItemsScreen}
              options={{ title: 'Damaged Items' }}
            />
            <Stack.Screen
              name="DamagedItemsHistory"
              component={DamagedItemsHistoryScreen}
              options={{ title: 'Damage History & Reports' }}
            />
            <Stack.Screen
              name="InventoryMovements"
              component={InventoryMovementsScreen}
              options={{ title: 'Inventory Movements' }}
            />
            <Stack.Screen
              name="CustomerManagement"
              component={CustomerManagementScreen}
              options={{ title: 'Customer Management' }}
            />
            <Stack.Screen
              name="CustomerPayments"
              component={CustomerPaymentsScreen}
              options={{ title: 'Customer Payments' }}
            />
            <Stack.Screen
              name="PrinterSettings"
              component={PrinterSettingsScreen}
              options={{ title: 'Printer Settings' }}
            />
            <Stack.Screen
              name="BarcodeScanner"
              component={BarcodeScannerScreen}
              options={{ title: 'Scan Barcode' }}
            />
            <Stack.Screen
              name="Categories"
              component={CategoriesScreen}
              options={{ title: 'Product Categories' }}
            />
            <Stack.Screen
              name="Brands"
              component={BrandsScreen}
              options={{ title: 'Product Brands' }}
            />
            <Stack.Screen
              name="Units"
              component={UnitsScreen}
              options={{ title: 'Units of Measure' }}
            />
            <Stack.Screen
              name="Sizes"
              component={SizesScreen}
              options={{ title: 'Product Sizes' }}
            />
            <Stack.Screen
              name="MasterData"
              component={MasterDataScreen}
              options={{ title: 'Master Data' }}
            />
            <Stack.Screen
              name="ReportsHub"
              component={ReportsHubScreen}
              options={{ title: 'Reports Hub' }}
            />
            <Stack.Screen
              name="SalesReturns"
              component={SalesReturnsScreen}
              options={{ title: 'Sales Returns' }}
            />
            <Stack.Screen
              name="PurchaseReturns"
              component={PurchaseReturnsScreen}
              options={{ title: 'Purchase Returns' }}
            />
            <Stack.Screen
              name="EndOfDay"
              component={EndOfDayScreen}
              options={{ title: 'End of Day' }}
            />
            <Stack.Screen
              name="CashCount"
              component={CashCountScreen}
              options={{ title: 'Cash Count', headerShown: false }}
            />
            <Stack.Screen
              name="PurchaseReport"
              component={PurchaseReportScreen}
              options={{ title: 'Purchase Report' }}
            />
            <Stack.Screen
              name="SalesReturnsReport"
              component={SalesReturnsReportScreen}
              options={{ title: 'Sales Returns Report' }}
            />
            <Stack.Screen
              name="PurchaseReturnsReport"
              component={PurchaseReturnsReportScreen}
              options={{ title: 'Purchase Returns Report' }}
            />
            <Stack.Screen
              name="AccountsReceivableReport"
              component={AccountsReceivableReportScreen}
              options={{ title: 'Accounts Receivable' }}
            />
            <Stack.Screen
              name="AccountsPayableReport"
              component={AccountsPayableReportScreen}
              options={{ title: 'Accounts Payable' }}
            />
            <Stack.Screen
              name="SalesReport"
              component={SalesReportScreen}
              options={{ title: 'Sales Report' }}
            />
            <Stack.Screen
              name="DeliveredItemsReport"
              component={DeliveredItemsReportScreen}
              options={{ title: 'Delivered Items Report' }}
            />
            <Stack.Screen
              name="ResetData"
              component={ResetDataScreen}
              options={{ title: 'Reset Transactional Data' }}
            />
            <Stack.Screen
              name="LicenseGenerator"
              component={LicenseGeneratorScreen}
              options={{ title: 'License Key Generator' }}
            />
            <Stack.Screen
              name="StockValuationReport"
              component={StockValuationReportScreen}
              options={{ title: 'Stock Valuation Report' }}
            />
            <Stack.Screen
              name="ZeroInventoryReport"
              component={ZeroInventoryReportScreen}
              options={{ title: 'Zero Inventory Report' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
