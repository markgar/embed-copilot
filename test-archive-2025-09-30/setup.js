// Test setup - run before each test file
// Set test environment variables to avoid real API calls during testing

// Suppress console logs during testing unless debugging
if (!process.env.DEBUG_TESTS) {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// Set minimal config for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Use different port for testing