import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  useTheme,
  Chip,
  DataTable,
  Searchbar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';

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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState<MovementType | ''>('');
  const [filterReference, setFilterReference] = useState<ReferenceType | ''>('');

  const theme = useTheme();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();

      const [movementsData, summaryData] = await Promise.all([
        dbService.getInventoryMovements({
          limit: 100
        }),
        dbService.getInventoryMovementsSummary()
      ]);

      setMovements(movementsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading inventory movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredData = async () => {
    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();

      const options: any = {};

      if (filterType) options.movement_type = filterType;
      if (filterReference) options.reference_type = filterReference;
      if (dateFrom) options.date_from = dateFrom;
      if (dateTo) options.date_to = dateTo;

      const [movementsData, summaryData] = await Promise.all([
        dbService.getInventoryMovements(options),
        dbService.getInventoryMovementsSummary(dateFrom || undefined, dateTo || undefined)
      ]);

      setMovements(movementsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading filtered data:', error);
    } finally {
      setLoading(false);
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
    <Card style={styles.movementCard}>
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

        <Paragraph style={styles.totalValue}>
          Value: ₱{item.total_value?.toFixed(2) || '0.00'}
        </Paragraph>
      </Card.Content>
    </Card>
  );

  const renderSummary = () => (
    <ScrollView contentContainerStyle={styles.summaryContainer}>
      {/* Date Filter */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <Title style={styles.filterTitle}>Filters</Title>
          <View style={styles.dateFilterRow}>
            <TextInput
              label="From Date"
              value={dateFrom}
              onChangeText={setDateFrom}
              mode="outlined"
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
            />
            <TextInput
              label="To Date"
              value={dateTo}
              onChangeText={setDateTo}
              mode="outlined"
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <Button
            mode="contained"
            onPress={loadFilteredData}
            style={styles.filterButton}
            loading={loading}
          >
            Apply Filter
          </Button>
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
            <Searchbar
              placeholder="Search movements..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />
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
        <Title style={styles.headerTitle}>Inventory Movements</Title>

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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
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
  searchBar: {
    margin: 16,
    marginTop: 8,
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
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dateFilterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateInput: {
    flex: 1,
  },
  filterButton: {
    marginTop: 8,
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
});