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
const DB_NAME = 'pos_database.db';

// Check if running on web platform
const isWeb = (): boolean => {
  return Platform.OS === 'web' || typeof document !== 'undefined';
};

// Get the path to the SQLite database file
const getDbFilePath = (): string => {
  return `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
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

  // List all backups in the backup folder (.db and legacy .json)
  async listBackups(): Promise<BackupInfo[]> {
    if (isWeb()) {
      return [];
    }

    try {
      const backupDir = await this.getBackupFolderPath();
      const files = await FileSystem.readDirectoryAsync(backupDir);

      const backups: BackupInfo[] = [];

      for (const filename of files) {
        if (!filename.startsWith('pos_backup_')) continue;

        const isDb = filename.endsWith('.db');
        const isJson = filename.endsWith('.json');
        if (!isDb && !isJson) continue;

        const filepath = `${backupDir}${filename}`;
        const fileInfo = await FileSystem.getInfoAsync(filepath, { size: true });

        if (!fileInfo.exists) continue;

        let metadata: BackupMetadata | undefined;
        let timestamp = new Date();

        if (isDb) {
          // For .db backups, read the companion .meta.json file
          const metaPath = `${filepath}.meta.json`;
          try {
            const metaContent = await FileSystem.readAsStringAsync(metaPath);
            metadata = JSON.parse(metaContent);
          } catch (e) {
            // No metadata file — parse timestamp from filename
          }
        } else {
          // Legacy .json backups — read metadata from within file
          try {
            const content = await FileSystem.readAsStringAsync(filepath);
            const data = JSON.parse(content);
            metadata = data.metadata;
          } catch (e) {
            // Could not read metadata
          }
        }

        // Get timestamp from metadata first, fallback to filename parsing
        if (metadata?.timestamp) {
          timestamp = new Date(metadata.timestamp);
        } else {
          const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d+)Z?\.(?:db|json)$/);
          if (dateMatch) {
            const [, year, month, day, hour, min, sec, ms] = dateMatch;
            timestamp = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}.${ms}Z`);
          }
        }

        const sizeKB = Math.round((fileInfo.size || 0) / 1024);

        // Skip empty/invalid backup files (0KB)
        if (sizeKB === 0) {
          console.log('[Backup] Skipping empty backup:', filename);
          continue;
        }

        backups.push({
          filename,
          filepath,
          timestamp,
          sizeKB,
          metadata,
        });
      }

      // Sort by timestamp, newest first
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('[Backup] Error listing backups:', error);
      return [];
    }
  }

  // Delete a backup file (and its .meta.json companion if .db)
  async deleteBackup(filepath: string): Promise<boolean> {
    if (isWeb()) {
      return false;
    }

    try {
      await FileSystem.deleteAsync(filepath, { idempotent: true });
      // Also delete companion metadata file for .db backups
      if (filepath.endsWith('.db')) {
        await FileSystem.deleteAsync(`${filepath}.meta.json`, { idempotent: true });
      }
      console.log('[Backup] Deleted backup:', filepath);
      return true;
    } catch (error) {
      console.error('[Backup] Error deleting backup:', error);
      return false;
    }
  }

  // Create auto-backup before dangerous operations (uses raw SQLite file copy)
  async createAutoBackup(reason: string = 'auto'): Promise<string | null> {
    console.log('[Backup] Creating auto-backup, reason:', reason);
    try {
      if (isWeb()) {
        console.log('[Backup] Auto-backup skipped on web platform');
        return null;
      }

      return await this.copyDatabaseFile(reason);
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
      const autoBackups = backups.filter(b =>
        b.filename.includes('_auto_') || b.filename.includes('_pre-reset_') || b.filename.includes('_pre-restore_')
      );

      if (autoBackups.length <= keepCount) {
        return 0;
      }

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

  // Web backup - exports localStorage data as JSON download
  private async createWebBackup(): Promise<string> {
    const dbService = getDatabase();

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

    const storedData = localStorage.getItem(WEB_STORAGE_KEY);
    const backupData = {
      metadata,
      platform: 'web',
      data: storedData ? JSON.parse(storedData) : {}
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pos_backup_${timestamp}.json`;

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return filename;
  }

  // Native backup — raw SQLite file copy (best practice)
  private async createNativeBackup(): Promise<string> {
    return await this.copyDatabaseFile('manual');
  }

  // Core backup method: VACUUM INTO (best practice) with WAL checkpoint + copy fallback
  private async copyDatabaseFile(reason: string): Promise<string> {
    const { DatabaseService } = require('../database/DatabaseService');
    const dbService = DatabaseService.getInstance();
    const db = dbService.getDatabase();

    const backupDir = await this.getBackupFolderPath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pos_backup_${reason}_${timestamp}.db`;
    const backupPath = `${backupDir}${filename}`;

    let backupCreated = false;

    // Method 1: VACUUM INTO — creates a complete, self-contained backup
    // regardless of WAL state (SQLite best practice)
    try {
      await db.execAsync(`VACUUM INTO '${backupPath}'`);
      console.log('[Backup] VACUUM INTO succeeded:', backupPath);
      backupCreated = true;
    } catch (e) {
      console.warn('[Backup] VACUUM INTO failed, falling back to file copy:', e);
    }

    // Method 2: Fallback — WAL checkpoint + raw file copy
    if (!backupCreated) {
      try {
        await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
        console.log('[Backup] WAL checkpoint completed');
      } catch (e) {
        console.warn('[Backup] WAL checkpoint failed:', e);
        // Continue anyway — the main .db may still have data
      }

      const dbPath = getDbFilePath();
      await FileSystem.copyAsync({ from: dbPath, to: backupPath });
      console.log('[Backup] Database file copied to:', backupPath);
    }

    // Verify the backup file is not empty
    const backupInfo = await FileSystem.getInfoAsync(backupPath, { size: true });
    if (!backupInfo.exists || !backupInfo.size || backupInfo.size < 4096) {
      // Clean up the empty/invalid backup file
      await FileSystem.deleteAsync(backupPath, { idempotent: true });
      throw new Error('Backup file is empty or too small. The database may not have flushed properly. Please try again.');
    }
    console.log('[Backup] Verified backup size:', Math.round(backupInfo.size / 1024), 'KB');

    // Write metadata as a sidecar file
    const metadata = await this.getBackupMetadata(db);
    metadata.backup_reason = reason;
    await FileSystem.writeAsStringAsync(
      `${backupPath}.meta.json`,
      JSON.stringify(metadata)
    );

    // Clean old auto-backups
    await this.cleanOldBackups(5);

    return backupPath;
  }

  // Share the backup file
  async shareBackup(backupPath: string): Promise<void> {
    if (isWeb()) {
      console.log('Backup downloaded:', backupPath);
      return;
    }

    if (await Sharing.isAvailableAsync()) {
      const mimeType = backupPath.endsWith('.db')
        ? 'application/x-sqlite3'
        : 'application/json';
      await Sharing.shareAsync(backupPath, {
        mimeType,
        dialogTitle: 'Share Database Backup'
      });
    } else {
      throw new Error('Sharing is not available on this platform');
    }
  }

  // Pick and restore a backup file via document picker
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

          if (!backupData.metadata) {
            throw new Error('Invalid backup file format');
          }

          if (backupData.platform === 'web' && backupData.data) {
            localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(backupData.data));
            console.log('Web backup restored successfully');
            resolve(true);
          } else if (backupData.tables) {
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

  // Native restore from document picker (supports both .db and legacy .json)
  private async restoreNativeFromFile(): Promise<boolean> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return false;
      }

      const filePath = result.assets[0].uri;
      const fileName = result.assets[0].name || '';

      if (fileName.endsWith('.db')) {
        return await this.restoreFromDbFile(filePath);
      } else if (fileName.endsWith('.json')) {
        return await this.restoreFromJsonFile(filePath);
      } else {
        throw new Error('Unsupported file type. Please select a .db or .json backup file.');
      }
    } catch (error) {
      console.error('Error picking backup file:', error);
      throw error;
    }
  }

  // Restore from a saved backup by filepath (called from the backup list UI)
  async restoreFromPath(backupPath: string): Promise<boolean> {
    if (backupPath.endsWith('.db')) {
      return await this.restoreFromDbFile(backupPath);
    } else if (backupPath.endsWith('.json')) {
      return await this.restoreFromJsonFile(backupPath);
    }
    throw new Error('Unsupported backup file format');
  }

  // Restore by replacing the SQLite database file (best practice)
  private async restoreFromDbFile(backupPath: string): Promise<boolean> {
    try {
      const { DatabaseService } = require('../database/DatabaseService');
      const dbService = DatabaseService.getInstance();

      // Close the current database connection
      try {
        const db = dbService.getDatabase();
        await db.closeAsync();
        console.log('[Restore] Database connection closed');
      } catch (e) {
        console.warn('[Restore] Could not close database:', e);
      }

      // Copy the backup file over the current database
      const dbPath = getDbFilePath();
      await FileSystem.copyAsync({ from: backupPath, to: dbPath });
      console.log('[Restore] Database file replaced from backup');

      // Delete any WAL/SHM files so SQLite starts fresh
      try {
        await FileSystem.deleteAsync(`${dbPath}-wal`, { idempotent: true });
        await FileSystem.deleteAsync(`${dbPath}-shm`, { idempotent: true });
      } catch (e) {
        // These files may not exist — that's fine
      }

      // Re-open the database connection
      await dbService.reinitialize();
      console.log('[Restore] Database re-opened successfully');

      return true;
    } catch (error) {
      console.error('[Restore] Error restoring from .db file:', error);
      throw new Error(`Failed to restore backup: ${error}`);
    }
  }

  // Restore from legacy JSON backup (row-by-row insert)
  private async restoreFromJsonFile(backupPath: string): Promise<boolean> {
    try {
      const { DatabaseService } = require('../database/DatabaseService');

      const backupContent = await FileSystem.readAsStringAsync(backupPath);
      const backupData = JSON.parse(backupContent);

      if (!backupData.metadata || !backupData.tables) {
        throw new Error('Invalid backup file format');
      }

      const dbService = DatabaseService.getInstance();
      const db = dbService.getDatabase();

      await db.execAsync('PRAGMA foreign_keys = OFF');

      try {
        // Clear all tables
        const allTables = await this.getAllTables(db);
        for (const table of allTables) {
          try {
            await db.execAsync(`DELETE FROM ${table}`);
          } catch (e) {
            console.warn(`Could not clear table ${table}:`, e);
          }
        }

        // Restore data table by table
        for (const [tableName, tableData] of Object.entries(backupData.tables)) {
          if (Array.isArray(tableData) && tableData.length > 0) {
            await this.restoreTableData(db, tableName, tableData);
          }
        }

        await db.execAsync('PRAGMA foreign_keys = ON');
        console.log('[Restore] JSON backup restored successfully');
        return true;
      } catch (error) {
        await db.execAsync('PRAGMA foreign_keys = ON');
        throw error;
      }
    } catch (error) {
      console.error('[Restore] Error restoring from JSON file:', error);
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

      const requiredArrays = ['products', 'users', 'categories'];
      for (const arr of requiredArrays) {
        if (!Array.isArray(data[arr])) {
          errors.push(`Missing or invalid data: ${arr}`);
        }
      }

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
      const integrityCheck = await db.getFirstAsync<{integrity_check: string}>('PRAGMA integrity_check');
      if (integrityCheck?.integrity_check !== 'ok') {
        errors.push(`Database integrity check failed: ${integrityCheck?.integrity_check}`);
      }

      const foreignKeyCheck = await db.getAllAsync('PRAGMA foreign_key_check');
      if (foreignKeyCheck.length > 0) {
        errors.push(`Foreign key violations found: ${foreignKeyCheck.length} issues`);
      }

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
        const { WebMockDatabaseService } = require('../database/WebMockDatabaseService');
        WebMockDatabaseService.getInstance();
        return {
          success: true,
          message: 'Database re-initialized successfully'
        };
      }

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
      await db.execAsync('PRAGMA integrity_check');
      await db.execAsync('REINDEX');
      await db.execAsync('VACUUM');

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
      await db.execAsync('ANALYZE');
      await db.execAsync('REINDEX');
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

  private async restoreTableData(db: SQLite.SQLiteDatabase, tableName: string, data: any[]): Promise<void> {
    if (data.length === 0) return;

    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const columnsStr = columns.join(', ');

    const insertStatement = `INSERT OR REPLACE INTO ${tableName} (${columnsStr}) VALUES (${placeholders})`;

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
