// Jest setup file
// Runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs during tests (optional - uncomment if needed)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
