import js from '@eslint/js';

export default [
  js.configs.recommended,
  // Node.js server code and configuration files
  {
    files: ['src/**/*.js', 'tools/**/*.js', 'models/**/*.js'],
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
    rules: {
      // Core quality rules  
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-console': 'off',
      
      // Code style for better readability
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'no-mixed-spaces-and-tabs': 'error',
      
      // Function-specific rules
      'no-unused-expressions': 'error',
      'prefer-const': 'error'
    }
  },
  // Browser client code
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        CustomEvent: 'readonly',
        location: 'readonly',
        // jQuery and other common libraries
        $: 'readonly',
        jQuery: 'readonly',
        // PowerBI
        powerbi: 'readonly',
        // Markdown parser
        marked: 'readonly',
        // Console is available in browsers too
        console: 'readonly'
      }
    },
    rules: {
      // Core quality rules  
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-console': 'off',
      
      // Code style for better readability
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'no-mixed-spaces-and-tabs': 'error',
      
      // Function-specific rules
      'no-unused-expressions': 'error',
      'prefer-const': 'error'
    }
  },

];