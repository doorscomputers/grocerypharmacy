import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  Chip,
  SegmentedButtons,
  DataTable,
  Divider,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPrinterDate, formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type UpcomingPDCReportScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'UpcomingPDCReport'
>;

type Props = {
  navigation: UpcomingPDCReportScreenNavigationProp;
};

type PeriodFilter = '7days' | '14days' | '30days' | 'all';

interface PDCItem {
  id: number;
  cheque_number: string;
  bank_name: string;
  amount: number;
  cheque_date: string;
  payee_name: string;
  supplier_name: string;
  supplier_id: number;
  payment_date: string;
  days_until_due: number;
}

interface PeriodSummary {
  thisWeek: { count: number; amount: number };
  nextWeek: { count: number; amount: number };
  thisMonth: { count: number; amount: number };
  beyond: { count: number; amount: number };
}

export default function UpcomingPDCReportScreen({ navigation }: Props) {
  const [pdcs, setPdcs] = useState<PDCItem[]>([]);
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary>({
    thisWeek: { count: 0, amount: 0 },
    nextWeek: { count: 0, amount: 0 },
    thisMonth: { count: 0, amount: 0 },
    beyond: { count: 0, amount: 0 },
  });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30days');
  const [loading, setLoading] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<any>({});

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  useEffect(() => {
    loadData();
    loadBusinessInfo();
  }, [periodFilter]);

  const loadBusinessInfo = async () => {
    try {
      const dbService = getDatabase();
      const [businessName, address, tin, phone] = await Promise.all([
        dbService.getSetting('business_name'),
        dbService.getSetting('business_address'),
        dbService.getSetting('business_tin'),
        dbService.getSetting('business_phone'),
      ]);
      setBusinessInfo({
        businessName: businessName || 'My Business',
        address: address || '',
        tin: tin || '',
        phone: phone || '',
      });
    } catch (error) {
      console.error('Error loading business info:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      // Get days ahead based on filter
      let daysAhead: number | undefined;
      switch (periodFilter) {
        case '7days': daysAhead = 7; break;
        case '14days': daysAhead = 14; break;
        case '30days': daysAhead = 30; break;
        default: daysAhead = undefined; // All pending
      }

      const [pdcsData, summaryData] = await Promise.all([
        dbService.getUpcomingPDCs({ daysAhead }),
        dbService.getPDCSummaryByPeriod(),
      ]);

      setPdcs(pdcsData);
      // Map DB result to screen's PeriodSummary shape
      // DB returns: overdue, thisWeek, nextWeek, thisMonth, total
      // Screen expects: thisWeek, nextWeek, thisMonth, beyond
      const beyondCount = (summaryData.total?.count || 0) - (summaryData.overdue?.count || 0) - (summaryData.thisWeek?.count || 0) - (summaryData.nextWeek?.count || 0) - (summaryData.thisMonth?.count || 0);
      const beyondAmount = (summaryData.total?.amount || 0) - (summaryData.overdue?.amount || 0) - (summaryData.thisWeek?.amount || 0) - (summaryData.nextWeek?.amount || 0) - (summaryData.thisMonth?.amount || 0);
      setPeriodSummary({
        thisWeek: summaryData.thisWeek || { count: 0, amount: 0 },
        nextWeek: summaryData.nextWeek || { count: 0, amount: 0 },
        thisMonth: summaryData.thisMonth || { count: 0, amount: 0 },
        beyond: { count: Math.max(0, beyondCount), amount: Math.max(0, beyondAmount) },
      });
    } catch (error) {
      console.error('Error loading PDC data:', error);
      Alert.alert('Error', 'Failed to load PDC data');
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return '#F44336'; // Overdue - Red
    if (daysUntilDue <= 3) return '#FF5722'; // Urgent - Deep Orange
    if (daysUntilDue <= 7) return '#FF9800'; // Soon - Orange
    if (daysUntilDue <= 14) return '#FFC107'; // Upcoming - Amber
    return '#4CAF50'; // Safe - Green
  };

  const getUrgencyLabel = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}d overdue`;
    if (daysUntilDue === 0) return 'Due Today';
    if (daysUntilDue === 1) return 'Tomorrow';
    return `${daysUntilDue} days`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  };

  const getTotalAmount = () => {
    return pdcs.reduce((sum, pdc) => sum + pdc.amount, 0);
  };

  // Build thermal print data for ReportActionsBar
  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);

    const now = new Date();
    const filterLabel = periodFilter === 'all' ? 'All Pending' :
      periodFilter === '7days' ? 'Next 7 Days' :
      periodFilter === '14days' ? 'Next 14 Days' : 'Next 30 Days';

    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('UPCOMING PDC')
      .println('REPORT')
      .normalSize()
      .bold(false)
      .feed()
      .println(formatPrinterDateTime(now))
      .println(`Period: ${filterLabel}`)
      .doubleSeparator()
      .align('left');

    // Summary section
    const pc = (v: number) => `P${(v || 0).toFixed(2)}`;
    builder
      .bold(true)
      .println('FUNDING SUMMARY')
      .bold(false)
      .separator()
      .leftRight('This Week:', `${pc(periodSummary.thisWeek.amount)} (${periodSummary.thisWeek.count})`)
      .leftRight('Next Week:', `${pc(periodSummary.nextWeek.amount)} (${periodSummary.nextWeek.count})`)
      .leftRight('This Month:', `${pc(periodSummary.thisMonth.amount)} (${periodSummary.thisMonth.count})`);
    if (periodSummary.beyond.count > 0) {
      builder.leftRight('Beyond:', `${pc(periodSummary.beyond.amount)} (${periodSummary.beyond.count})`);
    }
    builder.separator();

    // PDC list
    builder.bold(true).println('PENDING CHEQUES').bold(false).separator();

    pdcs.forEach((pdc) => {
      builder
        .bold(true)
        .println(pdc.cheque_number)
        .bold(false)
        .leftRight(`  ${pdc.bank_name}`, pc(pdc.amount))
        .println(`  ${pdc.supplier_name}`)
        .println(`  Due: ${formatDate(pdc.cheque_date)}`);
    });

    builder.doubleSeparator();
    builder.bold(true).leftRight('TOTAL:', pc(getTotalAmount())).bold(false);

    builder
      .feed()
      .align('center')
      .separator()
      .println('*** END OF REPORT ***')
      .feed(2)
      .cut();

    return builder;
  };

  // Build PDF HTML for ReportActionsBar
  const buildPdfHtml = (): string => {
    const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    const filterLabel = periodFilter === 'all' ? 'All Pending' :
      periodFilter === '7days' ? 'Next 7 Days' :
      periodFilter === '14days' ? 'Next 14 Days' : 'Next 30 Days';

    return `
      <html><head><style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .business-name { font-size: 24px; font-weight: bold; }
        .report-title { font-size: 18px; font-weight: bold; margin-top: 20px; color: #333; }
        .meta-info { font-size: 12px; color: #666; margin: 10px 0; }
        .summary-cards { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
        .summary-card { flex: 1; min-width: 120px; padding: 15px; border-radius: 8px; text-align: center; }
        .card-label { font-size: 11px; color: #666; }
        .card-amount { font-size: 16px; font-weight: bold; margin: 5px 0; }
        .card-count { font-size: 11px; color: #888; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .amount { text-align: right; }
        .urgency-badge { padding: 3px 8px; border-radius: 12px; color: white; font-size: 10px; }
        .overdue { background-color: #F44336; }
        .urgent { background-color: #FF5722; }
        .soon { background-color: #FF9800; }
        .upcoming { background-color: #FFC107; color: #333; }
        .safe { background-color: #4CAF50; }
        .total-row { font-weight: bold; background-color: #f0f0f0; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #888; }
      </style></head><body>
        <div class="header">
          <div class="business-name">${businessInfo.businessName || 'Business Name'}</div>
          <div>${businessInfo.address || ''}</div>
          <div>${businessInfo.phone || ''}</div>
          <div class="report-title">UPCOMING PDC REPORT</div>
          <div class="meta-info">Period: ${filterLabel} | Generated: ${now}</div>
        </div>
        <div class="summary-cards">
          <div class="summary-card" style="background-color: #FFEBEE;">
            <div class="card-label">This Week</div>
            <div class="card-amount" style="color: #F44336;">₱${periodSummary.thisWeek.amount.toLocaleString()}</div>
            <div class="card-count">${periodSummary.thisWeek.count} cheques</div>
          </div>
          <div class="summary-card" style="background-color: #FFF3E0;">
            <div class="card-label">Next Week</div>
            <div class="card-amount" style="color: #FF9800;">₱${periodSummary.nextWeek.amount.toLocaleString()}</div>
            <div class="card-count">${periodSummary.nextWeek.count} cheques</div>
          </div>
          <div class="summary-card" style="background-color: #E3F2FD;">
            <div class="card-label">This Month</div>
            <div class="card-amount" style="color: #2196F3;">₱${periodSummary.thisMonth.amount.toLocaleString()}</div>
            <div class="card-count">${periodSummary.thisMonth.count} cheques</div>
          </div>
          <div class="summary-card" style="background-color: #E8F5E9;">
            <div class="card-label">Beyond</div>
            <div class="card-amount" style="color: #4CAF50;">₱${periodSummary.beyond.amount.toLocaleString()}</div>
            <div class="card-count">${periodSummary.beyond.count} cheques</div>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>Cheque #</th><th>Bank</th><th>Supplier</th><th>Due Date</th><th>Status</th><th class="amount">Amount</th>
          </tr></thead>
          <tbody>
            ${pdcs.map((pdc, index) => {
              const urgencyClass = pdc.days_until_due < 0 ? 'overdue' :
                pdc.days_until_due <= 3 ? 'urgent' :
                pdc.days_until_due <= 7 ? 'soon' :
                pdc.days_until_due <= 14 ? 'upcoming' : 'safe';
              return `<tr>
                <td>${index + 1}</td><td>${pdc.cheque_number}</td><td>${pdc.bank_name}</td>
                <td>${pdc.supplier_name}</td><td>${formatDate(pdc.cheque_date)}</td>
                <td><span class="urgency-badge ${urgencyClass}">${getUrgencyLabel(pdc.days_until_due)}</span></td>
                <td class="amount">₱${pdc.amount.toLocaleString()}</td>
              </tr>`;
            }).join('')}
            <tr class="total-row"><td colspan="6">TOTAL FUNDING REQUIRED</td><td class="amount">₱${getTotalAmount().toLocaleString()}</td></tr>
          </tbody>
        </table>
        <div class="footer">
          <p>This report shows all pending post-dated cheques that need to be funded.</p>
          <p>Generated on ${now}</p>
        </div>
      </body></html>
    `;
  };

  const renderPDCCard = ({ item, index }: { item: PDCItem; index: number }) => {
    const urgencyColor = getUrgencyColor(item.days_until_due);

    return (
      <Card style={[styles.pdcCard, { borderLeftColor: urgencyColor, borderLeftWidth: 4 }]}>
        <Card.Content>
          <View style={styles.pdcHeader}>
            <View style={styles.pdcInfo}>
              <Title style={styles.chequeNumber}>{item.cheque_number}</Title>
              <Paragraph style={styles.bankName}>{item.bank_name}</Paragraph>
              <Paragraph style={styles.supplierName}>{item.supplier_name}</Paragraph>
            </View>
            <View style={styles.pdcDetails}>
              <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
                <Paragraph style={styles.urgencyText}>{getUrgencyLabel(item.days_until_due)}</Paragraph>
              </View>
              <Paragraph style={styles.pdcAmount}>{formatCurrency(item.amount)}</Paragraph>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.pdcDetailsRow}>
            <View style={styles.detailItem}>
              <Paragraph style={styles.detailLabel}>Cheque Date</Paragraph>
              <Paragraph style={styles.detailValue}>{formatDate(item.cheque_date)}</Paragraph>
            </View>
            <View style={styles.detailItem}>
              <Paragraph style={styles.detailLabel}>Payee</Paragraph>
              <Paragraph style={styles.detailValue}>{item.payee_name || item.supplier_name}</Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { padding: lo.screenPadding }]}>
        <Title style={[styles.headerTitle, { fontSize: fs.h2 }]}>Upcoming PDC Report</Title>
        <Paragraph style={styles.headerSubtitle}>
          Monitor post-dated cheques for funding
        </Paragraph>
      </View>

      {/* Period Filter */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={periodFilter}
          onValueChange={(value) => setPeriodFilter(value as PeriodFilter)}
          buttons={[
            { value: '7days', label: '7 Days' },
            { value: '14days', label: '14 Days' },
            { value: '30days', label: '30 Days' },
            { value: 'all', label: 'All' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Summary Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryContainer}>
        <Card style={[styles.summaryCard, { backgroundColor: '#FFEBEE' }]}>
          <Card.Content>
            <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>This Week</Paragraph>
            <Title style={[styles.summaryAmount, { color: '#F44336' }]}>
              {formatCurrency(periodSummary.thisWeek.amount)}
            </Title>
            <Paragraph style={styles.summaryCount}>{periodSummary.thisWeek.count} cheques</Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.summaryCard, { backgroundColor: '#FFF3E0' }]}>
          <Card.Content>
            <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Next Week</Paragraph>
            <Title style={[styles.summaryAmount, { color: '#FF9800' }]}>
              {formatCurrency(periodSummary.nextWeek.amount)}
            </Title>
            <Paragraph style={styles.summaryCount}>{periodSummary.nextWeek.count} cheques</Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
          <Card.Content>
            <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>This Month</Paragraph>
            <Title style={[styles.summaryAmount, { color: '#2196F3' }]}>
              {formatCurrency(periodSummary.thisMonth.amount)}
            </Title>
            <Paragraph style={styles.summaryCount}>{periodSummary.thisMonth.count} cheques</Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
          <Card.Content>
            <Paragraph style={[styles.summaryLabel, { fontSize: fs.caption }]}>Beyond</Paragraph>
            <Title style={[styles.summaryAmount, { color: '#4CAF50' }]}>
              {formatCurrency(periodSummary.beyond.amount)}
            </Title>
            <Paragraph style={styles.summaryCount}>{periodSummary.beyond.count} cheques</Paragraph>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Total Funding Required */}
      <Card style={styles.totalCard}>
        <Card.Content style={styles.totalContent}>
          <View>
            <Paragraph style={styles.totalLabel}>Total Funding Required</Paragraph>
            <Paragraph style={styles.totalCount}>{pdcs.length} pending cheques</Paragraph>
          </View>
          <Title style={styles.totalAmount}>{formatCurrency(getTotalAmount())}</Title>
        </Card.Content>
      </Card>

      {/* Actions Bar */}
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Upcoming PDC Report"
        reportFileName={`upcoming-pdc-${Date.now()}`}
        emailBody={`Please find attached the Upcoming PDC Report.\n\nTotal: ${formatCurrency(getTotalAmount())} (${pdcs.length} cheques)\n\n---\nGenerated by IgoroTech POS`}
      />

      {/* PDC List */}
      <FlatList
        data={pdcs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPDCCard}
        contentContainerStyle={[styles.listContainer, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              No pending cheques found for this period.
            </Paragraph>
          </View>
        }
      />
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  segmentedButtons: {
    // Default styling
  },
  summaryContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
    maxHeight: 100,
  },
  summaryCard: {
    marginRight: 12,
    minWidth: 130,
  },
  summaryLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryCount: {
    fontSize: 10,
    opacity: 0.6,
  },
  totalCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1E88E5',
  },
  totalContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
  },
  totalCount: {
    fontSize: 11,
    color: 'white',
    opacity: 0.7,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  pdcCard: {
    marginBottom: 12,
    elevation: 3,
  },
  pdcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pdcInfo: {
    flex: 1,
  },
  chequeNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  bankName: {
    fontSize: 13,
    color: '#2196F3',
    marginBottom: 2,
  },
  supplierName: {
    fontSize: 12,
    opacity: 0.7,
  },
  pdcDetails: {
    alignItems: 'flex-end',
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  urgencyText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  pdcAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  divider: {
    marginVertical: 10,
  },
  pdcDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    opacity: 0.6,
  },
  detailValue: {
    fontSize: 12,
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
});
