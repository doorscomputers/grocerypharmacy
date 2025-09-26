import { User } from '../database/schema';
import { DatabaseService } from '../database/DatabaseService';

export type Permission =
  | 'VIEW_DASHBOARD'
  | 'CREATE_SALE'
  | 'VIEW_ALL_SALES'
  | 'VIEW_OWN_SALES'
  | 'VOID_SALE'
  | 'REFUND_SALE'
  | 'MANAGE_PRODUCTS'
  | 'VIEW_PRODUCTS'
  | 'MANAGE_INVENTORY'
  | 'VIEW_REPORTS'
  | 'MANAGE_USERS'
  | 'VIEW_SETTINGS'
  | 'MANAGE_SETTINGS'
  | 'PERFORM_Z_READING'
  | 'PERFORM_X_READING'
  | 'VIEW_EJOURNAL'
  | 'MANAGE_PURCHASES';

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    'VIEW_DASHBOARD',
    'CREATE_SALE',
    'VIEW_ALL_SALES',
    'VIEW_OWN_SALES',
    'VOID_SALE',
    'REFUND_SALE',
    'MANAGE_PRODUCTS',
    'VIEW_PRODUCTS',
    'MANAGE_INVENTORY',
    'VIEW_REPORTS',
    'MANAGE_USERS',
    'VIEW_SETTINGS',
    'MANAGE_SETTINGS',
    'PERFORM_Z_READING',
    'PERFORM_X_READING',
    'VIEW_EJOURNAL',
    'MANAGE_PURCHASES',
  ],
  MANAGER: [
    'VIEW_DASHBOARD',
    'CREATE_SALE',
    'VIEW_ALL_SALES',
    'VIEW_OWN_SALES',
    'VOID_SALE',
    'REFUND_SALE',
    'MANAGE_PRODUCTS',
    'VIEW_PRODUCTS',
    'MANAGE_INVENTORY',
    'VIEW_REPORTS',
    'VIEW_SETTINGS',
    'PERFORM_Z_READING',
    'PERFORM_X_READING',
    'VIEW_EJOURNAL',
    'MANAGE_PURCHASES',
    // Manager cannot: MANAGE_USERS, MANAGE_SETTINGS
  ],
  CASHIER: [
    'VIEW_DASHBOARD',
    'CREATE_SALE',
    'VIEW_OWN_SALES',
    'VIEW_PRODUCTS',
    // Cashier cannot: void/refund sales, manage products/inventory, view all sales, access settings, etc.
  ],
};

export class PermissionService {
  private static dynamicPermissions: Map<string, string[]> = new Map();

  static async loadDynamicPermissions(): Promise<void> {
    try {
      const dbService = DatabaseService.getInstance();
      const managerPerms = await dbService.getEnabledPermissionsForRole('MANAGER');
      const cashierPerms = await dbService.getEnabledPermissionsForRole('CASHIER');

      this.dynamicPermissions.set('MANAGER', managerPerms);
      this.dynamicPermissions.set('CASHIER', cashierPerms);
    } catch (error) {
      console.error('Failed to load dynamic permissions:', error);
      // Fall back to static permissions if dynamic loading fails
    }
  }

  static hasPermission(user: User | null, permission: Permission): boolean {
    if (!user || !user.is_active) {
      return false;
    }

    const userRole = user.role as UserRole;

    // Admin always has all permissions
    if (userRole === 'ADMIN') {
      return ROLE_PERMISSIONS[userRole].includes(permission);
    }

    // Use dynamic permissions for Manager and Cashier
    const dynamicPerms = this.dynamicPermissions.get(userRole);
    if (dynamicPerms) {
      return dynamicPerms.includes(permission);
    }

    // Fallback to static permissions
    const rolePermissions = ROLE_PERMISSIONS[userRole];
    return rolePermissions.includes(permission);
  }

  static hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }

  static hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  static canViewScreen(user: User | null, screenName: string): boolean {
    const screenPermissions: Record<string, Permission[]> = {
      Dashboard: ['VIEW_DASHBOARD'],
      Sales: ['CREATE_SALE'],
      Products: ['VIEW_PRODUCTS'],
      Reports: ['VIEW_REPORTS'],
      Settings: ['VIEW_SETTINGS'],
      Purchase: ['MANAGE_PURCHASES'],
      InitialInventory: ['MANAGE_INVENTORY'],
      PhysicalInventory: ['MANAGE_INVENTORY'],
    };

    const requiredPermissions = screenPermissions[screenName] || [];
    return requiredPermissions.length === 0 || this.hasAnyPermission(user, requiredPermissions);
  }

  static getAccessibleScreens(user: User | null): string[] {
    const allScreens = [
      'Dashboard',
      'Sales',
      'Products',
      'Reports',
      'Settings',
      'Purchase',
      'InitialInventory',
      'PhysicalInventory'
    ];

    return allScreens.filter(screen => this.canViewScreen(user, screen));
  }

  static getRoleDisplayName(role: UserRole): string {
    const roleNames = {
      ADMIN: 'Administrator',
      MANAGER: 'Manager',
      CASHIER: 'Cashier'
    };
    return roleNames[role];
  }

  static canAccessTransaction(user: User | null, transactionCashierId: number): boolean {
    if (!user) return false;

    // Admin and Manager can view all transactions
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      return true;
    }

    // Cashier can only view their own transactions
    return user.id === transactionCashierId;
  }

  static async refreshDynamicPermissions(): Promise<void> {
    await this.loadDynamicPermissions();
  }

  static getAvailablePermissions(): { permission: Permission; label: string; description: string }[] {
    return [
      { permission: 'VIEW_DASHBOARD', label: 'View Dashboard', description: 'Access to dashboard and statistics' },
      { permission: 'CREATE_SALE', label: 'Create Sales', description: 'Process new sales transactions' },
      { permission: 'VIEW_ALL_SALES', label: 'View All Sales', description: 'See all transactions from all users' },
      { permission: 'VIEW_OWN_SALES', label: 'View Own Sales', description: 'See only own transactions' },
      { permission: 'VOID_SALE', label: 'Void Sales', description: 'Cancel/void sales transactions' },
      { permission: 'REFUND_SALE', label: 'Refund Sales', description: 'Process customer refunds' },
      { permission: 'MANAGE_PRODUCTS', label: 'Manage Products', description: 'Create, edit, and delete products' },
      { permission: 'VIEW_PRODUCTS', label: 'View Products', description: 'Browse product catalog' },
      { permission: 'MANAGE_INVENTORY', label: 'Manage Inventory', description: 'Handle inventory movements and counting' },
      { permission: 'VIEW_REPORTS', label: 'View Reports', description: 'Access to BIR reports and analytics' },
      { permission: 'VIEW_SETTINGS', label: 'View Settings', description: 'See system configuration' },
      { permission: 'PERFORM_Z_READING', label: 'Z-Reading', description: 'Generate end-of-day reports' },
      { permission: 'PERFORM_X_READING', label: 'X-Reading', description: 'Generate mid-day inquiry reports' },
      { permission: 'VIEW_EJOURNAL', label: 'View eJournal', description: 'Access audit trail logs' },
      { permission: 'MANAGE_PURCHASES', label: 'Manage Purchases', description: 'Handle purchase orders and receiving' },
    ];
  }
}