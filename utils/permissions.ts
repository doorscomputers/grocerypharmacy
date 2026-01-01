import { User } from '../database/schema';
import { getDatabase } from '../database/getDatabase';

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
  | 'MANAGE_PURCHASES'
  | 'MANAGE_SUPPLIERS'
  | 'CREATE_PURCHASE_ORDER'
  | 'MANAGE_SUPPLIER_PAYMENTS'
  | 'MANAGE_DAMAGED_ITEMS'
  | 'MANAGE_CUSTOMERS'
  | 'COLLECT_CUSTOMER_PAYMENTS';

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
    'MANAGE_SUPPLIERS',
    'CREATE_PURCHASE_ORDER',
    'MANAGE_SUPPLIER_PAYMENTS',
    'MANAGE_DAMAGED_ITEMS',
    'MANAGE_CUSTOMERS',
    'COLLECT_CUSTOMER_PAYMENTS',
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
    'MANAGE_SUPPLIERS',
    'CREATE_PURCHASE_ORDER',
    'MANAGE_SUPPLIER_PAYMENTS',
    'MANAGE_DAMAGED_ITEMS',
    'MANAGE_CUSTOMERS',
    'COLLECT_CUSTOMER_PAYMENTS',
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
      const dbService = getDatabase();
      // Check if the method exists (may not be in mock service)
      if (dbService.getEnabledPermissionsForRole) {
        const managerPerms = await dbService.getEnabledPermissionsForRole('MANAGER');
        const cashierPerms = await dbService.getEnabledPermissionsForRole('CASHIER');

        this.dynamicPermissions.set('MANAGER', managerPerms);
        this.dynamicPermissions.set('CASHIER', cashierPerms);
      }
    } catch (error) {
      console.error('Failed to load dynamic permissions:', error);
      // Fall back to static permissions if dynamic loading fails
    }
  }

  static hasPermission(user: User | null, permission: Permission): boolean {
    // Check if user exists and is active (handle both boolean and number types)
    if (!user) {
      console.log('[Permission] No user provided');
      return false;
    }

    // Handle is_active as both boolean true and number 1
    const isActive = user.is_active === true || user.is_active === 1 || (user as any).is_active === 1;
    if (!isActive) {
      console.log('[Permission] User not active:', user.is_active);
      return false;
    }

    const userRole = user.role as UserRole;
    console.log('[Permission] Checking', permission, 'for role', userRole);

    // Admin always has all permissions from ROLE_PERMISSIONS
    if (userRole === 'ADMIN') {
      const hasIt = ROLE_PERMISSIONS[userRole].includes(permission);
      console.log('[Permission] Admin has', permission, ':', hasIt);
      return hasIt;
    }

    // Use dynamic permissions for Manager and Cashier
    const dynamicPerms = this.dynamicPermissions.get(userRole);
    if (dynamicPerms) {
      return dynamicPerms.includes(permission);
    }

    // Fallback to static permissions
    const rolePermissions = ROLE_PERMISSIONS[userRole];
    return rolePermissions ? rolePermissions.includes(permission) : false;
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

  static clearPermissions(): void {
    this.dynamicPermissions.clear();
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