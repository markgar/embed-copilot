# Test Suite

Fresh start! This is a clean, modern test structure.

## Directory Structure

```
test/
├── unit/           # Unit tests - test individual functions/modules
└── integration/    # Integration tests - test multiple components together
```

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit
```

## Writing Tests

### Unit Test Example
```javascript
// test/unit/myFunction.test.js
describe('myFunction', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Integration Test Example
```javascript
// test/integration/api.test.js
const request = require('supertest');
const app = require('../../src-v2/app');

describe('API Integration', () => {
  it('should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
```

## Old Tests

Old tests are archived in `test-archive-2025-09-30/` for reference.
