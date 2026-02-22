import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useResponsive, responsiveValue, useResponsiveTheme } from '../../utils/responsive';

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
  // Get responsive dimensions
  const { width: screenWidth } = useResponsive();
  const { sp, fs, lo } = useResponsiveTheme();

  // Calculate responsive key dimensions
  const keyDimensions = useMemo(() => {
    const keyWidth = responsiveValue(screenWidth, {
      smallPhone: Math.floor((screenWidth - 64) / 3.5), // Dynamic for small screens
      largePhone: Math.floor((screenWidth - 64) / 3.5),
      smallTablet: 72,
      default: 72,
    });

    const keyHeight = responsiveValue(screenWidth, {
      smallPhone: 48,
      largePhone: 52,
      smallTablet: 56,
      default: 52,
    });

    const keyMargin = responsiveValue(screenWidth, {
      smallPhone: 3,
      largePhone: 4,
      smallTablet: 4,
      default: 4,
    });

    return { keyWidth, keyHeight, keyMargin };
  }, [screenWidth]);

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
    <View style={[styles.container, { padding: sp.sm }]}>
      {KEYS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map(key => {
            // Hide decimal key if not needed
            if (key === '.' && !showDecimal) {
              return (
                <View
                  key={key}
                  style={[
                    styles.keyEmpty,
                    {
                      width: keyDimensions.keyWidth,
                      height: keyDimensions.keyHeight,
                      marginHorizontal: keyDimensions.keyMargin,
                    },
                  ]}
                />
              );
            }

            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.key,
                  {
                    width: keyDimensions.keyWidth,
                    height: keyDimensions.keyHeight,
                    marginHorizontal: keyDimensions.keyMargin,
                  },
                  key === '⌫' && styles.keyBackspace,
                ]}
                onPress={() => handleKeyPress(key)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.keyText,
                    { fontSize: fs.h2 },
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
    // Width, height, and marginHorizontal now set dynamically via inline styles
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
    // Width, height, and marginHorizontal now set dynamically via inline styles
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
