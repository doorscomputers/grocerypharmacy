import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface POSNumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  showDecimal?: boolean;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

function POSNumericKeypad({
  value,
  onChange,
  maxLength = 10,
  showDecimal = true,
}: POSNumericKeypadProps) {
  const handleKeyPress = useCallback((key: string) => {
    if (key === '⌫') {
      // Backspace
      onChange(value.slice(0, -1));
    } else if (key === '.') {
      // Decimal point - only add if not already present and showDecimal is true
      if (showDecimal && !value.includes('.')) {
        onChange(value + key);
      }
    } else {
      // Number key
      if (value.length < maxLength) {
        // Prevent leading zeros (except for decimal numbers)
        if (value === '0' && key !== '.') {
          onChange(key);
        } else {
          onChange(value + key);
        }
      }
    }
  }, [value, onChange, maxLength, showDecimal]);

  return (
    <View style={styles.container}>
      {KEYS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map(key => {
            // Hide decimal key if not needed
            if (key === '.' && !showDecimal) {
              return <View key={key} style={styles.keyEmpty} />;
            }

            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.key,
                  key === '⌫' && styles.keyBackspace,
                ]}
                onPress={() => handleKeyPress(key)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.keyText,
                    key === '⌫' && styles.keyTextBackspace,
                  ]}
                >
                  {key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  key: {
    width: 72,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  keyBackspace: {
    backgroundColor: '#FFEBEE',
  },
  keyEmpty: {
    width: 72,
    height: 52,
    marginHorizontal: 4,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#212121',
  },
  keyTextBackspace: {
    color: '#F44336',
  },
});

export default memo(POSNumericKeypad);
