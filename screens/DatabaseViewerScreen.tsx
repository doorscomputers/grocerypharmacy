import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
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
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';

type DatabaseViewerScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'DatabaseViewer'
>;

type Props = {
  navigation: DatabaseViewerScreenNavigationProp;
};

export default function DatabaseViewerScreen({ navigation }: Props) {
  const [currentTable, setCurrentTable] = useState('inventory_movements');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [tableCounts, setTableCounts] = useState<{[key: string]: number}>({});
  const theme = useTheme();

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

  const loadTableCounts = async () => {
    try {
      const dbService = DatabaseService.getInstance();
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
      const dbService = DatabaseService.getInstance();
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
      const dbService = DatabaseService.getInstance();
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

  const clearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will clear all transactions, physical counts, and inventory movements. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: performClear }
      ]
    );
  };

  const performClear = async () => {
    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
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

      Alert.alert('Success', 'All transactional data has been cleared');
      loadTableCounts();
      loadTableData(currentTable);
    } catch (error) {
      console.error('Error clearing data:', error);
      Alert.alert('Error', 'Failed to clear data');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title>Database Viewer</Title>
            <Paragraph>View and manage your database tables</Paragraph>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Quick Actions</Title>
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
                onPress={clearAllData}
                style={styles.actionButton}
              >
                Clear Data
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Table Selection */}
        <Card style={styles.tablesCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Tables</Title>
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
        <Card style={styles.queryCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Custom Query</Title>
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
        <Card style={styles.dataCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>
              {currentTable === 'custom_query' ? 'Query Results' : `Table: ${currentTable}`}
            </Title>
            <Paragraph style={styles.dataCount}>
              Showing {Math.min(data.length, 20)} of {data.length} records
            </Paragraph>
            {renderDataTable()}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
  },
  actionsCard: {
    marginBottom: 16,
  },
  tablesCard: {
    marginBottom: 16,
  },
  queryCard: {
    marginBottom: 16,
  },
  dataCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
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
});