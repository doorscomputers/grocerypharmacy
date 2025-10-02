import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  useTheme,
  Chip,
  Searchbar,
  Modal,
  Portal,
  Divider,
  FAB,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';

type CustomerManagementScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CustomerManagement'
>;

type Props = {
  navigation: CustomerManagementScreenNavigationProp;
};

export default function CustomerManagementScreen({ navigation }: Props) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Customer modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [customerData, setCustomerData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    tin: '',
    credit_terms: '30',
    credit_limit: '0',
    notes: '',
  });

  const theme = useTheme();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();
      const customersData = await dbService.getCustomers(false); // Include inactive
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCustomerData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      tin: '',
      credit_terms: '30',
      credit_limit: '0',
      notes: '',
    });
    setEditingCustomer(null);
  };

  const handleAdd = () => {
    resetForm();
    setModalVisible(true);
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setCustomerData({
      name: customer.name || '',
      contact_person: customer.contact_person || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      tin: customer.tin || '',
      credit_terms: customer.credit_terms?.toString() || '30',
      credit_limit: customer.credit_limit?.toString() || '0',
      notes: customer.notes || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!customerData.name.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }

    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();

      const saveData = {
        name: customerData.name.trim(),
        contact_person: customerData.contact_person.trim() || undefined,
        phone: customerData.phone.trim() || undefined,
        email: customerData.email.trim() || undefined,
        address: customerData.address.trim() || undefined,
        tin: customerData.tin.trim() || undefined,
        credit_terms: parseInt(customerData.credit_terms) || 30,
        credit_limit: parseFloat(customerData.credit_limit) || 0,
        notes: customerData.notes.trim() || undefined,
      };

      if (editingCustomer) {
        await dbService.updateCustomer(editingCustomer.id, saveData);
        Alert.alert('Success', 'Customer updated successfully');
      } else {
        await dbService.createCustomer(saveData);
        Alert.alert('Success', 'Customer created successfully');
      }

      setModalVisible(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error saving customer:', error);
      Alert.alert('Error', 'Failed to save customer');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (customer: any) => {
    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();

      await dbService.updateCustomer(customer.id, {
        is_active: !customer.is_active
      });

      Alert.alert('Success', `Customer ${customer.is_active ? 'deactivated' : 'activated'} successfully`);
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

  const renderCustomer = ({ item }: { item: any }) => (
    <Card style={styles.customerCard}>
      <Card.Content>
        <View style={styles.customerHeader}>
          <View style={styles.customerInfo}>
            <Title style={styles.customerName}>{item.name}</Title>
            <Paragraph style={styles.customerCode}>Code: {item.code}</Paragraph>
            {item.contact_person && (
              <Paragraph style={styles.contactPerson}>Contact: {item.contact_person}</Paragraph>
            )}
            {item.phone && (
              <Paragraph style={styles.phone}>Phone: {item.phone}</Paragraph>
            )}
            {item.email && (
              <Paragraph style={styles.email}>Email: {item.email}</Paragraph>
            )}
          </View>
          <View style={styles.customerStats}>
            <Chip
              style={[
                styles.statusChip,
                { backgroundColor: item.is_active ? '#4CAF50' : '#F44336' }
              ]}
              textStyle={{ color: 'white', fontSize: 10 }}
              compact
            >
              {item.is_active ? 'ACTIVE' : 'INACTIVE'}
            </Chip>
            <Paragraph style={styles.creditTerms}>
              Terms: {item.credit_terms} days
            </Paragraph>
            <Paragraph style={styles.creditLimit}>
              Limit: ₱{item.credit_limit?.toFixed(2) || '0.00'}
            </Paragraph>
          </View>
        </View>

        {item.address && (
          <Paragraph style={styles.address}>Address: {item.address}</Paragraph>
        )}

        {item.tin && (
          <Paragraph style={styles.tin}>TIN: {item.tin}</Paragraph>
        )}

        {item.notes && (
          <Paragraph style={styles.notes}>Notes: {item.notes}</Paragraph>
        )}

        <View style={styles.customerActions}>
          <Button
            mode="outlined"
            onPress={() => handleEdit(item)}
            style={styles.actionButton}
            compact
          >
            Edit
          </Button>
          <Button
            mode={item.is_active ? 'outlined' : 'contained'}
            onPress={() => handleToggleStatus(item)}
            style={styles.actionButton}
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
              No customers found. Tap the + button to add a customer.
            </Paragraph>
          </View>
        }
      />

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={handleAdd}
      />

      {/* Customer Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Title style={styles.modalTitle}>
            {editingCustomer ? 'Edit Customer' : 'Add Customer'}
          </Title>

          <View style={styles.modalContent}>
            <TextInput
              label="Customer Name *"
              value={customerData.name}
              onChangeText={(text) => setCustomerData({ ...customerData, name: text })}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Contact Person"
              value={customerData.contact_person}
              onChangeText={(text) => setCustomerData({ ...customerData, contact_person: text })}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Phone"
              value={customerData.phone}
              onChangeText={(text) => setCustomerData({ ...customerData, phone: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
            />

            <TextInput
              label="Email"
              value={customerData.email}
              onChangeText={(text) => setCustomerData({ ...customerData, email: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
            />

            <TextInput
              label="Address"
              value={customerData.address}
              onChangeText={(text) => setCustomerData({ ...customerData, address: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
            />

            <TextInput
              label="TIN"
              value={customerData.tin}
              onChangeText={(text) => setCustomerData({ ...customerData, tin: text })}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Credit Terms (Days)"
              value={customerData.credit_terms}
              onChangeText={(text) => setCustomerData({ ...customerData, credit_terms: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              label="Credit Limit"
              value={customerData.credit_limit}
              onChangeText={(text) => setCustomerData({ ...customerData, credit_limit: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              label="Notes"
              value={customerData.notes}
              onChangeText={(text) => setCustomerData({ ...customerData, notes: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.modalButton}
                loading={loading}
              >
                {editingCustomer ? 'Update' : 'Create'}
              </Button>
            </View>
          </View>
        </Modal>
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
    marginBottom: 16,
  },
  searchBar: {
    marginBottom: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 80, // Space for FAB
  },
  customerCard: {
    marginBottom: 16,
    elevation: 4,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerInfo: {
    flex: 1,
  },
  customerStats: {
    alignItems: 'flex-end',
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  customerCode: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  contactPerson: {
    fontSize: 14,
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    marginBottom: 2,
  },
  statusChip: {
    marginBottom: 8,
    alignSelf: 'flex-end',
  },
  creditTerms: {
    fontSize: 12,
    marginBottom: 2,
  },
  creditLimit: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  address: {
    fontSize: 14,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  tin: {
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.8,
  },
  notes: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  customerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
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
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  input: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 16,
  },
  modalButton: {
    flex: 1,
  },
});