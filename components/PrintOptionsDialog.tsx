import React, { useState } from 'react';
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
} from 'react-native-paper';
import * as Print from 'expo-print';
import { PRINTER_WIDTH, ESCPOSBuilder } from '../utils/escpos';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';

interface PrintOptionsDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  onPrint: (printerWidth: number) => ESCPOSBuilder;
  /** Optional: HTML builder for system print fallback when no Bluetooth printer */
  onBuildPdfHtml?: () => string;
}

export default function PrintOptionsDialog({
  visible,
  onDismiss,
  title = 'Print Report',
  onPrint,
  onBuildPdfHtml,
}: PrintOptionsDialogProps) {
  const theme = useTheme();
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('58mm');
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    try {
      setPrinting(true);
      const printerService = BluetoothPrinterService.getInstance();

      if (!printerService.isConnected()) {
        // Fallback: use system print dialog if PDF HTML builder is available
        if (onBuildPdfHtml) {
          try {
            const html = onBuildPdfHtml();
            await Print.printAsync({ html });
            onDismiss();
          } catch (pdfError) {
            console.error('System print error:', pdfError);
            Alert.alert('Print Error', 'Failed to print via system printer.');
          }
          return;
        }

        Alert.alert(
          'Printer Not Connected',
          'Please connect to a Bluetooth printer in Settings first.',
          [{ text: 'OK' }]
        );
        setPrinting(false);
        return;
      }

      const printerWidth = paperSize === '80mm' ? PRINTER_WIDTH.MM_80 : PRINTER_WIDTH.MM_58;
      const builder = onPrint(printerWidth);

      await printerService.print(builder);

      Alert.alert('Success', 'Report printed successfully!');
      onDismiss();
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', error.message || 'Failed to print report');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Paragraph style={styles.label}>Select Paper Size:</Paragraph>

          <RadioButton.Group
            onValueChange={(value) => setPaperSize(value as '58mm' | '80mm')}
            value={paperSize}
          >
            <View style={styles.radioRow}>
              <RadioButton.Item
                label="58mm (32 characters)"
                value="58mm"
                style={styles.radioItem}
                labelStyle={styles.radioLabel}
              />
            </View>
            <View style={styles.radioRow}>
              <RadioButton.Item
                label="80mm (48 characters)"
                value="80mm"
                style={styles.radioItem}
                labelStyle={styles.radioLabel}
              />
            </View>
          </RadioButton.Group>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {paperSize === '58mm'
                ? 'Compact format for portable printers'
                : 'Standard format for desktop printers'}
            </Text>
          </View>
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
    maxWidth: 400,
    alignSelf: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
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
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#1565C0',
    textAlign: 'center',
  },
});
