import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { getDatabase } from '../../database/getDatabase';
import { formatDateTime } from '../../utils/dateTime';
import { useResponsiveTheme } from '../../utils/responsive';

interface Transaction {
  id: number;
  invoice_number: string;
  transaction_number: string;
  transaction_date: string;
  total_amount: number;
  payment_method: string;
  cashier_name: string;
  customer_name?: string;
  status: string;
}

interface POSReprintModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTransaction: (transactionId: number) => void;
}

export default function POSReprintModal({
  visible,
  onClose,
  onSelectTransaction,
}: POSReprintModalProps) {
  const { sp, fs, lo } = useResponsiveTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTodayTransactions();
    }
  }, [visible]);

  const loadTodayTransactions = async () => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      // Get today's date in YYYY-MM-DD format (Manila timezone)
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      const todayTransactions = await dbService.getTransactionsByDate(today);
      // Filter only completed transactions
      const completed = todayTransactions.filter((t: Transaction) => t.status === 'COMPLETED');
      setTransactions(completed);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (transaction: Transaction) => {
    onClose();
    setTimeout(() => {
      onSelectTransaction(transaction.id);
    }, 100);
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });
    } catch {
      return dateString;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      'CASH': 'Cash',
      'CARD': 'Card',
      'CHECK': 'Check',
      'ONLINE': 'Online',
      'CHARGE_INVOICE': 'Charge',
    };
    return methods[method] || method;
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      style={styles.transactionItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.transactionLeft}>
        <Text style={[styles.invoiceNumber, { fontSize: fs.body }]}>{item.invoice_number}</Text>
        <Text style={styles.transactionTime}>{formatTime(item.transaction_date)}</Text>
        {item.customer_name && (
          <Text style={styles.customerName}>{item.customer_name}</Text>
        )}
      </View>
      <View style={styles.transactionRight}>
        <Text style={styles.totalAmount}>{formatCurrency(item.total_amount)}</Text>
        <Text style={styles.paymentMethod}>{getPaymentMethodLabel(item.payment_method)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.container, { maxWidth: lo.modalMaxWidth }]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { fontSize: fs.h3 }]}>Reprint Receipt</Text>
            <IconButton icon="close" size={24} onPress={onClose} />
          </View>

          {/* Subtitle */}
          <View style={styles.subtitle}>
            <Text style={styles.subtitleText}>Today's Transactions</Text>
            <Text style={styles.countText}>{transactions.length} transaction(s)</Text>
          </View>

          {/* Transaction List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>Loading transactions...</Text>
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Transactions Today</Text>
              <Text style={styles.emptySubtitle}>
                Complete a sale to see transactions here
              </Text>
            </View>
          ) : (
            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderTransaction}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Select a transaction to reprint its receipt
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  subtitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
  },
  subtitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
  },
  countText: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#616161',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  transactionLeft: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1976D2',
  },
  transactionTime: {
    fontSize: 13,
    color: '#616161',
    marginTop: 2,
  },
  customerName: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2E7D32',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
});
