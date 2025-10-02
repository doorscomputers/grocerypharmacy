import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { insertTestProducts } from '../scripts/addTestProductsExpo';

export default function TestDataScreen() {
  const [loading, setLoading] = useState(false);
  const [productCount, setProductCount] = useState<number | null>(null);

  const handleAddTestProducts = async () => {
    try {
      setLoading(true);
      console.log('Starting to add test products...');

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
            onPress={handleAddTestProducts}
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
});