import React from 'react';
import { View } from 'react-native';
import { Card, Paragraph, Title } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { Permission } from '../utils/permissions';

interface RoleGuardProps {
  children: React.ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showFallback?: boolean;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback,
  showFallback = true,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, user } = useAuth();

  let hasAccess = false;

  // Debug logging
  console.log('[RoleGuard] Checking permission:', permission, 'User:', user?.username, 'Role:', user?.role);

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    if (requireAll) {
      hasAccess = hasAllPermissions(permissions);
    } else {
      hasAccess = hasAnyPermission(permissions);
    }
  } else {
    // No permissions specified, assume access granted
    hasAccess = true;
  }

  console.log('[RoleGuard] Result for', permission, ':', hasAccess);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showFallback) {
    return (
      <Card style={{ margin: 16, padding: 16 }}>
        <Card.Content>
          <Title>Access Restricted</Title>
          <Paragraph>You don't have permission to access this feature.</Paragraph>
        </Card.Content>
      </Card>
    );
  }

  return null;
};

interface ScreenGuardProps {
  children: React.ReactNode;
  screenName: string;
  fallback?: React.ReactNode;
}

export const ScreenGuard: React.FC<ScreenGuardProps> = ({
  children,
  screenName,
  fallback,
}) => {
  const { canViewScreen } = useAuth();

  if (canViewScreen(screenName)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
      <Card>
        <Card.Content>
          <Title style={{ textAlign: 'center', marginBottom: 16 }}>Access Denied</Title>
          <Paragraph style={{ textAlign: 'center' }}>
            You don't have permission to access this screen.
          </Paragraph>
        </Card.Content>
      </Card>
    </View>
  );
};