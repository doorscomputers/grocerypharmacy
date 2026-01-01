import React, { useState, useEffect } from 'react';
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
  Searchbar,
  Dialog,
  Portal,
  Divider,
  FAB,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Customer } from '../database/schema';
import { StableTextInput } from '../components/StableTextInput';

type CustomerManagementScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CustomerManagement'
>;

type Props = {
  navigation: CustomerManagementScreenNavigationProp;
};

export default function CustomerManagementScreen({ navigation }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [tin, setTin] = useState('');
  const [creditTerms, setCreditTerms] = useState('30');
  const [creditLimit, setCreditLimit] = useState('0');
  const [notes, setNotes] = useState('');

  const theme = useTheme();

  useEffect(() => {
    loadData();
  }, [showInactive]);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const customersData = await dbService.getCustomers(!showInactive);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setTin('');
    setCreditTerms('30');
    setCreditLimit('0');
    setNotes('');
    setEditingCustomer(null);
  };

  const openAddDialog = () => {
    clearForm();
    setDialogVisible(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setContactPerson(customer.contact_person || '');
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setAddress(customer.address || '');
    setTin(customer.tin || '');
    setCreditTerms(customer.credit_terms?.toString() || '30');
    setCreditLimit(customer.credit_limit?.toString() || '0');
    setNotes(customer.notes || '');
    setDialogVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }

    // Check for duplicate customer name
    const duplicateName = customers.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase() &&
      (!editingCustomer || c.id !== editingCustomer.id)
    );

    if (duplicateName) {
      Alert.alert('Error', `Customer "${name}" already exists. Please use a unique name.`);
      return;
    }

    // Validate credit terms (1-365 days)
    const parsedCreditTerms = parseInt(creditTerms);
    if (isNaN(parsedCreditTerms) || parsedCreditTerms < 1 || parsedCreditTerms > 365) {
      Alert.alert('Error', 'Credit terms must be between 1 and 365 days');
      return;
    }

    // Validate credit limit (non-negative)
    const parsedCreditLimit = parseFloat(creditLimit);
    if (isNaN(parsedCreditLimit) || parsedCreditLimit < 0) {
      Alert.alert('Error', 'Credit limit cannot be negative');
      return;
    }

    // Validate email format if provided
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        Alert.alert('Error', 'Please enter a valid email address');
        return;
      }
    }

    try {
      setLoading(true);
      const dbService = getDatabase();

      const saveData = {
        name: name.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        tin: tin.trim() || undefined,
        credit_terms: parsedCreditTerms,
        credit_limit: parsedCreditLimit,
        notes: notes.trim() || undefined,
      };

      if (editingCustomer) {
        await dbService.updateCustomer(editingCustomer.id, saveData);
        Alert.alert('Success', 'Customer updated successfully');
      } else {
        await dbService.createCustomer(saveData);
        Alert.alert('Success', 'Customer created successfully');
      }

      setDialogVisible(false);
      clearForm();
      await loadData();
    } catch (error) {
      console.error('Error saving customer:', error);
      Alert.alert('Error', 'Failed to save customer');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (customer: Customer) => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      await dbService.updateCustomer(customer.id, {
        is_active: !customer.is_active
      });

      Alert.alert(
        'Success',
        `Customer ${customer.is_active ? 'deactivated' : 'activated'} successfully`
      );
      await loadData();
    } catch (error) {
      console.error('Error toggling customer status:', error);
      Alert.alert('Error', 'Failed to update customer status');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(query) ||
      customer.code?.toLowerCase().includes(query) ||
      customer.contact_person?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
  });

  const formatCurrency = (amount: number) => {
    return `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderCustomer = ({ item }: { item: Customer }) => (
    <Card style={[styles.customerCard, !item.is_active && styles.inactiveCard]}>
      <Card.Content>
        <View style={styles.customerHeader}>
          <View style={styles.customerInfo}>
            <Title style={[styles.customerName, !item.is_active && styles.inactiveText]}>
              {item.name}
            </Title>
            <Paragraph style={styles.customerCode}>Code: {item.code}</Paragraph>
          </View>
          <Chip
            compact
            style={[
              styles.statusChip,
              { backgroundColor: item.is_active ? '#E8F5E9' : '#FFEBEE' }
            ]}
            textStyle={{
              color: item.is_active ? '#4CAF50' : '#F44336',
              fontSize: 11,
              fontWeight: 'bold'
            }}
          >
            {item.is_active ? 'Active' : 'Inactive'}
          </Chip>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.detailsSection}>
          {item.contact_person && (
            <View style={styles.detailRow}>
              <Paragraph style={styles.detailLabel}>Contact:</Paragraph>
              <Paragraph style={styles.detailValue}>{item.contact_person}</Paragraph>
            </View>
          )}
          {item.phone && (
            <View style={styles.detailRow}>
              <Paragraph style={styles.detailLabel}>Phone:</Paragraph>
              <Paragraph style={styles.detailValue}>{item.phone}</Paragraph>
            </View>
          )}
          {item.email && (
            <View style={styles.detailRow}>
              <Paragraph style={styles.detailLabel}>Email:</Paragraph>
              <Paragraph style={styles.detailValue}>{item.email}</Paragraph>
            </View>
          )}
          {item.address && (
            <View style={styles.detailRow}>
              <Paragraph style={styles.detailLabel}>Address:</Paragraph>
              <Paragraph style={styles.detailValue}>{item.address}</Paragraph>
            </View>
          )}
          {item.tin && (
            <View style={styles.detailRow}>
              <Paragraph style={styles.detailLabel}>TIN:</Paragraph>
              <Paragraph style={styles.detailValue}>{item.tin}</Paragraph>
            </View>
          )}
          <View style={styles.detailRow}>
            <Paragraph style={styles.detailLabel}>Credit Terms:</Paragraph>
            <Paragraph style={styles.detailValue}>{item.credit_terms || 30} days</Paragraph>
          </View>
          <View style={styles.detailRow}>
            <Paragraph style={styles.detailLabel}>Credit Limit:</Paragraph>
            <Paragraph style={[styles.detailValue, styles.creditAmount]}>
              {formatCurrency(item.credit_limit || 0)}
            </Paragraph>
          </View>
          {item.notes && (
            <View style={styles.notesRow}>
              <Paragraph style={styles.detailLabel}>Notes:</Paragraph>
              <Paragraph style={styles.notesText}>{item.notes}</Paragraph>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => openEditDialog(item)}
            style={styles.actionButton}
            icon="pencil"
            compact
          >
            Edit
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleToggleStatus(item)}
            style={[
              styles.actionButton,
              { borderColor: item.is_active ? '#FF5722' : '#4CAF50' }
            ]}
            icon={item.is_active ? 'account-cancel' : 'account-check'}
            textColor={item.is_active ? '#FF5722' : '#4CAF50'}
            compact
          >
            {item.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Customer Management</Title>
        <Searchbar
          placeholder="Search customers..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        <Button
          mode={showInactive ? 'contained' : 'outlined'}
          compact
          onPress={() => setShowInactive(!showInactive)}
          style={styles.filterButton}
        >
          {showInactive ? 'Show Active Only' : 'Show All'}
        </Button>
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCustomer}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              {searchQuery
                ? 'No customers found matching your search.'
                : 'No customers found. Tap the + button to add a customer.'}
            </Paragraph>
          </View>
        }
      />

      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        icon="plus"
        label="Add Customer"
        onPress={openAddDialog}
      />

      {/* Add/Edit Customer Dialog */}
      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>
            {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView showsVerticalScrollIndicator={true}>
              <View style={styles.dialogContent}>
                <StableTextInput
                  label="Customer Name *"
                  value={name}
                  onChangeText={setName}
                  mode="outlined"
                  style={styles.dialogInput}
                />

                <StableTextInput
                  label="Contact Person"
                  value={contactPerson}
                  onChangeText={setContactPerson}
                  mode="outlined"
                  style={styles.dialogInput}
                />

                <StableTextInput
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  mode="outlined"
                  style={styles.dialogInput}
                  keyboardType="phone-pad"
                />

                <StableTextInput
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  mode="outlined"
                  style={styles.dialogInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <StableTextInput
                  label="Address"
                  value={address}
                  onChangeText={setAddress}
                  mode="outlined"
                  style={styles.dialogInput}
                  multiline
                  numberOfLines={2}
                />

                <StableTextInput
                  label="TIN Number"
                  value={tin}
                  onChangeText={setTin}
                  mode="outlined"
                  style={styles.dialogInput}
                />

                <View style={styles.rowInputs}>
                  <StableTextInput
                    label="Credit Terms (days)"
                    value={creditTerms}
                    onChangeText={setCreditTerms}
                    mode="outlined"
                    style={[styles.dialogInput, styles.halfInput]}
                    keyboardType="numeric"
                  />
                  <StableTextInput
                    label="Credit Limit (₱)"
                    value={creditLimit}
                    onChangeText={setCreditLimit}
                    mode="outlined"
                    style={[styles.dialogInput, styles.halfInput]}
                    keyboardType="numeric"
                  />
                </View>

                <StableTextInput
                  label="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  mode="outlined"
                  style={styles.dialogInput}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleSave}
              loading={loading}
              mode="contained"
            >
              {editingCustomer ? 'Update' : 'Create'}
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
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  searchBar: {
    marginBottom: 8,
    elevation: 2,
  },
  filterButton: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  customerCard: {
    marginBottom: 12,
    elevation: 3,
  },
  inactiveCard: {
    backgroundColor: '#F5F5F5',
    opacity: 0.85,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  inactiveText: {
    color: '#757575',
  },
  customerCode: {
    fontSize: 12,
    color: '#666',
  },
  statusChip: {
    marginLeft: 8,
  },
  divider: {
    marginVertical: 12,
  },
  detailsSection: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#555',
    width: 90,
  },
  detailValue: {
    fontSize: 13,
    flex: 1,
    color: '#333',
  },
  creditAmount: {
    fontWeight: 'bold',
    color: '#1976D2',
  },
  notesRow: {
    marginTop: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
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
    color: '#666',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  dialog: {
    maxHeight: '85%',
  },
  dialogScrollArea: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  dialogContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  dialogInput: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
});
