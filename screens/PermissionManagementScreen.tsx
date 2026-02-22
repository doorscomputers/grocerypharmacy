import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Switch,
  List,
  Button,
  Chip,
  useTheme,
  Divider,
  IconButton,
  SegmentedButtons,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { RoleGuard } from '../components/RoleGuard';
import { PermissionService, Permission, PERMISSION_CATEGORIES } from '../utils/permissions';
import { useResponsiveTheme } from '../utils/responsive';

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
  const [selectedRole, setSelectedRole] = useState<'MANAGER' | 'CASHIER'>('MANAGER');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
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

  const confirmResetRole = async () => {
    try {
      setShowResetConfirm(false);
      const dbService = getDatabase();
      await dbService.resetRolePermissions(selectedRole, user?.id || 1);
      await loadPermissions();
      await refreshPermissions();
      Alert.alert('Success', `${selectedRole.toLowerCase()} permissions reset to default`);
    } catch (error) {
      console.error('Error resetting permissions:', error);
      Alert.alert('Error', 'Failed to reset permissions');
    }
  };

  const getPermissionInfo = (permission: string) => {
    const availablePerms = PermissionService.getAvailablePermissions();
    return availablePerms.find(p => p.permission === permission) || {
      permission: permission as Permission,
      label: permission.replace(/_/g, ' ').toLowerCase(),
      description: 'Custom permission'
    };
  };

  const permissions = selectedRole === 'MANAGER' ? managerPermissions : cashierPermissions;
  const enabledCount = permissions.filter(p => p.is_enabled).length;
  const totalCount = permissions.length;

  const toggleCategory = (label: string) => {
    setExpandedCategories(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const getCategoryPermissions = (categoryPerms: Permission[]) => {
    return permissions.filter(p => categoryPerms.includes(p.permission as Permission));
  };

  return (
    <RoleGuard permission="MANAGE_PERMISSIONS">
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Fixed header area */}
        <View style={[styles.header, { paddingHorizontal: lo.screenPadding }]}>
          <Text style={[styles.title, { fontSize: fs.h2 }]}>Permission Management</Text>
          <Text style={[styles.subtitle, { fontSize: fs.body }]}>
            Control what features each role can access
          </Text>
        </View>

        {/* Segmented buttons - fixed */}
        <View style={[styles.segmentContainer, { paddingHorizontal: lo.screenPadding }]}>
          <SegmentedButtons
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as 'MANAGER' | 'CASHIER')}
            buttons={[
              { value: 'MANAGER', label: 'Manager', icon: 'briefcase-outline' },
              { value: 'CASHIER', label: 'Cashier', icon: 'cash-register' },
            ]}
          />
        </View>

        {/* Role summary - fixed */}
        <View style={[styles.roleSummary, { paddingHorizontal: lo.screenPadding }]}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryText}>
              {enabledCount} of {totalCount} enabled
            </Text>
            <Chip
              mode="outlined"
              compact
              style={[styles.statusChip, {
                backgroundColor: enabledCount > totalCount * 0.7 ? '#E8F5E8' : '#FFF3E0'
              }]}
              textStyle={styles.statusChipText}
            >
              {enabledCount > totalCount * 0.7 ? 'Full Access' : 'Limited'}
            </Chip>
          </View>
          <Button
            mode="outlined"
            compact
            icon="restore"
            onPress={() => setShowResetConfirm(true)}
            textColor={theme.colors.error}
            style={styles.resetButton}
          >
            Reset
          </Button>
        </View>

        <Divider />

        {/* Scrollable accordion content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 12 }}>Loading permissions...</Text>
          </View>
        ) : (
          <ScrollView style={[styles.content, { paddingHorizontal: lo.screenPadding }]}>
            <View style={styles.accordionCard}>
              {PERMISSION_CATEGORIES.map((category) => {
                const catPerms = getCategoryPermissions(category.permissions);
                // Hide categories with no permissions for this role
                if (catPerms.length === 0) return null;

                const catEnabled = catPerms.filter(p => p.is_enabled).length;
                const isExpanded = expandedCategories[category.label] || false;

                return (
                  <List.Accordion
                    key={category.label}
                    title={category.label}
                    left={props => <List.Icon {...props} icon={category.icon} />}
                    right={() => (
                      <Chip compact style={styles.countChip} textStyle={styles.countChipText}>
                        {catEnabled}/{catPerms.length}
                      </Chip>
                    )}
                    expanded={isExpanded}
                    onPress={() => toggleCategory(category.label)}
                    style={styles.accordion}
                    titleStyle={styles.accordionTitle}
                  >
                    {catPerms.map((perm) => {
                      const permInfo = getPermissionInfo(perm.permission);
                      return (
                        <View key={perm.permission} style={styles.permissionRow}>
                          <View style={styles.permissionInfo}>
                            <Text style={styles.permissionLabel}>{permInfo.label}</Text>
                            <Text style={styles.permissionDesc}>{permInfo.description}</Text>
                          </View>
                          <Switch
                            value={perm.is_enabled}
                            onValueChange={() =>
                              handlePermissionToggle(selectedRole, perm.permission, perm.is_enabled)
                            }
                            color={theme.colors.primary}
                          />
                        </View>
                      );
                    })}
                  </List.Accordion>
                );
              })}
            </View>
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </View>

      {/* Reset Confirmation Modal */}
      <Modal
        visible={showResetConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetConfirm(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowResetConfirm(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalIconRow}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#d32f2f" />
            </View>
            <Text style={styles.modalTitle}>Reset Permissions?</Text>
            <Text style={styles.modalMessage}>
              This will reset all {selectedRole.toLowerCase()} permissions back to their default values. This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowResetConfirm(false)}
                style={styles.modalCancelBtn}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={confirmResetRole}
                buttonColor="#d32f2f"
                textColor="#fff"
                icon="restore"
                style={styles.modalResetBtn}
              >
                Reset to Default
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  segmentContainer: {
    paddingVertical: 8,
  },
  roleSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusChip: {
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  resetButton: {
    borderColor: '#d32f2f',
  },
  content: {
    flex: 1,
  },
  accordionCard: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  accordion: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  accordionTitle: {
    fontWeight: '600',
    fontSize: 15,
  },
  countChip: {
    backgroundColor: '#E3F2FD',
    marginRight: 8,
  },
  countChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingLeft: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    backgroundColor: '#FAFAFA',
  },
  permissionInfo: {
    flex: 1,
    marginRight: 12,
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  permissionDesc: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalResetBtn: {
    flex: 1,
  },
});
