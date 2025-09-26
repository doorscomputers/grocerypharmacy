import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../database/schema';
import { DatabaseService } from '../database/DatabaseService';
import { PermissionService, Permission } from '../utils/permissions';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  canViewScreen: (screenName: string) => boolean;
  getAccessibleScreens: () => string[];
  updateUser: (userData: Partial<User>) => void;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for stored session on app start
    checkStoredSession();
  }, []);

  const checkStoredSession = async () => {
    try {
      // In a production app, you'd check stored tokens/session
      // For now, we'll just check if there's a valid session
      console.log('Checking stored session...');
    } catch (error) {
      console.error('Error checking stored session:', error);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const dbService = DatabaseService.getInstance();
      const authenticatedUser = await dbService.authenticateUser(username, password);

      if (authenticatedUser) {
        const userWithTypedRole = authenticatedUser as User;
        setUser(userWithTypedRole);
        setIsAuthenticated(true);

        // Update last login
        await dbService.updateUserLastLogin(userWithTypedRole.id);

        // Load dynamic permissions
        await PermissionService.loadDynamicPermissions();

        // Log the login in eJournal
        await dbService.createEJournalEntry({
          entry_type: 'SYSTEM',
          reference_number: `LOGIN_${Date.now()}`,
          description: `User ${username} logged in`,
          cashier_id: userWithTypedRole.id,
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      if (user) {
        const dbService = DatabaseService.getInstance();

        // Log the logout in eJournal
        await dbService.createEJournalEntry({
          entry_type: 'SYSTEM',
          reference_number: `LOGOUT_${Date.now()}`,
          description: `User ${user.username} logged out`,
          cashier_id: user.id,
        });
      }

      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Still proceed with logout even if logging fails
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    return PermissionService.hasPermission(user, permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return PermissionService.hasAnyPermission(user, permissions);
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(permission => PermissionService.hasPermission(user, permission));
  };

  const canViewScreen = (screenName: string): boolean => {
    return PermissionService.canViewScreen(user, screenName);
  };

  const getAccessibleScreens = (): string[] => {
    return PermissionService.getAccessibleScreens(user);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const refreshPermissions = async () => {
    await PermissionService.refreshDynamicPermissions();
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canViewScreen,
    getAccessibleScreens,
    updateUser,
    refreshPermissions,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};