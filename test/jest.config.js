module.exports = {
  testEnvironment: 'node',
  testTimeout: 20000, // Reduced from 30000
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  
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