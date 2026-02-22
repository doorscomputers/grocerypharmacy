import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  HelperText,
  useTheme,
  Divider,
  Text,
  IconButton,
} from 'react-native-paper';
import { DeviceBindingService, TrialStatus } from '../utils/DeviceBindingService';
import * as Clipboard from 'expo-clipboard';
import { useResponsiveTheme } from '../utils/responsive';

// ============================================
// SELLER CONTACT CONFIGURATION
// Change these values to your own contact details
// ============================================
const SELLER_PHONE = '+639623108957';
const SELLER_EMAIL = 'igorotekit@gmail.com';
const APP_NAME = 'IgoroTech POS';

interface ActivationScreenProps {
  onActivationSuccess: () => void;
}

export default function ActivationScreen({ onActivationSuccess }: ActivationScreenProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  useEffect(() => {
    loadDeviceId();
    checkTrialStatus();
  }, []);

  const checkTrialStatus = async () => {
    try {
      const status = await DeviceBindingService.getTrialStatus();
      setIsTrialExpired(status.isTrialExpired);
    } catch (err) {
      console.error('Error checking trial status:', err);
    }
  };

  const loadDeviceId = async () => {
    try {
      const id = await DeviceBindingService.getCurrentDeviceId();
      setDeviceId(id);
    } catch (err) {
      console.error('Error loading device ID:', err);
    }
  };

  const copyDeviceId = async () => {
    try {
      await Clipboard.setStringAsync(deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy device ID');
    }
  };

  const getMessage = () => {
    return `Hello, I would like to request a license key for ${APP_NAME}.\n\nMy Device ID is:\n${deviceId}\n\nThank you!`;
  };

  const sendViaWhatsApp = async () => {
    if (!deviceId) {
      Alert.alert('Error', 'Device ID not loaded yet');
      return;
    }

    const message = encodeURIComponent(getMessage());
    const phone = SELLER_PHONE.replace(/[^0-9]/g, ''); // Remove non-numeric characters
    const url = `whatsapp://send?phone=${phone}&text=${message}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Try web WhatsApp as fallback
        const webUrl = `https://wa.me/${phone}?text=${message}`;
        await Linking.openURL(webUrl);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open WhatsApp. Please make sure it is installed.');
    }
  };

  const sendViaSMS = async () => {
    if (!deviceId) {
      Alert.alert('Error', 'Device ID not loaded yet');
      return;
    }

    const message = encodeURIComponent(getMessage());
    const url = Platform.OS === 'ios'
      ? `sms:${SELLER_PHONE}&body=${message}`
      : `sms:${SELLER_PHONE}?body=${message}`;

    try {
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Error', 'Could not open SMS app');
    }
  };

  const sendViaEmail = async () => {
    if (!deviceId) {
      Alert.alert('Error', 'Device ID not loaded yet');
      return;
    }

    const subject = encodeURIComponent(`License Key Request - ${APP_NAME}`);
    const body = encodeURIComponent(getMessage());
    const url = `mailto:${SELLER_EMAIL}?subject=${subject}&body=${body}`;

    try {
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Error', 'Could not open email app');
    }
  };

  const formatLicenseKeyInput = (text: string) => {
    // Remove all non-alphanumeric characters
    const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    // Format as XXXX-XXXX-XXXX-XXXX
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.slice(0, 4).join('-');
  };

  const handleLicenseKeyChange = (text: string) => {
    setLicenseKey(formatLicenseKeyInput(text));
    setError('');
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key');
      return;
    }

    // Validate format (should be XXXX-XXXX-XXXX-XXXX)
    const cleaned = licenseKey.replace(/[-\s]/g, '');
    if (cleaned.length !== 16) {
      setError('License key must be 16 characters (format: XXXX-XXXX-XXXX-XXXX)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await DeviceBindingService.activateDevice(licenseKey);

      if (result.success) {
        Alert.alert(
          'Success',
          result.message,
          [{ text: 'OK', onPress: onActivationSuccess }]
        );
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Activation error:', err);
      setError('Activation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.content, { padding: lo.screenPadding }]}>
            <Card style={[styles.card, { maxWidth: lo.modalMaxWidth, alignSelf: 'center', width: '100%' }]}>
              <Card.Content>
                <Title style={[styles.title, { color: isTrialExpired ? '#D32F2F' : theme.colors.primary, fontSize: fs.h2 }]}>
                  {isTrialExpired ? 'Trial Expired' : 'Activate IgoroTech POS'}
                </Title>
                <Paragraph style={styles.subtitle}>
                  {isTrialExpired
                    ? 'Your 30-day trial has ended. Enter a license key to continue using the app.'
                    : 'Enter your license key to activate this device'}
                </Paragraph>

                <Divider style={styles.divider} />

                {/* Device ID Section */}
                <View style={styles.deviceIdSection}>
                  <Text style={styles.sectionLabel}>Your Device ID:</Text>
                  <View style={styles.deviceIdContainer}>
                    <Text
                      style={styles.deviceIdText}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {deviceId || 'Loading...'}
                    </Text>
                    <IconButton
                      icon={copied ? 'check' : 'content-copy'}
                      size={20}
                      onPress={copyDeviceId}
                      iconColor={copied ? '#4CAF50' : theme.colors.primary}
                    />
                  </View>
                </View>

                {/* Send Device ID Buttons */}
                <View style={styles.sendButtonsSection}>
                  <Text style={styles.sectionLabel}>Send Device ID to get your license:</Text>

                  <View style={styles.sendButtonsRow}>
                    <Button
                      mode="contained"
                      onPress={sendViaWhatsApp}
                      icon="whatsapp"
                      style={[styles.sendButton, { backgroundColor: '#25D366' }]}
                      labelStyle={styles.sendButtonLabel}
                      disabled={!deviceId}
                    >
                      WhatsApp
                    </Button>

                    <Button
                      mode="contained"
                      onPress={sendViaSMS}
                      icon="message-text"
                      style={[styles.sendButton, { backgroundColor: '#2196F3' }]}
                      labelStyle={styles.sendButtonLabel}
                      disabled={!deviceId}
                    >
                      SMS
                    </Button>

                    <Button
                      mode="contained"
                      onPress={sendViaEmail}
                      icon="email"
                      style={[styles.sendButton, { backgroundColor: '#EA4335' }]}
                      labelStyle={styles.sendButtonLabel}
                      disabled={!deviceId}
                    >
                      Email
                    </Button>
                  </View>
                </View>

                <Divider style={styles.divider} />

                {/* License Key Input */}
                <TextInput
                  label="License Key"
                  value={licenseKey}
                  onChangeText={handleLicenseKeyChange}
                  mode="outlined"
                  style={styles.input}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoCapitalize="characters"
                  maxLength={19} // 16 chars + 3 dashes
                  error={!!error}
                />

                {error ? (
                  <HelperText type="error" visible={!!error}>
                    {error}
                  </HelperText>
                ) : null}

                <Button
                  mode="contained"
                  onPress={handleActivate}
                  loading={loading}
                  disabled={loading || !licenseKey.trim()}
                  style={styles.button}
                  labelStyle={styles.buttonLabel}
                >
                  Activate Device
                </Button>

                <Divider style={styles.divider} />

                <View style={styles.infoSection}>
                  <Text style={styles.infoTitle}>How to Activate:</Text>
                  <Text style={styles.infoText}>
                    1. Tap WhatsApp, SMS, or Email button above
                  </Text>
                  <Text style={styles.infoText}>
                    2. Send the message (Device ID is included)
                  </Text>
                  <Text style={styles.infoText}>
                    3. Wait for your license key (usually within 24 hours)
                  </Text>
                  <Text style={styles.infoText}>
                    4. Enter the license key above and tap Activate
                  </Text>
                </View>

                <Paragraph style={styles.footerText}>
                  This license is bound to this device only. Each device requires its own license key.
                </Paragraph>
              </Card.Content>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  card: {
    padding: 10,
    borderRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
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
  deviceIdSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  sendButtonsSection: {
    marginBottom: 8,
  },
  sendButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sendButton: {
    flex: 1,
    borderRadius: 8,
  },
  sendButtonLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  deviceIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  deviceIdText: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  input: {
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
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
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
