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
  | 'ADD_PRODUCT'
  | 'EDIT_PRODUCT'
  | 'DELETE_PRODUCT'
  | 'VIEW_PRODUCT_COST'
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
  | 'RECEIVE_PURCHASE'
  | 'MANAGE_SUPPLIER_PAYMENTS'
  | 'PAY_PAYABLES'
  | 'VIEW_ACCOUNTS_PAYABLE'
  | 'MANAGE_DAMAGED_ITEMS'
  | 'MANAGE_CUSTOMERS'
  | 'ADD_CUSTOMER'
  | 'EDIT_CUSTOMER'
  | 'DELETE_CUSTOMER'
  | 'COLLECT_CUSTOMER_PAYMENTS'
  | 'VIEW_ACCOUNTS_RECEIVABLE'
  | 'CREATE_CHARGE_INVOICE'
  | 'DELETE_RECORDS'
  | 'ACCESS_ADMIN_TOOLS'
  | 'MANAGE_PERMISSIONS';

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface PermissionCategory {
  label: string;
  icon: string;
  permissions: Permission[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    label: 'POS / Sales',
    icon: 'cash-register',
    permissions: ['VIEW_DASHBOARD', 'CREATE_SALE', 'VIEW_ALL_SALES', 'VIEW_OWN_SALES', 'VOID_SALE', 'REFUND_SALE'],
  },
  {
    label: 'Products',
    icon: 'package-variant',
    permissions: ['MANAGE_PRODUCTS', 'VIEW_PRODUCTS', 'ADD_PRODUCT', 'EDIT_PRODUCT', 'DELETE_PRODUCT', 'VIEW_PRODUCT_COST'],
  },
  {
    label: 'Inventory',
    icon: 'warehouse',
    permissions: ['MANAGE_INVENTORY'],
  },
  {
    label: 'Purchasing',
    icon: 'truck-delivery',
    permissions: ['MANAGE_PURCHASES', 'CREATE_PURCHASE_ORDER', 'RECEIVE_PURCHASE', 'MANAGE_SUPPLIERS', 'MANAGE_SUPPLIER_PAYMENTS', 'PAY_PAYABLES', 'VIEW_ACCOUNTS_PAYABLE', 'MANAGE_DAMAGED_ITEMS'],
  },
  {
    label: 'Customers',
    icon: 'account-group',
    permissions: ['MANAGE_CUSTOMERS', 'ADD_CUSTOMER', 'EDIT_CUSTOMER', 'DELETE_CUSTOMER', 'COLLECT_CUSTOMER_PAYMENTS', 'VIEW_ACCOUNTS_RECEIVABLE', 'CREATE_CHARGE_INVOICE'],
  },
  {
    label: 'Reports',
    icon: 'chart-bar',
    permissions: ['VIEW_REPORTS', 'PERFORM_Z_READING', 'PERFORM_X_READING', 'VIEW_EJOURNAL'],
  },
  {
    label: 'System',
    icon: 'cog',
    permissions: ['VIEW_SETTINGS', 'MANAGE_SETTINGS', 'MANAGE_USERS', 'DELETE_RECORDS', 'ACCESS_ADMIN_TOOLS', 'MANAGE_PERMISSIONS'],
  },
];

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
    'ADD_PRODUCT',
    'EDIT_PRODUCT',
    'DELETE_PRODUCT',
    'VIEW_PRODUCT_COST',
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
    'RECEIVE_PURCHASE',
    'MANAGE_SUPPLIER_PAYMENTS',
    'PAY_PAYABLES',
    'VIEW_ACCOUNTS_PAYABLE',
    'MANAGE_DAMAGED_ITEMS',
    'MANAGE_CUSTOMERS',
    'ADD_CUSTOMER',
    'EDIT_CUSTOMER',
    'DELETE_CUSTOMER',
    'COLLECT_CUSTOMER_PAYMENTS',
    'VIEW_ACCOUNTS_RECEIVABLE',
    'CREATE_CHARGE_INVOICE',
    'DELETE_RECORDS',
    'ACCESS_ADMIN_TOOLS',
    'MANAGE_PERMISSIONS',
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
    'ADD_PRODUCT',
    'EDIT_PRODUCT',
    'DELETE_PRODUCT',
    'VIEW_PRODUCT_COST',
    'MANAGE_INVENTORY',
    'VIEW_REPORTS',
    'VIEW_SETTINGS',
    'PERFORM_Z_READING',
    'PERFORM_X_READING',
    'VIEW_EJOURNAL',
    'MANAGE_PURCHASES',
    'MANAGE_SUPPLIERS',
    'CREATE_PURCHASE_ORDER',
    'RECEIVE_PURCHASE',
    'MANAGE_SUPPLIER_PAYMENTS',
    'PAY_PAYABLES',
    'VIEW_ACCOUNTS_PAYABLE',
    'MANAGE_DAMAGED_ITEMS',
    'MANAGE_CUSTOMERS',
    'ADD_CUSTOMER',
    'EDIT_CUSTOMER',
    'DELETE_CUSTOMER',
    'COLLECT_CUSTOMER_PAYMENTS',
    'VIEW_ACCOUNTS_RECEIVABLE',
    'CREATE_CHARGE_INVOICE',
    // Manager cannot: MANAGE_USERS, MANAGE_SETTINGS, DELETE_RECORDS (global)
  ],
  CASHIER: [
    'VIEW_DASHBOARD',
    'CREATE_SALE',
    'VIEW_OWN_SALES',
    'VIEW_PRODUCTS',
    'ADD_PRODUCT',           // Can add products
    // NO EDIT_PRODUCT       - Cannot edit products
    // NO DELETE_PRODUCT     - Cannot delete products
    // NO VIEW_PRODUCT_COST  - Cannot see cost prices
    'RECEIVE_PURCHASE',      // Can accept deliveries
    'ADD_CUSTOMER',          // Can add customers
    // NO EDIT_CUSTOMER      - Cannot edit customers
    // NO DELETE_CUSTOMER    - Cannot delete customers
    'COLLECT_CUSTOMER_PAYMENTS',  // Can collect receivables
    'PAY_PAYABLES',          // Can pay suppliers
    'CREATE_CHARGE_INVOICE', // Can create charge invoices
    // NO DELETE_RECORDS     - Cannot delete any records
    // NO VOID_SALE          - Cannot void sales
    // NO REFUND_SALE        - Cannot refund sales
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
      { permission: 'MANAGE_PRODUCTS', label: 'Manage Products', description: 'Full product management access' },
      { permission: 'VIEW_PRODUCTS', label: 'View Products', description: 'Browse product catalog' },
      { permission: 'ADD_PRODUCT', label: 'Add Products', description: 'Create new products' },
      { permission: 'EDIT_PRODUCT', label: 'Edit Products', description: 'Modify existing products' },
      { permission: 'DELETE_PRODUCT', label: 'Delete Products', description: 'Remove products from catalog' },
      { permission: 'VIEW_PRODUCT_COST', label: 'View Product Cost', description: 'See product cost prices' },
      { permission: 'MANAGE_INVENTORY', label: 'Manage Inventory', description: 'Handle inventory movements and counting' },
      { permission: 'VIEW_REPORTS', label: 'View Reports', description: 'Access to BIR reports and analytics' },
      { permission: 'VIEW_SETTINGS', label: 'View Settings', description: 'See system configuration' },
      { permission: 'MANAGE_SETTINGS', label: 'Manage Settings', description: 'Modify system configuration' },
      { permission: 'MANAGE_USERS', label: 'Manage Users', description: 'Add, edit, and manage user accounts' },
      { permission: 'PERFORM_Z_READING', label: 'Z-Reading', description: 'Generate end-of-day reports' },
      { permission: 'PERFORM_X_READING', label: 'X-Reading', description: 'Generate mid-day inquiry reports' },
      { permission: 'VIEW_EJOURNAL', label: 'View eJournal', description: 'Access audit trail logs' },
      { permission: 'MANAGE_PURCHASES', label: 'Manage Purchases', description: 'Handle purchase orders' },
      { permission: 'CREATE_PURCHASE_ORDER', label: 'Create Purchase Orders', description: 'Create new purchase orders' },
      { permission: 'RECEIVE_PURCHASE', label: 'Receive Purchases', description: 'Accept deliveries from suppliers' },
      { permission: 'MANAGE_SUPPLIERS', label: 'Manage Suppliers', description: 'Add, edit, and manage suppliers' },
      { permission: 'MANAGE_SUPPLIER_PAYMENTS', label: 'Manage Supplier Payments', description: 'Full supplier payment management' },
      { permission: 'PAY_PAYABLES', label: 'Pay Payables', description: 'Make payments to suppliers' },
      { permission: 'VIEW_ACCOUNTS_PAYABLE', label: 'View Accounts Payable', description: 'See outstanding supplier balances' },
      { permission: 'MANAGE_DAMAGED_ITEMS', label: 'Manage Damaged Items', description: 'Record and manage damaged inventory' },
      { permission: 'MANAGE_CUSTOMERS', label: 'Manage Customers', description: 'Full customer management access' },
      { permission: 'ADD_CUSTOMER', label: 'Add Customers', description: 'Create new customer records' },
      { permission: 'EDIT_CUSTOMER', label: 'Edit Customers', description: 'Modify customer information' },
      { permission: 'DELETE_CUSTOMER', label: 'Delete Customers', description: 'Remove customer records' },
      { permission: 'COLLECT_CUSTOMER_PAYMENTS', label: 'Collect Payments', description: 'Receive customer payments' },
      { permission: 'VIEW_ACCOUNTS_RECEIVABLE', label: 'View Accounts Receivable', description: 'See outstanding customer balances' },
      { permission: 'CREATE_CHARGE_INVOICE', label: 'Charge Invoices', description: 'Create credit/charge invoices' },
      { permission: 'DELETE_RECORDS', label: 'Delete Records', description: 'Delete any system records' },
      { permission: 'ACCESS_ADMIN_TOOLS', label: 'Admin Tools', description: 'Access to admin tools like database reset and test data' },
      { permission: 'MANAGE_PERMISSIONS', label: 'Manage Permissions', description: 'Configure role permissions (Admin only)' },
    ];
  }
}