import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Button,
  IconButton,
  Portal,
  Dialog,
  Paragraph,
  Chip,
  Text,
  Divider,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { User } from '../database/schema';
import { useAuth } from '../contexts/AuthContext';
import { PermissionService } from '../utils/permissions';
import { StableTextInput } from '../components/StableTextInput';
import { hashPassword } from '../utils/passwordHash';
import { useResponsiveTheme } from '../utils/responsive';
import { useResponsive } from '../utils/responsive';

type UserManagementScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'UserManagement'
>;

type Props = {
  navigation: UserManagementScreenNavigationProp;
};

export default function UserManagementScreen({ navigation }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserData, setEditUserData] = useState({
    username: '',
    full_name: '',
    role: 'CASHIER' as 'ADMIN' | 'CASHIER' | 'MANAGER',
    newPassword: '',
  });
  const [newUser, setNewUser] = useState({
    username: '',
    full_name: '',
    role: 'CASHIER' as 'ADMIN' | 'CASHIER' | 'MANAGER',
    password: '',
  });
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const { sp, fs, lo } = useResponsiveTheme();
  const { isPhone, isTablet, isLandscape } = useResponsive();
  const insets = useSafeAreaInsets();

  const DEFAULT_PASSWORD = '123456';

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const fetchedUsers = await dbService.getUsers();
      setUsers(fetchedUsers as User[]);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.full_name || !newUser.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const dbService = getDatabase();
      await dbService.createUser({
        username: newUser.username,
        full_name: newUser.full_name,
        role: newUser.role,
        password_hash: hashPassword(newUser.password),
      });

      setDialogVisible(false);
      setNewUser({ username: '', full_name: '', role: 'CASHIER', password: '' });
      loadUsers();
      Alert.alert('Success', 'User created successfully');
    } catch (error) {
      console.error('Error creating user:', error);
      Alert.alert('Error', 'Failed to create user');
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      `Are you sure you want to ${action} ${user.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: user.is_active ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const dbService = getDatabase();
              await dbService.updateUser(user.id, { is_active: !user.is_active });
              loadUsers();
            } catch (error) {
              console.error('Error updating user status:', error);
              Alert.alert('Error', 'Failed to update user status');
            }
          },
        },
      ]
    );
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserData({
      username: user.username,
      full_name: user.full_name,
      role: user.role as 'ADMIN' | 'CASHIER' | 'MANAGER',
      newPassword: '',
    });
    setEditDialogVisible(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    if (!editUserData.username || !editUserData.full_name) {
      Alert.alert('Error', 'Username and Full Name are required');
      return;
    }

    try {
      const dbService = getDatabase();
      const updateData: any = {
        username: editUserData.username,
        full_name: editUserData.full_name,
        role: editUserData.role,
      };

      if (editUserData.newPassword) {
        updateData.password_hash = hashPassword(editUserData.newPassword);
      }

      await dbService.updateUser(editingUser.id, updateData);
      setEditDialogVisible(false);
      setEditingUser(null);
      loadUsers();
      Alert.alert('Success', 'User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Error', 'Failed to update user');
    }
  };

  const handleResetPassword = () => {
    Alert.alert(
      'Reset Password',
      `Reset password to default "${DEFAULT_PASSWORD}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setEditUserData(prev => ({ ...prev, newPassword: DEFAULT_PASSWORD }));
            Alert.alert('Password Set', `Password will be set to "${DEFAULT_PASSWORD}" when you save.`);
          },
        },
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return theme.colors.error;
      case 'MANAGER':
        return theme.colors.primary;
      case 'CASHIER':
        return '#607D8B';
      default:
        return theme.colors.outline;
    }
  };

  // Allow ADMIN and MANAGER roles to access User Management
  if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'MANAGER') {
    return (
      <Card style={{ margin: 16, padding: 16 }}>
        <Card.Content>
          <Title>Access Restricted</Title>
          <Paragraph>You don't have permission to access this feature.</Paragraph>
        </Card.Content>
      </Card>
    );
  }

  // Managers cannot see ADMIN users
  const visibleUsers = currentUser?.role === 'MANAGER'
    ? users.filter(u => u.role !== 'ADMIN')
    : users;

  // Managers can only assign Cashier or Manager roles
  const availableRoles: ('CASHIER' | 'MANAGER' | 'ADMIN')[] =
    currentUser?.role === 'ADMIN' ? ['CASHIER', 'MANAGER', 'ADMIN'] : ['CASHIER', 'MANAGER'];

  // Use 2 columns on tablet landscape, 1 column otherwise
  const numColumns = isTablet && isLandscape ? 2 : 1;

  const renderUserCard = ({ item }: { item: User }) => {
    const isSelf = item.id === currentUser?.id;

    return (
      <Card style={[
        styles.userCard,
        {
          marginHorizontal: sp.sm,
          marginVertical: sp.xs,
          flex: numColumns === 2 ? 1 : undefined,
          maxWidth: numColumns === 2 ? '49%' : undefined,
        },
      ]}>
        <Card.Content style={{ paddingVertical: sp.md, paddingHorizontal: sp.md }}>
          {/* Top row: Name + Role */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { fontSize: fs.cardTitle }]} numberOfLines={1}>
                {item.full_name}
              </Text>
              <Text style={[styles.userUsername, { fontSize: fs.bodySmall }]}>
                @{item.username}
              </Text>
            </View>
            <View style={styles.cardBadges}>
              <Chip
                textStyle={{ color: '#FFFFFF', fontSize: fs.body }}
                style={{ backgroundColor: getRoleColor(item.role) }}
              >
                {PermissionService.getRoleDisplayName(item.role as any)}
              </Chip>
            </View>
          </View>

          <Divider style={{ marginVertical: sp.sm }} />

          {/* Status + Actions row */}
          <View style={styles.cardFooter}>
            <Chip
              compact
              icon={item.is_active ? 'check-circle' : 'close-circle'}
              textStyle={{
                color: item.is_active ? '#2E7D32' : '#C62828',
                fontSize: fs.caption,
              }}
              style={{
                backgroundColor: item.is_active ? '#E8F5E9' : '#FFEBEE',
              }}
            >
              {item.is_active ? 'Active' : 'Inactive'}
            </Chip>

            <View style={styles.cardActions}>
              <Button
                mode="outlined"
                onPress={() => handleEditUser(item)}
                icon="pencil"
                compact
                style={styles.cardActionButton}
                labelStyle={{ fontSize: fs.caption }}
              >
                Edit
              </Button>
              {!isSelf && (
                <Button
                  mode="outlined"
                  onPress={() => handleToggleUserStatus(item)}
                  icon={item.is_active ? 'account-cancel' : 'account-check'}
                  compact
                  style={[
                    styles.cardActionButton,
                    { borderColor: item.is_active ? '#E53935' : '#43A047' },
                  ]}
                  textColor={item.is_active ? '#E53935' : '#43A047'}
                  labelStyle={{ fontSize: fs.caption }}
                >
                  {item.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
        <Paragraph style={{ marginTop: sp.md }}>Loading users...</Paragraph>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: lo.screenPadding, paddingVertical: sp.sm }]}>
        <View>
          <Title style={{ fontSize: fs.h2 }}>User Management</Title>
          <Paragraph style={{ fontSize: fs.bodySmall, opacity: 0.6 }}>
            {visibleUsers.length} user{visibleUsers.length !== 1 ? 's' : ''}
          </Paragraph>
        </View>
        <Button
          mode="contained"
          onPress={() => setDialogVisible(true)}
          icon="account-plus"
          style={{ elevation: 2 }}
        >
          Add User
        </Button>
      </View>

      <Divider />

      {/* User List */}
      <FlatList
        key={numColumns}
        data={visibleUsers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderUserCard}
        numColumns={numColumns}
        contentContainerStyle={{
          padding: sp.sm,
          paddingBottom: insets.bottom + 16,
        }}
        columnWrapperStyle={numColumns > 1 ? { gap: sp.sm } : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Paragraph style={{ fontSize: fs.body, opacity: 0.6 }}>No users found</Paragraph>
          </View>
        }
      />

      {/* Dialogs */}
      <Portal>
        {/* Add User Dialog */}
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Add New User</Dialog.Title>
          <Dialog.Content>
            <StableTextInput
              label="Username"
              value={newUser.username}
              onChangeText={(text) => setNewUser(prev => ({ ...prev, username: text }))}
              mode="outlined"
              style={styles.dialogInput}
              autoCapitalize="none"
            />
            <StableTextInput
              label="Full Name"
              value={newUser.full_name}
              onChangeText={(text) => setNewUser(prev => ({ ...prev, full_name: text }))}
              mode="outlined"
              style={styles.dialogInput}
            />
            <StableTextInput
              label="Password"
              value={newUser.password}
              onChangeText={(text) => setNewUser(prev => ({ ...prev, password: text }))}
              mode="outlined"
              secureTextEntry
              style={styles.dialogInput}
            />
            <View style={styles.roleSelector}>
              <Paragraph>Role:</Paragraph>
              <View style={styles.roleChips}>
                {availableRoles.map((role) => (
                  <Chip
                    key={role}
                    selected={newUser.role === role}
                    onPress={() => setNewUser({ ...newUser, role })}
                    style={[styles.roleChip, newUser.role === role && { backgroundColor: theme.colors.primary }]}
                    textStyle={{ color: newUser.role === role ? '#FFFFFF' : '#333333' }}
                  >
                    {PermissionService.getRoleDisplayName(role)}
                  </Chip>
                ))}
              </View>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleCreateUser}>
              Create User
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
          <Dialog.Title>Edit User</Dialog.Title>
          <Dialog.Content>
            <StableTextInput
              label="Username"
              value={editUserData.username}
              onChangeText={(text) => setEditUserData(prev => ({ ...prev, username: text }))}
              mode="outlined"
              style={styles.dialogInput}
              autoCapitalize="none"
            />
            <StableTextInput
              label="Full Name"
              value={editUserData.full_name}
              onChangeText={(text) => setEditUserData(prev => ({ ...prev, full_name: text }))}
              mode="outlined"
              style={styles.dialogInput}
            />
            <View style={styles.passwordSection}>
              <StableTextInput
                label="New Password (leave blank to keep current)"
                value={editUserData.newPassword}
                onChangeText={(text) => setEditUserData(prev => ({ ...prev, newPassword: text }))}
                mode="outlined"
                secureTextEntry
                style={styles.passwordInput}
              />
              <Button
                mode="outlined"
                onPress={handleResetPassword}
                compact
                style={styles.resetButton}
              >
                Reset to Default
              </Button>
            </View>
            <View style={styles.roleSelector}>
              <Paragraph>Role:</Paragraph>
              <View style={styles.roleChips}>
                {availableRoles.map((role) => (
                  <Chip
                    key={role}
                    selected={editUserData.role === role}
                    onPress={() => setEditUserData(prev => ({ ...prev, role }))}
                    style={[styles.roleChip, editUserData.role === role && { backgroundColor: theme.colors.primary }]}
                    textStyle={{ color: editUserData.role === role ? '#FFFFFF' : '#333333' }}
                  >
                    {PermissionService.getRoleDisplayName(role)}
                  </Chip>
                ))}
              </View>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleSaveUser}>
              Save Changes
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCard: {
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  userName: {
    fontWeight: '700',
  },
  userUsername: {
    opacity: 0.55,
    marginTop: 2,
  },
  cardBadges: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cardActionButton: {
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  dialogInput: {
    marginBottom: 16,
  },
  roleSelector: {
    marginTop: 8,
  },
  roleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  roleChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  passwordSection: {
    marginBottom: 16,
  },
  passwordInput: {
    marginBottom: 8,
  },
  resetButton: {
    alignSelf: 'flex-start',
  },
});
