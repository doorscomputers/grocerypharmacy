import React, { memo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Category } from '../../database/schema';

interface POSCategoryChipsProps {
  categories: Category[];
  selectedCategory: number | null;
  onSelectCategory: (categoryId: number | null) => void;
}

function POSCategoryChips({ categories, selectedCategory, onSelectCategory }: POSCategoryChipsProps) {
  const theme = useTheme();

  const handleSelectAll = useCallback(() => {
    onSelectCategory(null);
  }, [onSelectCategory]);

  const handleSelectCategory = useCallback((categoryId: number) => {
    onSelectCategory(categoryId);
  }, [onSelectCategory]);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* All category chip */}
        <TouchableOpacity
          style={[
            styles.chip,
            selectedCategory === null && { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleSelectAll}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.chipText,
              selectedCategory === null && styles.chipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {/* Category chips */}
        {categories.map(category => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.chip,
              selectedCategory === category.id && { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => handleSelectCategory(category.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategory === category.id && styles.chipTextActive,
              ]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#616161',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});

export default memo(POSCategoryChips);
