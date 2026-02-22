import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  DataTable,
  List,
  TextInput,
  Divider,
  Chip,
  SegmentedButtons,
  Portal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseBackupService, BackupInfo } from '../utils/DatabaseBackupService';
import { useResponsiveTheme } from '../utils/responsive';
import * as ExpoFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const WEB_STORAGE_KEY = 'posmobile_webmock_db';
const CLEAR_CONFIRMATION_TEXT = 'CLEAR';

type DatabaseViewerScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'DatabaseViewer'
>;

type Props = {
  navigation: DatabaseViewerScreenNavigationProp;
};

export default function DatabaseViewerScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState('management');

  // Viewer tab state
  const [currentTable, setCurrentTable] = useState('inventory_movements');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [tableCounts, setTableCounts] = useState<{[key: string]: number}>({});

  // Secure Clear Data dialog state
  const [clearDialogVisible, setClearDialogVisible] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearAdminPassword, setClearAdminPassword] = useState('');
  const [clearPasswordError, setClearPasswordError] = useState('');
  const [clearing, setClearing] = useState(false);

  // Health tab state
  const [dbHealth, setDbHealth] = useState<{
    isHealthy: boolean;
    walMode: boolean;
    synchronousMode: string;
    integrityOk: boolean;
    estimatedSizeKB: number;
    issues: string[];
  } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [fixingIssues, setFixingIssues] = useState(false);
  const [diskSpace, setDiskSpace] = useState<{ free: number; total: number } | null>(null);

  // Management tab state
  const [backupList, setBackupList] = useState<BackupInfo[]>([]);
  const [showBackupList, setShowBackupList] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupCount, setBackupCount] = useState(0);
  const [clearInventoryPasswordVisible, setClearInventoryPasswordVisible] = useState(false);
  const [clearInventoryPassword, setClearInventoryPassword] = useState('');
  const [restorePasswordVisible, setRestorePasswordVisible] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [pendingRestoreBackup, setPendingRestoreBackup] = useState<BackupInfo | null>(null);

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const { user } = useAuth();

  const tables = [
    { name: 'inventory_movements', label: 'Item Ledger', description: 'All item movements' },
    { name: 'transactions', label: 'Sales', description: 'Sales transactions' },
    { name: 'transaction_items', label: 'Sale Items', description: 'Individual sale items' },
    { name: 'physical_count_sessions', label: 'Physical Counts', description: 'Count sessions' },
    { name: 'physical_count_details', label: 'Count Details', description: 'Individual counts' },
    { name: 'products', label: 'Products', description: 'Product catalog' },
    { name: 'users', label: 'Users', description: 'System users' },
    { name: 'ejournal', label: 'eJournal', description: 'Audit trail' },
  ];

  useEffect(() => {
    loadTableCounts();
    loadTableData(currentTable);
  }, [currentTable]);

  useEffect(() => {
    if (activeTab === 'health') {
      checkDatabaseHealth();
      checkDiskSpace();
    }
    if (activeTab === 'management') {
      loadBackupCount();
    }
  }, [activeTab]);

  // ==================== VIEWER TAB FUNCTIONS ====================

  const loadTableCounts = async () => {
    try {
      const dbService = getDatabase();
      const db = dbService.getDatabase();
      const counts: {[key: string]: number} = {};

      for (const table of tables) {
        try {
          const result = await db.getFirstAsync<{count: number}>(
            `SELECT COUNT(*) as count FROM ${table.name}`
          );
          counts[table.name] = result?.count || 0;
        } catch (error) {
          console.log(`Table ${table.name} might not exist yet`);
          counts[table.name] = 0;
        }
      }

      setTableCounts(counts);
    } catch (error) {
      console.error('Error loading table counts:', error);
    }
  };

  const loadTableData = async (tableName: string) => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      const db = dbService.getDatabase();

      const result = await db.getAllAsync(
        `SELECT * FROM ${tableName} ORDER BY
         CASE
           WHEN EXISTS(SELECT * FROM pragma_table_info('${tableName}') WHERE name = 'created_at') THEN created_at
           WHEN EXISTS(SELECT * FROM pragma_table_info('${tableName}') WHERE name = 'id') THEN id
           ELSE rowid
         END DESC LIMIT 50`
      );

      setData(result);
    } catch (error) {
      console.error('Error loading table data:', error);
      Alert.alert('Error', `Failed to load data from ${tableName}`);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const executeCustomQuery = async () => {
    if (!customQuery.trim()) return;

    setLoading(true);
    try {
      const dbService = getDatabase();
      const db = dbService.getDatabase();

      const result = await db.getAllAsync(customQuery);
      setData(result);
      setCurrentTable('custom_query');
    } catch (error) {
      console.error('Error executing query:', error);
      Alert.alert('Query Error', `Failed to execute query: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Secure Clear Data
  const openClearDialog = () => {
    setClearConfirmText('');
    setClearAdminPassword('');
    setClearPasswordError('');
    setClearDialogVisible(true);
  };

  const performClear = async () => {
    if (clearConfirmText !== CLEAR_CONFIRMATION_TEXT) return;
    if (!clearAdminPassword.trim()) {
      setClearPasswordError('Password is required');
      return;
    }

    setClearing(true);
    setClearPasswordError('');
    try {
      const dbService = getDatabase();

      // Verify admin password
      const isValid = await dbService.verifyAdminPassword(clearAdminPassword);
      if (!isValid) {
        setClearPasswordError('Incorrect admin password');
        setClearing(false);
        return;
      }

      const db = dbService.getDatabase();

      // Clear data in correct order (respecting foreign keys)
      const clearQueries = [
        'DELETE FROM transaction_items',
        'DELETE FROM transactions',
        'DELETE FROM physical_count_details',
        'DELETE FROM physical_count_sessions',
        'DELETE FROM inventory_movements',
        'DELETE FROM ejournal',
        'DELETE FROM z_readings',
        'DELETE FROM x_readings',
        "UPDATE settings SET value = '1' WHERE key = 'current_invoice_number'",
        "UPDATE settings SET value = '0' WHERE key = 'z_counter'"
      ];

      for (const query of clearQueries) {
        await db.runAsync(query);
      }

      setClearDialogVisible(false);
      Alert.alert('Success', 'All transactional data has been cleared');
      loadTableCounts();
      loadTableData(currentTable);
    } catch (error) {
      console.error('Error clearing data:', error);
      Alert.alert('Error', 'Failed to clear data');
    } finally {
      setClearing(false);
    }
  };

  // ==================== HEALTH TAB FUNCTIONS ====================

  const checkDatabaseHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const dbService = getDatabase();
      const health = await dbService.checkDatabaseHealth();
      const dbInfo = await dbService.getDatabaseInfo();
      setDbHealth({
        isHealthy: health.isHealthy,
        walMode: health.walMode,
        synchronousMode: health.synchronousMode,
        integrityOk: health.integrityOk,
        estimatedSizeKB: dbInfo.estimatedSizeKB,
        issues: health.issues,
      });
    } catch (error) {
      console.error('Error checking database health:', error);
      setDbHealth({
        isHealthy: false,
        walMode: false,
        synchronousMode: 'UNKNOWN',
        integrityOk: false,
        estimatedSizeKB: 0,
        issues: [`Health check failed: ${error}`],
      });
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  const checkDiskSpace = async () => {
    try {
      const isWebPlatform = Platform.OS === 'web';
      if (isWebPlatform) {
        setDiskSpace(null);
      } else if (ExpoFileSystem.getFreeDiskStorageAsync) {
        const free = await ExpoFileSystem.getFreeDiskStorageAsync();
        const total = await ExpoFileSystem.getTotalDiskCapacityAsync();
        setDiskSpace({
          free: Math.round(free / (1024 * 1024)),
          total: Math.round(total / (1024 * 1024)),
        });
      }
    } catch (error) {
      console.error('Error checking disk space:', error);
      setDiskSpace(null);
    }
  };

  const handleCheckpointWAL = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const result = await dbService.checkpointWAL();
      if (result.success) {
        Alert.alert('Success', `WAL checkpoint completed. ${result.pagesCheckpointed} pages written to database.`);
      } else {
        Alert.alert('Warning', 'WAL checkpoint could not be completed.');
      }
    } catch (error) {
      Alert.alert('Error', `Checkpoint failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFixIssues = async () => {
    try {
      setFixingIssues(true);
      const dbService = getDatabase();
      const result = await dbService.fixDatabaseIssues();

      if (result.success) {
        Alert.alert(
          'Issues Fixed',
          result.fixesApplied.length > 0
            ? `The following fixes were applied:\n\n${result.fixesApplied.map(f => '• ' + f).join('\n')}\n\nYour database is now properly configured.`
            : 'No issues found that needed fixing.',
          [{ text: 'OK' }]
        );
        await checkDatabaseHealth();
      } else {
        Alert.alert(
          'Fix Incomplete',
          result.message,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', `Failed to fix issues: ${error}`);
    } finally {
      setFixingIssues(false);
    }
  };

  // ==================== MANAGEMENT TAB FUNCTIONS ====================

  const loadBackupCount = async () => {
    try {
      const backupService = DatabaseBackupService.getInstance();
      const backups = await backupService.listBackups();
      setBackupCount(backups.length);
    } catch (error) {
      console.error('Error loading backup count:', error);
    }
  };

  const handleBackup = async () => {
    Alert.alert(
      'Create Backup',
      'Backup will be saved on this device. You can share a copy to Google Drive or email afterward.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Backup Now',
          onPress: async () => {
            try {
              setLoading(true);

              const backupService = DatabaseBackupService.getInstance();
              const backupPath = await backupService.createBackup();

              // Refresh backup count
              await loadBackupCount();

              const isWebPlatform = Platform.OS === 'web';
              if (isWebPlatform) {
                Alert.alert('Success', 'Backup downloaded successfully!');
              } else {
                Alert.alert(
                  'Backup Created',
                  'Your backup has been saved on this device.',
                  [
                    { text: 'OK' },
                    {
                      text: 'Share Copy',
                      onPress: () => backupService.shareBackup(backupPath),
                    },
                  ]
                );
              }
            } catch (error) {
              console.error('Backup failed:', error);
              Alert.alert('Error', `Backup failed: ${error}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const loadBackupList = async () => {
    const isWebPlatform = Platform.OS === 'web';
    if (isWebPlatform) {
      Alert.alert('Info', 'Backup history is not available on web. Backups are downloaded directly to your device.');
      return;
    }

    setLoadingBackups(true);
    try {
      const backupService = DatabaseBackupService.getInstance();
      const backups = await backupService.listBackups();
      setBackupList(backups);
      setBackupCount(backups.length);
      setShowBackupList(true);
    } catch (error) {
      console.error('Error loading backups:', error);
      Alert.alert('Error', 'Failed to load backup list');
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleRestoreFromBackup = async (backup: BackupInfo) => {
    Alert.alert(
      'Restore Backup',
      `Restore from backup created on ${backup.timestamp.toLocaleString()}?\n\nThis will REPLACE all current data. This action cannot be undone!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            setPendingRestoreBackup(backup);
            setRestorePassword('');
            setRestorePasswordVisible(true);
          }
        }
      ]
    );
  };

  const handleRestorePasswordSubmit = async () => {
    if (!restorePassword.trim()) {
      Alert.alert('Error', 'Please enter your admin password');
      return;
    }

    try {
      setLoading(true);
      const dbService = getDatabase();
      const isValid = await dbService.verifyAdminPassword(restorePassword);

      if (!isValid) {
        Alert.alert('Access Denied', 'Incorrect admin password');
        setRestorePassword('');
        setLoading(false);
        return;
      }

      setRestorePasswordVisible(false);
      setRestorePassword('');
      setShowBackupList(false);

      if (!pendingRestoreBackup) return;

      const backupService = DatabaseBackupService.getInstance();
      await backupService.createAutoBackup('pre-restore');

      const success = await backupService.restoreFromPath(pendingRestoreBackup.filepath);

      if (success) {
        Alert.alert(
          'Restore Complete',
          'Database has been restored successfully. Please restart the app to ensure all changes take effect.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Restore failed. Please try again.');
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Error', `Restore failed: ${error}`);
    } finally {
      setLoading(false);
      setPendingRestoreBackup(null);
    }
  };

  const handleDeleteBackup = async (backup: BackupInfo) => {
    Alert.alert(
      'Delete Backup',
      `Delete backup from ${backup.timestamp.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const backupService = DatabaseBackupService.getInstance();
              await backupService.deleteBackup(backup.filepath);
              const backups = await backupService.listBackups();
              setBackupList(backups);
              setBackupCount(backups.length);
              Alert.alert('Success', 'Backup deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete backup');
            }
          }
        }
      ]
    );
  };

  const handleShareBackup = async (backup: BackupInfo) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backup.filepath, {
          mimeType: 'application/json',
          dialogTitle: 'Share Backup File'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share backup');
    }
  };

  const handleRestore = async () => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      Alert.alert(
        'Access Denied',
        'Only administrators and managers can restore database backups.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Open the saved backups list — the primary restore path
    loadBackupList();
  };

  const handleImportFromFile = async () => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      Alert.alert(
        'Access Denied',
        'Only administrators and managers can restore database backups.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Import from File',
      'This will replace ALL current data with data from an external backup file. A safety backup will be created first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose File',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              setShowBackupList(false);

              const backupService = DatabaseBackupService.getInstance();

              const isWebPlatform = Platform.OS === 'web';
              if (!isWebPlatform) {
                try {
                  await backupService.createAutoBackup('pre-restore');
                } catch (safetyError) {
                  console.warn('[Restore] Safety backup failed:', safetyError);
                }
              }

              const success = await backupService.restoreFromFile();

              if (success) {
                Alert.alert(
                  'Success',
                  'Database restored successfully. Please restart the app to ensure all changes take effect.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Restore failed:', error);
              Alert.alert('Error', `Restore failed: ${error}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleValidateDatabase = async () => {
    try {
      setLoading(true);

      const isWebPlatform = Platform.OS === 'web' || typeof window !== 'undefined' && typeof (window as any).document !== 'undefined';
      let validation: { isValid: boolean; errors: string[] };

      if (isWebPlatform) {
        validation = validateWebDatabase();
      } else {
        const backupService = DatabaseBackupService.getInstance();
        validation = await backupService.validateDatabase();
      }

      if (validation.isValid) {
        Alert.alert(
          'Database Validation',
          'Database is healthy and all integrity checks passed.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Database Issues Found',
          `Found ${validation.errors.length} issue(s):\n\n${validation.errors.join('\n')}\n\nWould you like to attempt repair?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Repair',
              onPress: async () => {
                try {
                  if (isWebPlatform) {
                    repairWebDatabase();
                    Alert.alert('Repair Successful', 'Database repair completed successfully', [{ text: 'OK' }]);
                  } else {
                    const backupService = DatabaseBackupService.getInstance();
                    const repair = await backupService.repairDatabase();
                    Alert.alert(
                      repair.success ? 'Repair Successful' : 'Repair Failed',
                      repair.message,
                      [{ text: 'OK' }]
                    );
                  }
                } catch (error) {
                  Alert.alert('Error', `Repair failed: ${error}`);
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', `Validation failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const validateWebDatabase = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    try {
      const storedData = localStorage.getItem(WEB_STORAGE_KEY);
      if (!storedData) {
        errors.push('No database data found');
        return { isValid: false, errors };
      }
      const data = JSON.parse(storedData);
      const requiredArrays = ['products', 'users', 'categories'];
      for (const arr of requiredArrays) {
        if (!Array.isArray(data[arr])) {
          errors.push(`Missing or invalid data: ${arr}`);
        }
      }
      const adminUser = data.users?.find((u: any) => u.role === 'ADMIN');
      if (!adminUser) {
        errors.push('No admin user found');
      }
    } catch (error) {
      errors.push(`Database validation error: ${error}`);
    }
    return { isValid: errors.length === 0, errors };
  };

  const repairWebDatabase = () => {
    const storedData = localStorage.getItem(WEB_STORAGE_KEY);
    if (storedData) {
      const data = JSON.parse(storedData);
      localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(data));
    }
  };

  const handleOptimizeDatabase = async () => {
    Alert.alert(
      'Optimize Database',
      'This will analyze, reindex, and compact the database to improve performance. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Optimize',
          onPress: async () => {
            try {
              setLoading(true);

              const isWebPlatform = Platform.OS === 'web' || typeof window !== 'undefined' && typeof (window as any).document !== 'undefined';

              if (isWebPlatform) {
                const storedData = localStorage.getItem(WEB_STORAGE_KEY);
                if (storedData) {
                  const parsedData = JSON.parse(storedData);
                  localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(parsedData));
                }
              } else {
                const backupService = DatabaseBackupService.getInstance();
                await backupService.optimizeDatabase();
              }

              Alert.alert('Success', 'Database optimization completed successfully!');
            } catch (error) {
              Alert.alert('Error', `Optimization failed: ${error}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleClearPhysicalInventory = async () => {
    Alert.alert(
      'Clear Physical Inventory Data',
      'This will delete all physical inventory history, count sessions, and reset all product stock quantities to zero. This action cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Clear',
              'Are you sure? This will permanently delete all physical inventory data and reset stock quantities to zero.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Clear All',
                  style: 'destructive',
                  onPress: () => {
                    setClearInventoryPassword('');
                    setClearInventoryPasswordVisible(true);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleClearInventoryPasswordSubmit = async () => {
    if (!clearInventoryPassword.trim()) {
      Alert.alert('Error', 'Please enter your admin password');
      return;
    }

    try {
      setLoading(true);
      const dbService = getDatabase();
      const isValid = await dbService.verifyAdminPassword(clearInventoryPassword);

      if (!isValid) {
        Alert.alert('Access Denied', 'Incorrect admin password');
        setClearInventoryPassword('');
        setLoading(false);
        return;
      }

      setClearInventoryPasswordVisible(false);
      setClearInventoryPassword('');

      await dbService.clearPhysicalInventoryData();
      Alert.alert('Success', 'Physical inventory data cleared and stock quantities reset to zero successfully.');
    } catch (error) {
      console.error('Error clearing physical inventory data:', error);
      Alert.alert('Error', 'Failed to clear physical inventory data');
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER FUNCTIONS ====================

  const renderDataTable = () => {
    if (data.length === 0) {
      return (
        <Card>
          <Card.Content>
            <Paragraph>No data found in this table</Paragraph>
          </Card.Content>
        </Card>
      );
    }

    const columns = Object.keys(data[0]);

    return (
      <ScrollView horizontal>
        <DataTable style={{ minWidth: Math.max(800, columns.length * 120) }}>
          <DataTable.Header>
            {columns.map((column, index) => (
              <DataTable.Title key={index} style={{ minWidth: 120 }}>
                {column}
              </DataTable.Title>
            ))}
          </DataTable.Header>

          {data.slice(0, 20).map((row, index) => (
            <DataTable.Row key={index}>
              {columns.map((column, colIndex) => (
                <DataTable.Cell key={colIndex} style={{ minWidth: 120 }}>
                  {String(row[column] || '').substring(0, 50)}
                  {String(row[column] || '').length > 50 ? '...' : ''}
                </DataTable.Cell>
              ))}
            </DataTable.Row>
          ))}
        </DataTable>
      </ScrollView>
    );
  };

  const renderViewerTab = () => (
    <>
      {/* Quick Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Quick Actions</Title>
          <View style={styles.actionButtons}>
            <Button
              mode="contained"
              onPress={() => loadTableCounts()}
              loading={loading}
              style={styles.actionButton}
            >
              Refresh
            </Button>
            <Button
              mode="outlined"
              onPress={openClearDialog}
              style={styles.actionButton}
              textColor="#F44336"
            >
              Clear Data
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Table Selection */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Tables</Title>
          {tables.map((table) => (
            <List.Item
              key={table.name}
              title={table.label}
              description={`${table.description} (${tableCounts[table.name] || 0} records)`}
              left={() => (
                <View style={styles.tableChip}>
                  <Chip
                    selected={currentTable === table.name}
                    onPress={() => setCurrentTable(table.name)}
                  >
                    {tableCounts[table.name] || 0}
                  </Chip>
                </View>
              )}
              onPress={() => setCurrentTable(table.name)}
            />
          ))}
        </Card.Content>
      </Card>

      {/* Custom Query */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Custom Query</Title>
          <TextInput
            label="SQL Query"
            value={customQuery}
            onChangeText={setCustomQuery}
            mode="outlined"
            multiline
            placeholder="SELECT * FROM inventory_movements WHERE product_id = 1"
            style={styles.queryInput}
          />
          <Button
            mode="contained"
            onPress={executeCustomQuery}
            loading={loading}
            disabled={!customQuery.trim()}
            style={styles.queryButton}
          >
            Execute Query
          </Button>
        </Card.Content>
      </Card>

      <Divider />

      {/* Data Display */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>
            {currentTable === 'custom_query' ? 'Query Results' : `Table: ${currentTable}`}
          </Title>
          <Paragraph style={styles.dataCount}>
            Showing {Math.min(data.length, 20)} of {data.length} records
          </Paragraph>
          {renderDataTable()}
        </Card.Content>
      </Card>
    </>
  );

  const renderManagementTab = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Data Management</Title>
        <Paragraph style={styles.cardSubtitle}>
          Backup, restore, and reset options
        </Paragraph>

        {/* Unified Backup & Restore Section */}
        <View style={styles.backupSection}>
          <View style={styles.backupSectionHeader}>
            <List.Icon icon="backup-restore" />
            <View style={{ flex: 1, marginLeft: 4 }}>
              <Paragraph style={styles.backupSectionTitle}>Backup & Restore</Paragraph>
              <Paragraph style={styles.backupSectionSubtitle}>
                {backupCount > 0 ? `${backupCount} backup(s) saved on this device` : 'No backups yet'}
              </Paragraph>
            </View>
          </View>
          <View style={styles.backupSectionButtons}>
            <Button
              mode="contained"
              icon="content-save"
              onPress={handleBackup}
              loading={loading}
              disabled={loading}
              style={{ flex: 1 }}
            >
              Backup Now
            </Button>
            <Button
              mode="outlined"
              icon="folder-open"
              onPress={loadBackupList}
              loading={loadingBackups}
              style={{ flex: 1 }}
            >
              View Saved Backups
            </Button>
          </View>
          <Button
            mode="text"
            icon="file-import"
            onPress={handleImportFromFile}
            compact
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            Import from File
          </Button>
        </View>

        <Divider />

        <List.Item
          title="Validate Database"
          description="Check database integrity and repair if needed"
          left={props => <List.Icon {...props} icon="database-check" />}
          right={props => <Button mode="outlined" compact onPress={handleValidateDatabase}>Validate</Button>}
          style={styles.listItem}
        />

        <Divider />

        <List.Item
          title="Optimize Database"
          description="Improve database performance"
          left={props => <List.Icon {...props} icon="tune" />}
          right={props => <Button mode="outlined" compact onPress={handleOptimizeDatabase}>Optimize</Button>}
          style={styles.listItem}
        />

        <Divider />

        <List.Item
          title="Test Data Generator"
          description="Add 5000 test products for testing"
          left={props => <List.Icon {...props} icon="test-tube" />}
          right={props => <Button mode="outlined" compact onPress={() => navigation.navigate('TestData')}>Generate</Button>}
          style={styles.listItem}
        />

        <Divider />

        <List.Item
          title="Clear Physical Inventory"
          description="Delete physical inventory data and reset stock to zero"
          left={props => <List.Icon {...props} icon="package-variant" />}
          right={props => (
            <Button
              mode="outlined"
              compact
              textColor="#FF9800"
              onPress={handleClearPhysicalInventory}
              loading={loading}
              disabled={loading}
            >
              Clear
            </Button>
          )}
          style={styles.listItem}
        />

        <Divider />

        <List.Item
          title="Reset Transactional Data"
          description="Delete all sales, purchases, payments, and inventory movements"
          left={props => <List.Icon {...props} icon="delete-forever" />}
          right={props => <List.Icon {...props} icon="chevron-right" color="#F44336" />}
          onPress={() => navigation.navigate('ResetData')}
          style={styles.listItem}
          titleStyle={{ color: '#F44336' }}
        />
      </Card.Content>
    </Card>
  );

  const renderHealthTab = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Database Health & Protection</Title>
        <Paragraph style={styles.cardSubtitle}>
          Monitor database health and prevent data corruption
        </Paragraph>

        {/* Health Status Summary */}
        <View style={[styles.healthSummary, { backgroundColor: dbHealth?.isHealthy ? '#E8F5E9' : '#FFEBEE' }]}>
          <List.Icon
            icon={dbHealth?.isHealthy ? 'check-circle' : 'alert-circle'}
            color={dbHealth?.isHealthy ? '#4CAF50' : '#F44336'}
          />
          <View style={styles.healthSummaryText}>
            <Paragraph style={{ fontWeight: 'bold', color: dbHealth?.isHealthy ? '#4CAF50' : '#F44336' }}>
              {checkingHealth ? 'Checking...' : dbHealth?.isHealthy ? 'Database Healthy' : 'Issues Detected'}
            </Paragraph>
            {dbHealth?.estimatedSizeKB ? (
              <Paragraph style={styles.healthDetail}>
                Size: {dbHealth.estimatedSizeKB > 1024 ? `${(dbHealth.estimatedSizeKB / 1024).toFixed(1)} MB` : `${dbHealth.estimatedSizeKB} KB`}
              </Paragraph>
            ) : null}
          </View>
          <Button mode="text" onPress={checkDatabaseHealth} loading={checkingHealth} compact>
            Refresh
          </Button>
        </View>

        {/* Health Details */}
        <List.Item
          title="WAL Mode (Crash Recovery)"
          description={dbHealth?.walMode ? 'Enabled - Better crash recovery' : 'Disabled - Enable for protection'}
          left={props => <List.Icon {...props} icon="shield-check" color={dbHealth?.walMode ? '#4CAF50' : '#FF9800'} />}
          right={() => (
            <Paragraph style={{ color: dbHealth?.walMode ? '#4CAF50' : '#FF9800' }}>
              {dbHealth?.walMode ? 'ON' : 'OFF'}
            </Paragraph>
          )}
        />

        <Divider />

        <List.Item
          title="Synchronous Mode"
          description={dbHealth?.synchronousMode === 'FULL' ? 'Maximum durability' : 'May lose data on crash'}
          left={props => <List.Icon {...props} icon="sync" color={dbHealth?.synchronousMode === 'FULL' ? '#4CAF50' : '#FF9800'} />}
          right={() => (
            <Paragraph style={{ color: dbHealth?.synchronousMode === 'FULL' ? '#4CAF50' : '#FF9800' }}>
              {dbHealth?.synchronousMode || 'Unknown'}
            </Paragraph>
          )}
        />

        <Divider />

        <List.Item
          title="Integrity Check"
          description={dbHealth?.integrityOk ? 'No corruption detected' : 'Database may be corrupted'}
          left={props => <List.Icon {...props} icon="database-check" color={dbHealth?.integrityOk ? '#4CAF50' : '#F44336'} />}
          right={() => (
            <Paragraph style={{ color: dbHealth?.integrityOk ? '#4CAF50' : '#F44336' }}>
              {dbHealth?.integrityOk ? 'OK' : 'FAILED'}
            </Paragraph>
          )}
        />

        {diskSpace && (
          <>
            <Divider />
            <List.Item
              title="Storage Space"
              description={`${diskSpace.free.toLocaleString()} MB free of ${diskSpace.total.toLocaleString()} MB`}
              left={props => <List.Icon {...props} icon="harddisk" color={diskSpace.free < 100 ? '#F44336' : '#4CAF50'} />}
              right={() => (
                <Paragraph style={{ color: diskSpace.free < 100 ? '#F44336' : '#4CAF50' }}>
                  {diskSpace.free < 100 ? 'LOW' : 'OK'}
                </Paragraph>
              )}
            />
          </>
        )}

        {/* Issues List */}
        {dbHealth?.issues && dbHealth.issues.length > 0 && (
          <View style={styles.issuesContainer}>
            <Paragraph style={styles.issuesTitle}>Issues Found:</Paragraph>
            {dbHealth.issues.map((issue, index) => (
              <Paragraph key={index} style={styles.issueItem}>{'\u2022'} {issue}</Paragraph>
            ))}
          </View>
        )}

        {/* Protection Actions */}
        <View style={styles.healthActions}>
          {dbHealth?.issues && dbHealth.issues.length > 0 && (
            <Button
              mode="contained"
              onPress={handleFixIssues}
              loading={fixingIssues}
              icon="wrench"
              style={[styles.healthButton, { backgroundColor: '#FF9800' }]}
              disabled={fixingIssues || loading}
            >
              Fix Issues
            </Button>
          )}
          <Button
            mode="outlined"
            onPress={handleCheckpointWAL}
            loading={loading}
            icon="content-save"
            style={styles.healthButton}
            disabled={fixingIssues || loading}
          >
            Save to Disk
          </Button>
        </View>

        <Paragraph style={styles.healthNote}>
          Tip: Database protection is always enabled. Use "Save to Disk" before closing the app to ensure all changes are saved.
          {dbHealth?.issues && dbHealth.issues.length > 0 && ' Tap "Fix Issues" to resolve the problems above.'}
        </Paragraph>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Tabs */}
      <View style={[styles.tabContainer, { paddingHorizontal: lo.screenPadding }]}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={[
            { value: 'management', label: 'Management', icon: 'cog' },
            { value: 'health', label: 'Health', icon: 'heart-pulse' },
            { value: 'viewer', label: 'Viewer', icon: 'table' },
          ]}
        />
      </View>

      <Divider />

      <ScrollView style={[styles.scrollContainer, { padding: lo.screenPadding }]}>
        {activeTab === 'viewer' && renderViewerTab()}
        {activeTab === 'management' && renderManagementTab()}
        {activeTab === 'health' && renderHealthTab()}
      </ScrollView>

      {/* Secure Clear Data Dialog */}
      <Portal>
        <Dialog
          visible={clearDialogVisible}
          onDismiss={() => {
            if (!clearing) {
              setClearDialogVisible(false);
            }
          }}
        >
          <Dialog.Title>Clear All Transactional Data</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ marginBottom: 16 }}>
              This will permanently delete all transactions, physical counts, inventory movements, eJournal entries, and reading data. This action cannot be undone.
            </Paragraph>
            <TextInput
              label={`Type "${CLEAR_CONFIRMATION_TEXT}" to confirm`}
              value={clearConfirmText}
              onChangeText={setClearConfirmText}
              mode="outlined"
              autoCapitalize="characters"
              style={styles.dialogInput}
              disabled={clearing}
            />
            <TextInput
              label="Admin Password"
              value={clearAdminPassword}
              onChangeText={(text) => {
                setClearAdminPassword(text);
                setClearPasswordError('');
              }}
              mode="outlined"
              secureTextEntry
              style={styles.dialogInput}
              disabled={clearing}
              error={!!clearPasswordError}
            />
            {clearPasswordError ? (
              <Paragraph style={{ color: '#F44336', fontSize: 12, marginTop: -4 }}>
                {clearPasswordError}
              </Paragraph>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setClearDialogVisible(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button
              onPress={performClear}
              loading={clearing}
              disabled={clearing || clearConfirmText !== CLEAR_CONFIRMATION_TEXT || !clearAdminPassword.trim()}
              textColor="#F44336"
            >
              Clear All Data
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Clear Physical Inventory Password Dialog */}
        <Dialog
          visible={clearInventoryPasswordVisible}
          onDismiss={() => {
            setClearInventoryPasswordVisible(false);
            setClearInventoryPassword('');
          }}
        >
          <Dialog.Title>Enter Password</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ marginBottom: 16 }}>
              Enter your admin password to clear physical inventory data
            </Paragraph>
            <TextInput
              label="Password"
              value={clearInventoryPassword}
              onChangeText={setClearInventoryPassword}
              mode="outlined"
              secureTextEntry={true}
              autoFocus={true}
              style={styles.dialogInput}
              disabled={loading}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setClearInventoryPasswordVisible(false);
              setClearInventoryPassword('');
            }} disabled={loading}>Cancel</Button>
            <Button
              onPress={handleClearInventoryPasswordSubmit}
              loading={loading}
              disabled={loading || !clearInventoryPassword.trim()}
            >OK</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Restore Password Dialog */}
        <Dialog
          visible={restorePasswordVisible}
          onDismiss={() => {
            if (!loading) {
              setRestorePasswordVisible(false);
              setRestorePassword('');
              setPendingRestoreBackup(null);
            }
          }}
        >
          <Dialog.Title>Admin Password Required</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ marginBottom: 16 }}>
              Enter your admin password to restore this backup.
            </Paragraph>
            <TextInput
              label="Admin Password"
              value={restorePassword}
              onChangeText={setRestorePassword}
              mode="outlined"
              secureTextEntry={true}
              autoFocus={true}
              style={styles.dialogInput}
              disabled={loading}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setRestorePasswordVisible(false);
              setRestorePassword('');
              setPendingRestoreBackup(null);
            }} disabled={loading}>Cancel</Button>
            <Button
              onPress={handleRestorePasswordSubmit}
              loading={loading}
              disabled={loading || !restorePassword.trim()}
              textColor="#F44336"
            >Restore</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Backup List Dialog */}
        <Dialog
          visible={showBackupList}
          onDismiss={() => setShowBackupList(false)}
          style={styles.backupDialog}
        >
          <Dialog.Title>Saved Backups</Dialog.Title>
          <Dialog.ScrollArea style={styles.backupScrollArea}>
            <ScrollView>
              {backupList.length === 0 ? (
                <Paragraph style={styles.noBackupsText}>
                  No backups found in the POSBackups folder.
                </Paragraph>
              ) : (
                backupList.map((backup, index) => (
                  <View key={backup.filename}>
                    <View style={styles.backupItem}>
                      <View style={styles.backupInfo}>
                        <Paragraph style={styles.backupDate}>
                          {backup.timestamp.toLocaleString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Paragraph>
                        <Paragraph style={styles.backupMeta}>
                          {backup.sizeKB} KB
                          {backup.metadata?.product_count ? ` \u2022 ${backup.metadata.product_count} products` : ''}
                          {backup.metadata?.backup_reason ? ` \u2022 ${backup.metadata.backup_reason}` : ''}
                        </Paragraph>
                      </View>
                      <View style={styles.backupActions}>
                        <Button
                          mode="text"
                          compact
                          icon="share"
                          onPress={() => handleShareBackup(backup)}
                        >
                          Share
                        </Button>
                        <Button
                          mode="text"
                          compact
                          icon="restore"
                          onPress={() => handleRestoreFromBackup(backup)}
                        >
                          Restore
                        </Button>
                        <Button
                          mode="text"
                          compact
                          icon="delete"
                          textColor="#F44336"
                          onPress={() => handleDeleteBackup(backup)}
                        >
                          Delete
                        </Button>
                      </View>
                    </View>
                    {index < backupList.length - 1 && <Divider />}
                  </View>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={{ justifyContent: 'space-between' }}>
            <Button icon="file-import" onPress={handleImportFromFile} compact>Import from File</Button>
            <Button onPress={() => setShowBackupList(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  cardSubtitle: {
    opacity: 0.7,
    marginBottom: 16,
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  tableChip: {
    justifyContent: 'center',
    marginRight: 12,
  },
  queryInput: {
    marginBottom: 12,
    minHeight: 80,
  },
  queryButton: {
    alignSelf: 'flex-start',
  },
  dataCount: {
    marginBottom: 12,
    fontStyle: 'italic',
  },
  listItem: {
    paddingVertical: 4,
  },
  dialogInput: {
    marginBottom: 8,
    textAlign: 'left',
  },
  // Health styles
  healthSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  healthSummaryText: {
    flex: 1,
    marginLeft: 8,
  },
  healthDetail: {
    fontSize: 12,
    opacity: 0.7,
  },
  issuesContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  issuesTitle: {
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 8,
  },
  issueItem: {
    fontSize: 12,
    color: '#C62828',
    marginLeft: 8,
    marginBottom: 4,
  },
  healthActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  healthButton: {
    flex: 1,
  },
  healthNote: {
    fontSize: 11,
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  // Backup dialog styles
  backupDialog: {
    maxHeight: '80%',
  },
  backupScrollArea: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  backupItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backupInfo: {
    marginBottom: 8,
  },
  backupDate: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  backupMeta: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  backupActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  noBackupsText: {
    textAlign: 'center',
    padding: 24,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  // Unified backup section
  backupSection: {
    paddingVertical: 12,
  },
  backupSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backupSectionTitle: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  backupSectionSubtitle: {
    fontSize: 12,
    opacity: 0.6,
  },
  backupSectionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
});
