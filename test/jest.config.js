module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  
  // Coverage configuration
  collectCoverage: false,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    '<rootDir>/../src-v2/**/*.js',
    '!<rootDir>/../src-v2/**/*.test.js',
    '!<rootDir>/../node_modules/**'
  ],
  
  // Test patterns - simple and clear
  testMatch: [
    '<rootDir>/**/*.test.js'
  ],
  
  // Ignore archived tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test-archive-.*/'
  ]
};
