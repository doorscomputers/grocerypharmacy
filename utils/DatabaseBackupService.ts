import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import { DatabaseService } from '../database/DatabaseService';
import { initializeDatabase } from '../database/schema';

export interface BackupMetadata {
  version: string;
  timestamp: string;
  app_version: string;
  product_count: number;
  transaction_count: number;
  user_count: number;
}

export class DatabaseBackupService {
  private static instance: DatabaseBackupService;

  private constructor() {}

  public static getInstance(): DatabaseBackupService {
    if (!DatabaseBackupService.instance) {
      DatabaseBackupService.instance = new DatabaseBackupService();
    }
    return DatabaseBackupService.instance;
  }

  // Create a backup of the database
  async createBackup(): Promise<string> {
    const dbService = DatabaseService.getInstance();
    const db = dbService.getDatabase();

    // Get metadata for the backup
    const metadata = await this.getBackupMetadata(db);

    // Get all table names
    const tables = await this.getAllTables(db);

    // Create backup data structure
    const backupData = {
      metadata,
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

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pos_backup_${timestamp}.json`;

    // Save to documents directory
    const documentsDir = (FileSystem as any).documentDirectory;
    if (!documentsDir) {
      throw new Error('Document directory not available');
    }
    const backupPath = `${documentsDir}${filename}`;
    await FileSystem.writeAsStringAsync(
      backupPath,
      JSON.stringify(backupData, null, 2)
    );

    return backupPath;
  }

  // Share the backup file
  async shareBackup(backupPath: string): Promise<void> {
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
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return false;
      }

      const backupPath = result.assets[0].uri;
      return await this.restoreBackup(backupPath);
    } catch (error) {
      console.error('Error picking backup file:', error);
      throw new Error('Failed to pick backup file');
    }
  }

  // Restore database from backup file
  async restoreBackup(backupPath: string): Promise<boolean> {
    try {
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

      // Backup current database before restore (as safety measure)
      const safetyBackupPath = await this.createSafetyBackup();
      console.log('Safety backup created at:', safetyBackupPath);

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
    const dbService = DatabaseService.getInstance();
    const db = dbService.getDatabase();

    try {
      // Create a backup before attempting repair
      const backupPath = await this.createSafetyBackup();
      console.log('Safety backup created before repair:', backupPath);

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

  private async createSafetyBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pos_safety_backup_${timestamp}.json`;
    return await this.createBackup();
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