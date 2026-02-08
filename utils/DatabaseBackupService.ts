import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { getDatabase } from '../database/getDatabase';

export interface BackupMetadata {
  version: string;
  timestamp: string;
  app_version: string;
  product_count: number;
  transaction_count: number;
  user_count: number;
  supplier_count?: number;
  customer_count?: number;
  backup_reason?: string;
}

export interface BackupInfo {
  filename: string;
  filepath: string;
  timestamp: Date;
  sizeKB: number;
  metadata?: BackupMetadata;
}

const WEB_STORAGE_KEY = 'posmobile_webmock_db';
const BACKUP_FOLDER_NAME = 'POSBackups';

// Check if running on web platform
const isWeb = (): boolean => {
  return Platform.OS === 'web' || typeof document !== 'undefined';
};

export class DatabaseBackupService {
  private static instance: DatabaseBackupService;

  private constructor() {}

  public static getInstance(): DatabaseBackupService {
    if (!DatabaseBackupService.instance) {
      DatabaseBackupService.instance = new DatabaseBackupService();
    }
    return DatabaseBackupService.instance;
  }

  // Get the dedicated backup folder path
  async getBackupFolderPath(): Promise<string> {
    if (isWeb()) {
      return 'downloads'; // Web uses browser downloads
    }

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      throw new Error('No writable directory available');
    }

    const backupDir = `${baseDir}${BACKUP_FOLDER_NAME}/`;

