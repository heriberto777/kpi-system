/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.integration.test.ts'],
  setupFiles: ['<rootDir>/src/test/env.integration.ts'],
  globalSetup: '<rootDir>/src/test/globalSetup.integration.js',
  testTimeout: 30000,
  clearMocks: true,
};
