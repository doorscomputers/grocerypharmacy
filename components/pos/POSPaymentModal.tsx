import React, { memo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
} from 'react-native';
import { Button, TextInput, IconButton, useTheme } from 'react-native-paper';
import POSNumericKeypad from './POSNumericKeypad';
import { CartTotals, DiscountState } from '../../hooks/usePOSCart';

// Format currency with commas
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

type PaymentMethod = 'CASH' | 'CARD' | 'CHECK' | 'ONLINE' | 'CHARGE_INVOICE';

interface Customer {
  id: number;
  name: string;
  phone?: string;
  code?: string;
  credit_limit?: number;
  outstanding_balance?: number;
}

interface POSPaymentModalProps {
  visible: boolean;
  totals: CartTotals;
  discount: DiscountState;
  customers: Customer[];
  onClose: () => void;
  onComplete: (data: {
    paymentMethod: PaymentMethod;
    amountTendered: number;
    customerId?: number;
    customerName?: string;
  }) => void;
  onQuickAddCustomer?: () => void;
  loading?: boolean;
}

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'CASH', label: 'Cash', icon: '💵' },
  { key: 'CARD', label: 'Card', icon: '💳' },
  { key: 'ONLINE', label: 'GCash/Maya', icon: '📱' },
  { key: 'CHECK', label: 'Check', icon: '📄' },
  { key: 'CHARGE_INVOICE', label: 'Charge', icon: '📋' },
];

