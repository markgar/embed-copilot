# ChartChat E2E Testing Guide

## Overview
This directory contains end-to-end tests that validate the complete ChartChat application flow, including the modular frontend architecture migration.

## Test Files

### `chartchat-frontend.test.js`
**Comprehensive E2E Test Suite**
- **Purpose**: Full validation of modular migration
- **Browser Mode**: Non-headless (visible browser for debugging)
- **Duration**: ~30-40 seconds
- **Coverage**: 
  - Module loading and initialization
  - PowerBI embedding and authentication
  - Chat interface functionality
  - AI interaction ("Show me sales by month")
  - TreeView and data controls
  - Error handling validation
  - Performance metrics

### `chartchat-quick.test.js`
**Quick CI/Automation Test**
- **Purpose**: Fast validation for CI pipelines
- **Browser Mode**: Headless
- **Duration**: ~15-20 seconds
- **Coverage**: Core functionality only

## Running Tests

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Only Quick Test (for CI)
```bash
npx jest test/e2e/chartchat-quick.test.js
```

### Run with Debug Output
```bash
DEBUG=puppeteer:* npm run test:e2e
```

## Test Scenarios

### 1. Application Loading
- ✅ Verifies all 7 modules load correctly
- ✅ Validates module APIs are available
- ✅ Checks UI elements are present

### 2. PowerBI Integration
- ✅ Confirms PowerBI report loads
- ✅ Validates authentication works
- ✅ Ensures iframe is embedded properly

### 3. Chat Interaction Flow
- ✅ Tests user input: "Show me sales by month"
- ✅ Validates AI response is received
- ✅ Checks chart updates based on AI response
- ✅ Verifies message history is maintained

### 4. Module Integration
- ✅ Error handling across modules
- ✅ UI responsiveness
- ✅ TreeView functionality
- ✅ Data control buttons

### 5. Performance Validation
- ✅ Memory usage under 100MB
- ✅ DOM node count reasonable
- ✅ No excessive console errors

## Migration Validation

These tests specifically validate that our modular architecture migration was successful:

### Before Migration
- Single 1517-line `chartchat.js` file
- Monolithic structure
- Difficult to test individual components

### After Migration (Validated by E2E Tests)
- ✅ 7 focused modules working together
- ✅ All original functionality preserved
- ✅ Enhanced error handling
- ✅ Improved maintainability
- ✅ Zero regressions detected

## Configuration

### Browser Settings
```javascript
// Development/Debug Mode
headless: false,
slowMo: 100,
defaultViewport: { width: 1280, height: 720 }

// CI/Production Mode  
headless: true,
args: ['--no-sandbox', '--disable-setuid-sandbox']
```

### Timeouts
- **Module Loading**: 15 seconds
- **PowerBI Loading**: 60 seconds
- **Chat Response**: 30 seconds
- **Overall Test**: 90 seconds

## Troubleshooting

### Common Issues

**1. PowerBI Takes Too Long to Load**
- Increase timeout in test configuration
- Check network connectivity
- Verify PowerBI credentials

**2. Chat Response Timeout**
- Check OpenAI API configuration
- Verify backend is running
- Check AI service availability

**3. Module Loading Failures**
- Verify all module files exist in `/public/js/modules/`
- Check script loading order in HTML
- Validate module exports

### Debug Tips

**1. Run with Visible Browser**
```javascript
headless: false,
slowMo: 100  // Slow down for visibility
```

**2. Enable Console Logging**
```javascript
page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
```

**3. Take Screenshots on Failure**
```javascript
await page.screenshot({ path: 'debug-screenshot.png' });
```

## Success Criteria

For the modular migration to be considered successful, all E2E tests must:

1. ✅ **Load all 7 modules** without errors
2. ✅ **Initialize PowerBI** and load report
3. ✅ **Process chat interaction** with AI response
4. ✅ **Maintain performance** under acceptable limits
5. ✅ **Handle errors gracefully** across modules
6. ✅ **Preserve all functionality** from original monolithic version

## Current Status

🎉 **ALL TESTS PASSING** - Migration validation complete!

- **Test Suites**: 2 total
- **Tests**: 11 total  
- **Status**: ✅ All passing
- **Coverage**: Full application flow validated
- **Performance**: Within acceptable bounds
- **Regressions**: None detected

The modular architecture migration has been successfully validated through comprehensive end-to-end testing.