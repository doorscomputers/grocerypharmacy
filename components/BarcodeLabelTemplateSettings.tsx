import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Checkbox,
  Button,
  TextInput,
  useTheme,
  HelperText,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LabelTemplate } from '../utils/escpos';

const LABEL_TEMPLATE_KEY = '@barcode_label_template';

const DEFAULT_TEMPLATE: LabelTemplate = {
  showCode: true,
  showName: true,
  showPrice: false,
  showCategory: false,
  showAdditionalText: false,
  additionalText: '',
};

/**
 * Barcode Label Template Settings Component
 * Allows users to configure which fields appear on barcode labels
 */
export default function BarcodeLabelTemplateSettings() {
  const theme = useTheme();
  const [template, setTemplate] = useState<LabelTemplate>(DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(false);
  const [additionalTextError, setAdditionalTextError] = useState('');

  // Load saved template on mount
  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const saved = await AsyncStorage.getItem(LABEL_TEMPLATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTemplate(parsed);
      }
    } catch (error) {
      console.error('Error loading label template:', error);
    }
  };

  const saveTemplate = async () => {
    try {
      // Validate additional text length
      if (template.additionalText.length > 40) {
        setAdditionalTextError('Additional text must be 40 characters or less');
        return;
      }

      setLoading(true);
      await AsyncStorage.setItem(LABEL_TEMPLATE_KEY, JSON.stringify(template));
      Alert.alert('Success', 'Label template saved successfully!');
      setAdditionalTextError('');
    } catch (error) {
      console.error('Error saving label template:', error);
      Alert.alert('Error', 'Failed to save label template');
    } finally {
      setLoading(false);
    }
  };

  const resetTemplate = () => {
    Alert.alert(
      'Reset Template',
      'Are you sure you want to reset to default template settings?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setTemplate(DEFAULT_TEMPLATE);
            setAdditionalTextError('');
            try {
              await AsyncStorage.setItem(LABEL_TEMPLATE_KEY, JSON.stringify(DEFAULT_TEMPLATE));
              Alert.alert('Success', 'Template reset to default!');
            } catch (error) {
              console.error('Error resetting template:', error);
            }
          },
        },
      ]
    );
  };

  const updateTemplate = (key: keyof LabelTemplate, value: boolean | string) => {
    setTemplate({ ...template, [key]: value });
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Title>Label Template Configuration</Title>
        <Paragraph style={styles.description}>
          Choose which information appears on your barcode labels.
          Barcode is always included.
        </Paragraph>

        {/* Show Product Code */}
        <Checkbox.Item
          label="Show Product Code"
          status={template.showCode ? 'checked' : 'unchecked'}
          onPress={() => updateTemplate('showCode', !template.showCode)}
          labelStyle={styles.checkboxLabel}
        />

        {/* Show Product Name */}
        <Checkbox.Item
          label="Show Product Name"
          status={template.showName ? 'checked' : 'unchecked'}
          onPress={() => updateTemplate('showName', !template.showName)}
          labelStyle={styles.checkboxLabel}
        />

        {/* Show Price */}
        <Checkbox.Item
          label="Show Price"
          status={template.showPrice ? 'checked' : 'unchecked'}
          onPress={() => updateTemplate('showPrice', !template.showPrice)}
          labelStyle={styles.checkboxLabel}
        />

        {/* Show Category */}
        <Checkbox.Item
          label="Show Category"
          status={template.showCategory ? 'checked' : 'unchecked'}
          onPress={() => updateTemplate('showCategory', !template.showCategory)}
          labelStyle={styles.checkboxLabel}
        />

        {/* Show Additional Text */}
        <Checkbox.Item
          label="Show Additional Text"
          status={template.showAdditionalText ? 'checked' : 'unchecked'}
          onPress={() => updateTemplate('showAdditionalText', !template.showAdditionalText)}
          labelStyle={styles.checkboxLabel}
        />

        {/* Additional Text Input (conditionally shown) */}
        {template.showAdditionalText && (
          <View style={styles.additionalTextContainer}>
            <TextInput
              label="Additional Text"
              value={template.additionalText}
              onChangeText={(text) => {
                updateTemplate('additionalText', text);
                if (text.length > 40) {
                  setAdditionalTextError('Maximum 40 characters');
                } else {
                  setAdditionalTextError('');
                }
              }}
              mode="outlined"
              placeholder="e.g., Store Name, Promo Text"
              maxLength={50}
              style={styles.textInput}
              error={!!additionalTextError}
            />
            <HelperText type="error" visible={!!additionalTextError}>
              {additionalTextError}
            </HelperText>
            <HelperText type="info" visible={!additionalTextError}>
              {template.additionalText.length}/40 characters
            </HelperText>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={resetTemplate}
            disabled={loading}
            style={styles.button}
          >
            Reset to Default
          </Button>
          <Button
            mode="contained"
            onPress={saveTemplate}
            disabled={loading || !!additionalTextError}
            loading={loading}
            style={styles.button}
            icon="content-save"
          >
            Save Template
          </Button>
        </View>

        {/* Preview Info */}
        <View style={[styles.previewBox, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Paragraph style={styles.previewTitle}>Label Preview:</Paragraph>
          <Paragraph style={styles.previewText}>• Barcode (always shown)</Paragraph>
          {template.showCode && <Paragraph style={styles.previewText}>• Product Code</Paragraph>}
          {template.showName && <Paragraph style={styles.previewText}>• Product Name</Paragraph>}
          {template.showPrice && <Paragraph style={styles.previewText}>• Price</Paragraph>}
          {template.showCategory && <Paragraph style={styles.previewText}>• Category</Paragraph>}
          {template.showAdditionalText && template.additionalText && (
            <Paragraph style={styles.previewText}>• {template.additionalText}</Paragraph>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    elevation: 2,
  },
  description: {
    marginBottom: 16,
    fontSize: 14,
    color: '#666',
  },
  checkboxLabel: {
    fontSize: 14,
  },
  additionalTextContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  textInput: {
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  button: {
    flex: 1,
  },
  previewBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  previewTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 14,
  },
  previewText: {
    fontSize: 12,
    marginVertical: 2,
  },
});

/**
 * Helper function to load label template from AsyncStorage
 * Used by other components that need to print labels
 */
export async function loadLabelTemplate(): Promise<LabelTemplate> {
  try {
    const saved = await AsyncStorage.getItem(LABEL_TEMPLATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    return DEFAULT_TEMPLATE;
  } catch (error) {
    console.error('Error loading label template:', error);
    return DEFAULT_TEMPLATE;
  }
}
