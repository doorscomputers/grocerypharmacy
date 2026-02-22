import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Text,
  FlatList,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  List,
  FAB,
  IconButton,
  useTheme,
  Dialog,
  Portal,
  Chip,
  Menu,
  Divider,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Product } from '../database/schema';
import { useResponsiveTheme } from '../utils/responsive';

type DamagedItemsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'DamagedItems'
>;

type Props = {
  navigation: DamagedItemsScreenNavigationProp;
};

type DamageReason = 'EXPIRED' | 'BROKEN' | 'DEFECTIVE' | 'SPOILED' | 'LOST' | 'THEFT' | 'OTHER';

export default function DamagedItemsScreen({ navigation }: Props) {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Session Management
  const [createSessionDialogVisible, setCreateSessionDialogVisible] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  // Damage Item Encoding
  const [addDamageDialogVisible, setAddDamageDialogVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [damagedQuantity, setDamagedQuantity] = useState('');
  const [damageReason, setDamageReason] = useState<DamageReason>('EXPIRED');
  const [damageDescription, setDamageDescription] = useState('');
  const [reasonMenuVisible, setReasonMenuVisible] = useState(false);

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const [sessionsData, productsData] = await Promise.all([
        dbService.getDamageSessions(10),
        dbService.getProducts(true, 100)
      ]);

      setActiveSessions(sessionsData.filter(session => session.status === 'ACTIVE'));
      setProducts(productsData as Product[]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generateSessionName = () => {
    const now = new Date();
    return `Damage Report - ${now.toLocaleDateString()}`;
  };

  const getReasonColor = (reason: DamageReason) => {
    switch (reason) {
      case 'EXPIRED': return '#FF9800';
      case 'BROKEN': return '#F44336';
      case 'DEFECTIVE': return '#E91E63';
      case 'SPOILED': return '#795548';
      case 'LOST': return '#607D8B';
      case 'THEFT': return '#000000';
      case 'OTHER': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const getReasonIcon = (reason: DamageReason) => {
    switch (reason) {
      case 'EXPIRED': return 'clock-alert';
      case 'BROKEN': return 'package-down';
      case 'DEFECTIVE': return 'alert-circle';
      case 'SPOILED': return 'emoticon-dead';
      case 'LOST': return 'help';
      case 'THEFT': return 'security';
      case 'OTHER': return 'dots-horizontal';
      default: return 'alert';
    }
  };

  const openCreateSessionDialog = () => {
    setSessionName(generateSessionName());
    setSessionNotes('');
    setCreateSessionDialogVisible(true);
  };

  const createDamageSession = async () => {
    if (!sessionName.trim()) {
      Alert.alert('Error', 'Please enter a session name');
      return;
    }

    try {
      setLoading(true);
      const dbService = getDatabase();

      const sessionData = {
        session_name: sessionName.trim(),
        notes: sessionNotes.trim() || undefined,
        started_by: 1 // TODO: Get from user context
      };

      const result = await dbService.createDamageSession(sessionData);

      Alert.alert(
        'Success',
        `Damage session ${result.sessionId} created successfully`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCreateSessionDialogVisible(false);
              loadData();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating damage session:', error);
      Alert.alert('Error', 'Failed to create damage session');
    } finally {
      setLoading(false);
    }
  };

  const openAddDamageDialog = (session: any) => {
    setSelectedSession(session);
    setSelectedProduct(null);
    setProductSearchQuery('');
    setDamagedQuantity('');
    setDamageReason('EXPIRED');
    setDamageDescription('');
    setAddDamageDialogVisible(true);
  };

  const addDamagedItem = async () => {
    if (!selectedProduct) {
      Alert.alert('Error', 'Please select a product');
      return;
    }

    if (!damagedQuantity || parseInt(damagedQuantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid damaged quantity');
      return;
    }

    const quantity = parseInt(damagedQuantity);

    if (quantity > selectedProduct.stock_quantity) {
      Alert.alert('Error', `Insufficient stock. Available: ${selectedProduct.stock_quantity}`);
      return;
    }

    try {
      setLoading(true);
      const dbService = getDatabase();

      const damageData = {
        session_id: selectedSession.session_id,
        product_id: selectedProduct.id,
        damaged_quantity: quantity,
        damage_reason: damageReason,
        damage_description: damageDescription.trim() || undefined,
        recorded_by: 1 // TODO: Get from user context
      };

      await dbService.addDamagedItem(damageData);

      Alert.alert(
        'Success',
        `${selectedProduct.name} (${quantity} units) marked as damaged`,
        [
          {
            text: 'Add More',
            onPress: () => {
              setSelectedProduct(null);
              setProductSearchQuery('');
              setDamagedQuantity('');
              setDamageDescription('');
              loadData();
            }
          },
          {
            text: 'Done',
            onPress: () => {
              setAddDamageDialogVisible(false);
              loadData();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error adding damaged item:', error);
      Alert.alert('Error', error.message || 'Failed to record damaged item');
    } finally {
      setLoading(false);
    }
  };

  const completeSession = async (session: any) => {
    Alert.alert(
      'Complete Session',
      `Are you sure you want to complete damage session ${session.session_id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              setLoading(true);
              const dbService = getDatabase();
              await dbService.completeDamageSession(session.session_id, 1);

              Alert.alert('Success', 'Damage session completed successfully');
              loadData();
            } catch (error) {
              console.error('Error completing session:', error);
              Alert.alert('Error', 'Failed to complete session');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const cancelSession = async (session: any) => {
    Alert.prompt(
      'Cancel Session',
      `Enter reason for cancelling session ${session.session_id}:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cancel Session',
          onPress: async (reason) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Please provide a cancellation reason');
              return;
            }

            try {
              setLoading(true);
              const dbService = getDatabase();
              await dbService.cancelDamageSession(session.session_id, 1, reason.trim());

              Alert.alert('Success', 'Damage session cancelled and inventory restored');
              loadData();
            } catch (error) {
              console.error('Error cancelling session:', error);
              Alert.alert('Error', 'Failed to cancel session');
            } finally {
              setLoading(false);
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const viewSessionDetails = async (session: any) => {
    try {
      const dbService = getDatabase();
      const sessionDetails = await dbService.getDamageSessionById(session.session_id);

      if (sessionDetails && sessionDetails.items) {
        const itemsList = sessionDetails.items
          .map((item: any) => `• ${item.product_name}: ${item.damaged_quantity} units (${item.damage_reason})`)
          .join('\n');

        Alert.alert(
          `${sessionDetails.session_id} Details`,
          `Status: ${sessionDetails.status}\n` +
          `Total Items: ${sessionDetails.total_items}\n` +
          `Total Value: ₱${sessionDetails.total_value?.toFixed(2) || '0.00'}\n` +
          `Started: ${new Date(sessionDetails.started_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\n\n` +
          `Items:\n${itemsList || 'No items recorded'}`
        );
      }
    } catch (error) {
      console.error('Error loading session details:', error);
      Alert.alert('Error', 'Failed to load session details');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.code.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const renderSession = ({ item }: { item: any }) => (
    <Card style={styles.sessionCard}>
      <Card.Content>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionInfo}>
            <Title style={styles.sessionId}>{item.session_id}</Title>
            <Paragraph style={styles.sessionName}>{item.session_name}</Paragraph>
            <Paragraph style={styles.sessionDate}>
              Started: {new Date(item.started_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
            </Paragraph>
          </View>
          <View style={styles.sessionStats}>
            <Chip style={styles.statusChip} textStyle={{ color: 'white' }}>
              {item.status}
            </Chip>
            <Paragraph style={styles.itemCount}>
              {item.total_items} items
            </Paragraph>
            <Paragraph style={styles.totalValue}>
              ₱{item.total_value?.toFixed(2) || '0.00'}
            </Paragraph>
          </View>
        </View>

        {item.notes && (
          <Paragraph style={styles.sessionNotes}>{item.notes}</Paragraph>
        )}

        <Divider style={styles.divider} />

        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => viewSessionDetails(item)}
            style={styles.actionButton}
            icon="eye"
          >
            View
          </Button>
          <Button
            mode="outlined"
            onPress={() => openAddDamageDialog(item)}
            style={styles.actionButton}
            icon="plus"
          >
            Add Item
          </Button>
          <Button
            mode="outlined"
            onPress={() => completeSession(item)}
            style={[styles.actionButton, { borderColor: '#4CAF50' }]}
            textColor="#4CAF50"
            icon="check"
          >
            Complete
          </Button>
          <Button
            mode="outlined"
            onPress={() => cancelSession(item)}
            style={[styles.actionButton, { borderColor: '#F44336' }]}
            textColor="#F44336"
            icon="cancel"
          >
            Cancel
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { padding: lo.screenPadding }]}>
        <Title style={[styles.headerTitle, { fontSize: fs.h2 }]}>Damaged Items</Title>
        <Button
          mode="outlined"
          onPress={() => navigation.navigate('DamagedItemsHistory')}
          style={styles.historyButton}
          icon="history"
        >
          View History
        </Button>
      </View>

      <FlatList
        data={activeSessions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSession}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              No active damage sessions. Create a new session to start recording damaged items.
            </Paragraph>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={openCreateSessionDialog}
        label="New Session"
        color="#FFFFFF"
      />

      {/* Create Session Dialog */}
      <Portal>
        <Dialog visible={createSessionDialogVisible} onDismiss={() => setCreateSessionDialogVisible(false)}>
          <Dialog.Title>Create Damage Session</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Session Name *"
              value={sessionName}
              onChangeText={setSessionName}
              mode="outlined"
              style={styles.dialogInput}
            />

            <TextInput
              label="Notes"
              value={sessionNotes}
              onChangeText={setSessionNotes}
              mode="outlined"
              style={styles.dialogInput}
              multiline
              numberOfLines={3}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateSessionDialogVisible(false)}>Cancel</Button>
            <Button onPress={createDamageSession} loading={loading}>
              Create Session
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Damaged Item Dialog */}
      <Portal>
        <Dialog
          visible={addDamageDialogVisible}
          onDismiss={() => setAddDamageDialogVisible(false)}
          style={styles.addDialog}
        >
          <Dialog.Title>
            Add Damaged Item - {selectedSession?.session_id}
          </Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              {/* Show product search/list only when no product is selected */}
              {!selectedProduct && (
                <>
                  <TextInput
                    label="Search Products"
                    value={productSearchQuery}
                    onChangeText={setProductSearchQuery}
                    mode="outlined"
                    style={styles.dialogInput}
                    right={<TextInput.Icon icon="magnify" />}
                  />

                  <View style={styles.productList}>
                    {filteredProducts.slice(0, 10).map((item) => (
                      <List.Item
                        key={item.id.toString()}
                        title={item.name}
                        titleNumberOfLines={1}
                        description={`${item.code} • Stock: ${item.stock_quantity} • Cost: ₱${item.cost.toFixed(2)}`}
                        descriptionNumberOfLines={1}
                        onPress={() => setSelectedProduct(item)}
                        style={styles.productListItem}
                        left={props => <List.Icon {...props} icon="package-variant" />}
                      />
                    ))}
                  </View>
                </>
              )}

              {/* Show selected product details and form */}
              {selectedProduct && (
                <>
                  <View style={styles.selectedProductCard}>
                    <View style={styles.selectedProductHeader}>
                      <List.Icon icon="package-variant" />
                      <View style={styles.selectedProductDetails}>
                        <Paragraph style={styles.selectedProductName}>
                          {selectedProduct.name}
                        </Paragraph>
                        <Paragraph style={styles.selectedProductInfo}>
                          {selectedProduct.code} • Stock: {selectedProduct.stock_quantity} {selectedProduct.unit}
                        </Paragraph>
                      </View>
                    </View>
                    <Button
                      mode="text"
                      onPress={() => setSelectedProduct(null)}
                      compact
                    >
                      Change
                    </Button>
                  </View>

                  <TextInput
                    label="Damaged Quantity *"
                    value={damagedQuantity}
                    onChangeText={setDamagedQuantity}
                    mode="outlined"
                    style={styles.dialogInput}
                    keyboardType="numeric"
                  />

                  {/* Damage Reason Selection */}
                  <Menu
                    visible={reasonMenuVisible}
                    onDismiss={() => setReasonMenuVisible(false)}
                    anchor={
                      <Button
                        mode="outlined"
                        onPress={() => setReasonMenuVisible(true)}
                        style={styles.dialogInput}
                        icon={getReasonIcon(damageReason)}
                        contentStyle={{ justifyContent: 'flex-start' }}
                      >
                        {damageReason}
                      </Button>
                    }
                    contentStyle={{ backgroundColor: '#ffffff', maxHeight: 300 }}
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    {(['EXPIRED', 'BROKEN', 'DEFECTIVE', 'SPOILED', 'LOST', 'THEFT', 'OTHER'] as DamageReason[]).map(reason => (
                      <Menu.Item
                        key={reason}
                        onPress={() => {
                          setDamageReason(reason);
                          setReasonMenuVisible(false);
                        }}
                        title={reason}
                        leadingIcon={getReasonIcon(reason)}
                        style={{ backgroundColor: '#ffffff' }}
                        titleStyle={{ color: '#333333' }}
                      />
                    ))}
                  </Menu>

                  <TextInput
                    label="Description (Optional)"
                    value={damageDescription}
                    onChangeText={setDamageDescription}
                    mode="outlined"
                    style={styles.dialogInput}
                    multiline
                    numberOfLines={3}
                  />

                  {damagedQuantity && (
                    <View style={styles.summaryContainer}>
                      <Chip
                        icon={getReasonIcon(damageReason)}
                        style={[styles.reasonChip, { backgroundColor: getReasonColor(damageReason) }]}
                        textStyle={{ color: 'white' }}
                      >
                        {damageReason}
                      </Chip>
                      <Paragraph style={styles.summaryText}>
                        {parseInt(damagedQuantity) || 0} × ₱{selectedProduct.cost.toFixed(2)} =
                        <Text style={styles.summaryAmount}>
                          ₱{((parseInt(damagedQuantity) || 0) * selectedProduct.cost).toFixed(2)}
                        </Text>
                      </Paragraph>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAddDamageDialogVisible(false)}>Cancel</Button>
            <Button onPress={addDamagedItem} loading={loading} disabled={!selectedProduct}>
              Record Damage
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  historyButton: {
    marginLeft: 16,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  sessionCard: {
    marginBottom: 16,
    elevation: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionId: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sessionName: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  sessionDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  sessionStats: {
    alignItems: 'flex-end',
  },
  statusChip: {
    backgroundColor: '#2196F3',
    marginBottom: 8,
  },
  itemCount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  sessionNotes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    opacity: 0.7,
  },
  divider: {
    marginVertical: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 70,
  },
  addDialog: {
    maxHeight: '90%',
  },
  dialogContent: {
    maxHeight: 500,
  },
  dialogInput: {
    marginBottom: 16,
  },
  productList: {
    maxHeight: 250,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  productListItem: {
    minHeight: 60,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedProduct: {
    backgroundColor: '#E3F2FD',
  },
  selectedProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  selectedProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedProductDetails: {
    flex: 1,
    marginLeft: 8,
  },
  selectedProductName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#1976D2',
  },
  selectedProductInfo: {
    fontSize: 12,
    opacity: 0.7,
  },
  summaryContainer: {
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  reasonChip: {
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    textAlign: 'center',
  },
  summaryAmount: {
    fontWeight: 'bold',
    color: '#F44336',
  },
});