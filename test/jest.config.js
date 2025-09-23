module.exports = {
  testEnvironment: 'node',
  testTimeout: 20000, // Reduced from 30000
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  
  // Coverage configuration
  collectCoverage: false, // Enable only when explicitly requested
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    '<rootDir>/../src-v2/**/*.js',
    '!<rootDir>/../src-v2/**/*.test.js',
    '!<rootDir>/../src-v2/app.js', // Exclude main app file
    '!<rootDir>/../node_modules/**'
  ],
  
  // Test patterns
  testMatch: [
    '<rootDir>/**/*.test.js'
  ],
  
  // Projects configuration for different test types
  projects: [
    {
      displayName: 'unit-integration',
      testMatch: [
        '<rootDir>/unit/**/*.test.js',
        '<rootDir>/integration/**/*.test.js',
        '<rootDir>/services/**/*.test.js',
        '<rootDir>/validation/**/*.test.js',
        '<rootDir>/regression/**/*.test.js'
      ],
      testTimeout: 10000
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/e2e/**/*.test.js'],
      testTimeout: 30000, // Reduced from 60000
      setupFilesAfterEnv: ['<rootDir>/setup.js']
    }
  ]
};