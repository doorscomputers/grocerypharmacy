# User Roles and Permissions System

## Overview
The POS Mobile app includes a comprehensive role-based access control system with three user roles: Admin, Manager, and Cashier. **New Feature**: Admins can now dynamically control which features Manager and Cashier roles can access through an intuitive Permission Management interface.

## User Roles

### Admin (Full Access)
- **Username**: `admin`
- **Password**: Any password (demo mode)
- **Permissions**: Full system access
- **Can Access**:
  - All dashboard statistics
  - Sales creation and viewing all transactions
  - Product management (create, edit, view)
  - Inventory management
  - All BIR reports and Z/X readings
  - System settings configuration
  - User management (create, edit, deactivate users)
  - Purchase orders
  - All screens and features

### Manager (Business Operations - Customizable)
- **Username**: `manager`
- **Password**: Any password (demo mode)
- **Permissions**: ⚠️ **Now Customizable by Admin!** Default permissions include most business operations
- **Default Access**:
  - All dashboard statistics
  - Sales creation and viewing all transactions
  - Product management (create, edit, view)
  - Inventory management
  - All BIR reports and Z/X readings
  - Purchase orders
  - View system settings (but cannot modify)
- **Cannot Access** (Fixed):
  - User management
  - System settings modification
- **🔐 Admin Control**: Admins can enable/disable any Manager permission through the Permission Management screen

### Cashier (Sales Only - Customizable)
- **Username**: `cashier`
- **Password**: Any password (demo mode)
- **Permissions**: ⚠️ **Now Customizable by Admin!** Default is limited to sales operations
- **Default Access**:
  - Personal dashboard (only own statistics)
  - Sales creation
  - View own transactions only
  - View products (read-only)
- **Default Restrictions**:
  - Other users' transactions
  - Product management
  - Inventory management
  - Reports, Settings, User management, Purchase orders
- **🔐 Admin Control**: Admins can enable/disable any Cashier permission through the Permission Management screen

## Technical Implementation

### Core Components

1. **Permission Service** (`utils/permissions.ts`)
   - Defines all permissions and role mappings
   - Provides permission checking functions
   - Handles screen access validation

2. **Authentication Context** (`contexts/AuthContext.tsx`)
   - Manages user authentication state
   - Provides authentication methods
   - Integrates with permission system

3. **Role Guards** (`components/RoleGuard.tsx`)
   - `RoleGuard`: Conditionally renders components based on permissions
   - `ScreenGuard`: Protects entire screens from unauthorized access

4. **Database Integration**
   - Enhanced `DatabaseService` with user management methods
   - eJournal logging for login/logout activities
   - Role-based transaction filtering

### Usage Examples

```typescript
// Protect a component with specific permission
<RoleGuard permission="MANAGE_PRODUCTS">
  <Button onPress={editProduct}>Edit Product</Button>
</RoleGuard>

// Protect entire screen
<ScreenGuard screenName="Settings">
  <SettingsContent />
</ScreenGuard>

// Check permissions programmatically
const { hasPermission } = useAuth();
if (hasPermission('CREATE_SALE')) {
  // Show sales interface
}
```

### Permission List

- `VIEW_DASHBOARD` - Access dashboard
- `CREATE_SALE` - Create new sales transactions
- `VIEW_ALL_SALES` - View all transactions
- `VIEW_OWN_SALES` - View only own transactions
- `VOID_SALE` - Void sales transactions
- `REFUND_SALE` - Process refunds
- `MANAGE_PRODUCTS` - Create/edit products
- `VIEW_PRODUCTS` - View product list
- `MANAGE_INVENTORY` - Inventory management
- `VIEW_REPORTS` - Access BIR reports
- `MANAGE_USERS` - User account management
- `VIEW_SETTINGS` - View system settings
- `MANAGE_SETTINGS` - Modify system settings
- `PERFORM_Z_READING` - Generate Z-readings
- `PERFORM_X_READING` - Generate X-readings
- `VIEW_EJOURNAL` - Access eJournal
- `MANAGE_PURCHASES` - Purchase order management

