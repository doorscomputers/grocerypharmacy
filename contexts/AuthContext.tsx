import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../database/schema';
import { getDatabase } from '../database/getDatabase';
import { PermissionService, Permission } from '../utils/permissions';

const SESSION_STORAGE_KEY = '@igorotech_pos_session';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored session on app start
    checkStoredSession();
  }, []);

  const checkStoredSession = async () => {
    try {
      console.log('Checking stored session...');
      const storedSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);

      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        const { userId, username } = sessionData;

        // Verify user still exists in database
        const dbService = getDatabase();
        const existingUser = await dbService.getUserById(userId);

        if (existingUser && existingUser.is_active) {
          console.log('Session restored for user:', username);
          setUser(existingUser as User);
          setIsAuthenticated(true);

          // Load dynamic permissions
          await PermissionService.loadDynamicPermissions();
        } else {
          // User no longer exists or is inactive, clear session
          console.log('Stored session invalid, clearing...');
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Error checking stored session:', error);
      // Clear potentially corrupted session data
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSession = async (userData: User) => {
    try {
      const sessionData = {
        userId: userData.id,
        username: userData.username,
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      console.log('Session saved for user:', userData.username);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const clearSession = async () => {
    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      console.log('Session cleared');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const dbService = getDatabase();
      const authenticatedUser = await dbService.authenticateUser(username, password);

      if (authenticatedUser) {
        const userWithTypedRole = authenticatedUser as User;
        setUser(userWithTypedRole);
        setIsAuthenticated(true);

        // Save session to AsyncStorage for persistence
        await saveSession(userWithTypedRole);

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

        // Lightweight database health check (runs in background, non-blocking)
        performDatabaseHealthCheck(dbService);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  // Database health check with automatic repair - runs after login
  const performDatabaseHealthCheck = async (dbService: any) => {
    try {
      // Check database health
      const health = await dbService.checkDatabaseHealth();

      console.log('[DB Health] Initial check - Healthy:', health.isHealthy, ', WAL:', health.walMode, ', Integrity:', health.integrityOk);

      if (!health.isHealthy || !health.integrityOk) {
        console.log('[DB Health] Issues detected, attempting automatic repair...');

        // Attempt automatic repair
        try {
          const repairResult = await dbService.attemptDatabaseRepair();

          if (repairResult.success) {
            console.log('[DB Health] Automatic repair SUCCESSFUL');
            repairResult.repairSteps.forEach((step: any) => {
              console.log(`  - ${step.step}: ${step.success ? '✓' : '✗'} ${step.message}`);
            });
          } else {
            console.warn('[DB Health] Automatic repair completed with issues:');
            repairResult.repairSteps.forEach((step: any) => {
              console.log(`  - ${step.step}: ${step.success ? '✓' : '✗'} ${step.message}`);
            });
            console.warn('[DB Health] Remaining issues:', repairResult.finalHealthCheck.issues);

            // Log repair attempt to eJournal for audit trail
            try {
              await dbService.createEJournalEntry({
                entry_type: 'SYSTEM',
                reference_number: `DB_REPAIR_${Date.now()}`,
                description: `Database repair attempted. Success: ${repairResult.success}. Issues: ${repairResult.finalHealthCheck.issues.join(', ') || 'None'}`,
                cashier_id: user?.id || 1,
              });
            } catch (logError) {
              console.warn('[DB Health] Could not log repair attempt:', logError);
            }
          }
        } catch (repairError) {
          console.error('[DB Health] Automatic repair failed:', repairError);

          // Fallback: try quick repair
          try {
            console.log('[DB Health] Trying quick repair as fallback...');
            const quickResult = await dbService.quickRepair();
            console.log('[DB Health] Quick repair result:', quickResult.message);
          } catch (quickError) {
            console.error('[DB Health] Quick repair also failed:', quickError);
          }
        }
      } else if (!health.walMode) {
        // Database is healthy but WAL mode not enabled - just enable protection
        console.log('[DB Health] Enabling WAL mode for better protection...');
        try {
          await dbService.enableCorruptionPrevention();
          console.log('[DB Health] Protection settings enabled successfully');
        } catch (protectionError) {
          console.warn('[DB Health] Could not enable protection:', protectionError);
        }
      } else {
        console.log('[DB Health] Database is healthy, no action needed');
      }

      // Log any remaining issues for debugging
      if (health.issues && health.issues.length > 0) {
        console.warn('[DB Health] Issues found:', health.issues);
      }
    } catch (error) {
      // Don't block login on health check failure
      console.warn('[DB Health] Health check failed:', error);
    }
  };

  const logout = async () => {
    try {
      if (user) {
        const dbService = getDatabase();

        // Log the logout in eJournal
        await dbService.createEJournalEntry({
          entry_type: 'SYSTEM',
          reference_number: `LOGOUT_${Date.now()}`,
          description: `User ${user.username} logged out`,
          cashier_id: user.id,
        });
      }

      // Clear stored session
      await clearSession();

      // Clear permission cache to prevent stale permissions on next login
      PermissionService.clearPermissions();

      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Still proceed with logout even if logging fails
      await clearSession();
      PermissionService.clearPermissions();
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
    isLoading,
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