const fs = require('fs');
const path = require('path');

class TelemetryParser {
  constructor(telemetryFilePath) {
    this.telemetryData = JSON.parse(fs.readFileSync(telemetryFilePath, 'utf8'));
  }

  // Group telemetry by endpoint
  groupByEndpoint() {
    const grouped = {};
    
    this.telemetryData.forEach(entry => {
      const key = `${entry.request.method} ${entry.request.path}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(entry);
    });
    
    return grouped;
  }

  // Extract unique response patterns for each endpoint
  extractResponsePatterns() {
    const grouped = this.groupByEndpoint();
    const patterns = {};

    Object.entries(grouped).forEach(([endpoint, entries]) => {
      // Skip telemetry control and logging endpoints for test generation
      if (endpoint.includes('telemetry-control') || endpoint.includes('log-')) {
        return;
      }

      patterns[endpoint] = {
        sampleCount: entries.length,
        statusCodes: [...new Set(entries.map(e => e.response.status))],
        avgResponseTime: Math.round(entries.reduce((sum, e) => sum + e.response.duration, 0) / entries.length),
        sampleRequest: this.sanitizeForTest(entries[0].request),
        sampleResponse: this.sanitizeForTest(entries[0].response),
        responseStructures: this.extractResponseStructures(entries)
      };
    });

    return patterns;
  }

  // Extract response structure patterns
  extractResponseStructures(entries) {
    const structures = new Set();
    
    entries.forEach(entry => {
      if (entry.response.body && typeof entry.response.body === 'object') {
        const keys = Object.keys(entry.response.body).sort();
        structures.add(JSON.stringify(keys));
      }
    });
    
    return Array.from(structures).map(s => JSON.parse(s));
  }

  // Sanitize data for test cases (remove dynamic values but keep structure)
  sanitizeForTest(data) {
    if (!data) return data;
    
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove/replace dynamic values while preserving structure
    const replaceDynamicValues = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(replaceDynamicValues);
      } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key.toLowerCase().includes('timestamp') || key.toLowerCase().includes('time')) {
            result[key] = '[TIMESTAMP]';
          } else if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key')) {
            result[key] = '[TOKEN]';
          } else if (key.toLowerCase().includes('duration')) {
            result[key] = '[DURATION]';
          } else if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            result[key] = '[GUID]';
          } else {
            result[key] = replaceDynamicValues(value);
          }
        }
        return result;
      }
      return obj;
    };
    
    return replaceDynamicValues(sanitized);
  }

  // Generate test cases
  generateTestCases() {
    const patterns = this.extractResponsePatterns();
    const testCases = [];

    Object.entries(patterns).forEach(([endpoint, pattern]) => {
      const [method, path] = endpoint.split(' ');
      
      testCases.push({
        endpoint,
        method,
        path,
        testName: `${method} ${path} should return expected structure`,
        expectedStatus: pattern.statusCodes[0], // Use most common status
        expectedStructure: pattern.responseStructures[0] || [],
        sampleRequest: pattern.sampleRequest,
        sampleResponse: pattern.sampleResponse,
        performanceBaseline: {
          avgResponseTime: pattern.avgResponseTime,
          tolerance: Math.max(50, pattern.avgResponseTime * 0.5) // 50ms or 50% tolerance
        }
      });
    });

    return testCases;
  }

  // Generate Jest test file content
  generateJestTests() {
    const testCases = this.generateTestCases();
    
    let testContent = `const request = require('supertest');

// Enhanced test suite generated from telemetry data
describe('API Endpoints - Telemetry-Based Tests', () => {
  let app;
  
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = require('../src/app.js');
  });

`;

    testCases.forEach(testCase => {
      testContent += `  // Test generated from ${testCase.endpoint} telemetry
  test('${testCase.testName}', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .${testCase.method.toLowerCase()}('${testCase.path}')`;

    // Add request body if it's a POST request with body
    if (testCase.method === 'POST' && testCase.sampleRequest.body && Object.keys(testCase.sampleRequest.body).length > 0) {
      testContent += `
      .send(${JSON.stringify(testCase.sampleRequest.body, null, 6)})`;
    }

    testContent += `;
    
    const responseTime = Date.now() - startTime;
    
    // Status code validation
    expect(response.status).toBe(${testCase.expectedStatus});
    
    // Response structure validation
    ${testCase.expectedStructure.length > 0 ? 
      testCase.expectedStructure.map(key => `expect(response.body).toHaveProperty('${key}');`).join('\n    ') :
      '// No specific structure validation needed'
    }
    
    // Performance baseline (with tolerance)
    expect(responseTime).toBeLessThan(${testCase.performanceBaseline.tolerance});
  });

`;
    });

    testContent += `});
`;

    return testContent;
  }
}

// Parse telemetry and generate tests
const parser = new TelemetryParser('./clean_telemetry.json');
const testContent = parser.generateJestTests();

// Write the enhanced test file
fs.writeFileSync('./test/api-telemetry.test.js', testContent);

// Also output analysis
const patterns = parser.extractResponsePatterns();
console.log('📊 Telemetry Analysis:');
console.log(JSON.stringify(patterns, null, 2));

console.log('\\n✅ Enhanced test suite generated: test/api-telemetry.test.js');