## Security Features

1. **Session Management**
   - User sessions tracked in authentication context
   - Automatic logout capability
   - Last login tracking

2. **Audit Trail**
   - All login/logout events logged in eJournal
   - Transaction filtering by user role
   - Permission-based data access

3. **UI Security**
   - Dynamic menu hiding based on roles
   - Screen-level protection
   - Component-level permission guards

## 🆕 Dynamic Permission Management

### How It Works
1. **Admin Login**: Login as `admin` to access the Permission Management screen
2. **Navigate**: Dashboard → 🔐 Permissions quick action
3. **Customize Access**: Toggle any permission on/off for Manager and Cashier roles
4. **Instant Effect**: Changes apply immediately - no app restart required
5. **Reset Option**: Restore default permissions for any role with one click

### Permission Management Features
- **Visual Interface**: Easy-to-use switches for each permission
- **Permission Descriptions**: Clear explanations of what each permission allows
- **Status Overview**: See how many permissions are enabled per role
- **Reset to Defaults**: Quick restoration of original permission sets
- **Audit Trail**: All permission changes are logged with admin user and timestamp

### Example Scenarios
- **Restrict Manager**: Remove "Manage Products" if you want managers to focus on sales only
- **Empower Cashier**: Enable "View Reports" to let experienced cashiers see daily summaries
- **Custom Roles**: Create unique permission combinations for specific business needs

## Testing the System

1. **Login with different roles**:
   - `admin` / any password - Full access + Permission Management
   - `manager` / any password - Customizable business operations
   - `cashier` / any password - Customizable sales operations

2. **Test Dynamic Permissions**:
   - Login as admin and modify permissions for manager/cashier
   - Login as manager/cashier to verify the changes took effect
   - Try disabling "Create Sales" for cashier and see it disappear from dashboard

3. **Verify role restrictions**:
   - Cashiers should only see their own dashboard stats
   - Managers cannot access user management or permission management
   - Only admins can modify system settings and user permissions

4. **Test navigation**:
   - Dashboard shows different quick actions based on current permissions
   - Unauthorized screens show access denied messages
   - Navigation reflects dynamically assigned permissions

## Files Modified/Created

### New Files:
- `utils/permissions.ts` - Permission definitions and service
- `contexts/AuthContext.tsx` - Authentication context
- `components/RoleGuard.tsx` - Permission-based UI guards
- `screens/UserManagementScreen.tsx` - Admin user management
- **🆕 `screens/PermissionManagementScreen.tsx`** - Dynamic permission control interface

### Modified Files:
- `App.tsx` - Added AuthProvider wrapper and new screen routes
- **🆕 `database/schema.ts`** - Added role_permissions table and dynamic permission data
- **🆕 `database/DatabaseService.ts`** - Enhanced with dynamic permission management methods
- `screens/LoginScreen.tsx` - Integrated with auth context
- **🆕 `screens/DashboardScreen.tsx`** - Role-based content, navigation, and Permission Management access
- `screens/SettingsScreen.tsx` - Added screen protection
- **🆕 `contexts/AuthContext.tsx`** - Added dynamic permission loading and refresh functionality
- **🆕 `utils/permissions.ts`** - Enhanced with dynamic permission loading and management

## Summary

✅ **Complete Role-Based Access Control System with Dynamic Management**

The enhanced role system provides:
- **Fixed Admin Role**: Always has full access to everything
- **Customizable Manager Role**: Admins can enable/disable specific business functions
- **Customizable Cashier Role**: Admins can grant additional permissions as needed
- **Real-time Changes**: Permission modifications take effect immediately
- **User-friendly Interface**: Intuitive toggles with clear descriptions
- **Audit Trail**: All changes tracked for compliance and security

This system ensures proper access control while giving administrators the flexibility to adapt permissions to their specific business needs and user trust levels.