import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, useTheme } from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'MasterData'>;
};

export default function MasterDataScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}>
        <Title style={[styles.pageTitle, { fontSize: fs.h2 }]}>Master Data Management</Title>
        <Paragraph style={[styles.pageSubtitle, { fontSize: fs.bodySmall }]}>Select a category to manage</Paragraph>

        <View style={styles.grid}>
          {menuItems.map((item, index) => (
            <Card
              key={index}
              style={[styles.card, { marginBottom: sp.md }]}
              onPress={() => navigation.navigate(item.screen as any)}
            >
              <Card.Content style={[styles.cardContent, { padding: sp.md }]}>
                <Title style={[styles.cardTitle, { color: item.color, fontSize: fs.cardTitle }]}>
                  {item.title}
                </Title>
                <Paragraph style={[styles.cardSubtitle, { fontSize: fs.bodySmall }]}>
                  {item.subtitle}
                </Paragraph>
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
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
