/**
 * Database Service Export
 * Automatically selects the correct database service based on platform
 */

import { Platform } from 'react-native';

// Export the appropriate DatabaseService based on platform
let DatabaseServiceClass: any;

if (Platform.OS === 'web') {
  // Use mock database for web testing
  DatabaseServiceClass = require('./WebMockDatabaseService').WebMockDatabaseService;
} else {
  // Use real SQLite database for native platforms
  DatabaseServiceClass = require('./DatabaseService').DatabaseService;
}

export const DatabaseService = DatabaseServiceClass;

// Re-export schema types
export * from './schema';
