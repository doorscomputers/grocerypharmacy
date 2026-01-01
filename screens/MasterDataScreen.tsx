import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'MasterData'>;
};

export default function MasterDataScreen({ navigation }: Props) {
  const theme = useTheme();

  const menuItems = [
    { title: 'Products', subtitle: 'Manage product catalog', screen: 'Products', color: '#6200EE' },
    { title: 'Categories', subtitle: 'Manage product categories', screen: 'Categories', color: '#4CAF50' },
    { title: 'Brands', subtitle: 'Manage product brands', screen: 'Brands', color: '#E91E63' },
    { title: 'Units', subtitle: 'Manage units of measure', screen: 'Units', color: '#00BCD4' },
    { title: 'Sizes', subtitle: 'Manage product sizes', screen: 'Sizes', color: '#FF5722' },
    { title: 'Suppliers', subtitle: 'Manage supplier information', screen: 'SupplierManagement', color: '#795548' },
    { title: 'Customers', subtitle: 'Manage customer accounts', screen: 'CustomerManagement', color: '#009688' },
    { title: 'Users', subtitle: 'Manage user accounts', screen: 'UserManagement', color: '#2196F3' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Title style={styles.pageTitle}>Master Data Management</Title>
        <Paragraph style={styles.pageSubtitle}>Select a category to manage</Paragraph>

        <View style={styles.grid}>
          {menuItems.map((item, index) => (
            <Card
              key={index}
              style={styles.card}
              onPress={() => navigation.navigate(item.screen as any)}
            >
              <Card.Content style={styles.cardContent}>
                <Title style={[styles.cardTitle, { color: item.color }]}>
                  {item.title}
                </Title>
                <Paragraph style={styles.cardSubtitle}>
                  {item.subtitle}
                </Paragraph>
              </Card.Content>
            </Card>
          ))}
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
    padding: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    marginBottom: 16,
    elevation: 2,
  },
  cardContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 4,
  },
});
