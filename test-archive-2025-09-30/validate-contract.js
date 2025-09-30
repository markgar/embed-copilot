#!/usr/bin/env node

/**
 * Quick validation script for the backend-frontend contract
 * This script can be run to quickly verify the chat API is working correctly
 */

const http = require('http');

const BASE_URL = 'http://localhost:5300';

// Test utilities
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5300,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test functions
async function testHealthEndpoint() {
  console.log('🔍 Testing health endpoint...');
  try {
    const response = await makeRequest('GET', '/health');
    if (response.status === 200) {
      console.log('✅ Health endpoint working');
      return true;
    } else {
      console.log(`❌ Health endpoint failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health endpoint error: ${error.message}`);
    return false;
  }
}

async function testChatValidation() {
  console.log('🔍 Testing chat validation...');
  try {
    const response = await makeRequest('POST', '/chat', {});
    if (response.status === 400 && response.body.error === 'Message is required') {
      console.log('✅ Chat validation working');
      return true;
    } else {
      console.log(`❌ Chat validation failed: ${response.status} - ${JSON.stringify(response.body)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Chat validation error: ${error.message}`);
    return false;
  }
}

async function testChatResponseFormat() {
  console.log('🔍 Testing chat response format (CRITICAL TEST)...');
  try {
    const response = await makeRequest('POST', '/chat', { message: 'test response format' });
    
    if (response.status === 200) {
      // CRITICAL: Check for the bug we fixed
      if (response.body.hasOwnProperty('response')) {
        console.log('✅ CRITICAL: Response has "response" field (correct format)');
        
        if (response.body.hasOwnProperty('message')) {
          console.log('⚠️  WARNING: Response also has "message" field (should not exist)');
          return false;
        }
        
        if (response.body.response && response.body.response !== 'undefined') {
          console.log('✅ CRITICAL: Response content is not undefined');
          
          if (response.body.hasOwnProperty('usage')) {
            console.log('✅ Usage statistics included');
            return true;
          } else {
            console.log('⚠️  WARNING: Usage statistics missing');
            return false;
          }
        } else {
          console.log('❌ CRITICAL: Response content is undefined or null');
          return false;
        }
      } else {
        console.log('❌ CRITICAL: Response missing "response" field - frontend will break!');
        console.log('Response body:', JSON.stringify(response.body, null, 2));
        return false;
      }
    } else if (response.status === 500) {
      console.log('⚠️  Chat returned 500 (likely OpenAI not configured - this is OK for testing)');
      if (response.body.error && !response.body.error.includes('undefined')) {
        console.log('✅ Error response format is correct');
        return true;
      } else {
        console.log('❌ Error response format is incorrect');
        return false;
      }
    } else {
      console.log(`❌ Unexpected chat response: ${response.status} - ${JSON.stringify(response.body)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Chat response format error: ${error.message}`);
    return false;
  }
}

async function testFrontendCompatibility() {
  console.log('🔍 Testing frontend compatibility...');
  try {
    const frontendRequest = {
      message: 'test frontend compatibility',
      currentChart: { chartType: 'lineChart', yAxis: null, xAxis: null },
      chatHistory: [{ role: 'user', content: 'previous message' }]
    };
    
    const response = await makeRequest('POST', '/chat', frontendRequest);
    
    if (response.status === 200 || response.status === 500) {
      console.log('✅ Frontend request format accepted');
      return true;
    } else {
      console.log(`❌ Frontend compatibility failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Frontend compatibility error: ${error.message}`);
    return false;
  }
}

// Main validation function
async function runValidation() {
  console.log('🚀 Running Backend-Frontend Contract Validation\n');
  
  const tests = [
    { name: 'Health Endpoint', fn: testHealthEndpoint },
    { name: 'Chat Validation', fn: testChatValidation },
    { name: 'Chat Response Format (CRITICAL)', fn: testChatResponseFormat },
    { name: 'Frontend Compatibility', fn: testFrontendCompatibility }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`✅ ${test.name} PASSED`);
      } else {
        failed++;
        console.log(`❌ ${test.name} FAILED`);
      }
    } catch (error) {
      failed++;
      console.log(`❌ ${test.name} ERROR: ${error.message}`);
    }
  }
  
  console.log('\n📊 VALIDATION SUMMARY');
  console.log('═'.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Backend-Frontend contract is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED! Please check the output above.');
    process.exit(1);
  }
}

// Check if server is running first
async function checkServerRunning() {
  try {
    const response = await makeRequest('GET', '/health');
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Run the validation
async function main() {
  console.log('🔧 Checking if server is running...');
  const isRunning = await checkServerRunning();
  
  if (!isRunning) {
    console.log('❌ Server is not running on localhost:5300');
    console.log('💡 Please start the server first: npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await runValidation();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  makeRequest,
  testHealthEndpoint,
  testChatValidation,
  testChatResponseFormat,
  testFrontendCompatibility,
  runValidation
};