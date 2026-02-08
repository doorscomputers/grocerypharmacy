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
  TextInput,
  List,
  FAB,
  IconButton,
  useTheme,
  Dialog,
  Portal,
  Chip,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Supplier } from '../database/schema';
import { StableTextInput } from '../components/StableTextInput';

type SupplierManagementScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'SupplierManagement'
>;

type Props = {
  navigation: SupplierManagementScreenNavigationProp;
};

export default function SupplierManagementScreen({ navigation }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form fields
  const [supplierCode, setSupplierCode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [tin, setTin] = useState('');
  const [creditTerms, setCreditTerms] = useState('30');
  const [creditLimit, setCreditLimit] = useState('');
  const [notes, setNotes] = useState('');

  const theme = useTheme();

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const supplierList = await dbService.getSuppliers(true);
      setSuppliers(supplierList);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      Alert.alert('Error', 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const generateSupplierCode = () => {
    const codeNumber = suppliers.length + 1;
    return `SUP${codeNumber.toString().padStart(3, '0')}`;
  };

  const clearForm = () => {
    setSupplierCode(generateSupplierCode());
    setSupplierName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setTin('');
    setCreditTerms('30');
    setCreditLimit('');
    setNotes('');
    setEditingSupplier(null);
  };

  const openAddDialog = () => {
    clearForm();
    setDialogVisible(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierCode(supplier.code);
    setSupplierName(supplier.name);
    setContactPerson(supplier.contact_person || '');
    setPhone(supplier.phone || '');
    setEmail(supplier.email || '');
    setAddress(supplier.address || '');
    setTin(supplier.tin || '');
    setCreditTerms(supplier.credit_terms?.toString() || '30');
    setCreditLimit(supplier.credit_limit?.toString() || '');
    setNotes(supplier.notes || '');
    setDialogVisible(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierName.trim() || !supplierCode.trim()) {
      Alert.alert('Error', 'Please enter supplier code and name');
      return;
    }

    // Check for duplicate supplier code
    const duplicateCode = suppliers.find(
      (s) => s.code.toLowerCase() === supplierCode.trim().toLowerCase() &&
      (!editingSupplier || s.id !== editingSupplier.id)
    );

    if (duplicateCode) {
      Alert.alert('Error', `Supplier code "${supplierCode}" already exists. Please use a unique code.`);
      return;
    }

    // Check for duplicate supplier name
    const duplicateName = suppliers.find(
      (s) => s.name.toLowerCase() === supplierName.trim().toLowerCase() &&
      (!editingSupplier || s.id !== editingSupplier.id)
    );

    if (duplicateName) {
      Alert.alert('Error', `Supplier "${supplierName}" already exists. Please use a unique name.`);
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

    // Validate credit terms and limit
    const parsedCreditTerms = parseInt(creditTerms);
    const parsedCreditLimit = parseFloat(creditLimit);
    if (isNaN(parsedCreditTerms) || parsedCreditTerms < 1 || parsedCreditTerms > 365) {
      Alert.alert('Error', 'Credit terms must be between 1 and 365 days');
      return;
    }
    if (isNaN(parsedCreditLimit) || parsedCreditLimit < 0) {
      Alert.alert('Error', 'Credit limit cannot be negative');
      return;
    }

    setLoading(true);

    try {
      const dbService = getDatabase();

      const supplierData = {
        code: supplierCode.trim(),
        name: supplierName.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        tin: tin.trim() || undefined,
        credit_terms: parsedCreditTerms,
        credit_limit: parsedCreditLimit,
        notes: notes.trim() || undefined,
      };

      if (editingSupplier) {
        // Update existing supplier
        await dbService.updateSupplier(editingSupplier.id, supplierData);
        Alert.alert('Success', 'Supplier updated successfully');
      } else {
        // Create new supplier
        await dbService.createSupplier(supplierData);
        Alert.alert('Success', 'Supplier created successfully');
      }

      setDialogVisible(false);
      clearForm();
      await loadSuppliers();
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      Alert.alert('Error', error?.message || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  const toggleSupplierStatus = async (supplier: Supplier) => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      await dbService.updateSupplier(supplier.id, {
        is_active: !supplier.is_active
      });

      Alert.alert(
        'Success',
        `Supplier ${supplier.is_active ? 'deactivated' : 'activated'} successfully`
      );

      await loadSuppliers();
    } catch (error) {
      console.error('Error toggling supplier status:', error);
      Alert.alert('Error', 'Failed to update supplier status');
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (supplier.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
  );

  const renderSupplier = ({ item }: { item: Supplier }) => (
    <Card style={styles.supplierCard}>
      <Card.Content>
        <View style={styles.supplierHeader}>
          <View style={styles.supplierInfo}>
            <Title style={styles.supplierName}>{item.name}</Title>
            <Paragraph style={styles.supplierCode}>Code: {item.code}</Paragraph>
            {item.contact_person && (
              <Paragraph style={styles.contactInfo}>
                Contact: {item.contact_person}
              </Paragraph>
            )}
            {item.phone && (
              <Paragraph style={styles.contactInfo}>Phone: {item.phone}</Paragraph>
            )}
            {item.email && (
              <Paragraph style={styles.contactInfo}>Email: {item.email}</Paragraph>
            )}
          </View>
          <View style={styles.supplierActions}>
            <Chip
              icon={item.is_active ? 'check-circle' : 'pause-circle'}
              style={[
                styles.statusChip,
                { backgroundColor: item.is_active ? '#E8F5E8' : '#FFF3E0' }
              ]}
              textStyle={{ color: item.is_active ? '#4CAF50' : '#FF9800' }}
            >
              {item.is_active ? 'Active' : 'Inactive'}
            </Chip>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.supplierDetails}>
          <View style={styles.detailRow}>
            <Paragraph style={styles.detailLabel}>Credit Terms:</Paragraph>
            <Paragraph style={styles.detailValue}>
              {item.credit_terms || 30} days
            </Paragraph>
          </View>
          <View style={styles.detailRow}>
            <Paragraph style={styles.detailLabel}>Credit Limit:</Paragraph>
            <Paragraph style={styles.detailValue}>
              ₱{(item.credit_limit || 0).toLocaleString()}
            </Paragraph>
          </View>
          {item.address && (
            <View style={styles.detailRow}>
              <Paragraph style={styles.detailLabel}>Address:</Paragraph>
              <Paragraph style={styles.detailValue}>{item.address}</Paragraph>
            </View>
          )}
          {item.notes && (
            <View style={styles.detailRow}>
              <Paragraph style={styles.detailLabel}>Notes:</Paragraph>
              <Paragraph style={styles.detailValue}>{item.notes}</Paragraph>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => openEditDialog(item)}
            style={styles.actionButton}
            icon="pencil"
          >
            Edit
          </Button>
          <Button
            mode="outlined"
            onPress={() => toggleSupplierStatus(item)}
            style={[
              styles.actionButton,
              { borderColor: item.is_active ? '#FF5722' : '#4CAF50' }
            ]}
            icon={item.is_active ? 'pause' : 'play'}
            textColor={item.is_active ? '#FF5722' : '#4CAF50'}
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
        <Title style={styles.headerTitle}>Supplier Management</Title>
        <TextInput
          label="Search Suppliers"
          value={searchQuery}
          onChangeText={setSearchQuery}
          mode="outlined"
          style={styles.searchInput}
          left={<TextInput.Icon icon="magnify" />}
          right={searchQuery ? (
            <TextInput.Icon
              icon="close"
              onPress={() => setSearchQuery('')}
            />
          ) : null}
          dense
        />
      </View>

      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSupplier}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadSuppliers}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              No suppliers found. Add your first supplier using the + button.
            </Paragraph>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={openAddDialog}
        label="Add Supplier"
        color="#FFFFFF"
      />

      {/* Add/Edit Supplier Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>
            {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
          </Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              <StableTextInput
                label="Supplier Code *"
                value={supplierCode}
                onChangeText={setSupplierCode}
                mode="outlined"
                style={styles.dialogInput}
                disabled={!!editingSupplier}
              />

              <StableTextInput
                label="Supplier Name *"
                value={supplierName}
                onChangeText={setSupplierName}
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
              />

              <StableTextInput
                label="Address"
                value={address}
                onChangeText={setAddress}
                mode="outlined"
                style={styles.dialogInput}
                multiline
                numberOfLines={3}
              />

              <StableTextInput
                label="TIN Number"
                value={tin}
                onChangeText={setTin}
                mode="outlined"
                style={styles.dialogInput}
              />

              <StableTextInput
                label="Credit Terms (days)"
                value={creditTerms}
                onChangeText={setCreditTerms}
                mode="outlined"
                style={styles.dialogInput}
                keyboardType="numeric"
              />

              <StableTextInput
                label="Credit Limit"
                value={creditLimit}
                onChangeText={setCreditLimit}
                mode="outlined"
                style={styles.dialogInput}
                keyboardType="numeric"
              />

              <StableTextInput
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                style={styles.dialogInput}
                multiline
                numberOfLines={3}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveSupplier} loading={loading}>
              {editingSupplier ? 'Update' : 'Create'}
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
    marginBottom: 16,
  },
  searchInput: {
    marginBottom: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  supplierCard: {
    marginBottom: 16,
    elevation: 4,
  },
  supplierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  supplierCode: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  contactInfo: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 2,
  },
  supplierActions: {
    alignItems: 'flex-end',
  },
  statusChip: {
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  supplierDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    opacity: 0.7,
    flex: 1,
  },
  detailValue: {
    fontSize: 12,
    flex: 2,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
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
    bottom: 70,
  },
  dialogContent: {
    maxHeight: 400,
  },
  dialogInput: {
    marginBottom: 16,
  },
});