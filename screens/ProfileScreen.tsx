import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  List,
  useTheme,
  Dialog,
  Portal,
  Avatar,
  Divider,
} from 'react-native-paper';

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { getDatabase } from '../database/getDatabase';
import { hashPassword, verifyPassword } from '../utils/passwordHash';
import { useResponsiveTheme } from '../utils/responsive';

type ProfileScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Profile'
>;

type Props = {
  navigation: ProfileScreenNavigationProp;
};

export default function ProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const { user, updateUser, logout } = useAuth();

  // Dialog states
  const [usernameDialogVisible, setUsernameDialogVisible] = useState(false);
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleOpenUsernameDialog = () => {
    setNewUsername(user?.username || '');
    setUsernameDialogVisible(true);
  };

  const handleOpenPasswordDialog = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordDialogVisible(true);
  };

  const handleChangeUsername = async () => {
    if (!user) return;

    const trimmedUsername = newUsername.trim();

    if (!trimmedUsername) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }

    if (trimmedUsername.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    if (trimmedUsername === user.username) {
      setUsernameDialogVisible(false);
      return;
    }

    setLoading(true);
    try {
      const dbService = getDatabase();

      // Check if username already exists
      const existingUser = await dbService.getUserByUsername(trimmedUsername);
      if (existingUser && existingUser.id !== user.id) {
        Alert.alert('Error', 'This username is already taken');
        setLoading(false);
        return;
      }

      // Update username in database
      await dbService.updateUser(user.id, { username: trimmedUsername });

      // Update user in context
      updateUser({ username: trimmedUsername });

      setUsernameDialogVisible(false);
      Alert.alert('Success', 'Username updated successfully');
    } catch (error) {
      console.error('Error updating username:', error);
      Alert.alert('Error', 'Failed to update username');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;

    // Validation
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 4) {
      Alert.alert('Error', 'New password must be at least 4 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      const dbService = getDatabase();

      // Get user with password hash to verify current password
      const userWithHash = await dbService.getUserById(user.id);
      if (!userWithHash) {
        Alert.alert('Error', 'User not found');
        setLoading(false);
        return;
      }

      // Verify current password
      if (!verifyPassword(currentPassword, userWithHash.password_hash || '')) {
        Alert.alert('Error', 'Current password is incorrect');
        setLoading(false);
        return;
      }

      // Hash new password and update
      const newPasswordHash = hashPassword(newPassword);
      await dbService.updateUser(user.id, { password_hash: newPasswordHash });

      setPasswordDialogVisible(false);
      Alert.alert(
        'Success',
        'Password changed successfully. Please login again with your new password.',
        [
          {
            text: 'OK',
            onPress: () => {
              logout();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return '#4CAF50';
      case 'MANAGER':
        return '#2196F3';
      case 'CASHIER':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrator';
      case 'MANAGER':
        return 'Manager';
      case 'CASHIER':
        return 'Cashier';
      default:
        return role;
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Paragraph>Please login to view your profile</Paragraph>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <View style={[styles.content, { padding: lo.screenPadding }]}>
          {/* Profile Header */}
          <Card style={styles.profileCard}>
            <Card.Content style={styles.profileHeader}>
              <Avatar.Text
                size={80}
                label={user.username.substring(0, 2).toUpperCase()}
                style={{ backgroundColor: getRoleColor(user.role) }}
              />
              <View style={styles.profileInfo}>
                <Title style={styles.profileName}>{user.full_name || user.username}</Title>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
                  <Paragraph style={styles.roleText}>{getRoleDisplayName(user.role)}</Paragraph>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Account Settings */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={[styles.cardTitle, { fontSize: fs.h3 }]}>Account Settings</Title>
              <Paragraph style={[styles.cardSubtitle, { fontSize: fs.bodySmall }]}>
                Manage your account credentials
              </Paragraph>

              <List.Item
                title="Username"
                description={user.username}
                left={props => <List.Icon {...props} icon="account" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={handleOpenUsernameDialog}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Change Password"
                description="Update your account password"
                left={props => <List.Icon {...props} icon="lock" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={handleOpenPasswordDialog}
                style={styles.listItem}
              />
            </Card.Content>
          </Card>

          {/* Account Info */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Account Information</Title>

              <List.Item
                title="Full Name"
                description={user.full_name || 'Not set'}
                left={props => <List.Icon {...props} icon="card-account-details" />}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Role"
                description={getRoleDisplayName(user.role)}
                left={props => <List.Icon {...props} icon="shield-account" />}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Account Status"
                description={user.is_active ? 'Active' : 'Inactive'}
                left={props => <List.Icon {...props} icon="check-circle" color={user.is_active ? '#4CAF50' : '#F44336'} />}
                style={styles.listItem}
              />
            </Card.Content>
          </Card>

          {/* Logout Button */}
          <Button
            mode="outlined"
            onPress={() => {
              Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: () => logout()
                  }
                ]
              );
            }}
            style={styles.logoutButton}
            textColor="#F44336"
            icon="logout"
          >
            Logout
          </Button>
        </View>
      </ScrollView>

      {/* Username Dialog */}
      <Portal>
        <Dialog visible={usernameDialogVisible} onDismiss={() => setUsernameDialogVisible(false)}>
          <Dialog.Title>Change Username</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="New Username"
              value={newUsername}
              onChangeText={setNewUsername}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUsernameDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleChangeUsername} loading={loading} disabled={loading}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Password Dialog */}
        <Dialog visible={passwordDialogVisible} onDismiss={() => setPasswordDialogVisible(false)}>
          <Dialog.Title>Change Password</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              mode="outlined"
              secureTextEntry={!showCurrentPassword}
              right={
                <TextInput.Icon
                  icon={showCurrentPassword ? "eye-off" : "eye"}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                />
              }
              style={styles.dialogInput}
            />
            <TextInput
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              mode="outlined"
              secureTextEntry={!showNewPassword}
              right={
                <TextInput.Icon
                  icon={showNewPassword ? "eye-off" : "eye"}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                />
              }
              style={styles.dialogInput}
            />
            <TextInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry={!showConfirmPassword}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? "eye-off" : "eye"}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
              style={styles.dialogInput}
            />
            <Paragraph style={styles.helperText}>
              Password must be at least 4 characters
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPasswordDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleChangePassword} loading={loading} disabled={loading}>
              Change Password
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: '4%',
    paddingBottom: '8%',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    marginBottom: '4%',
    elevation: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  profileInfo: {
    marginLeft: 20,
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  card: {
    marginBottom: '4%',
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    opacity: 0.7,
    marginBottom: 12,
    fontSize: 12,
  },
  listItem: {
    paddingVertical: 4,
  },
  dialogInput: {
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  logoutButton: {
    marginTop: 8,
    borderColor: '#F44336',
  },
});
