import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly'
      }
    },
    files: ['src-v2/**/*.js'],
    rules: {
      // Core quality rules  
      'no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-console': 'off',
      
      // Code style for better readability
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      
      // Function-specific rules
      'no-unused-expressions': 'error',
      'prefer-const': 'error'
    }
  },
  {
    // Ignore patterns
    ignores: [
      'test/**/*',
      'tools/**/*', 
      'public/**/*',
      'models/**/*',
      'node_modules/**/*'
    ]
  }
];