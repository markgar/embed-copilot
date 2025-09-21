# Test Organization & Structure

This document explains the comprehensive test suite for the embed-copilot application, detailing the organization, types of tests, and how to run them effectively.

## Overview

Our test suite follows modern testing best practices with a clear separation of concerns and the testing pyramid principle. We have **324 tests** across multiple categories, achieving **79.45% statement coverage**.

## Directory Structure

```
test/
├── unit/                           # Fast, isolated unit tests
│   ├── controllers/                # Controller unit tests
│   │   ├── chatController.test.js
│   │   ├── embedController.test.js
│   │   ├── metadataController.test.js
│   │   └── systemController.test.js
│   └── services/                   # Service unit tests
│       ├── cacheService.test.js
│       ├── configService.test.js
│       ├── errorService.test.js
│       ├── openaiService.test.js
│       └── powerbiService.test.js
├── integration/                    # Component interaction tests
│   ├── api/                        # API integration tests
│   │   ├── api.test.js
│   │   ├── api-v2-baseline.test.js
│   │   ├── api-telemetry.test.js
│   │   └── chat-api-contract.test.js
│   ├── backend-frontend-contract.test.js
│   ├── controllers.test.js
│   ├── openai-service-integration.test.js
│   ├── openaiService.liveCapture.test.js
│   ├── powerbi-integration.test.js
│   ├── routes.test.js
│   └── service-integration.test.js
├── services/                       # Service-focused integration tests
│   ├── cacheService.integration.test.js
│   ├── errorService.integration.test.js
│   └── openaiService.regression.test.js
├── validation/                     # End-to-end validation tests
│   ├── caching-behavior.test.js
│   ├── performance-verification.test.js
│   ├── powerbi-endpoint-comprehensive.test.js
│   └── telemetry-contract.test.js
├── regression/                     # Baseline/snapshot tests
│   └── openaiService.baseline.test.js
├── jest.config.js                  # Jest configuration
├── setup.js                       # Test setup and utilities
└── README.md                      # This file
```

## Test Categories

### 🔹 Unit Tests (`/unit/`)
**Purpose**: Test individual components in isolation with all dependencies mocked.
- **Fast execution** (< 1 second total)
- **High reliability** - no external dependencies
- **Comprehensive coverage** of business logic

**Structure**:
- **Controllers**: Test HTTP request/response handling, validation, error cases
- **Services**: Test business logic, data transformation, internal APIs

**Example**: `chatController.test.js` tests chat message validation and response formatting with mocked OpenAI service.

### 🔹 Integration Tests (`/integration/`)
**Purpose**: Test multiple components working together in realistic scenarios.

#### System Integration
- **Controllers**: Multiple controllers working with their services
- **Routes**: Full request routing with middleware
- **Service Integration**: Multiple services cooperating

#### API Integration (`/integration/api/`)
- **API Contract Tests**: Validate API response formats and contracts
- **Baseline Tests**: Ensure API endpoints exist and respond correctly
- **Telemetry Tests**: Validate logging and metrics collection

**Example**: `controllers.test.js` tests real HTTP requests through controllers with mocked external services.

### 🔹 Service Integration Tests (`/services/`)
**Purpose**: Test individual services with realistic usage patterns and dependencies.
- **Cache behavior**: Test caching workflows matching real application patterns
- **Error handling**: Test error scenarios with actual error flows
- **Regression**: Prevent AI service behavior changes

**Key Difference from `/integration/`**: These focus on single service behavior rather than cross-service interactions.

### 🔹 Validation Tests (`/validation/`)
**Purpose**: End-to-end behavior validation and non-functional requirements.
- **Performance**: Response time and memory usage validation
- **Caching**: Cache behavior verification across the application
- **Contracts**: API contract compliance
- **PowerBI Integration**: Comprehensive endpoint validation

### 🔹 Regression Tests (`/regression/`)
**Purpose**: Ensure AI-generated responses remain consistent and reliable.
- **Baseline Snapshots**: Capture expected AI outputs for specific inputs
- **Chart Logic Validation**: Ensure AI selects appropriate chart types
- **Multi-turn Conversations**: Test context preservation

## Running Tests

### Run All Tests
```bash
npm test
```

