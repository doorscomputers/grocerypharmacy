import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert, Share } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  DataTable,
  Divider,
  SegmentedButtons,
  ActivityIndicator,
  Text,
} from 'react-native-paper';

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPrinterDateTime } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'ESalesReport'>;
};

interface ESalesData {
  tin: string;
  branch: string;
  month: string;
  year: string;
  min: string;
  lastOR: string;
  vatableSales: number;
  vatZeroRatedSales: number;
  vatExemptSales: number;
  otherPercentageTaxSales: number;
}

export default function ESalesReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Generate year options (current year and 5 years back)
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Month options
  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [reportData, setReportData] = useState<ESalesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [companySettings, setCompanySettings] = useState({ name: '', address: '', tin: '' });

  const formatCurrency = (amount: number) =>
    `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  React.useEffect(() => {
    loadCompanySettings();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const dbService = getDatabase();
      const name = await dbService.getSetting('business_name') || 'IgoroTech POS';
      const address = await dbService.getSetting('business_address') || '';
      const tin = await dbService.getSetting('business_tin') || '';
      setCompanySettings({ name, address, tin });
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const data = await dbService.getESalesReportData(selectedYear, selectedMonth);
      setReportData(data);
    } catch (error) {
      console.error('Error loading eSales report:', error);
      Alert.alert('Error', 'Failed to load eSales report data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  const generateCSV = (data: ESalesData): string => {
    // CSV header row
    const header = 'TIN,Branch,Month,Year,MIN,Last OR,Vatable Sales,Vat Zero Rated Sales,Vat Exempt Sales,Sales Subject to Other Percentage Taxes';

    // Data row - format numbers with 2 decimal places
    const row = [
      data.tin,
      data.branch,
      data.month,
      data.year,
      data.min,
      data.lastOR,
      data.vatableSales.toFixed(2),
      data.vatZeroRatedSales.toFixed(2),
      data.vatExemptSales.toFixed(2),
      data.otherPercentageTaxSales.toFixed(2),
    ].join(',');

    return `${header}\n${row}`;
  };

  const exportToCSV = async () => {
    if (!reportData) {
      Alert.alert('No Data', 'Please generate the report first');
      return;
    }

    try {
      setExporting(true);
      const csv = generateCSV(reportData);
      const filename = `eSales_${reportData.year}_${reportData.month}.csv`;

      if (Platform.OS === 'web') {
        // Web: Create a blob and download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Success', `File downloaded as ${filename}`);
      } else {
        // Mobile: Save to file and share
        const filePath = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(filePath, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        // Check if sharing is available
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/csv',
            dialogTitle: 'Export eSales Report',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          // Fallback to native Share
          await Share.share({
            title: 'eSales Report',
            message: csv,
          });
        }
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export CSV file');
    } finally {
      setExporting(false);
    }
  };

  const getMonthLabel = (month: number) => {
    return monthOptions.find(m => m.value === month)?.label || '';
  };

  const buildPrintReport = (printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder(printerWidth);
    const now = new Date();

    // Header
    builder
      .align('center')
      .bold(true)
      .doubleSize()
      .println('E-SALES REPORT')
      .normalSize()
      .bold(false)
      .feed();

    // Period
    if (reportData) {
      builder
        .align('center')
        .println(`Period: ${getMonthLabel(parseInt(reportData.month))} ${reportData.year}`)
        .println(`Generated: ${formatPrinterDateTime(now)}`)
        .feed()
        .doubleSeparator()
        .align('left');

      // Business Information
      builder
        .bold(true)
        .println('BUSINESS INFORMATION')
        .bold(false)
        .leftRight('TIN:', reportData.tin || '-')
        .leftRight('Branch:', reportData.branch || '-')
        .leftRight('MIN:', reportData.min || '-')
        .leftRight('Last OR:', reportData.lastOR || '-')
        .separator();

      // Sales Summary
      builder
        .bold(true)
        .println('SALES SUMMARY')
        .bold(false)
        .separator();

      builder
        .leftRight('Vatable Sales:', `P${(reportData.vatableSales || 0).toFixed(2)}`)
        .leftRight('VAT Zero Rated:', `P${(reportData.vatZeroRatedSales || 0).toFixed(2)}`)
        .leftRight('VAT Exempt:', `P${(reportData.vatExemptSales || 0).toFixed(2)}`)
        .leftRight('Other % Tax:', `P${(reportData.otherPercentageTaxSales || 0).toFixed(2)}`);

      // Calculate total sales
      const totalSales = (reportData.vatableSales || 0) +
        (reportData.vatZeroRatedSales || 0) +
        (reportData.vatExemptSales || 0) +
        (reportData.otherPercentageTaxSales || 0);

      builder
        .doubleSeparator()
        .bold(true)
        .leftRight('TOTAL SALES:', `P${totalSales.toFixed(2)}`)
        .bold(false);

      // VAT Amount (12% of vatable sales)
      const vatAmount = (reportData.vatableSales || 0) * 0.12;
      builder
        .separator()
        .leftRight('VAT Amount (12%):', `P${vatAmount.toFixed(2)}`);
    } else {
      builder
        .align('center')
        .println('No report data available')
        .println('Please generate a report first');
    }

    // Footer
    builder
      .feed()
      .align('center')
      .separator()
      .println('*** BIR eSALES REPORT ***')
      .feed(2)
      .cut();

    return builder;
  };

  const buildPdfHtml = (): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    const timeStr = now.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour12: true });

    const totalSales = reportData ? (reportData.vatableSales || 0) +
      (reportData.vatZeroRatedSales || 0) +
      (reportData.vatExemptSales || 0) +
      (reportData.otherPercentageTaxSales || 0) : 0;
    const vatAmount = reportData ? (reportData.vatableSales || 0) * 0.12 : 0;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 18px; font-weight: bold; }
          .company-info { font-size: 11px; color: #666; }
          .report-title { font-size: 16px; font-weight: bold; margin: 15px 0; }
          .date-time { font-size: 11px; color: #666; }
          .section { margin: 15px 0; }
          .section-title { font-size: 13px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .highlight { background-color: #E3F2FD; }
          .total-row { background-color: #E8F5E9; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companySettings.name}</div>
          ${companySettings.address ? `<div class="company-info">${companySettings.address}</div>` : ''}
          ${companySettings.tin ? `<div class="company-info">TIN: ${companySettings.tin}</div>` : ''}
          <div class="report-title">BIR eSALES REPORT</div>
          <div class="date-time">Generated: ${dateStr} ${timeStr}</div>
          ${reportData ? `<div class="date-time">Period: ${getMonthLabel(parseInt(reportData.month))} ${reportData.year}</div>` : ''}
        </div>

        ${reportData ? `
          <div class="section">
            <div class="section-title">Business Information</div>
            <table>
              <tr><td style="width: 40%"><strong>TIN</strong></td><td>${reportData.tin || '-'}</td></tr>
              <tr><td><strong>Branch</strong></td><td>${reportData.branch || '-'}</td></tr>
              <tr><td><strong>MIN</strong></td><td>${reportData.min || '-'}</td></tr>
              <tr><td><strong>Last OR</strong></td><td>${reportData.lastOR || '-'}</td></tr>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Sales Summary</div>
            <table>
              <tr class="highlight"><td><strong>Vatable Sales</strong></td><td class="text-right">${formatCurrency(reportData.vatableSales)}</td></tr>
              <tr><td>VAT Zero Rated Sales</td><td class="text-right">${formatCurrency(reportData.vatZeroRatedSales)}</td></tr>
              <tr><td>VAT Exempt Sales</td><td class="text-right">${formatCurrency(reportData.vatExemptSales)}</td></tr>
              <tr><td>Other % Tax Sales</td><td class="text-right">${formatCurrency(reportData.otherPercentageTaxSales)}</td></tr>
              <tr class="total-row"><td><strong>TOTAL SALES</strong></td><td class="text-right">${formatCurrency(totalSales)}</td></tr>
              <tr><td>VAT Amount (12%)</td><td class="text-right">${formatCurrency(vatAmount)}</td></tr>
            </table>
          </div>
        ` : '<div class="section"><p>No report data available. Please generate a report first.</p></div>'}

        <div class="footer">
          Report generated on ${now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
        </div>
      </body>
      </html>
    `;
    return html;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReportActionsBar
        onBuildPrintData={buildPrintReport}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="eSales Report"
        reportFileName="ESalesReport"
        disabled={!reportData}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Filter Card */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Select Period</Title>

            {/* Year Selector */}
            <View style={styles.filterRow}>
              <Paragraph style={styles.filterLabel}>Year:</Paragraph>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <SegmentedButtons
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                  buttons={yearOptions.map(year => ({
                    value: year.toString(),
                    label: year.toString(),
                  }))}
                  style={styles.segmentedButtons}
                />
              </ScrollView>
            </View>

            {/* Month Selector */}
            <View style={styles.filterRow}>
              <Paragraph style={styles.filterLabel}>Month:</Paragraph>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <View style={styles.monthRow}>
                  {monthOptions.slice(0, 6).map(month => (
                    <Button
                      key={month.value}
                      mode={selectedMonth === month.value ? 'contained' : 'outlined'}
                      onPress={() => setSelectedMonth(month.value)}
                      compact
                      style={styles.monthButton}
                      labelStyle={styles.monthButtonLabel}
                    >
                      {month.label.substring(0, 3)}
                    </Button>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={styles.filterRow}>
              <Paragraph style={styles.filterLabel}></Paragraph>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <View style={styles.monthRow}>
                  {monthOptions.slice(6, 12).map(month => (
                    <Button
                      key={month.value}
                      mode={selectedMonth === month.value ? 'contained' : 'outlined'}
                      onPress={() => setSelectedMonth(month.value)}
                      compact
                      style={styles.monthButton}
                      labelStyle={styles.monthButtonLabel}
                    >
                      {month.label.substring(0, 3)}
                    </Button>
                  ))}
                </View>
              </ScrollView>
            </View>

            <Button
              mode="contained"
              onPress={loadReport}
              loading={loading}
              disabled={loading}
              style={styles.generateButton}
              icon="file-search"
            >
              Generate Report
            </Button>
          </Card.Content>
        </Card>

        {/* Loading Indicator */}
        {loading && (
          <Card style={styles.card}>
            <Card.Content style={styles.centerContent}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Paragraph style={styles.loadingText}>Loading report data...</Paragraph>
            </Card.Content>
          </Card>
        )}

        {/* Report Data */}
        {reportData && !loading && (
          <>
            <Card style={styles.card}>
              <Card.Content>
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>
                  eSales Report - {getMonthLabel(parseInt(reportData.month))} {reportData.year}
                </Title>

                <DataTable>
                  <DataTable.Row>
                    <DataTable.Cell style={styles.labelCell}>TIN</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.valueText}>{reportData.tin}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell style={styles.labelCell}>Branch</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.valueText}>{reportData.branch}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell style={styles.labelCell}>Month</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.valueText}>{reportData.month}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell style={styles.labelCell}>Year</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.valueText}>{reportData.year}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell style={styles.labelCell}>MIN</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.valueText}>{reportData.min || '-'}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell style={styles.labelCell}>Last OR</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.valueText}>{reportData.lastOR || '-'}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>

                  <Divider style={styles.tableDivider} />

                  <DataTable.Row style={styles.highlightRow}>
                    <DataTable.Cell style={styles.labelCell}>Vatable Sales</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.amountText}>{formatCurrency(reportData.vatableSales)}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell style={styles.labelCell}>VAT Zero Rated Sales</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.amountText}>{formatCurrency(reportData.vatZeroRatedSales)}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell style={styles.labelCell}>VAT Exempt Sales</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.amountText}>{formatCurrency(reportData.vatExemptSales)}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell style={styles.labelCell}>Other % Tax Sales</DataTable.Cell>
                    <DataTable.Cell style={styles.valueCell}>
                      <Text style={styles.amountText}>{formatCurrency(reportData.otherPercentageTaxSales)}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                </DataTable>
              </Card.Content>
            </Card>

            {/* Export Button */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Export</Title>
                <Paragraph style={styles.exportNote}>
                  Export the report as CSV file for BIR eSales submission.
                </Paragraph>
                <Button
                  mode="contained"
                  onPress={exportToCSV}
                  loading={exporting}
                  disabled={exporting}
                  style={styles.exportButton}
                  icon="file-export"
                  buttonColor="#4CAF50"
                >
                  Export to CSV
                </Button>
              </Card.Content>
            </Card>

            {/* CSV Preview */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.sectionTitle}>CSV Preview</Title>
                <View style={styles.csvPreview}>
                  <Text style={styles.csvText}>
                    TIN,Branch,Month,Year,MIN,Last OR,Vatable Sales,Vat Zero Rated Sales,Vat Exempt Sales,Sales Subject to Other Percentage Taxes
                  </Text>
                  <Text style={styles.csvText}>
                    {reportData.tin},{reportData.branch},{reportData.month},{reportData.year},{reportData.min},{reportData.lastOR},{reportData.vatableSales.toFixed(2)},{reportData.vatZeroRatedSales.toFixed(2)},{reportData.vatExemptSales.toFixed(2)},{reportData.otherPercentageTaxSales.toFixed(2)}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          </>
        )}

        {/* Instructions */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Instructions</Title>
            <View style={styles.instructionList}>
              <Paragraph style={styles.instruction}>
                1. Select the Year and Month for the report period
              </Paragraph>
              <Paragraph style={styles.instruction}>
                2. Click "Generate Report" to calculate the sales data
              </Paragraph>
              <Paragraph style={styles.instruction}>
                3. Review the data to ensure accuracy
              </Paragraph>
              <Paragraph style={styles.instruction}>
                4. Click "Export to CSV" to download the file
              </Paragraph>
              <Paragraph style={styles.instruction}>
                5. Submit the CSV file to BIR's eSales portal
              </Paragraph>
            </View>
            <Divider style={styles.divider} />
            <Paragraph style={styles.noteText}>
              Note: Ensure TIN and MIN are configured in Settings before generating the report.
            </Paragraph>
          </Card.Content>
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Paragraph style={[styles.footerText, { fontSize: fs.caption }]}>
            Report generated on {new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
          </Paragraph>
        </View>
      </ScrollView>

      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  filterCard: {
    marginBottom: 16,
    elevation: 3,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipScroll: {
    flexGrow: 0,
  },
  segmentedButtons: {
    flexWrap: 'wrap',
  },
  monthRow: {
    flexDirection: 'row',
    gap: 6,
  },
  monthButton: {
    minWidth: 50,
  },
  monthButtonLabel: {
    fontSize: 11,
  },
  generateButton: {
    marginTop: 16,
  },
  centerContent: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  labelCell: {
    flex: 2,
  },
  valueCell: {
    flex: 2,
    justifyContent: 'flex-end',
  },
  valueText: {
    fontWeight: '600',
  },
  amountText: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  tableDivider: {
    marginVertical: 8,
  },
  highlightRow: {
    backgroundColor: '#E3F2FD',
  },
  exportNote: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 12,
  },
  exportButton: {
    marginTop: 8,
  },
  csvPreview: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  csvText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    lineHeight: 16,
    color: '#333',
  },
  instructionList: {
    marginBottom: 12,
  },
  instruction: {
    fontSize: 13,
    marginBottom: 6,
    paddingLeft: 8,
  },
  divider: {
    marginVertical: 12,
  },
  noteText: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  footer: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
});
