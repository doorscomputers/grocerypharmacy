import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  DataTable,
  Chip,
  Text,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { formatPesoCurrency } from '../utils/ReceiptPdfService';
import { formatPrinterDate } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'CostOfGoodsSoldReport'>;
};

type ViewMode = 'period' | 'product' | 'category';

interface ReportData {
  summary: {
    revenue: number;
    cogs: number;
    gross_profit: number;
    gross_margin_pct: number;
    transaction_count: number;
    pre_avco_revenue: number;
    avco_start_date: string | null;
  };
  by_period: Array<{ period: string; revenue: number; cogs: number; gross_profit: number; gross_margin_pct: number }>;
  by_product: Array<{ product_id: number; product_code: string; product_name: string; qty: number; revenue: number; cogs: number; gross_profit: number; gross_margin_pct: number }>;
  by_category: Array<{ category_id: number | null; category_name: string; revenue: number; cogs: number; gross_profit: number; gross_margin_pct: number }>;
}

// Convert a Date object to SQLite-comparable string: 'YYYY-MM-DD HH:mm:ss' in local (device) time.
// Transactions are stored using getPhilippineDateTimeString() in the same format, so string comparison works.
function toSqlDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function CostOfGoodsSoldReportScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs } = useResponsiveTheme();

  const [dateRange, setDateRange] = useState(() => {
    const r = getDateRange('this_month');
    return { startDate: r.startDate, endDate: r.endDate };
  });
  const [viewMode, setViewMode] = useState<ViewMode>('period');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const db = getDatabase();
      const startStr = toSqlDateTime(dateRange.startDate);
      const endStr = toSqlDateTime(dateRange.endDate);
      const report = await db.getCogsReport(startStr, endStr);
      setData(report);
    } catch (e) {
      console.error('COGS report load failed', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) setDateRange({ startDate, endDate });
  }, []);

  const summary = data?.summary;
  const hasPreAvco = (summary?.pre_avco_revenue || 0) !== 0;

  const fmt = (n: number) => formatPesoCurrency(n);
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

  // ============ PRINT (ESC/POS) ============
  const buildPrintData = useCallback(
    (printerWidth: number): ESCPOSBuilder => {
      const b = new ESCPOSBuilder(printerWidth);
      b.align('center').bold().println('COST OF GOODS SOLD REPORT').bold(false).align('left');
      b.println(`Period: ${formatPrinterDate(dateRange.startDate)} to ${formatPrinterDate(dateRange.endDate)}`);
      b.separator();
      if (summary) {
        b.leftRight('Revenue:', fmt(summary.revenue));
        b.leftRight('COGS:', fmt(summary.cogs));
        b.leftRight('Gross Profit:', fmt(summary.gross_profit));
        b.leftRight('Gross Margin:', fmtPct(summary.gross_margin_pct));
        b.leftRight('Transactions:', String(summary.transaction_count));
        if (hasPreAvco) {
          b.separator();
          b.println(`Note: ${fmt(summary.pre_avco_revenue)} of revenue has no cost data (pre-AVCO).`);
        }
      }
      b.separator();
      if (viewMode === 'product' && data) {
        b.bold().println('By Product').bold(false);
        for (const row of data.by_product.slice(0, 30)) {
          b.println(`${row.product_code} ${row.product_name}`);
          b.leftRight(`  Qty ${row.qty.toFixed(2)}`, `GP ${fmt(row.gross_profit)}`);
        }
      } else if (viewMode === 'category' && data) {
        b.bold().println('By Category').bold(false);
        for (const row of data.by_category) {
          b.leftRight(row.category_name, fmt(row.gross_profit));
        }
      } else if (data) {
        b.bold().println('By Period (Daily)').bold(false);
        for (const row of data.by_period) {
          b.leftRight(row.period, fmt(row.gross_profit));
        }
      }
      b.separator();
      b.align('center').println('--- End of Report ---').align('left');
      return b;
    },
    [dateRange, summary, data, viewMode, hasPreAvco]
  );

  // ============ PDF HTML ============
  const buildPdfHtml = useCallback((): string => {
    const startStr = dateRange.startDate.toLocaleDateString('en-PH');
    const endStr = dateRange.endDate.toLocaleDateString('en-PH');
    const s = summary;
    const rowsHtml = (() => {
      if (!data) return '';
      if (viewMode === 'product') {
        return data.by_product
          .map(
            r => `<tr>
              <td>${r.product_code}</td>
              <td>${r.product_name}</td>
              <td style="text-align:right">${r.qty.toFixed(2)}</td>
              <td style="text-align:right">${fmt(r.revenue)}</td>
              <td style="text-align:right">${fmt(r.cogs)}</td>
              <td style="text-align:right">${fmt(r.gross_profit)}</td>
              <td style="text-align:right">${fmtPct(r.gross_margin_pct)}</td>
            </tr>`
          )
          .join('');
      }
      if (viewMode === 'category') {
        return data.by_category
          .map(
            r => `<tr>
              <td>${r.category_name}</td>
              <td style="text-align:right">${fmt(r.revenue)}</td>
              <td style="text-align:right">${fmt(r.cogs)}</td>
              <td style="text-align:right">${fmt(r.gross_profit)}</td>
              <td style="text-align:right">${fmtPct(r.gross_margin_pct)}</td>
            </tr>`
          )
          .join('');
      }
      return data.by_period
        .map(
          r => `<tr>
            <td>${r.period}</td>
            <td style="text-align:right">${fmt(r.revenue)}</td>
            <td style="text-align:right">${fmt(r.cogs)}</td>
            <td style="text-align:right">${fmt(r.gross_profit)}</td>
            <td style="text-align:right">${fmtPct(r.gross_margin_pct)}</td>
          </tr>`
        )
        .join('');
    })();

    const tableHeader = (() => {
      if (viewMode === 'product')
        return `<tr><th>Code</th><th>Product</th><th>Qty</th><th>Revenue</th><th>COGS</th><th>Gross Profit</th><th>Margin %</th></tr>`;
      if (viewMode === 'category')
        return `<tr><th>Category</th><th>Revenue</th><th>COGS</th><th>Gross Profit</th><th>Margin %</th></tr>`;
      return `<tr><th>Date</th><th>Revenue</th><th>COGS</th><th>Gross Profit</th><th>Margin %</th></tr>`;
    })();

    return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 20px; }
      .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 16px; }
      .title { font-size: 20px; font-weight: bold; color: #1976D2; }
      .period { text-align: center; color: #666; background: #f5f5f5; padding: 8px; border-radius: 4px; margin: 8px 0; }
      .summary { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
      .summary-item { flex: 1 1 140px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; }
      .summary-label { font-size: 11px; color: #666; }
      .summary-value { font-size: 16px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { padding: 6px 8px; border-bottom: 1px solid #eee; text-align: left; }
      th { background: #f5f5f5; }
      .note { background: #FFF3CD; border-left: 4px solid #FFC107; padding: 10px; margin: 12px 0; font-size: 11px; }
      .footer { margin-top: 20px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 8px; }
    </style></head><body>
      <div class="header">
        <div class="title">Cost of Goods Sold Report</div>
        <div style="font-size:11px;color:#666;margin-top:4px;">Perpetual Weighted Average Cost (AVCO)</div>
      </div>
      <div class="period">Period: ${startStr} to ${endStr}</div>
      ${
        s
          ? `<div class="summary">
        <div class="summary-item"><div class="summary-label">Revenue</div><div class="summary-value" style="color:#388E3C">${fmt(s.revenue)}</div></div>
        <div class="summary-item"><div class="summary-label">COGS</div><div class="summary-value" style="color:#D32F2F">${fmt(s.cogs)}</div></div>
        <div class="summary-item"><div class="summary-label">Gross Profit</div><div class="summary-value" style="color:#1976D2">${fmt(s.gross_profit)}</div></div>
        <div class="summary-item"><div class="summary-label">Gross Margin</div><div class="summary-value" style="color:#6A1B9A">${fmtPct(s.gross_margin_pct)}</div></div>
        <div class="summary-item"><div class="summary-label">Transactions</div><div class="summary-value">${s.transaction_count}</div></div>
      </div>`
          : ''
      }
      ${
        hasPreAvco
          ? `<div class="note">Pre-AVCO sales: ${fmt(summary!.pre_avco_revenue)} of revenue has no cost-at-sale snapshot and is excluded from COGS. These are transactions that occurred before AVCO tracking was enabled.</div>`
          : ''
      }
      <table>
        <thead>${tableHeader}</thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="footer">
        ${s?.avco_start_date ? `AVCO tracking began ${s.avco_start_date}` : 'AVCO tracking active'} - Generated by IgoroTech POS
      </div>
    </body></html>`;
  }, [data, summary, viewMode, dateRange, hasPreAvco]);

  // ============ UI ============
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="chart-line" size={28} color="#1976D2" />
            <Title style={[styles.headerTitle, { fontSize: fs.h2 }]}>Cost of Goods Sold</Title>
          </View>
          <Paragraph style={styles.headerSubtitle}>
            Revenue, COGS, Gross Profit and Margin (Perpetual Moving Average Cost)
          </Paragraph>
        </Card.Content>
      </Card>

      <DateRangeFilter onDateChange={handleDateChange} selectedPreset="this_month" />

      {/* Summary Cards */}
      {summary && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Summary</Title>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: '#E8F5E9' }]}>
                <Paragraph style={styles.summaryLabel}>Revenue</Paragraph>
                <Title style={[styles.summaryValue, { color: '#388E3C' }]}>{fmt(summary.revenue)}</Title>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: '#FFEBEE' }]}>
                <Paragraph style={styles.summaryLabel}>COGS</Paragraph>
                <Title style={[styles.summaryValue, { color: '#D32F2F' }]}>{fmt(summary.cogs)}</Title>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: '#E3F2FD' }]}>
                <Paragraph style={styles.summaryLabel}>Gross Profit</Paragraph>
                <Title style={[styles.summaryValue, { color: '#1976D2' }]}>{fmt(summary.gross_profit)}</Title>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: '#F3E5F5' }]}>
                <Paragraph style={styles.summaryLabel}>Gross Margin</Paragraph>
                <Title style={[styles.summaryValue, { color: '#6A1B9A' }]}>{fmtPct(summary.gross_margin_pct)}</Title>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: '#FFF8E1' }]}>
                <Paragraph style={styles.summaryLabel}>Transactions</Paragraph>
                <Title style={[styles.summaryValue, { color: '#F57F17' }]}>{summary.transaction_count}</Title>
              </View>
            </View>

            {hasPreAvco && (
              <View style={styles.warning}>
                <MaterialCommunityIcons name="alert" size={18} color="#F57C00" />
                <Text style={styles.warningText}>
                  {fmt(summary.pre_avco_revenue)} of revenue has no AVCO cost snapshot (pre-AVCO) and is excluded from COGS.
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* View Toggle */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.chipsRow}>
            <Chip
              selected={viewMode === 'period'}
              onPress={() => setViewMode('period')}
              style={styles.chip}
              icon="calendar"
            >
              By Period
            </Chip>
            <Chip
              selected={viewMode === 'product'}
              onPress={() => setViewMode('product')}
              style={styles.chip}
              icon="package-variant"
            >
              By Product
            </Chip>
            <Chip
              selected={viewMode === 'category'}
              onPress={() => setViewMode('category')}
              style={styles.chip}
              icon="shape"
            >
              By Category
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* Detail Table */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>
            {viewMode === 'period' ? 'Daily Breakdown' : viewMode === 'product' ? 'Product Breakdown' : 'Category Breakdown'}
          </Title>
          {loading && <Paragraph>Loading...</Paragraph>}
          {!loading && data && (
            <ScrollView horizontal>
              <DataTable>
                {viewMode === 'period' && (
                  <>
                    <DataTable.Header>
                      <DataTable.Title>Date</DataTable.Title>
                      <DataTable.Title numeric>Revenue</DataTable.Title>
                      <DataTable.Title numeric>COGS</DataTable.Title>
                      <DataTable.Title numeric>Gross Profit</DataTable.Title>
                      <DataTable.Title numeric>Margin %</DataTable.Title>
                    </DataTable.Header>
                    {data.by_period.map((r) => (
                      <DataTable.Row key={r.period}>
                        <DataTable.Cell>{r.period}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmt(r.revenue)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmt(r.cogs)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmt(r.gross_profit)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmtPct(r.gross_margin_pct)}</DataTable.Cell>
                      </DataTable.Row>
                    ))}
                    {data.by_period.length === 0 && (
                      <DataTable.Row>
                        <DataTable.Cell>No data for selected period</DataTable.Cell>
                      </DataTable.Row>
                    )}
                  </>
                )}

                {viewMode === 'product' && (
                  <>
                    <DataTable.Header>
                      <DataTable.Title>Code</DataTable.Title>
                      <DataTable.Title>Product</DataTable.Title>
                      <DataTable.Title numeric>Qty</DataTable.Title>
                      <DataTable.Title numeric>Revenue</DataTable.Title>
                      <DataTable.Title numeric>COGS</DataTable.Title>
                      <DataTable.Title numeric>Gross Profit</DataTable.Title>
                      <DataTable.Title numeric>Margin %</DataTable.Title>
                    </DataTable.Header>
                    {data.by_product.map((r) => (
                      <DataTable.Row key={r.product_id}>
                        <DataTable.Cell>{r.product_code}</DataTable.Cell>
                        <DataTable.Cell>{r.product_name}</DataTable.Cell>
                        <DataTable.Cell numeric>{r.qty.toFixed(2)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmt(r.revenue)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmt(r.cogs)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmt(r.gross_profit)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmtPct(r.gross_margin_pct)}</DataTable.Cell>
                      </DataTable.Row>
                    ))}
                    {data.by_product.length === 0 && (
                      <DataTable.Row>
                        <DataTable.Cell>No data for selected period</DataTable.Cell>
                      </DataTable.Row>
                    )}
                  </>
                )}

                {viewMode === 'category' && (
                  <>
                    <DataTable.Header>
                      <DataTable.Title>Category</DataTable.Title>
                      <DataTable.Title numeric>Revenue</DataTable.Title>
                      <DataTable.Title numeric>COGS</DataTable.Title>
                      <DataTable.Title numeric>Gross Profit</DataTable.Title>
                      <DataTable.Title numeric>Margin %</DataTable.Title>
                    </DataTable.Header>
                    {data.by_category.map((r, idx) => (
                      <DataTable.Row key={`cat-${r.category_id ?? 'null'}-${idx}`}>
                        <DataTable.Cell>{r.category_name}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmt(r.revenue)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmt(r.cogs)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmt(r.gross_profit)}</DataTable.Cell>
                        <DataTable.Cell numeric>{fmtPct(r.gross_margin_pct)}</DataTable.Cell>
                      </DataTable.Row>
                    ))}
                    {data.by_category.length === 0 && (
                      <DataTable.Row>
                        <DataTable.Cell>No data for selected period</DataTable.Cell>
                      </DataTable.Row>
                    )}
                  </>
                )}
              </DataTable>
            </ScrollView>
          )}
        </Card.Content>
      </Card>

      {/* Footer info */}
      <Card style={styles.card}>
        <Card.Content>
          <Paragraph style={styles.footerNote}>
            Cost method: Perpetual Weighted Average Cost (Moving Average / AVCO).
            Beginning inventory entered via Initial Inventory Setup seeds the cost anchor.
            Each purchase receiving updates the rolling average. Each sale snapshots the
            cost-at-time-of-sale onto the line and never changes thereafter.
          </Paragraph>
          {summary?.avco_start_date && (
            <Paragraph style={styles.footerNote}>AVCO tracking began: {summary.avco_start_date}</Paragraph>
          )}
        </Card.Content>
      </Card>

      <ReportActionsBar
        onBuildPrintData={buildPrintData}
        onBuildPdfHtml={buildPdfHtml}
        reportTitle="Cost of Goods Sold Report"
        reportFileName={`COGS_${toSqlDateTime(dateRange.startDate).slice(0, 10)}_${toSqlDateTime(dateRange.endDate).slice(0, 10)}`}
        emailBody={
          summary
            ? `Please find attached the COGS Report.\n\nPeriod: ${dateRange.startDate.toLocaleDateString(
                'en-PH'
              )} to ${dateRange.endDate.toLocaleDateString('en-PH')}\nRevenue: ${fmt(
                summary.revenue
              )}\nCOGS: ${fmt(summary.cogs)}\nGross Profit: ${fmt(summary.gross_profit)}\nMargin: ${fmtPct(
                summary.gross_margin_pct
              )}\n\nGenerated by IgoroTech POS`
            : undefined
        }
        disabled={!data || loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerCard: { margin: 8, elevation: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { marginLeft: 8, fontWeight: 'bold' },
  headerSubtitle: { color: '#666', marginTop: 4, fontSize: 12 },
  card: { margin: 8, elevation: 1 },
  sectionTitle: { marginBottom: 12, fontWeight: 'bold' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryItem: { flex: 1, minWidth: 130, padding: 12, borderRadius: 8 },
  summaryLabel: { fontSize: 12, color: '#666' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { marginRight: 4 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#F57C00',
    padding: 10,
    borderRadius: 4,
    marginTop: 12,
  },
  warningText: { fontSize: 12, color: '#5d4037', flex: 1 },
  footerNote: { fontSize: 11, color: '#666', lineHeight: 16 },
});
