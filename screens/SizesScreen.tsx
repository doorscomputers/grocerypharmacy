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
import { Size } from '../database/schema';
import { StableTextInput } from '../components/StableTextInput';

type SizesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Sizes'>;

type Props = {
  navigation: SizesScreenNavigationProp;
};

export default function SizesScreen({ navigation }: Props) {
  const [sizes, setSizes] = useState<Size[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [editingSize, setEditingSize] = useState<Size | null>(null);
  const [sizeToDelete, setSizeToDelete] = useState<Size | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sort_order: '0',
  });
  const [initialFormData, setInitialFormData] = useState({ name: '', description: '', sort_order: '0' });
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
    loadSizes();
  }, [showInactive]);

  const loadSizes = async () => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      const sizeList = await dbService.getSizes(!showInactive);
      setSizes(sizeList);
    } catch (error) {
      console.error('Error loading sizes:', error);
      Alert.alert('Error', 'Failed to load sizes');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sort_order: '0',
    });
    setEditingSize(null);
  };

  const handleAddSize = () => {
    const emptyForm = { name: '', description: '', sort_order: '0' };
    setFormData(emptyForm);
    setInitialFormData(emptyForm);
    setEditingSize(null);
    setDialogVisible(true);
  };

  const handleEditSize = (size: Size) => {
    const editForm = {
      name: size.name,
      description: size.description || '',
      sort_order: size.sort_order?.toString() || '0',
    };
    setFormData(editForm);
    setInitialFormData(editForm);
    setEditingSize(size);
    setDialogVisible(true);
  };

  const handleSaveSize = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Size name is required');
      return;
    }

    // Check for duplicate size name
    const duplicateName = sizes.find(
      (s) => s.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      (!editingSize || s.id !== editingSize.id)
    );

    if (duplicateName) {
      Alert.alert('Error', `Size "${formData.name}" already exists. Please use a unique name.`);
      return;
    }

    const sortOrder = parseInt(formData.sort_order) || 0;

    setLoading(true);
    try {
      const dbService = getDatabase();

      if (editingSize) {
        await dbService.updateSize(editingSize.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          sort_order: sortOrder,
        });
        Alert.alert('Success', 'Size updated successfully');
      } else {
        await dbService.createSize({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          sort_order: sortOrder,
        });
        Alert.alert('Success', 'Size added successfully');
      }

      setDialogVisible(false);
      resetForm();
      await loadSizes();
    } catch (error: any) {
      console.error('Error saving size:', error);
      Alert.alert('Error', error?.message || 'Failed to save size');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSize = (size: Size) => {
    setSizeToDelete(size);
    setDeleteDialogVisible(true);
  };

  const confirmDeleteSize = async () => {
    if (!sizeToDelete) return;

    setLoading(true);
    try {
      const dbService = getDatabase();
      await dbService.deleteSize(sizeToDelete.id, true); // Soft delete
      Alert.alert('Success', 'Size deactivated successfully');
      setDeleteDialogVisible(false);
      setSizeToDelete(null);
      await loadSizes();
    } catch (error: any) {
      console.error('Error deleting size:', error);
      Alert.alert('Error', error.message || 'Failed to delete size');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (size: Size) => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      await dbService.updateSize(size.id, { is_active: !size.is_active });
      Alert.alert(
        'Success',
        `Size "${size.name}" has been ${size.is_active ? 'deactivated' : 'activated'}`
      );
      await loadSizes();
    } catch (error) {
      console.error('Error toggling size status:', error);
      Alert.alert('Error', 'Failed to update size status');
    } finally {
      setLoading(false);
    }
  };

  const filteredSizes = sizes.filter(size =>
    size.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (size.description && size.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderSize = ({ item }: { item: Size }) => (
    <Card style={[styles.card, !item.is_active && styles.inactiveCard]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <View style={styles.titleRow}>
              <Title style={[styles.cardTitle, !item.is_active && styles.inactiveText]}>
                {item.name}
              </Title>
              {item.sort_order !== undefined && item.sort_order !== 0 && (
                <Chip compact style={styles.orderChip} textStyle={styles.orderText}>
                  #{item.sort_order}
                </Chip>
              )}
            </View>
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
              onPress={() => handleEditSize(item)}
            />
            <IconButton
              icon="delete"
              size={22}
              iconColor="#F44336"
              onPress={() => handleDeleteSize(item)}
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
            placeholder="Search sizes..."
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

        {loading && sizes.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Paragraph style={styles.loadingText}>Loading sizes...</Paragraph>
          </View>
        ) : (
          <FlatList
            data={filteredSizes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderSize}
            style={styles.list}
            contentContainerStyle={styles.listContainer}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadSizes();
              setRefreshing(false);
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Paragraph style={styles.emptyText}>
                  {searchQuery ? 'No sizes found matching your search' : 'No sizes available'}
                </Paragraph>
                <Button mode="outlined" onPress={handleAddSize}>
                  Add First Size
                </Button>
              </View>
            }
          />
        )}
      </View>

      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: insets.bottom + 16 }]}
        icon="plus"
        label="Add Size"
        color="#FFFFFF"
        onPress={handleAddSize}
      />

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleDialogDismiss}>
          <Dialog.Title>
            {editingSize ? 'Edit Size' : 'Add New Size'}
          </Dialog.Title>
          <Dialog.Content>
            <StableTextInput
              label="Size Name *"
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Small, Medium, Large, 500ml"
              autoFocus
            />
            <StableTextInput
              label="Sort Order"
              value={formData.sort_order}
              onChangeText={(text) => setFormData(prev => ({ ...prev, sort_order: text.replace(/[^0-9]/g, '') }))}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              placeholder="0 (lower values appear first)"
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
              onPress={handleSaveSize}
              loading={loading}
              disabled={loading}
            >
              {editingSize ? 'Update' : 'Add'}
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
              Are you sure you want to deactivate the size "{sizeToDelete?.name}"?
            </Paragraph>
            <Paragraph style={styles.warningText}>
              This will hide the size from selection lists but preserve the data.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={confirmDeleteSize}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  inactiveText: {
    color: '#757575',
  },
  orderChip: {
    backgroundColor: '#FFF3E0',
  },
  orderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#E65100',
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
    bottom: 70,
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
