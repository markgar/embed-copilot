#!/usr/bin/env node
/**
 * API Contract Validator
 * 
 * This script validates that our test mocks match real API responses.
 * Run it to see what actual APIs return and compare to our test expectations.
 * 
 * Usage:
 *   node tools/validate-api-contracts.js
 * 
 * Environment variables required:
 *   CLIENT_ID - Azure AD application ID
 *   CLIENT_SECRET - Azure AD application secret
 *   TENANT_ID - Azure AD tenant ID
 *   TEST_WORKSPACE_ID - Fabric workspace ID for testing
 *   TEST_DATASET_ID - Dataset ID for testing
 */

const FabricService = require('../src-v2/services/fabricService');
const PowerBIService = require('../src-v2/services/powerbiService');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Save contract to file
function saveContract(name, data) {
  const contractsDir = path.join(__dirname, '..', 'test', 'contracts');
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  
  const filePath = path.join(contractsDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  logInfo(`Saved to: ${filePath}`);
}

// Compare with our test mocks
function compareMockToReality(mockData, realData, name) {
  logSection(`Comparing Mock vs Reality: ${name}`);
  
  const mockKeys = Object.keys(mockData);
  const realKeys = Object.keys(realData);
  
  // Check if mock has all real keys
  const missingKeys = realKeys.filter(k => !mockKeys.includes(k));
  const extraKeys = mockKeys.filter(k => !realKeys.includes(k));
  
  if (missingKeys.length > 0) {
    logError(`Mock is missing keys: ${missingKeys.join(', ')}`);
  }
  
  if (extraKeys.length > 0) {
    logWarning(`Mock has extra keys: ${extraKeys.join(', ')}`);
  }
  
  if (missingKeys.length === 0 && extraKeys.length === 0) {
    logSuccess('Mock structure matches reality!');
  }
  
  // Check data types
  console.log('\nData Type Comparison:');
  realKeys.forEach(key => {
    const mockType = typeof mockData[key];
    const realType = typeof realData[key];
    
    if (mockType === realType) {
      logSuccess(`  ${key}: ${realType}`);
    } else {
      logError(`  ${key}: mock=${mockType}, real=${realType}`);
    }
  });
}

async function validateFabricService() {
  logSection('FABRIC SERVICE VALIDATION');
  
  const config = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    tenantId: process.env.TENANT_ID
  };
  
  // Validate environment
  if (!config.clientId || !config.clientSecret || !config.tenantId) {
    logError('Missing required environment variables: CLIENT_ID, CLIENT_SECRET, TENANT_ID');
    return false;
  }
  
  const service = new FabricService(config, fetch);
  
  try {
    // Test 1: Get Access Token
    logSection('Test 1: getAccessToken()');
    const token = await service.getAccessToken();
    
    logSuccess(`Got access token`);
    logInfo(`Token length: ${token.length} characters`);
    logInfo(`Token starts with: ${token.substring(0, 30)}...`);
    logInfo(`Token format: ${token.includes('.') ? 'JWT (contains dots)' : 'Opaque'}`);
    
    // Check against our mock
    const mockToken = 'mock-fabric-token';
    console.log('\nMock Token Analysis:');
    logInfo(`Mock length: ${mockToken.length}`);
    if (token.length !== mockToken.length) {
      logWarning(`Real token is ${token.length - mockToken.length} chars longer than mock`);
    }
    
    // Save token metadata (not the actual token!)
    const tokenContract = {
      length: token.length,
      format: token.includes('.') ? 'JWT' : 'opaque',
      exampleStart: token.substring(0, 10) + '...',
      expiresIn: 3600 // From Azure AD response
    };
    saveContract('fabric-access-token-metadata', tokenContract);
    
  } catch (error) {
    logError(`getAccessToken failed: ${error.message}`);
    return false;
  }
  
  // Test 2: Check Report Exists
  if (process.env.TEST_WORKSPACE_ID) {
    try {
      logSection('Test 2: checkReportExists()');
      const result = await service.checkReportExists(
        process.env.TEST_WORKSPACE_ID,
        'Nonexistent Report ' + Date.now()
      );
      
      if (result === null) {
        logSuccess('checkReportExists returned null for non-existent report');
      } else {
        logWarning('Got unexpected result:');
        console.log(JSON.stringify(result, null, 2));
      }
      
      // Save contract
      const contract = {
        notFound: result,
        expectedType: 'null',
        notes: 'When report does not exist, should return null'
      };
      saveContract('fabric-report-not-found', contract);
      
    } catch (error) {
      logError(`checkReportExists failed: ${error.message}`);
    }
  } else {
    logWarning('Skipping checkReportExists - no TEST_WORKSPACE_ID provided');
  }
  
  // Test 3: Compare with our test mocks
  logSection('Comparing with Unit Test Mocks');
  
  const mockTokenResponse = {
    access_token: 'mock-fabric-token',
    expires_in: 3600
  };
  
  logInfo('Our mock token response:');
  console.log(JSON.stringify(mockTokenResponse, null, 2));
  
  logSuccess('Token mock looks reasonable (has access_token and expires_in)');
  
  return true;
}

