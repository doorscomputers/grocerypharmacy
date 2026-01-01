import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Text,
  FlatList,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  DataTable,
  Divider,
  Chip,
  List,
  IconButton,
  Portal,
  Dialog,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';

type PhysicalCountReportScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PhysicalCountReport'
>;

type Props = {
  navigation: PhysicalCountReportScreenNavigationProp;
};

interface PhysicalCountSession {
  session_id: string;
  date: string;
  status: string;
  started_by_name: string;
  completed_by_name?: string;
  started_at: string;
  completed_at?: string;
  total_items: number;
  counted_items: number;
  discrepancy_count: number;
  total_discrepancy_value: number;
  notes?: string;
}

interface PhysicalCountDetail {
  product_code: string;
  product_name: string;
  system_quantity: number;
  physical_quantity: number;
  discrepancy: number;
  value_discrepancy: number;
  item_status: string;
  counted_by_name?: string;
  counted_at?: string;
  item_notes?: string;
}

interface GroupedReport {
  session: PhysicalCountSession;
  details: PhysicalCountDetail[];
}

export default function PhysicalCountReportScreen({ navigation }: Props) {
  const [reportData, setReportData] = useState<GroupedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const dbService = getDatabase();

      // Format dates for database query
      const actualStartDate = dateRange.startDate.toISOString().split('T')[0];
      const actualEndDate = dateRange.endDate.toISOString().split('T')[0];
      console.log('🔍 PhysicalCountReport Debug:');
      console.log('  Actual Start Date:', actualStartDate);
      console.log('  Actual End Date:', actualEndDate);

      // First, let's check what sessions exist without date filtering
      console.log('🔍 Checking all sessions in database...');
      const allSessions = await dbService.getPhysicalCountReport();
      console.log('  Total sessions in DB:', allSessions.length);

      if (allSessions.length > 0) {
        const sessionDates = allSessions.slice(0, 5).map(s => ({
          session_id: s.session_id,
          date: s.date,
          date_type: typeof s.date,
          actual_date: new Date(s.date).toISOString().split('T')[0]
        }));
        console.log('  Sample session dates:', sessionDates);

        // Show date range comparison
        if (actualStartDate || actualEndDate) {
          console.log('  Date filter comparison:');
          sessionDates.forEach(session => {
            const sessionDate = session.actual_date;
            const withinStart = !actualStartDate || sessionDate >= actualStartDate;
            const withinEnd = !actualEndDate || sessionDate <= actualEndDate;
            const shouldInclude = withinStart && withinEnd;
            console.log(`    ${session.session_id}: ${sessionDate} -> Include: ${shouldInclude} (start: ${withinStart}, end: ${withinEnd})`);
          });
        }
      }

      const rawData = await dbService.getPhysicalCountReport(
        undefined, // sessionId
        actualStartDate,
        actualEndDate
      );

      console.log('  Filtered Data Count:', rawData.length);
      console.log('  Applied filters - Start:', actualStartDate, 'End:', actualEndDate);

      // Group data by session with performance optimizations
      const groupedData: { [key: string]: GroupedReport } = {};

      // Limit processing to prevent UI freeze
      const maxSessions = 15; // Limit sessions
      const maxDetailsPerSession = 30; // Limit details per session
      const processedSessions = new Set<string>();

      rawData.forEach((row: any) => {
        // Skip if we've reached the session limit
        if (processedSessions.size >= maxSessions && !groupedData[row.session_id]) {
          return;
        }

        if (!groupedData[row.session_id]) {
          processedSessions.add(row.session_id);
          groupedData[row.session_id] = {
            session: {
              session_id: row.session_id,
              date: row.date,
              status: row.status,
              started_by_name: row.started_by_name,
              completed_by_name: row.completed_by_name,
              started_at: row.started_at,
              completed_at: row.completed_at,
              total_items: row.total_items,
              counted_items: row.counted_items,
              discrepancy_count: row.discrepancy_count,
              total_discrepancy_value: row.total_discrepancy_value,
              notes: row.notes,
            },
            details: [],
          };
        }

        // Only add detail if we have product data and haven't exceeded limit
        if (row.product_code &&
            row.product_code !== null &&
            row.product_code.trim() !== '' &&
            groupedData[row.session_id].details.length < maxDetailsPerSession) {
          groupedData[row.session_id].details.push({
            product_code: row.product_code,
            product_name: row.product_name,
            system_quantity: row.system_quantity,
            physical_quantity: row.physical_quantity,
            discrepancy: row.discrepancy,
            value_discrepancy: row.value_discrepancy,
            item_status: row.item_status,
            counted_by_name: row.counted_by_name,
            counted_at: row.counted_at,
            item_notes: row.item_notes,
          });
        }
      });

      const finalData = Object.values(groupedData);
      console.log('  Final grouped sessions:', finalData.length);
      console.log('  Sessions with details:', finalData.filter(s => s.details.length > 0).length);

      setReportData(finalData);
    } catch (error) {
      console.error('Error loading report data:', error);
      Alert.alert('Error', 'Failed to load physical count report data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const toggleSessionExpansion = (sessionId: string) => {
    setExpandedSession(expandedSession === sessionId ? null : sessionId);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const createTestData = async () => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      console.log('Starting test data creation...');
      const sessionId = await dbService.createTestPhysicalCountData();

      if (sessionId) {
        Alert.alert(
          'Test Data Created',
          `Created test physical count session ${sessionId}. Refresh to see the data.`,
          [
            {
              text: 'Refresh Now',
              onPress: () => loadReportData(),
            },
          ]
        );
      } else {
        Alert.alert('Warning', 'Test data creation completed but no session ID returned');
      }
    } catch (error) {
      console.error('Error creating test data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Error',
        `Failed to create test data: ${errorMessage}`,
        [
          {
            text: 'OK',
            onPress: () => console.log('Error acknowledged'),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusChipColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const renderSession = ({ item: report }: { item: GroupedReport }) => (
    <Card key={report.session.session_id} style={styles.sessionCard}>
      <List.Item
        title={`Session: ${report.session.session_id}`}
        description={`${formatDate(report.session.date)} • Started by ${report.session.started_by_name}`}
        left={() => (
          <View style={styles.sessionStatus}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusChipColor(report.session.status) }]}
              textStyle={styles.statusChipText}
            >
              {report.session.status.toUpperCase()}
            </Chip>
          </View>
        )}
        right={() => (
          <IconButton
            icon={expandedSession === report.session.session_id ? "chevron-up" : "chevron-down"}
            onPress={() => toggleSessionExpansion(report.session.session_id)}
          />
        )}
        onPress={() => toggleSessionExpansion(report.session.session_id)}
      />

      {expandedSession === report.session.session_id && (
        <Card.Content style={styles.expandedContent}>
          {/* Session Information */}
          <View style={styles.sessionInfoSection}>
            <View style={styles.sessionSummary}>
              <Text style={styles.summaryTitle}>Session Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Items</Text>
                  <Text style={styles.summaryValue}>{report.session.total_items || 0}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Counted</Text>
                  <Text style={styles.summaryValue}>{report.session.counted_items || 0}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Discrepancies</Text>
                  <Text style={styles.summaryValue}>{report.session.discrepancy_count || 0}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Value Impact</Text>
                  <Text style={[
                    styles.summaryValue,
                    { color: (report.session.total_discrepancy_value || 0) < 0 ? '#F44336' : '#4CAF50' }
                  ]}>
                    ₱{Math.abs(report.session.total_discrepancy_value || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Timeline */}
            <View style={styles.timelineSection}>
              <Text style={styles.timelineTitle}>Timeline</Text>
              <Text style={styles.timelineItem}>
                ▶️ Started: {formatDateTime(report.session.started_at)} by {report.session.started_by_name}
              </Text>
              {report.session.completed_at && report.session.completed_by_name && (
                <Text style={styles.timelineItem}>
                  ✅ Completed: {formatDateTime(report.session.completed_at)} by {report.session.completed_by_name}
                </Text>
              )}
            </View>

            {report.session.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.notesTitle}>Session Notes:</Text>
                <Text style={styles.notesText}>{report.session.notes}</Text>
              </View>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Details Table */}
          <Title style={styles.detailsTitle}>Count Details ({report.details.length} items)</Title>

          {report.details.length > 0 ? (
            <DataTable style={styles.dataTable}>
              <DataTable.Header>
                <DataTable.Title style={styles.productColumn}>Product</DataTable.Title>
                <DataTable.Title numeric style={styles.numberColumn}>System</DataTable.Title>
                <DataTable.Title numeric style={styles.numberColumn}>Physical</DataTable.Title>
                <DataTable.Title numeric style={styles.numberColumn}>Diff</DataTable.Title>
                <DataTable.Title style={styles.userColumn}>Counted By</DataTable.Title>
              </DataTable.Header>

              {report.details.slice(0, 20).map((detail, detailIndex) => (
                <DataTable.Row key={detailIndex}>
                  <DataTable.Cell style={styles.productColumn}>
                    <View>
                      <Text style={styles.productName}>{detail.product_name}</Text>
                      <Text style={styles.productCode}>{detail.product_code}</Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={styles.numberColumn}>
                    {detail.system_quantity}
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={styles.numberColumn}>
                    {detail.physical_quantity}
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={styles.numberColumn}>
                    <Text style={[
                      styles.discrepancyText,
                      { color: detail.discrepancy >= 0 ? '#4CAF50' : '#F44336' }
                    ]}>
                      {detail.discrepancy >= 0 ? '+' : ''}{detail.discrepancy}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell style={styles.userColumn}>
                    <Text style={styles.userName}>{detail.counted_by_name || 'N/A'}</Text>
                    {detail.counted_at && (
                      <Text style={styles.countTime}>
                        {formatDateTime(detail.counted_at)}
                      </Text>
                    )}
                  </DataTable.Cell>
                </DataTable.Row>
              ))}

              {report.details.length > 20 && (
                <DataTable.Row>
                  <DataTable.Cell>
                    <Text style={styles.moreItemsText}>
                      ... and {report.details.length - 20} more items
                    </Text>
                  </DataTable.Cell>
                </DataTable.Row>
              )}
            </DataTable>
          ) : (
            <View style={styles.noDetailsContainer}>
              <Text style={styles.noDetailsText}>No count details recorded for this session</Text>
            </View>
          )}
        </Card.Content>
      )}
    </Card>
  );

  const renderHeader = () => (
    <View>
      <Card style={styles.headerCard}>
        <Card.Content>
          <Title style={styles.headerTitle}>Physical Count Reports</Title>
          <Paragraph style={styles.headerSubtitle}>
            View detailed physical inventory count sessions grouped by user and date
          </Paragraph>
          <View style={styles.headerButtons}>
            <Button
              mode="outlined"
              onPress={() => loadReportData()}
              style={styles.refreshButton}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              mode="contained"
              onPress={createTestData}
              style={styles.refreshButton}
              loading={loading}
            >
              Generate Test Data
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Date Filter Card */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <DateRangeFilter
            onDateChange={handleDateChange}
            selectedPreset="this_month"
          />
        </Card.Content>
      </Card>
    </View>
  );

  const renderEmptyComponent = () => (
    <Card style={styles.emptyCard}>
      <Card.Content>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Title style={styles.emptyTitle}>No Physical Counts Found</Title>
          <Paragraph style={styles.emptyText}>
            No physical inventory count sessions have been recorded yet.
          </Paragraph>
        </View>
      </Card.Content>
    </Card>
  );

  if (loading && reportData.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Title>Loading Physical Count Reports...</Title>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={reportData}
        renderItem={renderSession}
        keyExtractor={(item) => item.session.session_id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyComponent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={10}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
    color: '#666',
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  refreshButton: {
    minWidth: 120,
  },
  filterCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
  },
  sessionCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
  },
  sessionStatus: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  expandedContent: {
    paddingTop: 0,
  },
  sessionInfoSection: {
    marginBottom: 16,
  },
  sessionSummary: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryItem: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timelineSection: {
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  timelineItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    lineHeight: 16,
  },
  notesSection: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 16,
  },
  divider: {
    marginVertical: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  dataTable: {
    backgroundColor: 'white',
  },
  productColumn: {
    flex: 2,
  },
  numberColumn: {
    flex: 1,
  },
  userColumn: {
    flex: 1.5,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  productCode: {
    fontSize: 10,
    color: '#666',
  },
  discrepancyText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  countTime: {
    fontSize: 9,
    color: '#666',
  },
  moreItemsText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    paddingVertical: 8,
  },
  noDetailsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noDetailsText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyCard: {
    margin: 16,
    elevation: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
});