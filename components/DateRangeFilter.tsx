import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal as RNModal } from 'react-native';
import { Button, Chip, Text, Card, RadioButton } from 'react-native-paper';

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'all_time';

interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface DateRangeFilterProps {
  onDateChange: (startDate: Date | null, endDate: Date | null) => void;
  selectedPreset?: DatePreset;
}

const getDateRange = (preset: DatePreset): DateRange => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today': {
      return {
        startDate: startOfDay,
        endDate: today,
        label: 'Today',
      };
    }
    case 'yesterday': {
      const yesterday = new Date(startOfDay);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return {
        startDate: yesterday,
        endDate: yesterdayEnd,
        label: 'Yesterday',
      };
    }
    case 'this_week': {
      const startOfWeek = new Date(startOfDay);
      const dayOfWeek = startOfWeek.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday is start of week
      startOfWeek.setDate(startOfWeek.getDate() - diff);
      return {
        startDate: startOfWeek,
        endDate: today,
        label: 'This Week',
      };
    }
    case 'last_week': {
      const startOfThisWeek = new Date(startOfDay);
      const dayOfWeek = startOfThisWeek.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfThisWeek.setDate(startOfThisWeek.getDate() - diff);

      const endOfLastWeek = new Date(startOfThisWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);
      endOfLastWeek.setHours(23, 59, 59, 999);

      const startOfLastWeek = new Date(endOfLastWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 6);
      startOfLastWeek.setHours(0, 0, 0, 0);

      return {
        startDate: startOfLastWeek,
        endDate: endOfLastWeek,
        label: 'Last Week',
      };
    }
    case 'this_month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: startOfMonth,
        endDate: today,
        label: 'This Month',
      };
    }
    case 'last_month': {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      endOfLastMonth.setHours(23, 59, 59, 999);
      return {
        startDate: startOfLastMonth,
        endDate: endOfLastMonth,
        label: 'Last Month',
      };
    }
    case 'this_quarter': {
      const quarter = Math.floor(today.getMonth() / 3);
      const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
      return {
        startDate: startOfQuarter,
        endDate: today,
        label: 'This Quarter',
      };
    }
    case 'last_quarter': {
      const quarter = Math.floor(today.getMonth() / 3);
      const startOfLastQuarter = new Date(today.getFullYear(), (quarter - 1) * 3, 1);
      const endOfLastQuarter = new Date(today.getFullYear(), quarter * 3, 0);
      endOfLastQuarter.setHours(23, 59, 59, 999);
      return {
        startDate: startOfLastQuarter,
        endDate: endOfLastQuarter,
        label: 'Last Quarter',
      };
    }
    case 'this_year': {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: startOfYear,
        endDate: today,
        label: 'This Year',
      };
    }
    case 'last_year': {
      const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
      endOfLastYear.setHours(23, 59, 59, 999);
      return {
        startDate: startOfLastYear,
        endDate: endOfLastYear,
        label: 'Last Year',
      };
    }
    case 'all_time':
    default: {
      const veryOldDate = new Date(2000, 0, 1);
      return {
        startDate: veryOldDate,
        endDate: today,
        label: 'All Time',
      };
    }
  }
};

const presetOptions: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'all_time', label: 'All Time' },
];

export default function DateRangeFilter({ onDateChange, selectedPreset: initialPreset }: DateRangeFilterProps) {
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>(initialPreset || 'this_month');
  const [modalVisible, setModalVisible] = useState(false);

  const currentRange = useMemo(() => getDateRange(selectedPreset), [selectedPreset]);

  const handlePresetChange = (preset: DatePreset) => {
    setSelectedPreset(preset);
    setModalVisible(false);
    const range = getDateRange(preset);
    onDateChange(range.startDate, range.endDate);
  };

  const formatDateRange = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const start = currentRange.startDate.toLocaleDateString('en-PH', options);
    const end = currentRange.endDate.toLocaleDateString('en-PH', options);

    if (selectedPreset === 'today') {
      return start;
    }
    if (selectedPreset === 'yesterday') {
      return start;
    }
    return `${start} - ${end}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <Text style={styles.label}>Date Range:</Text>
        <Button
          mode="outlined"
          onPress={() => setModalVisible(true)}
          icon="calendar"
          contentStyle={styles.buttonContent}
          style={styles.dateButton}
        >
          {currentRange.label}
        </Button>
      </View>
      <Chip icon="calendar-range" style={styles.dateChip} textStyle={styles.dateChipText}>
        {formatDateRange()}
      </Chip>

      {/* Date Selection Modal */}
      <RNModal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <Card style={styles.modalCard}>
              <Card.Title title="Select Date Range" />
              <Card.Content>
                <ScrollView style={styles.optionsList}>
                  {presetOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionItem,
                        selectedPreset === option.value && styles.selectedOptionItem,
                      ]}
                      onPress={() => handlePresetChange(option.value)}
                    >
                      <RadioButton
                        value={option.value}
                        status={selectedPreset === option.value ? 'checked' : 'unchecked'}
                        onPress={() => handlePresetChange(option.value)}
                        color="#1976D2"
                      />
                      <Text
                        style={[
                          styles.optionText,
                          selectedPreset === option.value && styles.selectedOptionText,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Card.Content>
              <Card.Actions>
                <Button onPress={() => setModalVisible(false)}>Cancel</Button>
              </Card.Actions>
            </Card>
          </TouchableOpacity>
        </TouchableOpacity>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
    color: '#333',
  },
  dateButton: {
    flex: 1,
  },
  buttonContent: {
    justifyContent: 'flex-start',
  },
  dateChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
  },
  dateChipText: {
    fontSize: 12,
    color: '#2E7D32',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: 300,
    maxHeight: 450,
    backgroundColor: '#fff',
  },
  optionsList: {
    maxHeight: 350,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  selectedOptionItem: {
    backgroundColor: '#E3F2FD',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  selectedOptionText: {
    color: '#1976D2',
    fontWeight: 'bold',
  },
});

export { getDateRange };
export type { DateRange };
