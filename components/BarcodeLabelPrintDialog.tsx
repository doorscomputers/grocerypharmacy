import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import {
  Dialog,
  Portal,
  Button,
  RadioButton,
  Text,
  Paragraph,
  ActivityIndicator,
  useTheme,
  TextInput,
  IconButton,
  Chip,
} from 'react-native-paper';
import { PRINTER_WIDTH, buildBarcodeLabel, BarcodeLabelData } from '../utils/escpos';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import { Product } from '../database/schema';
import { generateProductCode, validateCode128 } from '../utils/BarcodeGenerator';
import { loadLabelTemplate } from './BarcodeLabelTemplateSettings';
import { getDatabase } from '../database/getDatabase';

interface BarcodeLabelPrintDialogProps {
  visible: boolean;
  onDismiss: () => void;
  product: Product | null;
  onPrintComplete?: () => void;
}

/**
 * Barcode Label Print Dialog Component
 * Allows users to print product barcode labels with configurable quantity and paper size
 */
export default function BarcodeLabelPrintDialog({
  visible,
  onDismiss,
  product,
  onPrintComplete,
}: BarcodeLabelPrintDialogProps) {
  const theme = useTheme();
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('58mm');
  const [quantity, setQuantity] = useState('1');
  const [printing, setPrinting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (visible) {
      setQuantity('1');
      setGeneratedCode(null);
      setPrinting(false);

      // Load printer width setting
      const printerService = BluetoothPrinterService.getInstance();
      const settings = printerService.getSettings();
      setPaperSize(settings.printerWidth === PRINTER_WIDTH.MM_80 ? '80mm' : '58mm');
    }
  }, [visible, product]);

  const incrementQuantity = () => {
    const current = parseInt(quantity) || 1;
    if (current < 100) {
      setQuantity((current + 1).toString());
    }
  };

  const decrementQuantity = () => {
    const current = parseInt(quantity) || 1;
    if (current > 1) {
      setQuantity((current - 1).toString());
    }
  };

  const handleQuantityChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      setQuantity('1');
    } else {
      const num = parseInt(cleaned);
      if (num > 100) {
        setQuantity('100');
      } else if (num < 1) {
        setQuantity('1');
      } else {
        setQuantity(cleaned);
      }
    }
  };

  const handlePrint = async () => {
    if (!product) {
      Alert.alert('Error', 'No product selected');
      return;
    }

    try {
      setPrinting(true);

      // Check printer connection
      const printerService = BluetoothPrinterService.getInstance();
      if (!printerService.isConnected()) {
        Alert.alert(
          'Printer Not Connected',
          'Please connect to a Bluetooth printer in Settings first.',
          [{ text: 'OK' }]
        );
        setPrinting(false);
        return;
      }

      // Get or generate barcode
      let barcodeData = product.code;
      let codeWasGenerated = false;

      if (!barcodeData || barcodeData.trim() === '') {
        // Auto-generate barcode
        barcodeData = await generateProductCode();
        setGeneratedCode(barcodeData);
        codeWasGenerated = true;

        // Update product in database with generated code
        try {
          const db = getDatabase();
          db.runSync('UPDATE products SET code = ? WHERE id = ?', [barcodeData, product.id]);
        } catch (error) {
          console.error('Error updating product code:', error);
          // Continue printing even if database update fails
        }
      }

      // Validate CODE128 compatibility
      if (!validateCode128(barcodeData)) {
        Alert.alert(
          'Invalid Barcode',
          'The product code is not compatible with CODE128 format. Please edit the product code to use only alphanumeric characters.',
          [{ text: 'OK' }]
        );
        setPrinting(false);
        return;
      }

      // Load template settings
      const template = await loadLabelTemplate();

      // Get printer width
      const printerWidth = paperSize === '80mm' ? PRINTER_WIDTH.MM_80 : PRINTER_WIDTH.MM_58;

      // Build label data
      const labelData: BarcodeLabelData = {
        productCode: barcodeData,
        productName: template.showName ? product.name : undefined,
        price: template.showPrice ? product.price : undefined,
        categoryName: template.showCategory ? (product as any).category_name : undefined,
        additionalText: template.showAdditionalText ? template.additionalText : undefined,
      };

      // Print multiple labels with delay between each
      const numLabels = parseInt(quantity) || 1;
      for (let i = 0; i < numLabels; i++) {
        const builder = buildBarcodeLabel(labelData, template, printerWidth);
        await printerService.print(builder);

        // Delay between labels to prevent printer buffer overflow
        if (i < numLabels - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Success message
      const message = codeWasGenerated
        ? `${numLabels} label(s) printed successfully!\n\nGenerated barcode: ${barcodeData}\nThis code has been saved to the product.`
        : `${numLabels} label(s) printed successfully!`;

      Alert.alert('Success', message);

      if (onPrintComplete) {
        onPrintComplete();
      }

      onDismiss();
    } catch (error: any) {
      console.error('Label print error:', error);
      Alert.alert(
        'Print Error',
        error.message || 'Failed to print label. Please check printer connection and try again.'
      );
    } finally {
      setPrinting(false);
    }
  };

  if (!product) {
    return null;
  }

  const currentCode = product.code || generatedCode;
  const willAutoGenerate = !currentCode;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Print Barcode Label</Dialog.Title>
        <Dialog.Content>
          {/* Product Info */}
          <View style={styles.productInfo}>
            <Paragraph style={styles.productName}>{product.name}</Paragraph>
            <View style={styles.barcodeInfo}>
              <Text style={styles.label}>Barcode: </Text>
              {currentCode ? (
                <Chip mode="flat" style={styles.chip}>{currentCode}</Chip>
              ) : (
                <Chip icon="auto-fix" mode="outlined" style={styles.chip}>
                  Will auto-generate
                </Chip>
              )}
            </View>
          </View>

          {/* Quantity Selector */}
          <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>Number of Labels</Text>
            <View style={styles.quantityContainer}>
              <IconButton
                icon="minus"
                size={24}
                onPress={decrementQuantity}
                disabled={printing || parseInt(quantity) <= 1}
                style={styles.quantityButton}
              />
              <TextInput
                value={quantity}
                onChangeText={handleQuantityChange}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.quantityInput}
                disabled={printing}
              />
              <IconButton
                icon="plus"
                size={24}
                onPress={incrementQuantity}
                disabled={printing || parseInt(quantity) >= 100}
                style={styles.quantityButton}
              />
            </View>
            <Text style={styles.quantityHint}>Min: 1, Max: 100</Text>
          </View>

          {/* Paper Size Selector */}
          <View style={styles.paperSizeSection}>
            <Text style={styles.sectionTitle}>Paper Size:</Text>
            <RadioButton.Group
              onValueChange={(value) => setPaperSize(value as '58mm' | '80mm')}
              value={paperSize}
            >
              <View style={styles.radioRow}>
                <RadioButton.Item
                  label="58mm (Compact)"
                  value="58mm"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                  disabled={printing}
                />
              </View>
              <View style={styles.radioRow}>
                <RadioButton.Item
                  label="80mm (Standard)"
                  value="80mm"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                  disabled={printing}
                />
              </View>
            </RadioButton.Group>
          </View>

          {/* Info Box */}
          {willAutoGenerate && (
            <View style={[styles.infoBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={styles.infoText}>
                A unique barcode will be generated and saved to this product.
              </Text>
            </View>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={printing}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handlePrint}
            disabled={printing}
            loading={printing}
            icon="printer"
          >
            {printing ? 'Printing...' : 'Print'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 450,
    alignSelf: 'center',
  },
  productInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  barcodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  chip: {
    marginLeft: 8,
  },
  quantitySection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    margin: 0,
  },
  quantityInput: {
    width: 100,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  quantityHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  paperSizeSection: {
    marginBottom: 16,
  },
  radioRow: {
    marginVertical: 2,
  },
  radioItem: {
    paddingVertical: 4,
  },
  radioLabel: {
    fontSize: 14,
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1565C0',
    textAlign: 'center',
  },
});
