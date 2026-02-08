import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Divider,
  FAB,
  Portal,
  Modal,
  Button,
  List,
  Chip,
  IconButton,
  Snackbar,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

// Manual content organized by sections
const MANUAL_SECTIONS = [
  {
    id: 'intro',
    title: '1. Introduction',
    icon: 'information',
    content: [
      {
        subtitle: 'What is IgoroTech Mobile POS?',
        text: 'IgoroTech Mobile POS is a Point of Sale system designed specifically for Philippine businesses. It runs on Android tablets and phones, works completely offline (no internet required), and includes all features needed for retail operations.',
      },
      {
        subtitle: 'Key Features',
        bullets: [
          'Sales processing with multiple payment methods',
          'Complete inventory tracking',
          'Customer and supplier management',
          'Sales reporting (Z-Reading, X-Reading, eJournal)',
          'Bluetooth thermal printer support',
          'VAT calculations (12% with vatable/exempt/zero-rated options)',
        ],
      },
    ],
  },
  {
    id: 'login',
    title: '2. Getting Started',
    icon: 'login',
    content: [
      {
        subtitle: 'First-Time Login',
        text: 'Enter your username and password to log in. Default credentials: Username "admin", Password "admin123". Change this immediately after first login!',
      },
      {
        subtitle: 'User Roles',
        bullets: [
          'Admin: Full system access - all features, settings, users',
          'Manager: Business operations - sales, inventory, reports',
          'Cashier: Sales only - process transactions, view products',
        ],
      },
      {
        subtitle: 'Initial Setup Checklist',
        bullets: [
          'Change the default admin password',
          'Enter your business information',
          'Enter your tax registration details',
          'Add your products',
          'Set up categories for products',
          'Configure your Bluetooth printer',
          'Create user accounts for your staff',
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    title: '3. Dashboard Overview',
    icon: 'view-dashboard',
    content: [
      {
        subtitle: 'Dashboard Cards',
        bullets: [
          "Today's Sales: Total sales amount for the current day",
          'Transactions: Number of completed transactions today',
          'Average Transaction: Average value per transaction',
          'Cash Sales: Total cash payments received',
        ],
      },
      {
        subtitle: 'Quick Action Buttons',
        bullets: [
          'New Sale: Go directly to the POS terminal',
          'Reports: Access all sales and inventory reports',
          'Inventory: View and manage product stock levels',
          'Settings: Access system configuration',
        ],
      },
    ],
  },
  {
    id: 'sales',
    title: '4. Making Sales',
    icon: 'cash-register',
    content: [
      {
        subtitle: 'Adding Products to Cart',
        bullets: [
          'Method 1: Tap on the product in the grid',
          'Method 2: Use the search bar to find products',
          'Method 3: Scan barcode using the camera',
        ],
      },
      {
        subtitle: 'Adjusting Quantities',
        text: 'Tap on an item in the cart to increase/decrease quantity. Use the trash icon to remove items completely.',
      },
      {
        subtitle: 'Retail vs Wholesale Pricing',
        text: 'Before adding items, select Retail or Wholesale mode. Items will use the selected price. You can mix both in the same cart - wholesale items show "WS" badge.',
      },
      {
        subtitle: 'Applying Discounts',
        bullets: [
          'Regular Discount: Tap "Discount" button, enter percentage or fixed amount',
          'SC/PWD Discount: Tap "SC/PWD" button, enter number of seniors/PWDs and total customers. System calculates 20% discount + VAT exemption automatically.',
        ],
      },
      {
        subtitle: 'Payment Methods',
        bullets: [
          'Cash: Enter amount tendered, system calculates change',
          'Card: Credit/debit card payment',
          'GCash/Online: Mobile payment apps (GCash, Maya, etc.)',
          'Check: Bank check payment',
          'Charge: Credit/Pay later - requires selecting a customer',
        ],
      },
      {
        subtitle: 'After the Sale',
        text: 'Receipt prints automatically (if printer connected). Invoice number is generated, stock is deducted, and transaction is recorded in the eJournal audit trail.',
      },
    ],
  },
  {
    id: 'products',
    title: '5. Product Management',
    icon: 'package-variant',
    content: [
      {
        subtitle: 'Adding a New Product',
        bullets: [
          'Required: Product Code, Name, Category, Unit, Selling Price',
          'Optional: Barcode, Cost Price, Wholesale Price, Reorder Level',
          'VAT Type: Vatable (12%), VAT Exempt, or Zero-Rated',
        ],
      },
      {
        subtitle: 'Managing Categories',
        text: 'Go to Master Data → Categories to add, edit, or delete product categories like Beverages, Canned Goods, Personal Care, etc.',
      },
      {
        subtitle: 'Managing Brands, Units, Sizes',
        text: 'Go to Master Data to manage Brands, Units (pcs, kg, L, etc.), and Sizes for your products.',
      },
    ],
  },
  {
    id: 'inventory',
    title: '6. Inventory Management',
    icon: 'warehouse',
    content: [
      {
        subtitle: 'Stock Status Indicators',
        bullets: [
          '✓ OK (Green): Stock above reorder level',
          '⚠ LOW (Yellow): Stock at or below reorder level',
          '✗ OUT (Red): Zero stock',
        ],
      },
      {
        subtitle: 'Inventory Movement Types',
        bullets: [
          'SALE: Stock deducted from customer purchase',
          'PURCHASE: Stock added from supplier delivery',
          'RETURN: Stock returned (customer or supplier)',
          'ADJUSTMENT: Manual stock correction',
          'DAMAGE: Stock written off due to damage',
          'COUNT: Adjustment from physical inventory',
        ],
      },
      {
        subtitle: 'Physical Inventory Count',
        text: 'Go to Inventory → Physical Inventory to start a stock count session. Count each product physically, enter actual quantities, and the system will show variances and adjust stock.',
      },
    ],
  },
  {
    id: 'customers',
    title: '7. Customer Management',
    icon: 'account-group',
    content: [
      {
        subtitle: 'Adding Customers',
        text: 'Go to Customers → Customer Management. Enter name, contact, address, TIN, and set credit limit for charge invoices.',
      },
      {
        subtitle: 'Customer Payments',
        text: 'Go to Customers → Customer Payments to record payments for outstanding balances. Select customer, enter payment amount and method.',
      },
      {
        subtitle: 'Accounts Receivable',
        text: 'View all customers with outstanding balances, aging analysis (current, 30, 60, 90+ days), and payment status.',
      },
    ],
  },
  {
    id: 'suppliers',
    title: '8. Supplier & Purchase Management',
    icon: 'truck-delivery',
    content: [
      {
        subtitle: 'Adding Suppliers',
        text: 'Go to Suppliers → Supplier Management. Enter business name, contact, address, TIN, and payment terms.',
      },
      {
        subtitle: 'Creating Purchase Orders',
        text: 'Go to Purchases → New Purchase. Select supplier, add products and quantities with costs. Tap "Receive & Save" when goods are delivered - stock updates automatically.',
      },
      {
        subtitle: 'Supplier Payments',
        text: 'Go to Suppliers → Supplier Payments to record payments. Select supplier, enter payment details.',
      },
    ],
  },
  {
    id: 'reports',
    title: '9. Reports',
    icon: 'file-chart',
    content: [
      {
        subtitle: 'Z-Reading (End of Day)',
        bullets: [
          'Daily sales summary report',
          'Recommended at the end of each business day',
          'Cumulative totals for the day',
          'Resets counters for next day',
          'Go to Reports → Z-Reading or End of Day',
        ],
      },
      {
        subtitle: 'X-Reading (Inquiry)',
        bullets: [
          'Mid-day sales inquiry (does NOT reset counters)',
          'Can be done multiple times',
          'For checking current sales status',
        ],
      },
      {
        subtitle: 'eJournal (Audit Trail)',
        text: 'Automatically records all sales, voids, returns, Z-Readings, and system events. Useful for auditing and record-keeping purposes.',
      },
      {
        subtitle: 'Other Reports',
        bullets: [
          'Sales Report: Complete transaction history with filters',
          'Inventory Reports: Stock levels, low stock, valuations',
          'Purchase Reports: Supplier purchases summary',
          'AR/AP Reports: Customer and supplier balances',
        ],
      },
    ],
  },
  {
    id: 'users',
    title: '10. User Management',
    icon: 'account-cog',
    content: [
      {
        subtitle: 'Creating User Accounts (Admin Only)',
        text: 'Go to Admin → User Management. Enter username, password, full name, and assign role (Admin, Manager, or Cashier).',
      },
      {
        subtitle: 'Customizing Permissions (Admin Only)',
        text: 'Go to Admin → Permission Management. Toggle permissions on/off for Manager and Cashier roles.',
      },
      {
        subtitle: 'Available Permissions',
        bullets: [
          'VIEW_DASHBOARD: Access main dashboard',
          'CREATE_SALE: Process sales transactions',
          'VOID_SALE / REFUND_SALE: Cancel or refund transactions',
          'MANAGE_PRODUCTS: Add/edit/delete products',
          'MANAGE_INVENTORY: Stock adjustments',
          'VIEW_REPORTS: Access report screens',
          'PERFORM_Z_READING / X_READING: Generate readings',
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: '11. Settings & Configuration',
    icon: 'cog',
    content: [
      {
        subtitle: 'Business Information',
        text: 'Enter your business name, address, contact number, and email. This appears on receipts and reports.',
      },
      {
        subtitle: 'Tax Settings',
        bullets: [
          'Tax Identification Number (TIN)',
          'POS Machine Serial Number',
        ],
      },
      {
        subtitle: 'VAT Settings',
        text: 'Default VAT rate is 12%. Products can be set as Vatable, VAT Exempt, or Zero-Rated.',
      },
    ],
  },
  {
    id: 'printing',
    title: '12. Bluetooth Printing',
    icon: 'printer',
    content: [
      {
        subtitle: 'Supported Printers',
        text: 'Works with standard ESC/POS thermal printers: 58mm (32 characters) or 80mm (48 characters) paper width.',
      },
      {
        subtitle: 'Setup Steps',
        bullets: [
          '1. Turn on your printer',
          '2. Pair in Android Settings → Bluetooth',
          '3. Go to Settings → Printer Settings in the app',
          '4. Tap "Scan for Printers" and select your printer',
          '5. Select paper width (58mm or 80mm)',
          '6. Tap "Test Print" to verify',
        ],
      },
      {
        subtitle: 'Troubleshooting',
        bullets: [
          'Printer not found: Check Bluetooth pairing in Android settings',
          'Garbled text: Verify paper width setting matches printer',
          'Not printing: Turn printer off/on, reconnect in app',
        ],
      },
    ],
  },
  {
    id: 'backup',
    title: '13. Backup & Data Management',
    icon: 'backup-restore',
    content: [
      {
        subtitle: 'Creating a Backup',
        text: 'Go to Settings → Backup & Restore → Create Backup. Share/save the backup file to cloud storage or another device.',
      },
      {
        subtitle: 'Recommended Backup Schedule',
        bullets: [
          'Daily: End of day (after Z-Reading)',
          'Weekly: To cloud storage (Google Drive, etc.)',
          'Monthly: To external storage or computer',
        ],
      },
      {
        subtitle: 'Restoring from Backup',
        text: 'WARNING: This replaces all current data! Go to Backup & Restore → Restore from Backup, select file, and confirm.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: '14. Troubleshooting',
    icon: 'wrench',
    content: [
      {
        subtitle: '"Unterminated Session" Warning',
        text: 'You have sales from previous days without Z-Reading. Go to End of Day screen and complete Z-Reading for each pending day.',
      },
      {
        subtitle: 'Login Failed',
        bullets: [
          'Check username/password (case-sensitive)',
          'Ensure account is Active (not deactivated)',
          'Try default admin: username "admin"',
        ],
      },
      {
        subtitle: 'Products Not Showing',
        bullets: [
          'Check if product is marked Active',
          'Check stock quantity (zero stock might be hidden)',
          'Clear category filter (select "All")',
        ],
      },
      {
        subtitle: 'App Crashes',
        bullets: [
          'Close and reopen the app',
          'Clear app cache in Android Settings',
          'Restart your device',
          'If persists, restore from backup',
        ],
      },
    ],
  },
  {
    id: 'quickref',
    title: '15. Quick Reference',
    icon: 'clipboard-list',
    content: [
      {
        subtitle: 'Daily Checklist - Start of Day',
        bullets: [
          '☐ Log in with your account',
          '☐ Check for unterminated sessions',
          '☐ Complete any pending Z-Readings',
          '☐ Test printer connection',
        ],
      },
      {
        subtitle: 'Daily Checklist - End of Day',
        bullets: [
          '☐ Do Cash Count',
          '☐ Generate X-Reading (optional)',
          '☐ Generate Z-Reading',
          '☐ Print and file Z-Reading report',
          '☐ Create backup',
        ],
      },
      {
        subtitle: 'Support',
        bullets: [
          'Contact your system administrator for technical support',
          'Keep regular backups of your data',
        ],
      },
    ],
  },
];

// Generate full HTML for PDF
const generateManualHtml = (): string => {
  let sectionsHtml = '';

  MANUAL_SECTIONS.forEach((section) => {
    let contentHtml = '';
    section.content.forEach((item) => {
      contentHtml += `<h3 style="color:#1976D2; margin-top:16px;">${item.subtitle}</h3>`;
      if (item.text) {
        contentHtml += `<p style="margin:8px 0; line-height:1.6;">${item.text}</p>`;
      }
      if (item.bullets) {
        contentHtml += '<ul style="margin:8px 0; padding-left:20px;">';
        item.bullets.forEach((bullet) => {
          contentHtml += `<li style="margin:4px 0; line-height:1.5;">${bullet}</li>`;
        });
        contentHtml += '</ul>';
      }
    });

    sectionsHtml += `
      <div style="page-break-inside:avoid; margin-bottom:24px;">
        <h2 style="color:#212121; border-bottom:2px solid #2196F3; padding-bottom:8px;">${section.title}</h2>
        ${contentHtml}
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>IgoroTech Mobile POS User Manual</title>
      <style>
        @page { margin: 20mm; }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #333;
          line-height: 1.5;
        }
        .cover {
          text-align: center;
          padding: 100px 20px;
          page-break-after: always;
        }
        .cover h1 {
          font-size: 32px;
          color: #1976D2;
          margin-bottom: 16px;
        }
        .cover h2 {
          font-size: 18px;
          color: #666;
          font-weight: normal;
        }
        .cover .version {
          margin-top: 40px;
          font-size: 14px;
          color: #999;
        }
        .toc {
          page-break-after: always;
        }
        .toc h2 {
          color: #1976D2;
          border-bottom: 2px solid #1976D2;
          padding-bottom: 8px;
        }
        .toc ul {
          list-style: none;
          padding: 0;
        }
        .toc li {
          padding: 8px 0;
          border-bottom: 1px dotted #ccc;
        }
        .content h2 {
          font-size: 18px;
        }
        .content h3 {
          font-size: 14px;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ccc;
          font-size: 10px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <!-- Cover Page -->
      <div class="cover">
        <h1>IgoroTech Mobile POS</h1>
        <h2>Complete User Manual & Tutorial</h2>
        <p style="margin-top:20px; color:#666;">
          Point of Sale System<br/>
          for Philippine Businesses
        </p>
        <div class="version">
          Version 1.0<br/>
          Generated: ${new Date().toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Manila'
          })}
        </div>
      </div>

      <!-- Table of Contents -->
      <div class="toc">
        <h2>Table of Contents</h2>
        <ul>
          ${MANUAL_SECTIONS.map(s => `<li>${s.title}</li>`).join('')}
        </ul>
      </div>

      <!-- Content -->
      <div class="content">
        ${sectionsHtml}
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>IgoroTech Mobile POS User Manual - Version 1.0</p>
        <p>© ${new Date().getFullYear()} IgoroTech. All rights reserved.</p>
        <p>For Philippine Businesses</p>
      </div>
    </body>
    </html>
  `;
};

const UserManualScreen: React.FC = () => {
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('intro');
  const [fabOpen, setFabOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });

  const showMessage = (message: string) => {
    setSnackbar({ visible: true, message });
  };

  const handleDownloadPdf = async () => {
    try {
      setLoading(true);
      setFabOpen(false);

      const html = generateManualHtml();

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html,
        width: 595, // A4 width in points
        height: 842, // A4 height in points
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showMessage('Sharing is not available on this device');
        return;
      }

      // Share/Download the PDF
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'IgoroTech POS User Manual',
        UTI: 'com.adobe.pdf',
      });

      showMessage('PDF generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showMessage('Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setLoading(true);
      setFabOpen(false);

      const html = generateManualHtml();

      // Print directly
      await Print.printAsync({
        html,
        width: 595,
        height: 842,
      });

      showMessage('Print dialog opened');
    } catch (error) {
      console.error('Error printing:', error);
      showMessage('Failed to print');
    } finally {
      setLoading(false);
    }
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const renderSectionContent = (content: any[]) => {
    return content.map((item, index) => (
      <View key={index} style={styles.contentItem}>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        {item.text && (
          <Paragraph style={styles.text}>{item.text}</Paragraph>
        )}
        {item.bullets && (
          <View style={styles.bulletList}>
            {item.bullets.map((bullet: string, bIndex: number) => (
              <View key={bIndex} style={styles.bulletItem}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Card.Content style={styles.headerContent}>
          <Title style={styles.headerTitle}>User Manual</Title>
          <Paragraph style={styles.headerSubtitle}>
            Complete Guide to IgoroTech Mobile POS
          </Paragraph>
          <View style={styles.chipRow}>
            <Chip icon="file-document" style={styles.chip}>Version 1.0</Chip>
            <Chip icon="shield-check" style={styles.chip}>Offline Ready</Chip>
          </View>
        </Card.Content>
      </Card>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <Card style={styles.loadingCard}>
            <Card.Content style={styles.loadingContent}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Generating PDF...</Text>
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Manual Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {MANUAL_SECTIONS.map((section) => (
          <Card key={section.id} style={styles.sectionCard}>
            <List.Accordion
              title={section.title}
              left={props => <List.Icon {...props} icon={section.icon} />}
              expanded={expandedSection === section.id}
              onPress={() => toggleSection(section.id)}
              style={styles.accordion}
              titleStyle={styles.accordionTitle}
            >
              <View style={styles.sectionContent}>
                {renderSectionContent(section.content)}
              </View>
            </List.Accordion>
          </Card>
        ))}

        {/* Bottom spacing for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB Group */}
      <Portal>
        <FAB.Group
          open={fabOpen}
          visible={!loading}
          icon={fabOpen ? 'close' : 'dots-vertical'}
          actions={[
            {
              icon: 'arrow-up',
              label: 'Back to Top',
              onPress: scrollToTop,
            },
            {
              icon: 'printer',
              label: 'Print Manual',
              onPress: handlePrint,
            },
            {
              icon: 'download',
              label: 'Download PDF',
              onPress: handleDownloadPdf,
            },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          fabStyle={styles.fab}
        />
      </Portal>

      {/* Snackbar */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbar({ ...snackbar, visible: false }),
        }}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 4,
    backgroundColor: '#1976D2',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#E3F2FD',
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: '#E3F2FD',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  sectionCard: {
    marginBottom: 8,
    elevation: 2,
  },
  accordion: {
    backgroundColor: '#FFFFFF',
  },
  accordionTitle: {
    fontWeight: '600',
    fontSize: 15,
  },
  sectionContent: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#FAFAFA',
  },
  contentItem: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: '#424242',
  },
  bulletList: {
    marginTop: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingRight: 16,
  },
  bulletDot: {
    fontSize: 14,
    color: '#1976D2',
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#424242',
  },
  fab: {
    backgroundColor: '#1976D2',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    padding: 24,
    borderRadius: 12,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#424242',
  },
});

export default UserManualScreen;
