import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Text,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Divider,
  List,
  useTheme,
  Dialog,
  Portal,
  ActivityIndicator,
  DataTable,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import { InventoryMovement } from '../database/schema';

interface InventoryCountItem {
  product_id: number;
  physical_quantity: number;
  notes?: string;
  created_at: string;
  product_name: string;
  product_code: string;
  unit: string;
  unit_cost: number;
  reference_number: string;
}

interface InventorySession {
  reference_number: string;
  description: string;
  amount?: number;
  created_at: string;
  entry_type: string;
  cashier_id: number;
  performed_by: string;
  user_username: string;
}
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type ReportsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Reports'
>;

type Props = {
  navigation: ReportsScreenNavigationProp;
};

interface ZReading {
  id: number;
  reading_number: number;
  date: string;
  start_invoice_number: string;
  end_invoice_number: string;
  gross_sales: number;
  vat_sales: number;
  vat_amount: number;
  discount_amount: number;
  void_amount: number;
  net_sales: number;
  reset_counter: number;
}

interface XReading {
  date: string;
  time: string;
  current_invoice_number: string;
  gross_sales: number;
  vat_sales: number;
  vat_amount: number;
  discount_amount: number;
  void_amount: number;
  net_sales: number;
  transaction_count: number;
}

export default function ReportsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [reportType, setReportType] = useState<'z' | 'x' | 'sales' | 'inventory'>('z');
  const [todayTransactions, setTodayTransactions] = useState([]);
  const [inventoryHistory, setInventoryHistory] = useState([]);
  const [inventoryFilterVisible, setInventoryFilterVisible] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  });
  const theme = useTheme();

  useEffect(() => {
    loadTodayTransactions();
    // Don't auto-load inventory history - only load when user requests it
  }, []);

  const loadTodayTransactions = async () => {
    try {
      const dbService = DatabaseService.getInstance();
      const transactions = await dbService.getTodaysTransactions();
      setTodayTransactions(transactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadInventoryHistory = async (startDate?: string, endDate?: string) => {
    try {
      const dbService = DatabaseService.getInstance();
      const db = dbService.getDatabase();

      let dateFilter = '';
      if (startDate && endDate && startDate.trim() && endDate.trim()) {
        // Try both date and created_at for better compatibility
        dateFilter = `AND (DATE(pcs.date) BETWEEN '${startDate}' AND '${endDate}' OR DATE(pcs.created_at) BETWEEN '${startDate}' AND '${endDate}')`;
        console.log('Date filter SQL:', dateFilter);
        console.log('Date range:', { startDate, endDate });
      } else if (startDate && startDate.trim()) {
        dateFilter = `AND (DATE(pcs.date) >= '${startDate}' OR DATE(pcs.created_at) >= '${startDate}')`;
        console.log('Start date filter SQL:', dateFilter);
      } else if (endDate && endDate.trim()) {
        dateFilter = `AND (DATE(pcs.date) <= '${endDate}' OR DATE(pcs.created_at) <= '${endDate}')`;
        console.log('End date filter SQL:', dateFilter);
      } else {
        console.log('No date filter applied - showing all sessions');
      }

      console.log('Loading inventory history with date filter:', { startDate, endDate, dateFilter });

      // First, let's see what sessions exist without filtering
      const allSessions = await db.getAllAsync(`
        SELECT
          pcs.session_id,
          pcs.date,
          pcs.created_at,
          DATE(pcs.date) as date_only,
          DATE(pcs.created_at) as created_date_only
        FROM physical_count_sessions pcs
        ORDER BY pcs.created_at DESC
        LIMIT 10
      `);
      console.log('Sample sessions in database:', allSessions);

      // Get physical inventory count sessions with user information and date filtering
      const rawSessions = await db.getAllAsync(`
        SELECT
          pcs.session_id as reference_number,
          pcs.notes as description,
          pcs.total_discrepancy_value as amount,
          pcs.created_at,
          'PHYSICAL_COUNT' as entry_type,
          pcs.started_by as cashier_id,
          u1.full_name as performed_by,
          u1.username as user_username,
          pcs.date,
          pcs.status,
          pcs.total_items,
          pcs.counted_items,
          pcs.discrepancy_count,
          u2.full_name as completed_by_name
        FROM physical_count_sessions pcs
        LEFT JOIN users u1 ON pcs.started_by = u1.id
        LEFT JOIN users u2 ON pcs.completed_by = u2.id
        WHERE 1=1
        ${dateFilter}
        ORDER BY pcs.created_at DESC
        LIMIT 50
      `);
      const sessions = rawSessions as InventorySession[];

      console.log(`Found ${sessions.length} physical count sessions with date filter:`, sessions.map(s => ({ id: s.reference_number, date: s.date, status: s.status })));

      // For each session, get the detailed item counts (optimized)
      const sessionsWithDetails = await Promise.all(
        sessions.map(async (session, index) => {
          try {
            const rawItems = await db.getAllAsync(`
              SELECT
                pcd.product_id,
                pcd.physical_quantity,
                pcd.system_quantity,
                pcd.discrepancy,
                pcd.value_discrepancy,
                pcd.status,
                pcd.notes,
                pcd.counted_at as created_at,
                p.name as product_name,
                p.code as product_code,
                p.unit,
                pcd.unit_cost
              FROM physical_count_details pcd
              JOIN products p ON pcd.product_id = p.id
              WHERE pcd.session_id = ?
              ORDER BY p.name
              LIMIT 100
            `, [session.reference_number]);
            const items = rawItems as InventoryCountItem[];

            console.log(`Loading session ${index + 1}/${sessions.length}: ${session.reference_number}`);

            // Data is already structured from physical_count_details table
            const itemsWithDetails = items.map(item => ({
              ...item,
              system_quantity: item.system_quantity || 0,
              physical_quantity: item.physical_quantity || 0,
              discrepancy: item.discrepancy || 0,
              value_discrepancy: item.value_discrepancy || 0
            }));

            return {
              ...session,
              items: itemsWithDetails
            };
          } catch (error) {
            console.error(`Error loading session ${session.reference_number}:`, error);
            return {
              ...session,
              items: []
            };
          }
        })
      );

      setInventoryHistory(sessionsWithDetails);
    } catch (error) {
      console.error('Error loading inventory history:', error);
    }
  };

  const generateZReading = async () => {
    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
      const zReading = await dbService.generateZReading(1); // Cashier ID would come from user context

      setCurrentReport(zReading);
      setReportType('z');
      setReportVisible(true);

      Alert.alert(
        'Z-Reading Generated',
        `Z-Reading #${zReading.reading_number} has been generated successfully.`,
        [
          { text: 'View Report', onPress: () => setReportVisible(true) },
          { text: 'OK' },
        ]
      );
    } catch (error) {
      console.error('Z-Reading error:', error);
      Alert.alert('Error', error.message || 'Failed to generate Z-Reading');
    } finally {
      setLoading(false);
    }
  };

  const generateXReading = async () => {
    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
      const xReading = await dbService.generateXReading(1); // Cashier ID would come from user context

      setCurrentReport(xReading);
      setReportType('x');
      setReportVisible(true);
    } catch (error) {
      console.error('X-Reading error:', error);
      Alert.alert('Error', 'Failed to generate X-Reading');
    } finally {
      setLoading(false);
    }
  };

  const generateSalesReport = async () => {
    setReportType('sales');
    setCurrentReport({ transactions: todayTransactions });
    setReportVisible(true);
  };

  const showInventoryFilterDialog = () => {
    setInventoryFilterVisible(true);
  };

  const generateInventoryHistoryReport = async () => {
    setLoading(true);
    try {
      await loadInventoryHistory(selectedDateRange.startDate, selectedDateRange.endDate);
      setReportType('inventory');
      setCurrentReport({
        inventoryHistory,
        dateRange: selectedDateRange,
        reportTitle: `Physical Inventory Count History (${selectedDateRange.startDate} to ${selectedDateRange.endDate})`
      });
      setReportVisible(true);
      setInventoryFilterVisible(false);
    } catch (error) {
      console.error('Error generating inventory report:', error);
      Alert.alert('Error', 'Failed to generate inventory history report');
    } finally {
      setLoading(false);
    }
  };

  const printReport = async () => {
    if (!currentReport || loading) return; // Prevent concurrent sharing

    setLoading(true);
    try {
      let html = '';

      if (reportType === 'z') {
        html = generateZReadingHTML(currentReport);
      } else if (reportType === 'x') {
        html = generateXReadingHTML(currentReport);
      } else if (reportType === 'sales') {
        html = generateSalesReportHTML(currentReport.transactions);
      } else if (reportType === 'inventory') {
        html = generateInventoryHistoryHTML(currentReport);
      }

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
        margins: {
          left: 20,
          top: 20,
          right: 20,
          bottom: 20,
        },
        width: 612,
        height: 792,
      });

      console.log('PDF generated successfully at:', uri);

      // Check if sharing is available before attempting to share
      if (await Sharing.isAvailableAsync()) {
        // Use the original simple sharing approach that was working before
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Info', 'Report generated successfully. Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      if (error.message?.includes('rejected')) {
        Alert.alert('Info', 'Another sharing operation is in progress. Please wait and try again.');
      } else if (error.message?.includes('print') || error.message?.includes('PDF')) {
        Alert.alert('PDF Error', 'Failed to generate PDF. Please try again or contact support if the issue persists.');
      } else if (error.message?.includes('sharing') || error.message?.includes('share')) {
        Alert.alert('Sharing Error', 'Failed to share the report. The PDF was generated but sharing failed.');
      } else {
        Alert.alert('Error', `Failed to generate or share report: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateZReadingHTML = (zReading: ZReading) => {
    const companyName = 'Your Company Name'; // Would get from settings
    const companyAddress = 'Your Company Address'; // Would get from settings
    const tin = '000-000-000-000'; // Would get from settings

    return `
      <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .company-name { font-weight: bold; font-size: 16px; }
            .report-title { font-weight: bold; font-size: 14px; margin: 10px 0; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .total-row { font-weight: bold; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${companyName}</div>
            <div>${companyAddress}</div>
            <div>TIN: ${tin}</div>
            <div class="report-title">*** Z-READING ***</div>
          </div>

          <div class="row">
            <span>Z-Reading #:</span>
            <span>${zReading.reading_number}</span>
          </div>
          <div class="row">
            <span>Date:</span>
            <span>${zReading.date}</span>
          </div>
          <div class="row">
            <span>Time:</span>
            <span>${new Date().toLocaleTimeString()}</span>
          </div>

          <div class="divider"></div>

          <div class="row">
            <span>Start Invoice #:</span>
            <span>${zReading.start_invoice_number}</span>
          </div>
          <div class="row">
            <span>End Invoice #:</span>
            <span>${zReading.end_invoice_number}</span>
          </div>

          <div class="divider"></div>

          <div class="row">
            <span>Gross Sales:</span>
            <span>₱${zReading.gross_sales.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>VAT Sales:</span>
            <span>₱${zReading.vat_sales.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>VAT Amount:</span>
            <span>₱${zReading.vat_amount.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>VAT Exempt:</span>
            <span>₱0.00</span>
          </div>
          <div class="row">
            <span>Zero Rated:</span>
            <span>₱0.00</span>
          </div>
          <div class="row">
            <span>Discount:</span>
            <span>₱${zReading.discount_amount.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>Void:</span>
            <span>₱${zReading.void_amount.toFixed(2)}</span>
          </div>

          <div class="divider"></div>

          <div class="row total-row">
            <span>NET SALES:</span>
            <span>₱${zReading.net_sales.toFixed(2)}</span>
          </div>

          <div class="divider"></div>

          <div class="row">
            <span>Reset Counter:</span>
            <span>${zReading.reset_counter}</span>
          </div>

          <div class="center" style="margin-top: 20px;">
            <div>*** END OF Z-READING ***</div>
            <div>PROFESSIONAL POS SYSTEM</div>
          </div>
        </body>
      </html>
    `;
  };

  const generateXReadingHTML = (xReading: XReading) => {
    const companyName = 'Your Company Name';
    const companyAddress = 'Your Company Address';
    const tin = '000-000-000-000';

    return `
      <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .company-name { font-weight: bold; font-size: 16px; }
            .report-title { font-weight: bold; font-size: 14px; margin: 10px 0; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .total-row { font-weight: bold; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${companyName}</div>
            <div>${companyAddress}</div>
            <div>TIN: ${tin}</div>
            <div class="report-title">*** X-READING ***</div>
          </div>

          <div class="row">
            <span>Date:</span>
            <span>${xReading.date}</span>
          </div>
          <div class="row">
            <span>Time:</span>
            <span>${xReading.time}</span>
          </div>

          <div class="divider"></div>

          <div class="row">
            <span>Current Invoice #:</span>
            <span>${xReading.current_invoice_number}</span>
          </div>
          <div class="row">
            <span>Transaction Count:</span>
            <span>${xReading.transaction_count}</span>
          </div>

          <div class="divider"></div>

          <div class="row">
            <span>Gross Sales:</span>
            <span>₱${xReading.gross_sales.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>VAT Sales:</span>
            <span>₱${xReading.vat_sales.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>VAT Amount:</span>
            <span>₱${xReading.vat_amount.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>Discount:</span>
            <span>₱${xReading.discount_amount.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>Void:</span>
            <span>₱${xReading.void_amount.toFixed(2)}</span>
          </div>

          <div class="divider"></div>

          <div class="row total-row">
            <span>NET SALES:</span>
            <span>₱${xReading.net_sales.toFixed(2)}</span>
          </div>

          <div class="center" style="margin-top: 20px;">
            <div>*** END OF X-READING ***</div>
            <div>PROFESSIONAL POS SYSTEM</div>
            <div style="margin-top: 10px; font-size: 10px;">
              This is an inquiry only.<br/>
              Counters not reset.
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const generateSalesReportHTML = (transactions: any[]) => {
    const companyName = 'Your Company Name';

    const transactionRows = transactions
      .filter(t => t.status === 'COMPLETED')
      .map(transaction => `
        <tr>
          <td>${transaction.invoice_number}</td>
          <td>${new Date(transaction.transaction_date).toLocaleTimeString()}</td>
          <td style="text-align: right;">₱${transaction.total_amount.toFixed(2)}</td>
          <td>${transaction.payment_method}</td>
        </tr>
      `).join('');

    const totalSales = transactions
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + t.total_amount, 0);

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .total { font-weight: bold; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${companyName}</h2>
            <h3>Daily Sales Report</h3>
            <p>Date: ${new Date().toLocaleDateString()}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Payment Method</th>
              </tr>
            </thead>
            <tbody>
              ${transactionRows}
              <tr class="total">
                <td colspan="2">TOTAL SALES</td>
                <td style="text-align: right;">₱${totalSales.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 30px; text-align: center;">
            <p>*** END OF REPORT ***</p>
            <p style="font-size: 10px;">Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;
  };

  const generateInventoryHistoryHTML = (reportData: any) => {
    const companyName = 'Your Company Name';
    const inventoryHistory = reportData.inventoryHistory || [];
    const dateRange = reportData.dateRange;
    const reportTitle = reportData.reportTitle || 'Physical Inventory Count History';

    const sessionsHTML = inventoryHistory.map((session: any, sessionIndex: number) => {
      const sessionDate = new Date(session.created_at).toLocaleDateString();
      const sessionTime = new Date(session.created_at).toLocaleTimeString();
      const discrepancyValue = Math.abs(session.amount);
      const performedBy = session.performed_by || 'Unknown User';
      const username = session.user_username || '';

      // Generate item rows for this session
      const itemRows = session.items?.map((item: any) => {
        const discrepancyColor = item.discrepancy > 0 ? '#4CAF50' : item.discrepancy < 0 ? '#F44336' : '#666';
        return `
          <tr>
            <td>${item.product_name}</td>
            <td>${item.product_code}</td>
            <td style="text-align: center;">${item.system_quantity} ${item.unit || ''}</td>
            <td style="text-align: center;">${item.physical_quantity} ${item.unit || ''}</td>
            <td style="text-align: center; color: ${discrepancyColor}; font-weight: bold;">
              ${item.discrepancy >= 0 ? '+' : ''}${item.discrepancy}
            </td>
            <td style="text-align: right; color: ${discrepancyColor}; font-weight: bold;">
              ₱${Math.abs(item.value_discrepancy || 0).toFixed(2)}
            </td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="6" style="text-align: center; font-style: italic;">No items found for this session</td></tr>';

      return `
        <div class="session-block">
          <div class="session-header">
            <h4>Physical Count ${sessionIndex + 1}</h4>
            <div class="session-info">
              <p><strong>Transaction ID:</strong> ${session.reference_number}</p>
              <p><strong>Date & Time:</strong> ${sessionDate} at ${sessionTime}</p>
              <p><strong>Performed By:</strong> ${performedBy}${username ? ` (${username})` : ''}</p>
              <p><strong>Total Discrepancy Value:</strong> <span style="color: ${session.amount >= 0 ? '#4CAF50' : '#F44336'}; font-weight: bold;">₱${discrepancyValue.toFixed(2)}</span></p>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr style="background-color: #e8e8e8;">
                <th>Product Name</th>
                <th>Product Code</th>
                <th>System Qty</th>
                <th>Physical Qty</th>
                <th>Difference</th>
                <th>Value Impact</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const totalDiscrepancy = inventoryHistory.reduce((sum, session) => sum + Math.abs(session.amount), 0);
    const totalItems = inventoryHistory.reduce((sum, session) => sum + (session.items?.length || 0), 0);

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .summary { margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px; }
            .session-block { margin: 30px 0; page-break-inside: avoid; border: 1px solid #ddd; border-radius: 8px; }
            .session-header { background-color: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd; }
            .session-header h4 { margin: 0 0 10px 0; color: #2196F3; font-size: 18px; }
            .session-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; }
            .session-info p { margin: 2px 0; }
            .summary-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
            .stat-item { text-align: center; padding: 10px; background-color: #f8f9fa; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .items-table th { background-color: #e8e8e8 !important; }
            .total-summary { margin: 30px 0; padding: 20px; background-color: #fff3cd; border: 2px solid #ffc107; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${companyName}</h2>
            <h3>${reportTitle}</h3>
            <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            ${dateRange ? `<p><strong>Report Period:</strong> ${dateRange.startDate} to ${dateRange.endDate}</p>` : ''}
          </div>

          <div class="summary">
            <h4>Summary for Selected Period</h4>
            <div class="summary-stats">
              <div class="stat-item">
                <strong>Total Count Sessions:</strong> ${inventoryHistory.length}
              </div>
              <div class="stat-item">
                <strong>Total Items Counted:</strong> ${totalItems}
              </div>
              <div class="stat-item">
                <strong>Total Discrepancy Value:</strong> <span style="color: ${totalDiscrepancy >= 0 ? '#4CAF50' : '#F44336'};">₱${totalDiscrepancy.toFixed(2)}</span>
              </div>
            </div>
          </div>

          ${sessionsHTML}

          <div class="total-summary">
            <h4>Report Summary</h4>
            <p><strong>Total Physical Count Sessions:</strong> ${inventoryHistory.length}</p>
            <p><strong>Total Products Counted:</strong> ${totalItems}</p>
            <p><strong>Combined Discrepancy Value:</strong> ₱${totalDiscrepancy.toFixed(2)}</p>
          </div>

          <div style="margin-top: 30px;">
            <h4>Report Notes:</h4>
            <ul>
              <li><strong>System Qty:</strong> Quantity in system before physical count</li>
              <li><strong>Physical Qty:</strong> Actual counted quantity</li>
              <li><strong>Difference:</strong> Physical - System (+ = overage, - = shortage)</li>
              <li><strong>Value Impact:</strong> Monetary value of the discrepancy</li>
              <li><strong>Green values:</strong> Overages (more than system)</li>
              <li><strong>Red values:</strong> Shortages (less than system)</li>
            </ul>
          </div>

          <div style="margin-top: 30px; text-align: center; border-top: 2px solid #333; padding-top: 10px;">
            <p><strong>*** END OF DETAILED INVENTORY HISTORY REPORT ***</strong></p>
            <p style="font-size: 10px;">Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;
  };

  const getTodayStats = () => {
    const completedTransactions = todayTransactions.filter(t => t.status === 'COMPLETED');
    const totalSales = completedTransactions.reduce((sum, t) => sum + t.total_amount, 0);
    const voidTransactions = todayTransactions.filter(t => t.status === 'VOID');
    const voidAmount = voidTransactions.reduce((sum, t) => sum + t.total_amount, 0);

    return {
      totalSales,
      transactionCount: completedTransactions.length,
      voidAmount,
      voidCount: voidTransactions.length,
    };
  };

  const stats = getTodayStats();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Card style={styles.statsCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Today's Summary</Title>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Paragraph style={styles.statLabel}>Total Sales</Paragraph>
                  <Title style={[styles.statValue, { color: '#4CAF50' }]}>
                    ₱{stats.totalSales.toFixed(2)}
                  </Title>
                </View>
                <View style={styles.statItem}>
                  <Paragraph style={styles.statLabel}>Transactions</Paragraph>
                  <Title style={styles.statValue}>{stats.transactionCount}</Title>
                </View>
                <View style={styles.statItem}>
                  <Paragraph style={styles.statLabel}>Void Amount</Paragraph>
                  <Title style={[styles.statValue, { color: '#F44336' }]}>
                    ₱{stats.voidAmount.toFixed(2)}
                  </Title>
                </View>
                <View style={styles.statItem}>
                  <Paragraph style={styles.statLabel}>Void Count</Paragraph>
                  <Title style={styles.statValue}>{stats.voidCount}</Title>
                </View>
              </View>
            </Card.Content>
          </Card>

          <Card style={styles.reportsCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Sales Reports</Title>
              <Paragraph style={styles.cardSubtitle}>
                Generate official Professional reports
              </Paragraph>

              <List.Item
                title="Z-Reading (End of Day)"
                description="Generate end-of-day sales report (resets counters)"
                left={props => <List.Icon {...props} icon="calculator" />}
                right={props => (
                  <Button
                    mode="contained"
                    compact
                    loading={loading && reportType === 'z'}
                    onPress={generateZReading}
                  >
                    Generate
                  </Button>
                )}
                style={styles.reportItem}
              />

              <Divider />

              <List.Item
                title="X-Reading (Inquiry)"
                description="Generate sales inquiry (does not reset counters)"
                left={props => <List.Icon {...props} icon="poll" />}
                right={props => (
                  <Button
                    mode="outlined"
                    compact
                    loading={loading && reportType === 'x'}
                    onPress={generateXReading}
                  >
                    Generate
                  </Button>
                )}
                style={styles.reportItem}
              />

              <Divider />

              <List.Item
                title="Daily Sales Report"
                description="Detailed transaction report for today"
                left={props => <List.Icon {...props} icon="file-document" />}
                right={props => (
                  <Button
                    mode="outlined"
                    compact
                    onPress={generateSalesReport}
                  >
                    Generate
                  </Button>
                )}
                style={styles.reportItem}
              />
            </Card.Content>
          </Card>

          <Card style={styles.inventoryCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Inventory Management</Title>
              <Paragraph style={styles.cardSubtitle}>
                Physical inventory count history and discrepancy reports
              </Paragraph>

              <List.Item
                title="Physical Inventory History"
                description={`Filtered inventory count sessions with date range selection`}
                left={props => <List.Icon {...props} icon="clipboard-list" />}
                right={props => (
                  <Button
                    mode="outlined"
                    compact
                    onPress={showInventoryFilterDialog}
                  >
                    Filter & View
                  </Button>
                )}
                style={styles.reportItem}
              />

              <Divider />

              <List.Item
                title="Current Physical Count"
                description="Start a new physical inventory count session"
                left={props => <List.Icon {...props} icon="counter" />}
                right={props => (
                  <Button
                    mode="contained"
                    compact
                    onPress={() => navigation.navigate('PhysicalInventory')}
                  >
                    Start Count
                  </Button>
                )}
                style={styles.reportItem}
              />
              <Divider />
              <List.Item
                title="Physical Count Reports"
                description="View detailed physical count reports grouped by user and session"
                left={props => <List.Icon {...props} icon="file-document" />}
                right={props => (
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => navigation.navigate('PhysicalCountReport')}
                  >
                    View Reports
                  </Button>
                )}
                style={styles.reportItem}
              />

              {inventoryHistory.length > 0 && (
                <>
                  <Divider />
                  <Paragraph style={styles.cardSubtitle}>
                    Recent Inventory Count Sessions
                  </Paragraph>
                  <DataTable>
                    <DataTable.Header>
                      <DataTable.Title>Session ID</DataTable.Title>
                      <DataTable.Title>Date</DataTable.Title>
                      <DataTable.Title numeric>Discrepancy</DataTable.Title>
                    </DataTable.Header>

                    {inventoryHistory.slice(0, 5).map((session: any, index) => (
                      <DataTable.Row key={session.reference_number || index}>
                        <DataTable.Cell>{session.reference_number}</DataTable.Cell>
                        <DataTable.Cell>
                          {new Date(session.created_at).toLocaleDateString()}
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                          <Paragraph style={[
                            styles.discrepancyAmount,
                            { color: session.amount >= 0 ? '#4CAF50' : '#F44336' }
                          ]}>
                            ₱{Math.abs(session.amount).toFixed(2)}
                          </Paragraph>
                        </DataTable.Cell>
                      </DataTable.Row>
                    ))}
                  </DataTable>
                </>
              )}

              {inventoryHistory.length === 0 && (
                <Paragraph style={styles.emptyText}>
                  No physical inventory counts recorded yet. Start your first count session!
                </Paragraph>
              )}
            </Card.Content>
          </Card>

          <Card style={styles.transactionsCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Today's Transactions</Title>

              {todayTransactions.length === 0 ? (
                <Paragraph style={styles.emptyText}>
                  No transactions recorded today
                </Paragraph>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>Invoice #</DataTable.Title>
                    <DataTable.Title>Amount</DataTable.Title>
                    <DataTable.Title>Status</DataTable.Title>
                  </DataTable.Header>

                  {todayTransactions.slice(-10).map((transaction: any) => (
                    <DataTable.Row key={transaction.id}>
                      <DataTable.Cell>{transaction.invoice_number}</DataTable.Cell>
                      <DataTable.Cell>₱{transaction.total_amount.toFixed(2)}</DataTable.Cell>
                      <DataTable.Cell>
                        <Paragraph style={[
                          styles.statusText,
                          transaction.status === 'COMPLETED' ? styles.completedStatus :
                          transaction.status === 'VOID' ? styles.voidStatus : null
                        ]}>
                          {transaction.status}
                        </Paragraph>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              )}
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      {/* Report Dialog */}
      <Portal>
        <Dialog
          visible={reportVisible}
          onDismiss={() => setReportVisible(false)}
          style={styles.reportDialog}
        >
          <Dialog.Title>
            {reportType === 'z' ? 'Z-Reading Report' :
             reportType === 'x' ? 'X-Reading Report' :
             reportType === 'sales' ? 'Sales Report' :
             reportType === 'inventory' ? 'Inventory History Report' : 'Report'}
          </Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.reportContent}>
              {currentReport && (
                <View style={styles.reportPreview}>
                  {reportType === 'inventory' ? (
                    <View>
                      <Text style={styles.reportTitle}>Physical Inventory History</Text>
                      <Text style={styles.reportSubtitle}>
                        Date Range: {currentReport.dateRange?.startDate} to {currentReport.dateRange?.endDate}
                      </Text>

                      {inventoryHistory.map((session, index) => (
                        <View key={session.reference_number} style={styles.sessionCard}>
                          <Text style={styles.sessionHeader}>
                            📊 Session: {session.reference_number}
                          </Text>
                          <Text style={styles.sessionDate}>
                            Date: {session.date} | Status: {session.status}
                          </Text>
                          <Text style={styles.sessionStats}>
                            Total Items: {session.total_items} | Counted: {session.counted_items}
                          </Text>
                          {session.performed_by && (
                            <Text style={styles.sessionUser}>
                              Started by: {session.performed_by}
                            </Text>
                          )}

                          {session.items && session.items.length > 0 && (
                            <View style={styles.itemsList}>
                              <Text style={styles.itemsHeader}>Items Counted:</Text>
                              {session.items.slice(0, 10).map((item, itemIndex) => (
                                <View key={itemIndex} style={styles.itemRow}>
                                  <Text style={styles.itemName}>{item.product_name}</Text>
                                  <Text style={styles.itemQuantities}>
                                    System: {item.system_quantity} → Physical: {item.physical_quantity}
                                  </Text>
                                  {item.discrepancy !== 0 && (
                                    <Text style={[styles.itemDiscrepancy,
                                      item.discrepancy > 0 ? styles.positive : styles.negative]}>
                                      Diff: {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                                    </Text>
                                  )}
                                </View>
                              ))}
                              {session.items.length > 10 && (
                                <Text style={styles.moreItems}>
                                  ... and {session.items.length - 10} more items
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View>
                      <Paragraph style={styles.previewText}>
                        Report generated successfully!
                      </Paragraph>
                      <Paragraph style={styles.previewSubtext}>
                        Use the Print/Share button to export the report.
                      </Paragraph>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setReportVisible(false)}>Close</Button>
            {reportType === 'inventory' && (
              <Button onPress={printReport} mode="outlined">
                Export PDF
              </Button>
            )}
            {reportType !== 'inventory' && (
              <Button onPress={printReport} mode="contained">
                Print/Share
              </Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Inventory History Filter Dialog */}
      <Portal>
        <Dialog visible={inventoryFilterVisible} onDismiss={() => setInventoryFilterVisible(false)}>
          <Dialog.Title>Filter Inventory History Report</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ marginBottom: 16 }}>
              Select date range to filter physical inventory count sessions:
            </Paragraph>

            <TextInput
              label="Start Date"
              value={selectedDateRange.startDate}
              onChangeText={(date) => setSelectedDateRange({...selectedDateRange, startDate: date})}
              mode="outlined"
              style={{ marginBottom: 12 }}
              placeholder="YYYY-MM-DD"
            />

            <TextInput
              label="End Date"
              value={selectedDateRange.endDate}
              onChangeText={(date) => setSelectedDateRange({...selectedDateRange, endDate: date})}
              mode="outlined"
              style={{ marginBottom: 16 }}
              placeholder="YYYY-MM-DD"
            />

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <Button
                mode="outlined"
                compact
                onPress={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setSelectedDateRange({ startDate: today, endDate: today });
                }}
              >
                Today
              </Button>

              <Button
                mode="outlined"
                compact
                onPress={() => {
                  const today = new Date();
                  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  setSelectedDateRange({
                    startDate: lastWeek.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                  });
                }}
              >
                Last 7 Days
              </Button>

              <Button
                mode="outlined"
                compact
                onPress={() => {
                  const today = new Date();
                  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                  setSelectedDateRange({
                    startDate: lastMonth.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                  });
                }}
              >
                Last 30 Days
              </Button>
            </View>

            <Paragraph style={{ fontSize: 12, opacity: 0.7 }}>
              Selected range: {selectedDateRange.startDate} to {selectedDateRange.endDate}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInventoryFilterVisible(false)}>Cancel</Button>
            <Button
              onPress={generateInventoryHistoryReport}
              mode="contained"
              loading={loading}
              disabled={loading}
            >
              Generate Report
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  statsCard: {
    marginBottom: 16,
    elevation: 4,
  },
  reportsCard: {
    marginBottom: 16,
    elevation: 4,
  },
  transactionsCard: {
    marginBottom: 16,
    elevation: 4,
  },
  inventoryCard: {
    marginBottom: 16,
    elevation: 4,
  },
  discrepancyAmount: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardSubtitle: {
    opacity: 0.7,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  reportItem: {
    paddingVertical: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.7,
    paddingVertical: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  completedStatus: {
    color: '#4CAF50',
  },
  voidStatus: {
    color: '#F44336',
  },
  reportDialog: {
    maxHeight: '80%',
  },
  reportContent: {
    paddingHorizontal: 24,
  },
  reportPreview: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  previewText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  previewSubtext: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
  // On-screen report styles
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2196F3',
  },
  reportSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },
  sessionCard: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  sessionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#2196F3',
  },
  sessionDate: {
    fontSize: 12,
    marginBottom: 2,
    opacity: 0.8,
  },
  sessionStats: {
    fontSize: 12,
    marginBottom: 2,
    fontWeight: '500',
  },
  sessionUser: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  itemsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  itemsHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#333',
  },
  itemRow: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemQuantities: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 2,
  },
  itemDiscrepancy: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#F44336',
  },
  moreItems: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.6,
  },
});