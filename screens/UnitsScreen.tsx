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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Unit } from '../database/schema';
import { StableTextInput } from '../components/StableTextInput';
import { useResponsiveTheme } from '../utils/responsive';

type UnitsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Units'>;

type Props = {
  navigation: UnitsScreenNavigationProp;
};

export default function UnitsScreen({ navigation }: Props) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    description: '',
  });
  const [initialFormData, setInitialFormData] = useState({ name: '', abbreviation: '', description: '' });
  const [showInactive, setShowInactive] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { sp, fs, lo } = useResponsiveTheme();

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
    loadUnits();
  }, [showInactive]);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      const unitList = await dbService.getUnits(!showInactive);
      setUnits(unitList);
    } catch (error) {
      console.error('Error loading units:', error);
      Alert.alert('Error', 'Failed to load units');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      abbreviation: '',
      description: '',
    });
    setEditingUnit(null);
  };

  const handleAddUnit = () => {
    const emptyForm = { name: '', abbreviation: '', description: '' };
    setFormData(emptyForm);
    setInitialFormData(emptyForm);
    setEditingUnit(null);
    setDialogVisible(true);
  };

  const handleEditUnit = (unit: Unit) => {
    const editForm = {
      name: unit.name,
      abbreviation: unit.abbreviation,
      description: unit.description || '',
    };
    setFormData(editForm);
    setInitialFormData(editForm);
    setEditingUnit(unit);
    setDialogVisible(true);
  };

  const handleSaveUnit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Unit name is required');
      return;
    }

    if (!formData.abbreviation.trim()) {
      Alert.alert('Error', 'Unit abbreviation is required');
      return;
    }

    // Check for duplicate unit name
    const duplicateName = units.find(
      (u) => u.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      (!editingUnit || u.id !== editingUnit.id)
    );

    if (duplicateName) {
      Alert.alert('Error', `Unit "${formData.name}" already exists. Please use a unique name.`);
      return;
    }

    // Check for duplicate abbreviation
    const duplicateAbbr = units.find(
      (u) => u.abbreviation.toLowerCase() === formData.abbreviation.trim().toLowerCase() &&
      (!editingUnit || u.id !== editingUnit.id)
    );

    if (duplicateAbbr) {
      Alert.alert('Error', `Unit abbreviation "${formData.abbreviation}" already exists. Please use a unique abbreviation.`);
      return;
    }

    setLoading(true);
    try {
      const dbService = getDatabase();

      if (editingUnit) {
        await dbService.updateUnit(editingUnit.id, {
          name: formData.name.trim(),
          abbreviation: formData.abbreviation.trim(),
          description: formData.description.trim() || undefined,
        });
        Alert.alert('Success', 'Unit updated successfully');
      } else {
        await dbService.createUnit({
          name: formData.name.trim(),
          abbreviation: formData.abbreviation.trim(),
          description: formData.description.trim() || undefined,
        });
        Alert.alert('Success', 'Unit added successfully');
      }

      setDialogVisible(false);
      resetForm();
      await loadUnits();
    } catch (error: any) {
      console.error('Error saving unit:', error);
      Alert.alert('Error', error?.message || 'Failed to save unit');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnit = (unit: Unit) => {
    setUnitToDelete(unit);
    setDeleteDialogVisible(true);
  };

  const confirmDeleteUnit = async () => {
    if (!unitToDelete) return;

    setLoading(true);
    try {
      const dbService = getDatabase();
      await dbService.deleteUnit(unitToDelete.id, true); // Soft delete
      Alert.alert('Success', 'Unit deactivated successfully');
      setDeleteDialogVisible(false);
      setUnitToDelete(null);
      await loadUnits();
    } catch (error: any) {
      console.error('Error deleting unit:', error);
      Alert.alert('Error', error.message || 'Failed to delete unit');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (unit: Unit) => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      await dbService.updateUnit(unit.id, { is_active: !unit.is_active });
      Alert.alert(
        'Success',
        `Unit "${unit.name}" has been ${unit.is_active ? 'deactivated' : 'activated'}`
      );
      await loadUnits();
    } catch (error) {
      console.error('Error toggling unit status:', error);
      Alert.alert('Error', 'Failed to update unit status');
    } finally {
      setLoading(false);
    }
  };

  const filteredUnits = units.filter(unit =>
    unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    unit.abbreviation.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (unit.description && unit.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderUnit = ({ item }: { item: Unit }) => (
    <Card style={[styles.card, !item.is_active && styles.inactiveCard]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <View style={styles.titleRow}>
              <Title style={[styles.cardTitle, { fontSize: fs.h3 }, !item.is_active && styles.inactiveText]}>
                {item.name}
              </Title>
              <Chip compact style={styles.abbreviationChip} textStyle={styles.abbreviationText}>
                {item.abbreviation}
              </Chip>
            </View>
            {item.description && (
              <Paragraph style={[styles.description, { fontSize: fs.body }]}>{item.description}</Paragraph>
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
              onPress={() => handleEditUnit(item)}
            />
            <IconButton
              icon="delete"
              size={22}
              iconColor="#F44336"
              onPress={() => handleDeleteUnit(item)}
            />
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.content, { paddingHorizontal: lo.screenPadding }]}>
        <View style={styles.header}>
          <Searchbar
            placeholder="Search units..."
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

        {loading && units.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Paragraph style={styles.loadingText}>Loading units...</Paragraph>
          </View>
        ) : (
          <FlatList
            data={filteredUnits}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderUnit}
            style={styles.list}
            contentContainerStyle={styles.listContainer}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadUnits();
              setRefreshing(false);
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Paragraph style={styles.emptyText}>
                  {searchQuery ? 'No units found matching your search' : 'No units available'}
                </Paragraph>
                <Button mode="outlined" onPress={handleAddUnit}>
                  Add First Unit
                </Button>
              </View>
            }
          />
        )}
      </View>

      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: insets.bottom + 16 }]}
        icon="plus"
        label="Add Unit"
        color="#FFFFFF"
        onPress={handleAddUnit}
      />

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleDialogDismiss}>
          <Dialog.Title>
            {editingUnit ? 'Edit Unit' : 'Add New Unit'}
          </Dialog.Title>
          <Dialog.Content>
            <StableTextInput
              label="Unit Name *"
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Kilogram, Piece, Liter"
              autoFocus
            />
            <StableTextInput
              label="Abbreviation *"
              value={formData.abbreviation}
              onChangeText={(text) => setFormData(prev => ({ ...prev, abbreviation: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., kg, pc, L"
              maxLength={10}
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
              onPress={handleSaveUnit}
              loading={loading}
              disabled={loading}
            >
              {editingUnit ? 'Update' : 'Add'}
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
              Are you sure you want to deactivate the unit "{unitToDelete?.name}"?
            </Paragraph>
            <Paragraph style={styles.warningText}>
              This will hide the unit from selection lists but preserve the data.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={confirmDeleteUnit}
              loading={loading}
              disabled={loading}
              textColor="#F44336"
            >
              Deactivate
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
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
  abbreviationChip: {
    backgroundColor: '#E3F2FD',
  },
  abbreviationText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976D2',
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
