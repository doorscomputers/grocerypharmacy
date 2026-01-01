import React, { useState, useEffect, useCallback } from 'react';
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
  useTheme,
  Chip,
  Divider,
  DataTable,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';

type DamagedItemsHistoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'DamagedItemsHistory'
>;

type Props = {
  navigation: DamagedItemsHistoryScreenNavigationProp;
};

type DamageReason = 'EXPIRED' | 'BROKEN' | 'DEFECTIVE' | 'SPOILED' | 'LOST' | 'THEFT' | 'OTHER';

export default function DamagedItemsHistoryScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'reports'>('sessions');
  const [damageSessions, setDamageSessions] = useState<any[]>([]);
  const [damageReports, setDamageReports] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  const theme = useTheme();

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

      const [sessionsData, reportsData] = await Promise.all([
        dbService.getDamageSessions(50),
        dbService.getDamageReports(dateFrom, dateTo)
      ]);

      // Filter sessions by date range
      const filteredSessions = sessionsData.filter((session: any) => {
        const sessionDate = new Date(session.started_at);
        return sessionDate >= dateRange.startDate && sessionDate <= dateRange.endDate;
      });

      setDamageSessions(filteredSessions);
      setDamageReports(reportsData);
    } catch (error) {
      console.error('Error loading damage history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#2196F3';
      case 'COMPLETED': return '#4CAF50';
      case 'CANCELLED': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getReasonColor = (reason: DamageReason) => {
    switch (reason) {
      case 'EXPIRED': return '#FF9800';
      case 'BROKEN': return '#F44336';
      case 'DEFECTIVE': return '#E91E63';
      case 'SPOILED': return '#795548';
      case 'LOST': return '#607D8B';
      case 'THEFT': return '#000000';
      case 'OTHER': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const renderSession = ({ item }: { item: any }) => (
    <Card style={styles.sessionCard}>
      <Card.Content>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionInfo}>
            <Title style={styles.sessionId}>{item.session_id}</Title>
            <Paragraph style={styles.sessionName}>{item.session_name}</Paragraph>
            <Paragraph style={styles.sessionDate}>
              Started: {new Date(item.started_at).toLocaleDateString()}
            </Paragraph>
            <Paragraph style={styles.sessionUser}>
              By: {item.started_by_name}
            </Paragraph>
          </View>
          <View style={styles.sessionStats}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={{ color: 'white' }}
            >
              {item.status}
            </Chip>
            <Paragraph style={styles.itemCount}>
              {item.total_items} items
            </Paragraph>
            <Paragraph style={styles.totalValue}>
              ₱{item.total_value?.toFixed(2) || '0.00'}
            </Paragraph>
          </View>
        </View>

        {item.completed_at && (
          <Paragraph style={styles.completedInfo}>
            Completed: {new Date(item.completed_at).toLocaleDateString()} by {item.completed_by_name}
          </Paragraph>
        )}

        {item.cancelled_reason && (
          <Paragraph style={styles.cancelledInfo}>
            Cancelled: {item.cancelled_reason} by {item.cancelled_by_name}
          </Paragraph>
        )}

        {item.notes && (
          <Paragraph style={styles.sessionNotes}>{item.notes}</Paragraph>
        )}
      </Card.Content>
    </Card>
  );

  const renderReports = () => (
    <ScrollView contentContainerStyle={styles.reportsContainer}>
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
          <Title style={styles.summaryTitle}>Damage Summary</Title>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total Sessions</Paragraph>
              <Paragraph style={styles.summaryValue}>
                {damageReports?.overallTotals?.total_sessions || 0}
              </Paragraph>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total Items</Paragraph>
              <Paragraph style={styles.summaryValue}>
                {damageReports?.overallTotals?.total_items || 0}
              </Paragraph>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total Quantity</Paragraph>
              <Paragraph style={styles.summaryValue}>
                {damageReports?.overallTotals?.total_quantity || 0}
              </Paragraph>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={styles.summaryLabel}>Total Value</Paragraph>
              <Paragraph style={[styles.summaryValue, { color: '#F44336' }]}>
                ₱{damageReports?.overallTotals?.total_value?.toFixed(2) || '0.00'}
              </Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Damage by Reason */}
      <Card style={styles.reportCard}>
        <Card.Content>
          <Title style={styles.reportTitle}>Damage by Reason</Title>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Reason</DataTable.Title>
              <DataTable.Title numeric>Items</DataTable.Title>
              <DataTable.Title numeric>Quantity</DataTable.Title>
              <DataTable.Title numeric>Value</DataTable.Title>
            </DataTable.Header>

            {damageReports?.reasonSummary?.map((item: any, index: number) => (
              <DataTable.Row key={index}>
                <DataTable.Cell>
                  <Chip
                    style={[styles.reasonChip, { backgroundColor: getReasonColor(item.damage_reason) }]}
                    textStyle={{ color: 'white', fontSize: 10 }}
                    compact
                  >
                    {item.damage_reason}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell numeric>{item.item_count}</DataTable.Cell>
                <DataTable.Cell numeric>{item.total_quantity}</DataTable.Cell>
                <DataTable.Cell numeric>₱{item.total_value?.toFixed(2)}</DataTable.Cell>
              </DataTable.Row>
            )) || []}
          </DataTable>
        </Card.Content>
      </Card>

      {/* Top Damaged Products */}
      <Card style={styles.reportCard}>
        <Card.Content>
          <Title style={styles.reportTitle}>Top Damaged Products</Title>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Product</DataTable.Title>
              <DataTable.Title numeric>Count</DataTable.Title>
              <DataTable.Title numeric>Quantity</DataTable.Title>
              <DataTable.Title numeric>Value</DataTable.Title>
            </DataTable.Header>

            {damageReports?.productSummary?.map((item: any, index: number) => (
              <DataTable.Row key={index}>
                <DataTable.Cell>
                  <View>
                    <Paragraph style={styles.productName}>{item.product_name}</Paragraph>
                    <Paragraph style={styles.productCode}>{item.product_code}</Paragraph>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell numeric>{item.damage_count}</DataTable.Cell>
                <DataTable.Cell numeric>{item.total_quantity}</DataTable.Cell>
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
      case 'sessions':
        return (
          <FlatList
            data={damageSessions}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderSession}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadData}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Paragraph style={styles.emptyText}>
                  No damage sessions found.
                </Paragraph>
              </View>
            }
          />
        );
      case 'reports':
        return renderReports();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Damage History & Reports</Title>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Button
            mode={activeTab === 'sessions' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('sessions')}
            style={styles.tabButton}
            compact
          >
            Sessions
          </Button>
          <Button
            mode={activeTab === 'reports' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('reports')}
            style={styles.tabButton}
            compact
          >
            Reports
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
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  sessionCard: {
    marginBottom: 16,
    elevation: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionId: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sessionName: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  sessionDate: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 2,
  },
  sessionUser: {
    fontSize: 12,
    opacity: 0.6,
  },
  sessionStats: {
    alignItems: 'flex-end',
  },
  statusChip: {
    marginBottom: 8,
  },
  itemCount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  completedInfo: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 8,
  },
  cancelledInfo: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 8,
  },
  sessionNotes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    opacity: 0.7,
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
  reportsContainer: {
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
  reasonChip: {
    alignSelf: 'flex-start',
  },
  productName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  productCode: {
    fontSize: 10,
    opacity: 0.7,
  },
});