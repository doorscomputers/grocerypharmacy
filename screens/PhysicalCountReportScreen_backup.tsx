import React, { useState, useEffect } from 'react';
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
  TextInput,
  Portal,
  Dialog,
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
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async (filterStartDate?: string, filterEndDate?: string) => {
    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();

      // Debug logging
      const actualStartDate = filterStartDate || startDate || undefined;
      const actualEndDate = filterEndDate || endDate || undefined;
      console.log('🔍 PhysicalCountReport Debug:');
      console.log('  Start Date:', actualStartDate);
      console.log('  End Date:', actualEndDate);

      const rawData = await dbService.getPhysicalCountReport(
        undefined, // sessionId
        actualStartDate,
        actualEndDate
      );

      console.log('  Raw Data Count:', rawData.length);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
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

  const generateReportPreview = async () => {
    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
      const rawData = await dbService.getPhysicalCountReport();

      // Analyze the report structure
      const analysis = {
        totalSessions: new Set(),
        totalUsers: new Set(),
        sessionsPerUser: {} as { [key: string]: number },
        itemsPerUser: {} as { [key: string]: number },
        itemsPerSession: {} as { [key: string]: number },
        timelineData: [] as any[],
        organizationStructure: {} as any
      };

      rawData.forEach((row: any) => {
        // Track sessions and users
        analysis.totalSessions.add(row.session_id);
        if (row.started_by_name) analysis.totalUsers.add(row.started_by_name);
        if (row.counted_by_name) analysis.totalUsers.add(row.counted_by_name);

        // Count sessions per user
        if (row.started_by_name) {
          analysis.sessionsPerUser[row.started_by_name] = (analysis.sessionsPerUser[row.started_by_name] || 0) + 1;
        }

        // Count items per user (who counted them)
        if (row.counted_by_name && row.product_code) {
          analysis.itemsPerUser[row.counted_by_name] = (analysis.itemsPerUser[row.counted_by_name] || 0) + 1;
        }

        // Count items per session
        if (row.product_code) {
          analysis.itemsPerSession[row.session_id] = (analysis.itemsPerSession[row.session_id] || 0) + 1;
        }

        // Timeline data
        if (row.started_at) {
          analysis.timelineData.push({
            type: 'session_start',
            session: row.session_id,
            user: row.started_by_name,
            date: row.started_at,
            details: `Started session ${row.session_id}`
          });
        }

        if (row.counted_at && row.product_code) {
          analysis.timelineData.push({
            type: 'item_count',
            session: row.session_id,
            user: row.counted_by_name,
            date: row.counted_at,
            details: `Counted ${row.product_name} (${row.product_code})`
          });
        }
      });

      // Sort timeline by date
      analysis.timelineData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Create organization structure summary
      analysis.organizationStructure = {
        reportType: 'Physical Inventory Count Report',
        primaryGrouping: 'By Count Session',
        secondaryGrouping: 'By Product Items within Session',
        userTracking: {
          sessionLevel: 'Who started/completed each session',
          itemLevel: 'Who counted each individual product'
        },
        dataHierarchy: [
          '1. Count Session (session_id, date, status)',
          '2. Session Summary (total items, counted items, discrepancies)',
          '3. Session Users (started_by, completed_by)',
          '4. Product Details (per item in session)',
          '5. Item Count Info (who counted, when counted)'
        ]
      };

      setPreviewData({
        ...analysis,
        totalSessions: analysis.totalSessions.size,
        totalUsers: analysis.totalUsers.size,
        sampleData: rawData.slice(0, 5) // First 5 rows for inspection
      });
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      Alert.alert('Error', 'Failed to generate report preview');
    } finally {
      setLoading(false);
    }
  };

  const debugCurrentData = async () => {
    try {
      const dbService = DatabaseService.getInstance();

      // Run our debug data integrity check first
      await dbService.debugPhysicalCountData();

      // Get all sessions without filtering
      const allData = await dbService.getPhysicalCountReport();

      console.log('🚨 DEBUG: All Physical Count Data');
      console.log('Total records:', allData.length);

      // Group by session to see all sessions
      const sessions = new Set();
      allData.forEach(row => sessions.add(row.session_id));

      console.log('Unique sessions:', Array.from(sessions));

      // Show sample dates to understand format
      const sampleDates = allData.slice(0, 5).map(row => ({
        session: row.session_id,
        date: row.date,
        dateType: typeof row.date,
        product_code: row.product_code
      }));

      console.log('Sample dates & data:', sampleDates);

      // Check for sessions with details vs without
      const sessionsWithDetails = allData.filter(row => row.product_code).length;
      const sessionsWithoutDetails = allData.filter(row => !row.product_code).length;

      console.log('Records with product details:', sessionsWithDetails);
      console.log('Records without product details:', sessionsWithoutDetails);

      Alert.alert(
        'Debug Info',
        `Found ${allData.length} records across ${sessions.size} sessions.\n\nWith details: ${sessionsWithDetails}\nWithout details: ${sessionsWithoutDetails}\n\nCheck console for details.`
      );
    } catch (error) {
      console.error('Debug error:', error);
      Alert.alert('Debug Error', 'Failed to fetch debug data');
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
              mode="contained"
              onPress={generateReportPreview}
              style={styles.previewButton}
              loading={loading}
              icon="eye"
            >
              Preview Report Structure
            </Button>
            <Button
              mode="outlined"
              onPress={() => loadReportData()}
              style={styles.refreshButton}
              loading={loading}
            >
              Refresh
            </Button>
          </View>
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
        getItemLayout={(data, index) => ({
          length: expandedSession ? 800 : 120,
          offset: (expandedSession ? 800 : 120) * index,
          index,
        })}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
      />
    </SafeAreaView>
  );
}
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

      {/* Report Preview Dialog */}
      {showPreview && previewData && (
        <Portal>
          <Dialog visible={showPreview} onDismiss={() => setShowPreview(false)} style={styles.previewDialog}>
            <Dialog.Title>📊 Physical Count Report Preview & Analysis</Dialog.Title>
            <Dialog.ScrollArea>
              <ScrollView style={styles.previewContent}>

                {/* Report Organization Structure */}
                <Card style={styles.previewSection}>
                  <Card.Content>
                    <Title style={styles.previewSectionTitle}>🏗️ Report Organization Structure</Title>
                    <Text style={styles.organizationTitle}>Report Type: {previewData.organizationStructure.reportType}</Text>

                    <View style={styles.organizationInfo}>
                      <Text style={styles.organizationLabel}>📋 Primary Grouping:</Text>
                      <Text style={styles.organizationValue}>{previewData.organizationStructure.primaryGrouping}</Text>
                    </View>

                    <View style={styles.organizationInfo}>
                      <Text style={styles.organizationLabel}>📦 Secondary Grouping:</Text>
                      <Text style={styles.organizationValue}>{previewData.organizationStructure.secondaryGrouping}</Text>
                    </View>

                    <Text style={styles.hierarchyTitle}>Data Hierarchy:</Text>
                    {previewData.organizationStructure.dataHierarchy.map((level: string, index: number) => (
                      <Text key={index} style={styles.hierarchyItem}>{level}</Text>
                    ))}
                  </Card.Content>
                </Card>

                {/* Summary Statistics */}
                <Card style={styles.previewSection}>
                  <Card.Content>
                    <Title style={styles.previewSectionTitle}>📈 Report Summary Statistics</Title>
                    <View style={styles.statsGrid}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{previewData.totalSessions}</Text>
                        <Text style={styles.statLabel}>Total Count Sessions</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{previewData.totalUsers}</Text>
                        <Text style={styles.statLabel}>Unique Users Involved</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{Object.keys(previewData.itemsPerSession).length}</Text>
                        <Text style={styles.statLabel}>Sessions with Items</Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>

                {/* User Activity Analysis */}
                <Card style={styles.previewSection}>
                  <Card.Content>
                    <Title style={styles.previewSectionTitle}>👥 User Activity Analysis</Title>

                    <Text style={styles.analysisSubtitle}>Sessions Started by User:</Text>
                    {Object.entries(previewData.sessionsPerUser).map(([user, count]: [string, any]) => (
                      <View key={user} style={styles.userActivityRow}>
                        <Text style={styles.previewUserName}>👤 {user}</Text>
                        <Text style={styles.userCount}>{count} session(s)</Text>
                      </View>
                    ))}

                    <Text style={styles.analysisSubtitle}>Items Counted by User:</Text>
                    {Object.entries(previewData.itemsPerUser).map(([user, count]: [string, any]) => (
                      <View key={user} style={styles.userActivityRow}>
                        <Text style={styles.previewUserName}>🔢 {user}</Text>
                        <Text style={styles.userCount}>{count} item(s)</Text>
                      </View>
                    ))}
                  </Card.Content>
                </Card>

                {/* User Tracking Explanation */}
                <Card style={styles.previewSection}>
                  <Card.Content>
                    <Title style={styles.previewSectionTitle}>🔍 User Tracking Details</Title>
                    <View style={styles.trackingInfo}>
                      <Text style={styles.trackingTitle}>Session Level Tracking:</Text>
                      <Text style={styles.trackingDetail}>• Who started each count session</Text>
                      <Text style={styles.trackingDetail}>• Who completed each count session</Text>
                      <Text style={styles.trackingDetail}>• Start and completion timestamps</Text>
                    </View>

                    <View style={styles.trackingInfo}>
                      <Text style={styles.trackingTitle}>Item Level Tracking:</Text>
                      <Text style={styles.trackingDetail}>• Who counted each individual product</Text>
                      <Text style={styles.trackingDetail}>• When each product was counted</Text>
                      <Text style={styles.trackingDetail}>• Individual product discrepancies</Text>
                    </View>
                  </Card.Content>
                </Card>

                {/* Recent Activity Timeline */}
                <Card style={styles.previewSection}>
                  <Card.Content>
                    <Title style={styles.previewSectionTitle}>⏰ Recent Activity Timeline (Last 10 Actions)</Title>
                    {previewData.timelineData.slice(-10).map((activity: any, index: number) => (
                      <View key={index} style={styles.timelineItem}>
                        <Text style={styles.timelineDate}>
                          {formatDateTime(activity.date)}
                        </Text>
                        <Text style={styles.timelineUser}>👤 {activity.user}</Text>
                        <Text style={styles.timelineDetails}>{activity.details}</Text>
                      </View>
                    ))}
                  </Card.Content>
                </Card>

                {/* Sample Data Inspection */}
                <Card style={styles.previewSection}>
                  <Card.Content>
                    <Title style={styles.previewSectionTitle}>🔬 Sample Raw Data (First 3 Records)</Title>
                    {previewData.sampleData.slice(0, 3).map((sample: any, index: number) => (
                      <View key={index} style={styles.sampleDataItem}>
                        <Text style={styles.sampleDataTitle}>Record #{index + 1}:</Text>
                        <Text style={styles.sampleDataField}>Session: {sample.session_id}</Text>
                        <Text style={styles.sampleDataField}>Started by: {sample.started_by_name}</Text>
                        <Text style={styles.sampleDataField}>Product: {sample.product_name || 'N/A'}</Text>
                        <Text style={styles.sampleDataField}>Counted by: {sample.counted_by_name || 'N/A'}</Text>
                      </View>
                    ))}
                  </Card.Content>
                </Card>

              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button onPress={() => setShowPreview(false)}>Close Preview</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
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
  // Preview Dialog Styles
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  previewButton: {
    flex: 1,
  },
  debugButtonContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  previewDialog: {
    maxHeight: '90%',
  },
  previewContent: {
    paddingHorizontal: 16,
  },
  previewSection: {
    marginBottom: 16,
    elevation: 2,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1976D2',
  },
  organizationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#4CAF50',
  },
  organizationInfo: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  organizationLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 120,
    color: '#666',
  },
  organizationValue: {
    fontSize: 12,
    flex: 1,
    color: '#333',
  },
  hierarchyTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#333',
  },
  hierarchyItem: {
    fontSize: 11,
    marginLeft: 8,
    marginBottom: 4,
    color: '#555',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  statLabel: {
    fontSize: 10,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 4,
  },
  analysisSubtitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#333',
  },
  userActivityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    paddingVertical: 4,
  },
  previewUserName: {
    fontSize: 12,
    flex: 1,
  },
  userCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  trackingInfo: {
    marginBottom: 12,
  },
  trackingTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#333',
  },
  trackingDetail: {
    fontSize: 11,
    marginLeft: 8,
    marginBottom: 2,
    color: '#555',
  },
  timelineActivity: {
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  timelineDate: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
  },
  timelineUser: {
    fontSize: 11,
    color: '#1976D2',
    marginTop: 2,
  },
  timelineDetails: {
    fontSize: 11,
    color: '#333',
    marginTop: 2,
  },
  sampleDataItem: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  sampleDataTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#E65100',
  },
  sampleDataField: {
    fontSize: 10,
    marginBottom: 2,
    color: '#333',
  },
});