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
import { Category } from '../database/schema';
import { StableTextInput } from '../components/StableTextInput';
import { useResponsiveTheme } from '../utils/responsive';

type CategoriesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Categories'>;

type Props = {
  navigation: CategoriesScreenNavigationProp;
};

export default function CategoriesScreen({ navigation }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [initialFormData, setInitialFormData] = useState({ name: '', description: '' });
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
    loadCategories();
  }, [showInactive]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      const categoryList = await dbService.getCategories(!showInactive);
      setCategories(categoryList);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
    });
    setEditingCategory(null);
  };

  const handleAddCategory = () => {
    const emptyForm = { name: '', description: '' };
    setFormData(emptyForm);
    setInitialFormData(emptyForm);
    setEditingCategory(null);
    setDialogVisible(true);
  };

  const handleEditCategory = (category: Category) => {
    const editForm = {
      name: category.name,
      description: category.description || '',
    };
    setFormData(editForm);
    setInitialFormData(editForm);
    setEditingCategory(category);
    setDialogVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    // Check for duplicate category name
    const duplicateName = categories.find(
      (c) => c.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      (!editingCategory || c.id !== editingCategory.id)
    );

    if (duplicateName) {
      Alert.alert('Error', `Category "${formData.name}" already exists. Please use a unique name.`);
      return;
    }

    setLoading(true);
    try {
      const dbService = getDatabase();

      if (editingCategory) {
        await dbService.updateCategory(editingCategory.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        });
        Alert.alert('Success', 'Category updated successfully');
      } else {
        await dbService.createCategory({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
        Alert.alert('Success', 'Category added successfully');
      }

      setDialogVisible(false);
      resetForm();
      await loadCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      Alert.alert('Error', error?.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogVisible(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setLoading(true);
    try {
      const dbService = getDatabase();
      await dbService.deleteCategory(categoryToDelete.id, true); // Soft delete
      Alert.alert('Success', 'Category deactivated successfully');
      setDeleteDialogVisible(false);
      setCategoryToDelete(null);
      await loadCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      Alert.alert('Error', error.message || 'Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (category: Category) => {
    setLoading(true);
    try {
      const dbService = getDatabase();
      await dbService.updateCategory(category.id, { is_active: !category.is_active });
      Alert.alert(
        'Success',
        `Category "${category.name}" has been ${category.is_active ? 'deactivated' : 'activated'}`
      );
      await loadCategories();
    } catch (error) {
      console.error('Error toggling category status:', error);
      Alert.alert('Error', 'Failed to update category status');
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderCategory = ({ item }: { item: Category }) => (
    <Card style={[styles.card, !item.is_active && styles.inactiveCard]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Title style={[styles.cardTitle, { fontSize: fs.h3 }, !item.is_active && styles.inactiveText]}>
              {item.name}
            </Title>
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
              onPress={() => handleEditCategory(item)}
            />
            <IconButton
              icon="delete"
              size={22}
              iconColor="#F44336"
              onPress={() => handleDeleteCategory(item)}
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
            placeholder="Search categories..."
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

        {loading && categories.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Paragraph style={styles.loadingText}>Loading categories...</Paragraph>
          </View>
        ) : (
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderCategory}
            style={styles.list}
            contentContainerStyle={[styles.listContainer, { paddingBottom: 100 }]}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadCategories();
              setRefreshing(false);
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Paragraph style={styles.emptyText}>
                  {searchQuery ? 'No categories found matching your search' : 'No categories available'}
                </Paragraph>
                <Button mode="outlined" onPress={handleAddCategory}>
                  Add First Category
                </Button>
              </View>
            }
          />
        )}
      </View>

      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: insets.bottom + 16 }]}
        icon="plus"
        label="Add Category"
        color="#FFFFFF"
        onPress={handleAddCategory}
      />

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleDialogDismiss}>
          <Dialog.Title>
            {editingCategory ? 'Edit Category' : 'Add New Category'}
          </Dialog.Title>
          <Dialog.Content>
            <StableTextInput
              label="Category Name *"
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
              onPress={handleSaveCategory}
              loading={loading}
              disabled={loading}
            >
              {editingCategory ? 'Update' : 'Add'}
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
              Are you sure you want to deactivate the category "{categoryToDelete?.name}"?
            </Paragraph>
            <Paragraph style={styles.warningText}>
              This will hide the category from selection lists but preserve the data.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={confirmDeleteCategory}
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
