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
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { toLocalDateString, formatPrinterDate, formatPrinterDateTime, formatPhilippineDate } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

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

  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  useEffect(() => {
    loadData();
    loadCompanySettings();
  }, [dateRange]);

  const loadCompanySettings = async () => {
    try {
      const dbService = getDatabase();
      const name = await dbService.getSetting('company_name') || 'IgoroTech POS';
      const address = await dbService.getSetting('company_address') || '';
      const tin = await dbService.getSetting('company_tin') || '';
      setCompanySettings({ name, address, tin });
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

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
      const dateFrom = toLocalDateString(dateRange.startDate);
      const dateTo = toLocalDateString(dateRange.endDate);

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

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('DAMAGED ITEMS')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .println(formatPrinterDate(now))
      .println(formatPrinterDateTime(now).split(' ').slice(3).join(' '))
      .println(`Period: ${formatPrinterDate(dateRange.startDate)}`)
      .println(`to ${formatPrinterDate(dateRange.endDate)}`)
      .doubleSeparator();

    // Summary
    builder
      .align('left')
      .bold(true)
      .println('SUMMARY')
      .bold(false)
      .separator()
      .leftRight('Total Sessions:', (damageReports?.overallTotals?.total_sessions || 0).toString())
      .leftRight('Total Items:', (damageReports?.overallTotals?.total_items || 0).toString())
      .leftRight('Total Quantity:', (damageReports?.overallTotals?.total_quantity || 0).toString())
      .bold(true)
      .leftRight('Total Value:', `P${(damageReports?.overallTotals?.total_value || 0).toFixed(2)}`)
      .bold(false)
      .doubleSeparator();

    // By Reason
    if (damageReports?.reasonSummary?.length > 0) {
      builder
        .bold(true)
        .println('BY REASON')
        .bold(false)
        .separator();

      damageReports.reasonSummary.forEach((item: any) => {
        builder.leftRight(
          `${item.damage_reason} (${item.item_count})`,
          `P${(item.total_value || 0).toFixed(2)}`
        );
      });
      builder.separator();
    }

    // Top Products
    if (damageReports?.productSummary?.length > 0) {
      builder
        .bold(true)
        .println('TOP DAMAGED PRODUCTS')
        .bold(false)
        .separator();

      damageReports.productSummary.slice(0, 10).forEach((item: any, index: number) => {
        const name = item.product_name.length > printerWidth - 5
          ? item.product_name.substring(0, printerWidth - 7) + '..'
          : item.product_name;
        builder.println(`${index + 1}. ${name}`);
        builder.leftRight(`  Qty: ${item.total_quantity}`, `P${(item.total_value || 0).toFixed(2)}`);
      });
      builder.separator();
    }

    // Sessions List
    if (damageSessions.length > 0) {
      builder
        .bold(true)
        .println('SESSIONS')
        .bold(false)
        .separator();

      damageSessions.slice(0, 15).forEach((session: any) => {
        builder
          .println(session.session_id)
          .leftRight(`  ${formatPrinterDate(session.started_at)}`, `${session.status}`)
          .leftRight(`  Items: ${session.total_items}`, `P${(session.total_value || 0).toFixed(2)}`);
      });

      if (damageSessions.length > 15) {
        builder.println(`... and ${damageSessions.length - 15} more`);
      }
    }

    // Footer
    builder
      .feed()
      .align('center')
      .println('*** END OF REPORT ***')
      .println(formatPrinterDateTime(now))
      .feed(2)
      .cut();

    return builder;
  };

  const buildPdfHtml = (): string => {
    const now = new Date();
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
          .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 16px; }
          .company-name { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
          .header-text { font-size: 11px; color: #666; }
          .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 16px 0; color: #F44336; }
          .date-range { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 12px 0; }
          .summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
          .summary-item { flex: 1; min-width: 120px; background: #f5f5f5; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-label { font-size: 11px; color: #666; margin-bottom: 4px; }
          .summary-value { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { background-color: #f5f5f5; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name || 'IgoroTech POS'}</div>
          ${companySettings.address ? `<div class="header-text">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="header-text">TIN: ${companySettings.tin}</div>` : ''}
        </div>

        <div class="report-title">DAMAGED ITEMS REPORT</div>
        <div class="date-range">Period: ${formatPhilippineDate(dateRange.startDate)} to ${formatPhilippineDate(dateRange.endDate)}</div>

        <div class="section-title">Summary</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total Sessions</div>
            <div class="summary-value">${damageReports?.overallTotals?.total_sessions || 0}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Items</div>
            <div class="summary-value">${damageReports?.overallTotals?.total_items || 0}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Quantity</div>
            <div class="summary-value">${damageReports?.overallTotals?.total_quantity || 0}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Value</div>
            <div class="summary-value" style="color: #F44336;">&#8369;${(damageReports?.overallTotals?.total_value || 0).toFixed(2)}</div>
          </div>
        </div>

        ${damageReports?.reasonSummary?.length > 0 ? `
          <div class="section-title">Damage by Reason</div>
          <table>
            <thead>
              <tr><th>Reason</th><th>Items</th><th>Quantity</th><th>Value</th></tr>
            </thead>
            <tbody>
              ${damageReports.reasonSummary.map((item: any) => `
                <tr>
                  <td>${item.damage_reason}</td>
                  <td>${item.item_count}</td>
                  <td>${item.total_quantity}</td>
                  <td>&#8369;${(item.total_value || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${damageReports?.productSummary?.length > 0 ? `
          <div class="section-title">Top Damaged Products</div>
          <table>
            <thead>
              <tr><th>Product</th><th>Code</th><th>Count</th><th>Quantity</th><th>Value</th></tr>
            </thead>
            <tbody>
              ${damageReports.productSummary.map((item: any) => `
                <tr>
                  <td>${item.product_name}</td>
                  <td>${item.product_code || '-'}</td>
                  <td>${item.damage_count}</td>
                  <td>${item.total_quantity}</td>
                  <td>&#8369;${(item.total_value || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${damageSessions.length > 0 ? `
          <div class="section-title">Sessions (${damageSessions.length})</div>
          <table>
            <thead>
              <tr><th>Session ID</th><th>Name</th><th>Date</th><th>Status</th><th>Items</th><th>Value</th></tr>
            </thead>
            <tbody>
              ${damageSessions.map((session: any) => `
                <tr>
                  <td>${session.session_id}</td>
                  <td>${session.session_name || '-'}</td>
                  <td>${formatPhilippineDate(session.started_at)}</td>
                  <td>${session.status}</td>
                  <td>${session.total_items}</td>
                  <td>&#8369;${(session.total_value || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="text-align: center; color: #999;">No damage sessions found</p>'}

        <div class="footer">
          <p>Generated: ${now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          <p>IgoroTech POS - Damaged Items Report</p>
        </div>
      </body>
      </html>
    `;
  };

  const renderSession = ({ item }: { item: any }) => (
    <Card style={styles.sessionCard}>
      <Card.Content>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionInfo}>
            <Title style={styles.sessionId}>{item.session_id}</Title>
            <Paragraph style={styles.sessionName}>{item.session_name}</Paragraph>
            <Paragraph style={styles.sessionDate}>
              Started: {formatPhilippineDate(item.started_at)}
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
            Completed: {formatPhilippineDate(item.completed_at)} by {item.completed_by_name}
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
    <ScrollView contentContainerStyle={[styles.reportsContainer, { padding: lo.screenPadding }]}>
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
          <Title style={[styles.summaryTitle, { fontSize: fs.h3 }]}>Damage Summary</Title>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Sessions</Paragraph>
              <Paragraph style={styles.summaryValue}>
                {damageReports?.overallTotals?.total_sessions || 0}
              </Paragraph>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Items</Paragraph>
              <Paragraph style={styles.summaryValue}>
                {damageReports?.overallTotals?.total_items || 0}
              </Paragraph>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Quantity</Paragraph>
              <Paragraph style={styles.summaryValue}>
                {damageReports?.overallTotals?.total_quantity || 0}
              </Paragraph>
            </View>
            <View style={styles.summaryItem}>
              <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Total Value</Paragraph>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { padding: lo.screenPadding }]}>
        {/* Report Actions: Print, PDF, Email */}
        <ReportActionsBar
          onBuildPrintData={buildPrintReport}
          onBuildPdfHtml={buildPdfHtml}
          reportTitle="Damaged Items Report"
          reportFileName={`DamagedItems_${toLocalDateString(dateRange.startDate)}_to_${toLocalDateString(dateRange.endDate)}`}
        />

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
    </View>
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