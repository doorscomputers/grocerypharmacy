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
}
import { AuthProvider } from './contexts/AuthContext';

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

  useEffect(() => {
    console.log('App component mounted, Platform:', Platform.OS);
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Starting app initialization...');

      // Check if running on web platform
      if (Platform.OS === 'web' || !DatabaseService) {
        console.warn('Web platform detected - SQLite functionality may be limited');
        setInitializationError('Web platform detected: This app is designed for mobile devices. Some features may not work properly in web browsers due to SQLite limitations.');
        setIsDbInitialized(true);
        return;
      }

      // Add a small delay to help with debugging
      await new Promise(resolve => setTimeout(resolve, 100));

      const dbService = DatabaseService.getInstance();
      console.log('DatabaseService instance created');

      await dbService.initialize();
      console.log('Database initialized successfully');

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
    }
  };

  if (!isDbInitialized) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
            <Title>Loading...</Title>
            <Paragraph>Initializing database...</Paragraph>
          </View>
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
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
