import React, { useState, useEffect } from 'react';
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
  Switch,
  List,
  Button,
  Chip,
  useTheme,
  Divider,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { RoleGuard } from '../components/RoleGuard';
import { PermissionService, Permission } from '../utils/permissions';

type PermissionManagementScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PermissionManagement'
>;

type Props = {
  navigation: PermissionManagementScreenNavigationProp;
};

interface RolePermission {
  id: number;
  role: 'MANAGER' | 'CASHIER';
  permission: string;
  is_enabled: boolean;
  updated_at: string;
}

export default function PermissionManagementScreen({ navigation }: Props) {
  const [managerPermissions, setManagerPermissions] = useState<RolePermission[]>([]);
  const [cashierPermissions, setCashierPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const { user, refreshPermissions } = useAuth();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const managerPerms = await dbService.getRolePermissions('MANAGER');
      const cashierPerms = await dbService.getRolePermissions('CASHIER');

      setManagerPermissions(managerPerms as RolePermission[]);
      setCashierPermissions(cashierPerms as RolePermission[]);
    } catch (error) {
      console.error('Error loading permissions:', error);
      Alert.alert('Error', 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = async (
    role: 'MANAGER' | 'CASHIER',
    permission: string,
    currentValue: boolean
  ) => {
    try {
      const dbService = getDatabase();
      await dbService.updateRolePermission(role, permission, !currentValue, user?.id || 1);

      // Update local state
      if (role === 'MANAGER') {
        setManagerPermissions(prev =>
          prev.map(p => p.permission === permission ? { ...p, is_enabled: !currentValue } : p)
        );
      } else {
        setCashierPermissions(prev =>
          prev.map(p => p.permission === permission ? { ...p, is_enabled: !currentValue } : p)
        );
      }

      // Refresh permissions in the app
      await refreshPermissions();

    } catch (error) {
      console.error('Error updating permission:', error);
      Alert.alert('Error', 'Failed to update permission');
    }
  };

  const handleResetRole = async (role: 'MANAGER' | 'CASHIER') => {
    Alert.alert(
      'Reset Permissions',
      `Are you sure you want to reset all ${role.toLowerCase()} permissions to default?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const dbService = getDatabase();
              await dbService.resetRolePermissions(role, user?.id || 1);
              await loadPermissions();
              await refreshPermissions();
              Alert.alert('Success', `${role.toLowerCase()} permissions reset to default`);
            } catch (error) {
              console.error('Error resetting permissions:', error);
              Alert.alert('Error', 'Failed to reset permissions');
            }
          }
        }
      ]
    );
  };

  const getPermissionInfo = (permission: string) => {
    const availablePerms = PermissionService.getAvailablePermissions();
    return availablePerms.find(p => p.permission === permission) || {
      permission: permission as Permission,
      label: permission.replace(/_/g, ' ').toLowerCase(),
      description: 'Custom permission'
    };
  };

  const renderRoleCard = (
    role: 'MANAGER' | 'CASHIER',
    permissions: RolePermission[]
  ) => {
    const enabledCount = permissions.filter(p => p.is_enabled).length;
    const totalCount = permissions.length;

    return (
      <Card style={styles.roleCard} key={role}>
        <Card.Content>
          <View style={styles.roleHeader}>
            <View>
              <Title style={styles.roleTitle}>
                {role === 'MANAGER' ? '👔 Manager' : '💼 Cashier'}
              </Title>
              <Paragraph style={styles.roleSubtitle}>
                {enabledCount} of {totalCount} permissions enabled
              </Paragraph>
            </View>
            <View style={styles.roleActions}>
              <Chip
                mode="outlined"
                style={[styles.statusChip, {
                  backgroundColor: enabledCount > totalCount * 0.7 ? '#E8F5E8' : '#FFF3E0'
                }]}
              >
                {enabledCount > totalCount * 0.7 ? 'Full Access' : 'Limited'}
              </Chip>
              <IconButton
                icon="restore"
                size={24}
                onPress={() => handleResetRole(role)}
                style={styles.resetButton}
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          {permissions.map((perm) => {
            const permInfo = getPermissionInfo(perm.permission);
            return (
              <View key={perm.permission} style={styles.permissionRow}>
                <View style={styles.permissionInfo}>
                  <Title style={styles.permissionTitle}>{permInfo.label}</Title>
                  <Paragraph style={styles.permissionDescription}>
                    {permInfo.description}
                  </Paragraph>
                </View>
                <Switch
                  value={perm.is_enabled}
                  onValueChange={(value) =>
                    handlePermissionToggle(role, perm.permission, perm.is_enabled)
                  }
                  color={theme.colors.primary}
                />
              </View>
            );
          })}
        </Card.Content>
      </Card>
    );
  };

  return (
    <RoleGuard permission="MANAGE_PERMISSIONS">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <Title style={styles.title}>Permission Management</Title>
          <Paragraph style={styles.subtitle}>
            Control what features each role can access
          </Paragraph>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.infoCard}>
            <Card style={[styles.card, { backgroundColor: theme.colors.primaryContainer }]}>
              <Card.Content>
                <Title style={styles.infoTitle}>💡 How it works</Title>
                <Paragraph style={styles.infoText}>
                  • Toggle permissions on/off for Manager and Cashier roles{'\n'}
                  • Admin role always has full access{'\n'}
                  • Changes take effect immediately{'\n'}
                  • Use "Reset" to restore default permissions
                </Paragraph>
              </Card.Content>
            </Card>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Paragraph>Loading permissions...</Paragraph>
            </View>
          ) : (
            <View style={styles.rolesContainer}>
              {renderRoleCard('MANAGER', managerPermissions)}
              {renderRoleCard('CASHIER', cashierPermissions)}
            </View>
          )}

          <View style={styles.footerActions}>
            <Button
              mode="contained"
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              Done
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    marginBottom: 16,
  },
  card: {
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  rolesContainer: {
    gap: 16,
  },
  roleCard: {
    elevation: 4,
    marginBottom: 16,
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  roleSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  roleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    borderRadius: 16,
  },
  resetButton: {
    margin: 0,
  },
  divider: {
    marginBottom: 16,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  permissionInfo: {
    flex: 1,
    marginRight: 16,
  },
  permissionTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 12,
    opacity: 0.7,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerActions: {
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  backButton: {
    minWidth: 120,
  },
});