### Run by Category
```bash
# Unit tests only (fastest)
npm test -- --testPathPatterns="unit/"

# Integration tests only
npm test -- --testPathPatterns="integration/"

# API tests only
npm test -- --testPathPatterns="integration/api"

# Validation tests only
npm test -- --testPathPatterns="validation/"

# Regression tests only
npm test -- --testPathPatterns="regression/"
```

### Run Specific Tests
```bash
# Single test file
npm test -- test/unit/services/openaiService.test.js

# Tests matching pattern
npm test -- --testNamePattern="should validate"

# With coverage
npm test -- --coverage
```

### Run with Options
```bash
# Verbose output
npm test -- --verbose

# Watch mode
npm test -- --watch

# Longer timeout for integration tests
npm test -- --testTimeout=15000
```

## Test Principles & Patterns

### 🎯 Testing Pyramid
Our test suite follows the testing pyramid with more unit tests at the base:
- **Unit Tests**: 134 tests (fast, isolated, comprehensive)
- **Integration Tests**: 150+ tests (moderate speed, realistic scenarios)
- **Validation/E2E**: 40+ tests (slower, full system validation)

### 🎭 Mocking Strategy
- **Unit Tests**: Mock all external dependencies (services, APIs, databases)
- **Integration Tests**: Mock only external APIs, use real internal services
- **Validation Tests**: Minimize mocking for realistic behavior

### 🔄 AI Testing Approach
Special considerations for AI-powered features:
- **Deterministic Testing**: Use fixed temperature (0.1) for consistent outputs
- **Strict vs Flexible**: Strict validation for chart logic, flexible for chat text
- **Baseline Regression**: Capture and validate expected AI behaviors

### 📊 Coverage Goals
Current coverage: **79.45% statements, 74.63% branches, 87.34% functions**

**High Coverage Areas** (90%+):
- Routes: 100%
- Core Services: 92-97%
- Controllers: 67-100%

**Improvement Areas**:
- `systemController.js`: 33% (health checks, telemetry)
- `telemetryService.js`: 52% (logging, metrics)
- `utils.js`: 60% (validation functions)

## Configuration

### Jest Configuration (`jest.config.js`)
```javascript
module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/setup.js']
};
```

### Test Setup (`setup.js`)
Contains custom matchers and global test utilities:
- `toBeOneOf`: Custom matcher for flexible assertions
- Environment setup for test isolation
- Common test utilities and helpers

## Best Practices

### ✅ Writing Good Tests
1. **Descriptive Names**: `should return 400 when message is empty`
2. **Arrange-Act-Assert**: Clear test structure
3. **Single Responsibility**: One concept per test
4. **Deterministic**: Tests should pass/fail consistently

### ✅ Test Organization
1. **Mirror Source Structure**: Tests organized like source code
2. **Logical Grouping**: Related tests in same describe blocks
3. **Clear Separation**: Unit vs integration vs validation
4. **Consistent Naming**: `*.test.js` for all test files

### ✅ Debugging Tests
```bash
# Run single failing test with verbose output
npm test -- test/path/to/test.js --verbose

# Debug with increased timeout
npm test -- --testTimeout=30000

# Check test coverage for specific files
npm test -- --coverage --collectCoverageFrom="src-v2/services/openaiService.js"
```

## Continuous Integration

### Test Execution Order
1. **Unit Tests**: Fast feedback on code changes
2. **Integration Tests**: Validate component interactions
3. **Validation Tests**: Ensure system behavior
4. **Regression Tests**: Catch AI behavior changes

### Performance Considerations
- Unit tests complete in < 1 second
- Full suite completes in ~12 seconds
- Integration tests may require longer timeouts
- AI tests can be flaky due to external API dependencies

## Contributing

When adding new tests:

1. **Choose the Right Category**:
   - Testing single function/class? → `unit/`
   - Testing component interaction? → `integration/`
   - Testing full system behavior? → `validation/`

2. **Follow Naming Conventions**:
   - Files: `componentName.test.js`
   - Describes: `describe('ComponentName', () => ...)`
   - Tests: `test('should do something specific', () => ...)`

3. **Mock Appropriately**:
   - Unit: Mock all dependencies
   - Integration: Mock external APIs only
   - Validation: Minimal mocking

4. **Keep Tests Fast and Reliable**:
   - Avoid real network calls in unit/integration tests
   - Use deterministic test data
   - Clean up after tests (reset mocks, clear cache)

---

For questions about testing patterns or adding new tests, refer to existing examples in the same category or consult the team lead.