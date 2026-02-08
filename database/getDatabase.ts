/**
 * Platform-aware database service getter
 * Returns the appropriate database service based on platform
 */

import { Platform } from 'react-native';

let dbService: any = null;
let isInitialized = false;

export function getDatabase(): any {
  if (dbService) {
    return dbService;
  }

  if (Platform.OS === 'web') {
    const { WebMockDatabaseService } = require('./WebMockDatabaseService');
    dbService = WebMockDatabaseService.getInstance();
  } else {
    const { DatabaseService } = require('./DatabaseService');
    dbService = DatabaseService.getInstance();
  }

  return dbService;
}

// Mark database as initialized (called from App.tsx after successful initialization)
export function markDatabaseInitialized(): void {
  isInitialized = true;
}

// Check if database is initialized
export function isDatabaseInitialized(): boolean {
  return isInitialized;
}

// Reset the database service (for testing/reloading)
export function resetDatabaseService(): void {
  dbService = null;
  isInitialized = false;
}
