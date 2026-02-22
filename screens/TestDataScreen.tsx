import React, { useState } from 'react';
import { View, StyleSheet, Alert, Modal, TouchableOpacity } from 'react-native';
import { Button, Card, Title, Paragraph, ActivityIndicator, TextInput, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { insertTestProducts } from '../scripts/addTestProductsExpo';
import { getDatabase } from '../database/getDatabase';

export default function TestDataScreen() {
  const [loading, setLoading] = useState(false);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleGeneratePress = () => {
    setAdminPassword('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handlePasswordConfirm = async () => {
    if (!adminPassword.trim()) {
      setPasswordError('Please enter your admin password');
      return;
    }

    setVerifying(true);
    setPasswordError('');

    try {
      const dbService = getDatabase();
      const isValid = await dbService.verifyAdminPassword(adminPassword);

      if (!isValid) {
        setPasswordError('Incorrect admin password');
        setVerifying(false);
        return;
      }
    } catch (error) {
      setPasswordError('Error verifying password');
      setVerifying(false);
      return;
    }

    setVerifying(false);
    setShowPasswordModal(false);
    setAdminPassword('');

    // Proceed with generating test data
    try {
      setLoading(true);
      const count = await insertTestProducts();
      setProductCount(count);

      Alert.alert(
        'Success',
        `Successfully added test products! Total products in database: ${count}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error adding test products:', error);
      Alert.alert(
        'Error',
        `Failed to add test products: ${error}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Test Data Generator</Title>
          <Paragraph>
            Add 5000 unique test products to the database for performance testing.
          </Paragraph>
          <Paragraph style={styles.warning}>
            Warning: This will add a large number of products to your database.
          </Paragraph>

          {productCount && (
            <Paragraph style={styles.count}>
              Current products in database: {productCount}
            </Paragraph>
          )}
        </Card.Content>

        <Card.Actions>
          <Button
            mode="contained"
            onPress={handleGeneratePress}
            disabled={loading}
            style={styles.button}
          >
            {loading ? 'Adding Products...' : 'Add 5000 Test Products'}
          </Button>
        </Card.Actions>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator animating={true} size="large" />
            <Paragraph style={styles.loadingText}>
              Generating and inserting products...
            </Paragraph>
          </View>
        )}
      </Card>

      {/* Admin Password Confirmation Modal */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => !verifying && setShowPasswordModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !verifying && setShowPasswordModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalIconRow}>
              <MaterialCommunityIcons name="shield-lock-outline" size={48} color="#FF9800" />
            </View>
            <Text style={styles.modalTitle}>Admin Verification Required</Text>
            <Text style={styles.modalMessage}>
              Generating test data will add 5,000 products to your database. Enter your admin password to confirm.
            </Text>
            <TextInput
              mode="outlined"
              label="Admin Password"
              value={adminPassword}
              onChangeText={(text) => { setAdminPassword(text); setPasswordError(''); }}
              secureTextEntry
              style={styles.passwordInput}
              disabled={verifying}
              error={!!passwordError}
              autoFocus
            />
            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => { setShowPasswordModal(false); setAdminPassword(''); setPasswordError(''); }}
                disabled={verifying}
                style={styles.modalBtn}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handlePasswordConfirm}
                loading={verifying}
                disabled={verifying || !adminPassword.trim()}
                buttonColor="#FF9800"
                textColor="#fff"
                icon="test-tube"
                style={styles.modalBtn}
              >
                Generate
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
  },
  warning: {
    color: '#ff6b35',
    fontWeight: 'bold',
    marginTop: 8,
  },
  count: {
    color: '#2196f3',
    fontWeight: 'bold',
    marginTop: 8,
  },
  button: {
    margin: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
  },
  modalIconRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#222',
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  passwordInput: {
    marginBottom: 4,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
  },
});