    // Create folder if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(backupDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
      console.log('[Backup] Created backup folder:', backupDir);
    }

    return backupDir;
  }

  // List all backups in the backup folder
  async listBackups(): Promise<BackupInfo[]> {
    if (isWeb()) {
      // Web doesn't have persistent backup storage
      return [];
    }

    try {
      const backupDir = await this.getBackupFolderPath();
      const files = await FileSystem.readDirectoryAsync(backupDir);

      const backups: BackupInfo[] = [];

      for (const filename of files) {
        if (filename.endsWith('.json') && filename.startsWith('pos_backup_')) {
          const filepath = `${backupDir}${filename}`;
          const fileInfo = await FileSystem.getInfoAsync(filepath, { size: true });

          if (fileInfo.exists) {
            // Try to read metadata
            let metadata: BackupMetadata | undefined;
            try {
              const content = await FileSystem.readAsStringAsync(filepath);
              const data = JSON.parse(content);
              metadata = data.metadata;
            } catch (e) {
              // Could not read metadata
            }

            // Extract timestamp from filename
            const timestampMatch = filename.match(/pos_backup_(.+)\.json/);
            let timestamp = new Date();
            if (timestampMatch) {
              const dateStr = timestampMatch[1].replace(/-/g, ':').replace('T', ' ');
              timestamp = new Date(dateStr);
            }

            backups.push({
              filename,
              filepath,
              timestamp,
              sizeKB: Math.round((fileInfo.size || 0) / 1024),
              metadata,
            });
          }
        }
      }

      // Sort by timestamp, newest first
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('[Backup] Error listing backups:', error);
      return [];
    }
  }

  // Delete a backup file
  async deleteBackup(filepath: string): Promise<boolean> {
    if (isWeb()) {
      return false;
    }

    try {
      await FileSystem.deleteAsync(filepath, { idempotent: true });
      console.log('[Backup] Deleted backup:', filepath);
      return true;
    } catch (error) {
      console.error('[Backup] Error deleting backup:', error);
      return false;
    }
  }

  // Create auto-backup before dangerous operations
  async createAutoBackup(reason: string = 'auto'): Promise<string | null> {
    console.log('[Backup] Creating auto-backup, reason:', reason);
    try {
      if (isWeb()) {
        // For web, we can't auto-save, so just return null
        console.log('[Backup] Auto-backup skipped on web platform');
        return null;
      }

      const backupDir = await this.getBackupFolderPath();
      const { DatabaseService } = require('../database/DatabaseService');
      const dbService = DatabaseService.getInstance();
      const db = dbService.getDatabase();

      // Get metadata
      const metadata = await this.getBackupMetadata(db);
      metadata.backup_reason = reason;

      // Get all table data
      const tables = await this.getAllTables(db);
      const backupData = {
        metadata,
        platform: 'native',
        tables: {} as Record<string, any[]>
      };

      for (const table of tables) {
        try {
          const data = await db.getAllAsync(`SELECT * FROM ${table}`);
          backupData.tables[table] = data;
        } catch (error) {
          backupData.tables[table] = [];
        }
      }

      // Generate filename with reason prefix
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `pos_backup_${reason}_${timestamp}.json`;
      const backupPath = `${backupDir}${filename}`;

      await FileSystem.writeAsStringAsync(
        backupPath,
        JSON.stringify(backupData, null, 2)
      );

      console.log('[Backup] Auto-backup created:', backupPath);
      return backupPath;
    } catch (error) {
      console.error('[Backup] Auto-backup failed:', error);
      return null;
    }
  }

  // Clean old auto-backups (keep last N)
  async cleanOldBackups(keepCount: number = 5): Promise<number> {
    if (isWeb()) {
      return 0;
    }

    try {
      const backups = await this.listBackups();
      const autoBackups = backups.filter(b => b.filename.includes('_auto_') || b.filename.includes('_pre-reset_'));

      if (autoBackups.length <= keepCount) {
        return 0;
      }

      // Delete oldest auto-backups
      const toDelete = autoBackups.slice(keepCount);
      let deletedCount = 0;

      for (const backup of toDelete) {
        if (await this.deleteBackup(backup.filepath)) {
          deletedCount++;
        }
      }

      console.log('[Backup] Cleaned', deletedCount, 'old auto-backups');
      return deletedCount;
    } catch (error) {
      console.error('[Backup] Error cleaning old backups:', error);
      return 0;
    }
  }

  // Create a backup of the database
  async createBackup(): Promise<string> {
    console.log('[Backup] Platform.OS:', Platform.OS, 'isWeb:', isWeb());
    if (isWeb()) {
      return await this.createWebBackup();
    }
    return await this.createNativeBackup();
  }

  // Web backup - exports localStorage data
  private async createWebBackup(): Promise<string> {
    const dbService = getDatabase();

    // Get counts for metadata
    const products = await dbService.getProducts();
    const transactions = await dbService.getTransactions();
    const users = await dbService.getUsers();

    const metadata: BackupMetadata = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      app_version: '1.0.0',
      product_count: products.length,
      transaction_count: transactions.length,
      user_count: users.length
    };

    // Get all localStorage data
    const storedData = localStorage.getItem(WEB_STORAGE_KEY);
    const backupData = {
      metadata,
      platform: 'web',
      data: storedData ? JSON.parse(storedData) : {}
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pos_backup_${timestamp}.json`;

    // Create downloadable file
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return filename;
  }

  // Native backup - exports SQLite data to dedicated backup folder
  private async createNativeBackup(): Promise<string> {
    const { DatabaseService } = require('../database/DatabaseService');
    const dbService = DatabaseService.getInstance();
    const db = dbService.getDatabase();

    // Get metadata for the backup
    const metadata = await this.getBackupMetadata(db);

    // Get all table names
    const tables = await this.getAllTables(db);

    // Create backup data structure
    const backupData = {
      metadata,
      platform: 'native',
      tables: {} as Record<string, any[]>
    };

    // Export all table data
    for (const table of tables) {
      try {
        const data = await db.getAllAsync(`SELECT * FROM ${table}`);
        backupData.tables[table] = data;
      } catch (error) {
        console.warn(`Could not backup table ${table}:`, error);
        backupData.tables[table] = [];
      }
    }

    // Get dedicated backup folder
    const backupDir = await this.getBackupFolderPath();

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pos_backup_manual_${timestamp}.json`;
    const backupPath = `${backupDir}${filename}`;

    console.log('[Backup] Saving to:', backupPath);

    await FileSystem.writeAsStringAsync(
      backupPath,
      JSON.stringify(backupData, null, 2)
    );

    // Clean old auto-backups (keep last 5)
    await this.cleanOldBackups(5);

    return backupPath;
  }

  // Share the backup file
  async shareBackup(backupPath: string): Promise<void> {
    if (isWeb()) {
      // On web, the file was already downloaded
      console.log('Backup downloaded:', backupPath);
      return;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(backupPath, {
        mimeType: 'application/json',
        dialogTitle: 'Share Database Backup'
      });
    } else {
      throw new Error('Sharing is not available on this platform');
    }
  }

  // Pick and restore a backup file
  async restoreFromFile(): Promise<boolean> {
    if (isWeb()) {
      return await this.restoreWebFromFile();
    }
    return await this.restoreNativeFromFile();
  }

  // Web restore - uses file input
  private async restoreWebFromFile(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';

      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve(false);
          return;
        }

        try {
          const content = await file.text();
          const backupData = JSON.parse(content);

          // Validate backup format
          if (!backupData.metadata) {
            throw new Error('Invalid backup file format');
          }

          // Restore data to localStorage
          if (backupData.platform === 'web' && backupData.data) {
            localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(backupData.data));
            console.log('Web backup restored successfully');
            resolve(true);
          } else if (backupData.tables) {
            // Convert native backup format to web format
            const webData = this.convertNativeToWebFormat(backupData.tables);
            localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(webData));
            console.log('Native backup converted and restored to web');
            resolve(true);
          } else {
            throw new Error('Unsupported backup format');
          }
        } catch (error) {
          console.error('Restore failed:', error);
          reject(error);
        }
      };

      input.click();
    });
  }

  // Convert native backup tables to web format
  private convertNativeToWebFormat(tables: Record<string, any[]>): any {
    return {
      products: tables.products || [],
      categories: tables.categories || [],
      brands: tables.brands || [],
      units: tables.units || [],
      sizes: tables.sizes || [],
      transactions: tables.transactions || [],
      users: tables.users || [],
      suppliers: tables.suppliers || [],
      customers: tables.customers || [],
      settings: this.convertSettingsArray(tables.settings || []),
      inventoryMovements: tables.inventory_movements || [],
      physicalCountSessions: tables.physical_count_sessions || [],
      physicalCountDetails: tables.physical_count_details || [],
      damageSessions: tables.damage_sessions || [],
      damageDetails: tables.damage_details || [],
      purchases: tables.purchases || [],
      purchaseItems: tables.purchase_items || [],
      accountsReceivable: tables.accounts_receivable || [],
      accountsPayable: tables.accounts_payable || [],
      customerPayments: tables.customer_payments || [],
      supplierPayments: tables.supplier_payments || [],
      eJournalEntries: tables.ejournal || [],
      salesReturns: tables.sales_returns || [],
      salesReturnItems: tables.sales_return_items || [],
      purchaseReturns: tables.purchase_returns || [],
      purchaseReturnItems: tables.purchase_return_items || [],
      endOfDayRecords: tables.end_of_day_records || [],
      counters: {
        productIdCounter: Math.max(...(tables.products || []).map((p: any) => p.id || 0), 0) + 1,
        categoryIdCounter: Math.max(...(tables.categories || []).map((c: any) => c.id || 0), 0) + 1,
        transactionIdCounter: Math.max(...(tables.transactions || []).map((t: any) => t.id || 0), 0) + 1,
      }
    };
  }

  // Convert settings array to object
  private convertSettingsArray(settingsArray: any[]): Record<string, string> {
    const settings: Record<string, string> = {};
    for (const item of settingsArray) {
      if (item.key && item.value !== undefined) {
        settings[item.key] = item.value;
      }
    }
    return settings;
  }

  // Native restore
  private async restoreNativeFromFile(): Promise<boolean> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return false;
      }

      const backupPath = result.assets[0].uri;
      return await this.restoreNativeBackup(backupPath);
    } catch (error) {
      console.error('Error picking backup file:', error);
      throw new Error('Failed to pick backup file');
    }
  }

  // Restore native database from backup file
  private async restoreNativeBackup(backupPath: string): Promise<boolean> {
    try {
      const { DatabaseService } = require('../database/DatabaseService');
      const { initializeDatabase } = require('../database/schema');

      // Read backup file
      const backupContent = await FileSystem.readAsStringAsync(backupPath);
      const backupData = JSON.parse(backupContent);

      // Validate backup format
      if (!backupData.metadata || !backupData.tables) {
        throw new Error('Invalid backup file format');
      }

      // Get database service
      const dbService = DatabaseService.getInstance();
      const db = dbService.getDatabase();

      // Disable foreign keys temporarily
      await db.execAsync('PRAGMA foreign_keys = OFF');

      try {
        // Clear existing data (except system tables)
        await this.clearUserData(db);

        // Restore data table by table
        for (const [tableName, tableData] of Object.entries(backupData.tables)) {
          if (Array.isArray(tableData) && tableData.length > 0) {
            await this.restoreTableData(db, tableName, tableData);
          }
        }

        // Re-enable foreign keys
        await db.execAsync('PRAGMA foreign_keys = ON');

        console.log('Database restored successfully');
        return true;

      } catch (error) {
        // Re-enable foreign keys even if restore failed
        await db.execAsync('PRAGMA foreign_keys = ON');
        throw error;
      }

    } catch (error) {
      console.error('Error restoring backup:', error);
      throw new Error(`Failed to restore backup: ${error}`);
    }
  }

  // Validate database integrity
  async validateDatabase(): Promise<{ isValid: boolean; errors: string[] }> {
    if (isWeb()) {
      return this.validateWebDatabase();
    }
    return this.validateNativeDatabase();
  }

  private validateWebDatabase(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const storedData = localStorage.getItem(WEB_STORAGE_KEY);
      if (!storedData) {
        errors.push('No database data found in localStorage');
        return { isValid: false, errors };
      }

      const data = JSON.parse(storedData);

      // Check required arrays exist
      const requiredArrays = ['products', 'users', 'categories'];
      for (const arr of requiredArrays) {
        if (!Array.isArray(data[arr])) {
          errors.push(`Missing or invalid data: ${arr}`);
        }
      }

      // Check for admin user
      const adminUser = data.users?.find((u: any) => u.role === 'ADMIN');
      if (!adminUser) {
        errors.push('No admin user found');
      }

    } catch (error) {
      errors.push(`Database validation error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async validateNativeDatabase(): Promise<{ isValid: boolean; errors: string[] }> {
    const { DatabaseService } = require('../database/DatabaseService');
    const dbService = DatabaseService.getInstance();
    const db = dbService.getDatabase();
    const errors: string[] = [];

    try {
      // Check database integrity
      const integrityCheck = await db.getFirstAsync<{integrity_check: string}>('PRAGMA integrity_check');
      if (integrityCheck?.integrity_check !== 'ok') {
        errors.push(`Database integrity check failed: ${integrityCheck?.integrity_check}`);
      }

      // Check foreign key consistency
      const foreignKeyCheck = await db.getAllAsync('PRAGMA foreign_key_check');
      if (foreignKeyCheck.length > 0) {
        errors.push(`Foreign key violations found: ${foreignKeyCheck.length} issues`);
      }

      // Validate essential tables exist
      const tables = await this.getAllTables(db);
      const requiredTables = ['products', 'transactions', 'users', 'settings'];
      for (const table of requiredTables) {
        if (!tables.includes(table)) {
          errors.push(`Required table missing: ${table}`);
        }
      }

    } catch (error) {
      errors.push(`Database validation error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Repair database corruption
  async repairDatabase(): Promise<{ success: boolean; message: string }> {
    if (isWeb()) {
      return this.repairWebDatabase();
    }
    return this.repairNativeDatabase();
  }

  private repairWebDatabase(): { success: boolean; message: string } {
    try {
      const storedData = localStorage.getItem(WEB_STORAGE_KEY);
      if (!storedData) {
        // Re-initialize with empty data
        const { WebMockDatabaseService } = require('../database/WebMockDatabaseService');
        WebMockDatabaseService.getInstance();
        return {
          success: true,
          message: 'Database re-initialized successfully'
        };
      }

      // Try to parse and re-save (fixes any JSON formatting issues)
      const data = JSON.parse(storedData);
      localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(data));

      return {
        success: true,
        message: 'Database repair completed successfully'
      };

    } catch (error) {
      console.error('Database repair failed:', error);
      return {
        success: false,
        message: `Database repair failed: ${error}`
      };
    }
  }

  private async repairNativeDatabase(): Promise<{ success: boolean; message: string }> {
    const { DatabaseService } = require('../database/DatabaseService');
    const { initializeDatabase } = require('../database/schema');
    const dbService = DatabaseService.getInstance();
    const db = dbService.getDatabase();

    try {
      // Try to recover using SQLite recovery commands
      await db.execAsync('PRAGMA integrity_check');
      await db.execAsync('REINDEX');
      await db.execAsync('VACUUM');

      // Re-initialize database schema to fix any structural issues
      await initializeDatabase(db);

      return {
        success: true,
        message: 'Database repair completed successfully'
      };

    } catch (error) {
      console.error('Database repair failed:', error);
      return {
        success: false,
        message: `Database repair failed: ${error}`
      };
    }
  }

  // Optimize database performance
  async optimizeDatabase(): Promise<void> {
    if (isWeb()) {
      // For web, just compact the localStorage data
      const storedData = localStorage.getItem(WEB_STORAGE_KEY);
      if (storedData) {
        const data = JSON.parse(storedData);
        localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(data));
      }
      console.log('Web database optimization completed');
      return;
    }

    const { DatabaseService } = require('../database/DatabaseService');
    const dbService = DatabaseService.getInstance();
    const db = dbService.getDatabase();

    try {
      // Analyze tables for query optimization
      await db.execAsync('ANALYZE');

      // Rebuild indexes
      await db.execAsync('REINDEX');

      // Compact database
      await db.execAsync('VACUUM');

      console.log('Database optimization completed');
    } catch (error) {
      console.error('Database optimization failed:', error);
      throw error;
    }
  }

  // Private helper methods
  private async getBackupMetadata(db: SQLite.SQLiteDatabase): Promise<BackupMetadata> {
    const [productCount, transactionCount, userCount] = await Promise.all([
      db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM products'),
      db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM transactions'),
      db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM users')
    ]);

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      app_version: '1.0.0',
      product_count: productCount?.count || 0,
      transaction_count: transactionCount?.count || 0,
      user_count: userCount?.count || 0
    };
  }

  private async getAllTables(db: SQLite.SQLiteDatabase): Promise<string[]> {
    const result = await db.getAllAsync<{name: string}>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    return result.map(row => row.name);
  }

  private async clearUserData(db: SQLite.SQLiteDatabase): Promise<void> {
    // Clear tables in order to respect foreign key constraints
    const tablesToClear = [
      'transaction_items',
      'transactions',
      'inventory_movements',
      'ejournal',
      'x_readings',
      'z_readings',
      'physical_count_details',
      'physical_count_sessions',
      'role_permissions',
      'products',
      'categories',
      'users',
      'stores',
      'settings'
    ];

    for (const table of tablesToClear) {
      try {
        await db.execAsync(`DELETE FROM ${table}`);
      } catch (error) {
        console.warn(`Could not clear table ${table}:`, error);
      }
    }
  }

  private async restoreTableData(db: SQLite.SQLiteDatabase, tableName: string, data: any[]): Promise<void> {
    if (data.length === 0) return;

    // Get column names from first row
    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const columnsStr = columns.join(', ');

    const insertStatement = `INSERT OR REPLACE INTO ${tableName} (${columnsStr}) VALUES (${placeholders})`;

    // Insert data in batches
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      await db.execAsync('BEGIN TRANSACTION');
      try {
        for (const row of batch) {
          const values = columns.map(col => row[col]);
          await db.runAsync(insertStatement, values);
        }
        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    }

    console.log(`Restored ${data.length} rows to ${tableName}`);
  }
}