/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false
      }
    }]
  },
  // Ignore React Native specific modules
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/react-native',
    '<rootDir>/node_modules/expo'
  ],
  // Ignore old mock-based tests (use runPOSTests.js for those)
  testPathIgnorePatterns: [
    '/node_modules/',
    'POSTransactionE2E.test.ts'
  ],
  // Don't transform node_modules
  transformIgnorePatterns: [
    '/node_modules/'
  ],
  // Increase timeout for database tests
  testTimeout: 30000
};
