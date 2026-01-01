import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  BackHandler,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  FAB,
  IconButton,
  useTheme,
  Dialog,
  Portal,
  Chip,
  Searchbar,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Brand } from '../database/schema';
import { StableTextInput } from '../components/StableTextInput';

type BrandsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Brands'>;

type Props = {
  navigation: BrandsScreenNavigationProp;
};

export default function BrandsScreen({ navigation }: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [initialFormData, setInitialFormData] = useState({ name: '', description: '' });
  const [showInactive, setShowInactive] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Check for unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  // Handle dialog dismiss with confirmation
  const handleDialogDismiss = useCallback(() => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => setDialogVisible(false) }
        ]
      );
    } else {
      setDialogVisible(false);
    }
  }, [hasUnsavedChanges]);

  // BackHandler effect for dialog
  useEffect(() => {
    if (!dialogVisible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hasUnsavedChanges()) {
        Alert.alert(
          'Discard Changes?',
          'You have unsaved changes. Are you sure you want to discard them?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => setDialogVisible(false) }
          ]
        );
        return true;
      }
      setDialogVisible(false);
      return true;
    });

    return () => backHandler.remove();
  }, [dialogVisible, hasUnsavedChanges]);

  useEffect(() => {
    loadBrands();
  }, [showInactive]);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      const brandList = await dbService.getBrands(!showInactive);
      setBrands(brandList);
    } catch (error) {
      console.error('Error loading brands:', error);
      Alert.alert('Error', 'Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
    });
    setEditingBrand(null);
  };

  const handleAddBrand = () => {
    const emptyForm = { name: '', description: '' };
    setFormData(emptyForm);
    setInitialFormData(emptyForm);
    setEditingBrand(null);
    setDialogVisible(true);
  };

  const handleEditBrand = (brand: Brand) => {
    const editForm = {
      name: brand.name,
      description: brand.description || '',
    };
    setFormData(editForm);
    setInitialFormData(editForm);
    setEditingBrand(brand);
    setDialogVisible(true);
  };

  const handleSaveBrand = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Brand name is required');
      return;
    }

    // Check for duplicate brand name
    const duplicateName = brands.find(
      (b) => b.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      (!editingBrand || b.id !== editingBrand.id)
    );

    if (duplicateName) {
      Alert.alert('Error', `Brand "${formData.name}" already exists. Please use a unique name.`);
      return;
    }

    setLoading(true);
    try {
      const dbService = getDatabase();

      if (editingBrand) {
        await dbService.updateBrand(editingBrand.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
        Alert.alert('Success', 'Brand updated successfully');
      } else {
        await dbService.createBrand({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
        Alert.alert('Success', 'Brand added successfully');
      }

      setDialogVisible(false);
      resetForm();
      await loadBrands();
    } catch (error: any) {
      console.error('Error saving brand:', error);
      if (error.message?.includes('UNIQUE constraint')) {
        Alert.alert('Error', 'A brand with this name already exists');
      } else {
        Alert.alert('Error', 'Failed to save brand');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = (brand: Brand) => {
    setBrandToDelete(brand);
    setDeleteDialogVisible(true);
  };

  const confirmDeleteBrand = async () => {
    if (!brandToDelete) return;

    setLoading(true);
    try {
      const dbService = getDatabase();
      await dbService.deleteBrand(brandToDelete.id, true); // Soft delete
      Alert.alert('Success', 'Brand deactivated successfully');
      setDeleteDialogVisible(false);
      setBrandToDelete(null);
      await loadBrands();
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      Alert.alert('Error', error.message || 'Failed to delete brand');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (brand: Brand) => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      await dbService.updateBrand(brand.id, { is_active: !brand.is_active });
      Alert.alert(
        'Success',
        `Brand "${brand.name}" has been ${brand.is_active ? 'deactivated' : 'activated'}`
      );
      await loadBrands();
    } catch (error) {
      console.error('Error toggling brand status:', error);
      Alert.alert('Error', 'Failed to update brand status');
    } finally {
      setLoading(false);
    }
  };

  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (brand.description && brand.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderBrand = ({ item }: { item: Brand }) => (
    <Card style={[styles.card, !item.is_active && styles.inactiveCard]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Title style={[styles.cardTitle, !item.is_active && styles.inactiveText]}>
              {item.name}
            </Title>
            {item.description && (
              <Paragraph style={styles.description}>{item.description}</Paragraph>
            )}
            <View style={styles.chipContainer}>
              <Chip
                compact
                style={[styles.statusChip, item.is_active ? styles.activeChip : styles.inactiveChip]}
                textStyle={styles.chipText}
              >
                {item.is_active ? 'Active' : 'Inactive'}
              </Chip>
            </View>
          </View>
          <View style={styles.cardActions}>
            <IconButton
              icon={item.is_active ? 'eye' : 'eye-off'}
              size={22}
              iconColor={item.is_active ? '#4CAF50' : '#9E9E9E'}
              onPress={() => handleToggleActive(item)}
            />
            <IconButton
              icon="pencil"
              size={22}
              iconColor={theme.colors.primary}
              onPress={() => handleEditBrand(item)}
            />
            <IconButton
              icon="delete"
              size={22}
              iconColor="#F44336"
              onPress={() => handleDeleteBrand(item)}
            />
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Searchbar
            placeholder="Search brands..."
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

        {loading && brands.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Paragraph style={styles.loadingText}>Loading brands...</Paragraph>
          </View>
        ) : (
          <FlatList
            data={filteredBrands}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderBrand}
            style={styles.list}
            contentContainerStyle={styles.listContainer}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadBrands();
              setRefreshing(false);
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Paragraph style={styles.emptyText}>
                  {searchQuery ? 'No brands found matching your search' : 'No brands available'}
                </Paragraph>
                <Button mode="outlined" onPress={handleAddBrand}>
                  Add First Brand
                </Button>
              </View>
            }
          />
        )}
      </View>

      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: insets.bottom + 16 }]}
        icon="plus"
        label="Add Brand"
        onPress={handleAddBrand}
      />

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleDialogDismiss}>
          <Dialog.Title>
            {editingBrand ? 'Edit Brand' : 'Add New Brand'}
          </Dialog.Title>
          <Dialog.Content>
            <StableTextInput
              label="Brand Name *"
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              mode="outlined"
              style={styles.input}
              autoFocus
            />
            <StableTextInput
              label="Description"
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleSaveBrand}
              loading={loading}
              disabled={loading}
            >
              {editingBrand ? 'Update' : 'Add'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Confirm Deactivation</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to deactivate the brand "{brandToDelete?.name}"?
            </Paragraph>
            <Paragraph style={styles.warningText}>
              This will hide the brand from selection lists but preserve the data.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={confirmDeleteBrand}
              loading={loading}
              disabled={loading}
              textColor="#F44336"
            >
              Deactivate
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    marginBottom: 16,
  },
  searchBar: {
    marginBottom: 8,
    elevation: 2,
  },
  filterButton: {
    alignSelf: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  list: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 100,
  },
  card: {
    marginBottom: 12,
    elevation: 3,
  },
  inactiveCard: {
    backgroundColor: '#F5F5F5',
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  inactiveText: {
    color: '#757575',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  statusChip: {
    marginRight: 8,
  },
  activeChip: {
    backgroundColor: '#E8F5E9',
  },
  inactiveChip: {
    backgroundColor: '#FFEBEE',
  },
  chipText: {
    fontSize: 11,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#666',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  warningText: {
    marginTop: 8,
    color: '#F57C00',
    fontStyle: 'italic',
  },
});
