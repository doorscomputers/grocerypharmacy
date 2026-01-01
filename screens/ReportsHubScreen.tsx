import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Card, Title, Paragraph, useTheme, List, Divider } from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'ReportsHub'>;
};

interface ReportCategory {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  reports: ReportItem[];
}

interface ReportItem {
  title: string;
  description: string;
  icon: string;
  screen?: keyof RootStackParamList;
  action?: string;
}

export default function ReportsHubScreen({ navigation }: Props) {
  const theme = useTheme();

  const reportCategories: ReportCategory[] = [
    {
      title: 'Sales Reports',
      subtitle: 'Transaction and revenue reports',
      icon: 'cash-register',
      color: '#4CAF50',
      reports: [
        { title: 'Sales Report', description: 'Complete sales with filters & analysis', icon: 'file-chart', screen: 'SalesReport' },
        { title: 'Z-Reading (End of Day)', description: 'Daily closing report - resets counters', icon: 'calculator', screen: 'EndOfDay' },
        { title: 'X-Reading (Inquiry)', description: 'Current sales inquiry - no reset', icon: 'poll', screen: 'Reports' },
        { title: 'Sales by Product', description: 'Top selling products report', icon: 'chart-bar', screen: 'SalesReport' },
        { title: 'Sales by Category', description: 'Sales breakdown by category', icon: 'chart-pie', screen: 'SalesReport' },
      ]
    },
    {
      title: 'Inventory Reports',
      subtitle: 'Stock levels and movements',
      icon: 'package-variant',
      color: '#2196F3',
      reports: [
        { title: 'Current Stock Levels', description: 'View all product quantities', icon: 'clipboard-list', screen: 'Products' },
        { title: 'Low Stock Alert', description: 'Products below reorder level', icon: 'alert', screen: 'Products' },
        { title: 'Item Ledger', description: 'All inventory movements by product', icon: 'history', screen: 'InventoryMovements' },
        { title: 'Stock Valuation', description: 'Total inventory value report', icon: 'currency-php', screen: 'Products' },
        { title: 'Physical Count History', description: 'Past physical count sessions', icon: 'counter', screen: 'Reports' },
        { title: 'Damaged Items Report', description: 'History of damaged inventory', icon: 'package-variant-closed-remove', screen: 'DamagedItemsHistory' },
      ]
    },
    {
      title: 'Purchase Reports',
      subtitle: 'Supplier purchases and receiving',
      icon: 'truck-delivery',
      color: '#FF9800',
      reports: [
        { title: 'Purchase Report', description: 'All purchases with filtering & summary', icon: 'receipt', screen: 'PurchaseReport' },
        { title: 'Delivered Items Report', description: 'Items received from suppliers', icon: 'package-variant-closed-check', screen: 'DeliveredItemsReport' },
        { title: 'Purchase Returns Report', description: 'Returns to suppliers', icon: 'truck-delivery-outline', screen: 'PurchaseReturnsReport' },
        { title: 'Purchases by Supplier', description: 'Purchase summary per supplier', icon: 'account-group', screen: 'PurchaseReport' },
      ]
    },
    {
      title: 'Accounts Receivable',
      subtitle: 'Customer balances and collections',
      icon: 'account-cash',
      color: '#9C27B0',
      reports: [
        { title: 'AR Report & Aging', description: 'Customer balances with aging analysis', icon: 'account-alert', screen: 'AccountsReceivableReport' },
        { title: 'Sales Returns Report', description: 'Customer returns and refunds', icon: 'cash-refund', screen: 'SalesReturnsReport' },
        { title: 'Customer Payments', description: 'Collect payments from customers', icon: 'cash-plus', screen: 'CustomerPayments' },
        { title: 'Customer Ledger', description: 'Transaction history per customer', icon: 'book-account', screen: 'CustomerManagement' },
      ]
    },
    {
      title: 'Accounts Payable',
      subtitle: 'Supplier balances and payments',
      icon: 'credit-card-outline',
      color: '#E91E63',
      reports: [
        { title: 'AP Report & Aging', description: 'Supplier balances with aging analysis', icon: 'account-alert-outline', screen: 'AccountsPayableReport' },
        { title: 'Purchase Returns Report', description: 'Returns to suppliers', icon: 'truck-delivery-outline', screen: 'PurchaseReturnsReport' },
        { title: 'Supplier Payments', description: 'Make payments to suppliers', icon: 'cash-minus', screen: 'SupplierPayments' },
        { title: 'Supplier Ledger', description: 'Transaction history per supplier', icon: 'book-account-outline', screen: 'SupplierManagement' },
      ]
    },
  ];

  const handleReportPress = (report: ReportItem) => {
    if (report.screen) {
      navigation.navigate(report.screen as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <Title style={styles.pageTitle}>Reports Hub</Title>
          <Paragraph style={styles.pageSubtitle}>
            Access all business reports in one place
          </Paragraph>
        </View>

        {reportCategories.map((category, categoryIndex) => (
          <Card key={categoryIndex} style={styles.categoryCard}>
            <Card.Content>
              <View style={styles.categoryHeader}>
                <List.Icon icon={category.icon} color={category.color} />
                <View style={styles.categoryTitleContainer}>
                  <Title style={[styles.categoryTitle, { color: category.color }]}>
                    {category.title}
                  </Title>
                  <Paragraph style={styles.categorySubtitle}>
                    {category.subtitle}
                  </Paragraph>
                </View>
              </View>

              <Divider style={styles.divider} />

              {category.reports.map((report, reportIndex) => (
                <React.Fragment key={reportIndex}>
                  <List.Item
                    title={report.title}
                    description={report.description}
                    left={props => <List.Icon {...props} icon={report.icon} color={category.color} />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                    onPress={() => handleReportPress(report)}
                    style={styles.reportItem}
                    titleStyle={styles.reportTitle}
                    descriptionStyle={styles.reportDescription}
                  />
                  {reportIndex < category.reports.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </Card.Content>
          </Card>
        ))}

        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            Tip: Most reports can be exported to PDF for printing or sharing
          </Paragraph>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...Platform.select({
      web: {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      },
    }),
  },
  scrollView: {
    flex: 1,
    ...Platform.select({
      web: {
        height: '100%',
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  header: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  pageSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  categoryCard: {
    marginBottom: 16,
    elevation: 3,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  categorySubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: -4,
  },
  divider: {
    marginVertical: 8,
  },
  reportItem: {
    paddingVertical: 4,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  reportDescription: {
    fontSize: 12,
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
    fontStyle: 'italic',
  },
});
