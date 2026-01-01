/**
 * Platform-aware database service getter
 * Returns the appropriate database service based on platform
 */

import { Platform } from 'react-native';

let dbService: any = null;

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