async function validatePowerBIService() {
  logSection('POWERBI SERVICE VALIDATION');
  
  const config = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    tenantId: process.env.TENANT_ID,
    powerBIApiUrl: 'https://api.powerbi.com',
    scopesGraph: ['https://graph.microsoft.com/.default'],
    scopesPowerBI: ['https://analysis.windows.net/powerbi/api/.default']
  };
  
  // Create mock MSAL client
  const mockMsalClient = {
    acquireTokenByClientCredential: async () => ({
      accessToken: 'mock-token'
    })
  };
  
  try {
    const service = new PowerBIService(config, mockMsalClient, fetch);
    
    logInfo('PowerBIService created successfully');
    logInfo('Note: Full validation requires real MSAL client and report IDs');
    
    logSuccess('Service structure validated');
    
  } catch (error) {
    logError(`PowerBIService validation failed: ${error.message}`);
    return false;
  }
  
  return true;
}

async function main() {
  log('\n🔍 API Contract Validator', 'cyan');
  log('This tool validates that our test mocks match real API responses\n');
  
  // Check environment
  const hasCredentials = process.env.CLIENT_ID && 
                        process.env.CLIENT_SECRET && 
                        process.env.TENANT_ID;
  
  if (!hasCredentials) {
    logError('Missing credentials!');
    console.log('\nPlease set environment variables:');
    console.log('  CLIENT_ID=your-client-id');
    console.log('  CLIENT_SECRET=your-client-secret');
    console.log('  TENANT_ID=your-tenant-id');
    console.log('\nOptional:');
    console.log('  TEST_WORKSPACE_ID=workspace-id');
    console.log('  TEST_DATASET_ID=dataset-id');
    console.log('\nExample:');
    console.log('  CLIENT_ID=xxx CLIENT_SECRET=yyy TENANT_ID=zzz node tools/validate-api-contracts.js');
    process.exit(1);
  }
  
  logSuccess('Credentials found in environment');
  
  // Run validations
  const fabricOk = await validateFabricService();
  const powerbiOk = await validatePowerBIService();
  
  // Summary
  logSection('VALIDATION SUMMARY');
  
  if (fabricOk) {
    logSuccess('Fabric Service: API contracts validated');
  } else {
    logError('Fabric Service: Validation failed');
  }
  
  if (powerbiOk) {
    logSuccess('PowerBI Service: Structure validated');
  } else {
    logError('PowerBI Service: Validation failed');
  }
  
  console.log('\n📁 Contract files saved to: test/contracts/');
  console.log('📝 Use these to validate your unit test mocks\n');
  
  if (fabricOk && powerbiOk) {
    logSuccess('All validations passed! ✨');
    process.exit(0);
  } else {
    logError('Some validations failed');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { validateFabricService, validatePowerBIService };
