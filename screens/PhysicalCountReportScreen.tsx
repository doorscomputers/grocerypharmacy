import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Text,
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
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const theme = useTheme();

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async (filterStartDate?: string, filterEndDate?: string) => {
    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
      const rawData = await dbService.getPhysicalCountReport(
        undefined, // sessionId
        filterStartDate || startDate || undefined,
        filterEndDate || endDate || undefined
      );

      // Group data by session
      const groupedData: { [key: string]: GroupedReport } = {};

      rawData.forEach((row: any) => {
        if (!groupedData[row.session_id]) {
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

        // Only add detail if we have product data
        if (row.product_code) {
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

      setReportData(Object.values(groupedData));
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

  const formatDateForFilter = (date: Date) => {
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
  };

  const handleApplyFilter = () => {
    loadReportData();
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    loadReportData('', '');
  };

  const setQuickFilter = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    setStartDate(formatDateForFilter(startDate));
    setEndDate(formatDateForFilter(endDate));
    loadReportData(formatDateForFilter(startDate), formatDateForFilter(endDate));
  };

  const toggleSessionExpansion = (sessionId: string) => {
    setExpandedSession(expandedSession === sessionId ? null : sessionId);
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

  if (loading) {
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
      <ScrollView style={styles.scrollContainer}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title style={styles.headerTitle}>Physical Count Reports</Title>
            <Paragraph style={styles.headerSubtitle}>
              View detailed physical inventory count sessions grouped by user and date
            </Paragraph>
            <Button
              mode="outlined"
              onPress={loadReportData}
              style={styles.refreshButton}
              loading={loading}
            >
              Refresh
            </Button>
          </Card.Content>
        </Card>

        {/* Date Filter Card */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Filter by Date Range</Title>

            {/* Quick Filter Buttons */}
            <View style={styles.quickFilterContainer}>
              <Button
                mode="outlined"
                onPress={() => setQuickFilter(7)}
                style={styles.quickFilterButton}
                compact
              >
                Last 7 Days
              </Button>
              <Button
                mode="outlined"
                onPress={() => setQuickFilter(30)}
                style={styles.quickFilterButton}
                compact
              >
                Last 30 Days
              </Button>
              <Button
                mode="outlined"
                onPress={() => setQuickFilter(90)}
                style={styles.quickFilterButton}
                compact
              >
                Last 90 Days
              </Button>
            </View>

            {/* Date Inputs */}
            <View style={styles.dateInputContainer}>
              <TextInput
                label="Start Date (YYYY-MM-DD)"
                value={startDate}
                onChangeText={setStartDate}
                mode="outlined"
                style={styles.dateInput}
                placeholder="2025-01-01"
              />
              <TextInput
                label="End Date (YYYY-MM-DD)"
                value={endDate}
                onChangeText={setEndDate}
                mode="outlined"
                style={styles.dateInput}
                placeholder="2025-12-31"
              />
            </View>

            {/* Filter Action Buttons */}
            <View style={styles.filterActions}>
              <Button
                mode="contained"
                onPress={handleApplyFilter}
                style={styles.filterButton}
                loading={loading}
              >
                Apply Filter
              </Button>
              <Button
                mode="outlined"
                onPress={handleClearFilter}
                style={styles.filterButton}
              >
                Clear Filter
              </Button>
            </View>
          </Card.Content>
        </Card>

        {reportData.length === 0 ? (
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
        ) : (
          reportData.map((report, index) => (
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
                <Card.Content>
                  <Divider style={styles.divider} />

                  {/* Session Summary */}
                  <View style={styles.sessionSummary}>
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Total Items</Text>
                        <Text style={styles.summaryValue}>{report.session.total_items}</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Counted</Text>
                        <Text style={styles.summaryValue}>{report.session.counted_items}</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Discrepancies</Text>
                        <Text style={styles.summaryValue}>{report.session.discrepancy_count}</Text>
                      </View>
                    </View>
                    <View style={styles.valueSummary}>
                      <Text style={styles.valueLabel}>Total Discrepancy Value:</Text>
                      <Text style={[
                        styles.valueAmount,
                        { color: report.session.total_discrepancy_value >= 0 ? '#4CAF50' : '#F44336' }
                      ]}>
                        ₱{report.session.total_discrepancy_value.toFixed(2)}
                      </Text>
                    </View>

                    {/* Session Timeline */}
                    <View style={styles.timelineSection}>
                      <Text style={styles.timelineTitle}>Session Timeline</Text>
                      <Text style={styles.timelineItem}>
                        📅 Started: {formatDateTime(report.session.started_at)} by {report.session.started_by_name}
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

                      {report.details.map((detail, detailIndex) => (
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
                            <View>
                              <Text style={styles.userName}>
                                {detail.counted_by_name || 'Not counted'}
                              </Text>
                              {detail.counted_at && (
                                <Text style={styles.countTime}>
                                  {formatDateTime(detail.counted_at)}
                                </Text>
                              )}
                            </View>
                          </DataTable.Cell>
                        </DataTable.Row>
                      ))}
                    </DataTable>
                  ) : (
                    <View style={styles.noDetailsContainer}>
                      <Text style={styles.noDetailsText}>No count details available for this session</Text>
                    </View>
                  )}
                </Card.Content>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    marginBottom: 16,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  refreshButton: {
    alignSelf: 'flex-start',
  },
  filterCard: {
    marginBottom: 16,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  quickFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  quickFilterButton: {
    marginRight: 8,
    marginBottom: 8,
  },
  dateInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  dateInput: {
    flex: 1,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
  },
  filterButton: {
    flex: 1,
  },
  emptyCard: {
    marginTop: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  sessionCard: {
    marginBottom: 12,
    elevation: 2,
  },
  sessionStatus: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusChip: {
    width: 80,
  },
  statusChipText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
  },
  sessionSummary: {
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  valueSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  valueLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  valueAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timelineSection: {
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  timelineItem: {
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.8,
  },
  notesSection: {
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dataTable: {
    backgroundColor: 'white',
  },
  productColumn: {
    flex: 3,
  },
  numberColumn: {
    flex: 1,
  },
  userColumn: {
    flex: 2,
  },
  productName: {
    fontSize: 12,
    fontWeight: '500',
  },
  productCode: {
    fontSize: 10,
    opacity: 0.6,
  },
  discrepancyText: {
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 11,
    fontWeight: '500',
  },
  countTime: {
    fontSize: 9,
    opacity: 0.6,
  },
  noDetailsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noDetailsText: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
  },
});