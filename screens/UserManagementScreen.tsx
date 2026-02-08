import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Button,
  DataTable,
  IconButton,
  Portal,
  Dialog,
  Paragraph,
  Chip,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { User } from '../database/schema';
import { useAuth } from '../contexts/AuthContext';
import { RoleGuard } from '../components/RoleGuard';
import { PermissionService } from '../utils/permissions';
import { StableTextInput } from '../components/StableTextInput';
import { hashPassword } from '../utils/passwordHash';

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
    try {
      const dbService = getDatabase();
      await dbService.updateUser(user.id, { is_active: !user.is_active });
      loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      Alert.alert('Error', 'Failed to update user status');
    }
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

      // Only update password if a new one was provided
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
        return theme.colors.outline;
      default:
        return theme.colors.outline;
    }
  };

  return (
    <RoleGuard permission="MANAGE_USERS">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <Title style={styles.title}>User Management</Title>
          <Button
            mode="contained"
            onPress={() => setDialogVisible(true)}
            icon="account-plus"
            style={styles.addButton}
          >
            Add User
          </Button>
        </View>

        <ScrollView style={styles.content}>
          <Card style={styles.card}>
            <Card.Content>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>Username</DataTable.Title>
                  <DataTable.Title>Full Name</DataTable.Title>
                  <DataTable.Title>Role</DataTable.Title>
                  <DataTable.Title>Status</DataTable.Title>
                  <DataTable.Title>Actions</DataTable.Title>
                </DataTable.Header>

                {users.map((user) => (
                  <DataTable.Row key={user.id}>
                    <DataTable.Cell>{user.username}</DataTable.Cell>
                    <DataTable.Cell>{user.full_name}</DataTable.Cell>
                    <DataTable.Cell>
                      <Chip
                        textStyle={{ color: 'white' }}
                        style={{ backgroundColor: getRoleColor(user.role) }}
                        compact
                      >
                        {PermissionService.getRoleDisplayName(user.role as any)}
                      </Chip>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      <Chip
                        mode={user.is_active ? 'outlined' : 'flat'}
                        textStyle={{
                          color: user.is_active ? theme.colors.primary : theme.colors.error
                        }}
                        compact
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Chip>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      <View style={styles.actionButtons}>
                        <IconButton
                          icon="pencil"
                          size={20}
                          onPress={() => handleEditUser(user)}
                          iconColor={theme.colors.primary}
                        />
                        <IconButton
                          icon={user.is_active ? 'account-cancel' : 'account-check'}
                          size={20}
                          onPress={() => handleToggleUserStatus(user)}
                          disabled={user.id === currentUser?.id}
                          iconColor={user.is_active ? theme.colors.error : theme.colors.primary}
                        />
                      </View>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>

              {users.length === 0 && !loading && (
                <View style={styles.emptyState}>
                  <Paragraph style={styles.emptyText}>No users found</Paragraph>
                </View>
              )}
            </Card.Content>
          </Card>
        </ScrollView>

        <Portal>
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
                  {(['CASHIER', 'MANAGER', 'ADMIN'] as const).map((role) => (
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
                  {(['CASHIER', 'MANAGER', 'ADMIN'] as const).map((role) => (
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
      </SafeAreaView>
    </RoleGuard>
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    elevation: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    elevation: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
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