function POSPaymentModal({
  visible,
  totals,
  discount,
  customers,
  onClose,
  onComplete,
  onQuickAddCustomer,
  loading = false,
}: POSPaymentModalProps) {
  const theme = useTheme();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPaymentMethod('CASH');
      setAmountTendered('');
      setSelectedCustomer(null);
      setShowCustomerList(false);
      setCustomerSearch('');
    }
  }, [visible]);

  // Calculate change
  const tenderedAmount = parseFloat(amountTendered) || 0;
  const changeAmount = tenderedAmount - totals.total;

  // Quick amount buttons
  const quickAmounts = [
    { label: 'Exact', value: totals.total },
    { label: '+₱100', value: Math.ceil(totals.total / 100) * 100 },
    { label: '+₱500', value: Math.ceil(totals.total / 500) * 500 },
    { label: '₱1000', value: 1000 },
  ];

  // Filter customers
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return true;
    const search = customerSearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(search) ||
      c.phone?.toLowerCase().includes(search) ||
      c.code?.toLowerCase().includes(search)
    );
  });

  const handleSelectQuickAmount = useCallback((value: number) => {
    setAmountTendered(value.toFixed(2));
  }, []);

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomerList(false);
    setCustomerSearch('');
  }, []);

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null);
  }, []);

  const handleComplete = useCallback(() => {
    // Validation
    if (paymentMethod === 'CHARGE_INVOICE' && !selectedCustomer) {
      Alert.alert('Customer Required', 'Please select a customer for charge invoice.');
      return;
    }

    if (paymentMethod !== 'CHARGE_INVOICE' && tenderedAmount < totals.total) {
      Alert.alert('Insufficient Payment', 'Amount tendered must be at least the total amount.');
      return;
    }

    onComplete({
      paymentMethod,
      amountTendered: paymentMethod === 'CHARGE_INVOICE' ? 0 : tenderedAmount,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
    });
  }, [paymentMethod, tenderedAmount, totals.total, selectedCustomer, onComplete]);

  const isValid = paymentMethod === 'CHARGE_INVOICE'
    ? selectedCustomer !== null
    : tenderedAmount >= totals.total;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Payment</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={onClose}
                style={styles.closeButton}
              />
            </View>

            {/* Customer Selection Modal */}
            {showCustomerList ? (
              <View style={styles.customerListContainer}>
                <View style={styles.customerSearchRow}>
                  <TextInput
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    mode="outlined"
                    style={styles.customerSearchInput}
                    dense
                    left={<TextInput.Icon icon="magnify" />}
                  />
                  <Button
                    mode="text"
                    onPress={() => setShowCustomerList(false)}
                  >
                    Cancel
                  </Button>
                </View>
                {/* Quick Add Customer Button */}
                {onQuickAddCustomer && (
                  <TouchableOpacity
                    style={styles.quickAddCustomerButton}
                    onPress={() => {
                      setShowCustomerList(false);
                      onQuickAddCustomer();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickAddCustomerIcon}>👤</Text>
                    <Text style={styles.quickAddCustomerText}>+ Quick Add New Customer</Text>
                  </TouchableOpacity>
                )}
                <FlatList
                  data={filteredCustomers}
                  keyExtractor={item => item.id.toString()}
                  style={styles.customerList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.customerItem}
                      onPress={() => handleSelectCustomer(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.customerItemLeft}>
                        <Text style={styles.customerName}>{item.name}</Text>
                        {item.phone && (
                          <Text style={styles.customerPhone}>{item.phone}</Text>
                        )}
                      </View>
                      {(item.credit_limit !== undefined || item.outstanding_balance !== undefined) && (
                        <View style={styles.customerItemRight}>
                          {item.outstanding_balance !== undefined && item.outstanding_balance > 0 && (
                            <Text style={styles.customerBalance}>
                              Bal: ₱{formatCurrency(item.outstanding_balance)}
                            </Text>
                          )}
                          {item.credit_limit !== undefined && item.credit_limit > 0 && (
                            <Text style={styles.customerCreditLimit}>
                              Limit: ₱{formatCurrency(item.credit_limit)}
                            </Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyCustomers}>No customers found</Text>
                  }
                />
              </View>
            ) : (
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Total Display */}
                <View style={styles.totalDisplay}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={[styles.totalAmount, { color: theme.colors.primary }]}>
                    ₱{formatCurrency(totals.total)}
                  </Text>
                  {discount.isSeniorCitizen && (
                    <Text style={styles.discountNote}>SC/PWD discount applied</Text>
                  )}
                </View>

                {/* Payment Methods */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Payment Method</Text>
                  <View style={styles.paymentMethods}>
                    {PAYMENT_METHODS.map(method => (
                      <TouchableOpacity
                        key={method.key}
                        style={[
                          styles.paymentMethodButton,
                          paymentMethod === method.key && {
                            backgroundColor: '#E3F2FD',
                            borderColor: theme.colors.primary,
                          },
                        ]}
                        onPress={() => setPaymentMethod(method.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.paymentMethodIcon}>{method.icon}</Text>
                        <Text
                          style={[
                            styles.paymentMethodLabel,
                            paymentMethod === method.key && { color: theme.colors.primary },
                          ]}
                        >
                          {method.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Customer Selection (for Charge Invoice) */}
                {paymentMethod === 'CHARGE_INVOICE' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Customer (Required)</Text>
                    {selectedCustomer ? (
                      <View style={styles.selectedCustomerContainer}>
                        <View style={styles.selectedCustomer}>
                          <View style={styles.selectedCustomerInfo}>
                            <Text style={styles.selectedCustomerName}>
                              {selectedCustomer.name}
                            </Text>
                            {selectedCustomer.phone && (
                              <Text style={styles.selectedCustomerPhone}>
                                {selectedCustomer.phone}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            style={styles.changeCustomerButton}
                            onPress={handleClearCustomer}
                          >
                            <Text style={styles.changeCustomerText}>Change</Text>
                          </TouchableOpacity>
                        </View>
                        {/* Show credit info for charge invoice */}
                        {(selectedCustomer.outstanding_balance !== undefined || selectedCustomer.credit_limit !== undefined) && (
                          <View style={styles.creditInfoBox}>
                            {selectedCustomer.outstanding_balance !== undefined && selectedCustomer.outstanding_balance > 0 && (
                              <View style={styles.creditInfoRow}>
                                <Text style={styles.creditInfoLabel}>Current Balance:</Text>
                                <Text style={styles.creditInfoValueRed}>₱{formatCurrency(selectedCustomer.outstanding_balance)}</Text>
                              </View>
                            )}
                            {selectedCustomer.credit_limit !== undefined && selectedCustomer.credit_limit > 0 && (
                              <View style={styles.creditInfoRow}>
                                <Text style={styles.creditInfoLabel}>Credit Limit:</Text>
                                <Text style={styles.creditInfoValue}>₱{formatCurrency(selectedCustomer.credit_limit)}</Text>
                              </View>
                            )}
                            <View style={styles.creditInfoRow}>
                              <Text style={styles.creditInfoLabel}>After This Sale:</Text>
                              <Text style={styles.creditInfoValueBold}>
                                ₱{formatCurrency((selectedCustomer.outstanding_balance || 0) + totals.total)}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.selectCustomerButton}
                        onPress={() => setShowCustomerList(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectCustomerText}>
                          Select Customer...
                        </Text>
                      </TouchableOpacity>
                    )}
                    <Text style={styles.chargeNote}>
                      This amount will be added to the customer's balance.
                    </Text>
                  </View>
                )}

                {/* Amount Tendered (for non-charge payments) */}
                {paymentMethod !== 'CHARGE_INVOICE' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Amount Tendered</Text>

                    {/* Quick Amount Buttons */}
                    <View style={styles.quickAmounts}>
                      {quickAmounts.map((qa, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.quickAmountButton,
                            tenderedAmount.toString() === qa.value.toFixed(2) && {
                              backgroundColor: theme.colors.primary,
                            },
                          ]}
                          onPress={() => handleSelectQuickAmount(qa.value)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.quickAmountText,
                              tenderedAmount.toString() === qa.value.toFixed(2) && {
                                color: '#FFFFFF',
                              },
                            ]}
                          >
                            {qa.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Amount Display */}
                    <View style={styles.amountDisplay}>
                      <Text style={styles.amountPrefix}>₱</Text>
                      <Text style={styles.amountValue}>
                        {amountTendered || '0.00'}
                      </Text>
                    </View>

                    {/* Numeric Keypad */}
                    <POSNumericKeypad
                      value={amountTendered}
                      onChange={setAmountTendered}
                      maxLength={10}
                      showDecimal={true}
                    />

                    {/* Change Display */}
                    {tenderedAmount >= totals.total && (
                      <View style={styles.changeDisplay}>
                        <Text style={styles.changeLabel}>Change</Text>
                        <Text style={styles.changeAmount}>
                          ₱{formatCurrency(changeAmount)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Optional Customer Selection (for non-charge) */}
                {paymentMethod !== 'CHARGE_INVOICE' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Customer (Optional)</Text>
                    {selectedCustomer ? (
                      <View style={styles.selectedCustomer}>
                        <View style={styles.selectedCustomerInfo}>
                          <Text style={styles.selectedCustomerName}>
                            {selectedCustomer.name}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.changeCustomerButton}
                          onPress={handleClearCustomer}
                        >
                          <Text style={styles.changeCustomerText}>Clear</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.selectCustomerButton, styles.selectCustomerButtonOptional]}
                        onPress={() => setShowCustomerList(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectCustomerTextOptional}>
                          + Add Customer
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            )}

            {/* Footer */}
            {!showCustomerList && (
              <View style={styles.footer}>
                <Button
                  mode="outlined"
                  onPress={onClose}
                  style={styles.cancelButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleComplete}
                  disabled={!isValid || loading}
                  loading={loading}
                  style={styles.completeButton}
                  contentStyle={styles.completeButtonContent}
                >
                  {paymentMethod === 'CHARGE_INVOICE'
                    ? 'Create Invoice'
                    : 'Complete Sale'}
                </Button>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
  },
  closeButton: {
    margin: 0,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: 500,
  },
  totalDisplay: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: '#616161',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  discountNote: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethodButton: {
    flex: 1,
    minWidth: 60,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  paymentMethodIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  paymentMethodLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#616161',
    textAlign: 'center',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
  },
  amountDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 16,
  },
  amountPrefix: {
    fontSize: 24,
    fontWeight: '600',
    color: '#616161',
    marginRight: 4,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#212121',
  },
  changeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginTop: 16,
  },
  changeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2E7D32',
  },
  changeAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  selectCustomerButton: {
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
    borderStyle: 'dashed',
  },
  selectCustomerButtonOptional: {
    backgroundColor: '#F5F5F5',
    borderColor: '#BDBDBD',
  },
  selectCustomerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E65100',
    textAlign: 'center',
  },
  selectCustomerTextOptional: {
    fontSize: 14,
    fontWeight: '500',
    color: '#616161',
    textAlign: 'center',
  },
  selectedCustomer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  selectedCustomerInfo: {
    flex: 1,
  },
  selectedCustomerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  selectedCustomerPhone: {
    fontSize: 13,
    color: '#616161',
    marginTop: 2,
  },
  changeCustomerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeCustomerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F44336',
  },
  chargeNote: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 8,
  },
  customerListContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    minHeight: 300,
  },
  customerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  customerSearchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  customerList: {
    flex: 1,
    minHeight: 200,
    maxHeight: 350,
  },
  customerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  customerItemLeft: {
    flex: 1,
  },
  customerItemRight: {
    alignItems: 'flex-end',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
  },
  customerPhone: {
    fontSize: 13,
    color: '#616161',
    marginTop: 2,
  },
  customerBalance: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
  },
  customerCreditLimit: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 2,
  },
  quickAddCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
  },
  quickAddCustomerIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  quickAddCustomerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  selectedCustomerContainer: {
    marginBottom: 8,
  },
  creditInfoBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  creditInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  creditInfoLabel: {
    fontSize: 13,
    color: '#616161',
  },
  creditInfoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#212121',
  },
  creditInfoValueRed: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F44336',
  },
  creditInfoValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
  },
  emptyCustomers: {
    textAlign: 'center',
    padding: 24,
    color: '#9E9E9E',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  completeButton: {
    flex: 2,
  },
  completeButtonContent: {
    paddingVertical: 4,
  },
});

export default memo(POSPaymentModal);
