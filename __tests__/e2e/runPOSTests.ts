/**
 * POS Transaction E2E Test Runner
 *
 * Run this script with:
 *   npx ts-node __tests__/e2e/runPOSTests.ts
 *
 * Or compile and run:
 *   npx tsc __tests__/e2e/runPOSTests.ts --outDir dist --esModuleInterop
 *   node dist/runPOSTests.js
 */

import { POSTransactionE2ETest, runE2ETests } from './POSTransactionE2E.test';

console.log('Starting POS Transaction E2E Tests...\n');
console.log('Date: ' + new Date().toISOString());
console.log('');

runE2ETests();
