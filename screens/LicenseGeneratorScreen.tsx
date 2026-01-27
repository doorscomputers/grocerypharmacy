import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  useTheme,
  Divider,
  Text,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { DeviceBindingService } from '../utils/DeviceBindingService';
import * as Clipboard from 'expo-clipboard';

type LicenseGeneratorScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'LicenseGenerator'
>;

type Props = {
  navigation: LicenseGeneratorScreenNavigationProp;
};

export default function LicenseGeneratorScreen({ navigation }: Props) {
  const [deviceId, setDeviceId] = useState('');
  const [generatedLicenseKey, setGeneratedLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const theme = useTheme();

  const handleGenerateLicenseKey = async () => {
    if (!deviceId.trim()) {
      Alert.alert('Error', 'Please enter a Device ID');
      return;
    }

    setLoading(true);
    try {
      const licenseKey = await DeviceBindingService.generateLicenseKey(deviceId.trim());
      setGeneratedLicenseKey(licenseKey);
    } catch (error) {
      console.error('Error generating license key:', error);
      Alert.alert('Error', 'Failed to generate license key');
    } finally {
      setLoading(false);
    }
  };

  const copyLicenseKey = async () => {
    try {
      await Clipboard.setStringAsync(generatedLicenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy license key');
    }
  };

  const clearForm = () => {
    setDeviceId('');
    setGeneratedLicenseKey('');
    setCopied(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Card style={styles.card}>
            <Card.Content>
              <Title style={[styles.title, { color: theme.colors.primary }]}>
                License Key Generator
              </Title>
              <Paragraph style={styles.subtitle}>
                Generate license keys for customer devices
              </Paragraph>

              <Divider style={styles.divider} />

              {/* Instructions */}
              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>How to Use:</Text>
                <Text style={styles.infoText}>
                  1. Customer installs the app on their device
                </Text>
                <Text style={styles.infoText}>
                  2. Customer sends you their Device ID
                </Text>
                <Text style={styles.infoText}>
                  3. Paste the Device ID below
                </Text>
                <Text style={styles.infoText}>
                  4. Generate and send them the license key
                </Text>
              </View>

              <Divider style={styles.divider} />

              {/* Device ID Input */}
              <TextInput
                label="Customer's Device ID"
                value={deviceId}
                onChangeText={setDeviceId}
                mode="outlined"
                style={styles.input}
                placeholder="Paste customer's device ID here"
                multiline
                numberOfLines={3}
              />

              <Button
                mode="contained"
                onPress={handleGenerateLicenseKey}
                loading={loading}
                disabled={loading || !deviceId.trim()}
                style={styles.button}
                labelStyle={styles.buttonLabel}
              >
                Generate License Key
              </Button>

              {/* Generated License Key */}
              {generatedLicenseKey ? (
                <>
                  <Divider style={styles.divider} />

                  <View style={styles.resultSection}>
                    <Text style={styles.sectionLabel}>Generated License Key:</Text>
                    <View style={styles.licenseKeyContainer}>
                      <Text style={styles.licenseKeyText}>
                        {generatedLicenseKey}
                      </Text>
                      <IconButton
                        icon={copied ? 'check' : 'content-copy'}
                        size={24}
                        onPress={copyLicenseKey}
                        iconColor={copied ? '#4CAF50' : theme.colors.primary}
                      />
                    </View>
                    <Text style={styles.helperText}>
                      Send this license key to your customer
                    </Text>

                    <Button
                      mode="outlined"
                      onPress={clearForm}
                      style={styles.clearButton}
                    >
                      Generate Another
                    </Button>
                  </View>
                </>
              ) : null}

              <Divider style={styles.divider} />

              {/* Security Notice */}
              <View style={styles.warningSection}>
                <Text style={styles.warningTitle}>Security Notice:</Text>
                <Text style={styles.warningText}>
                  Each license key is unique to a specific device and cannot be transferred.
                  If a customer changes devices, they will need a new license key.
                </Text>
              </View>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    padding: 8,
    borderRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#666',
  },
  divider: {
    marginVertical: 16,
  },
  infoSection: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1565C0',
  },
  infoText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
    paddingLeft: 8,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultSection: {
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  licenseKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingLeft: 16,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  licenseKeyText: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#2E7D32',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  clearButton: {
    marginTop: 16,
  },
  warningSection: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#E65100',
  },
  warningText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
});
