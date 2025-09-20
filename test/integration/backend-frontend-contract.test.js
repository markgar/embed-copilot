const request = require('supertest');

// Backend-Frontend Integration Tests
// These tests validate the specific contract between backend responses and frontend expectations
describe('Backend-Frontend Integration Contract', () => {
  let app;
  
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = require('../../src-v2/app.js');
  });

  describe('Chat Response Format - Frontend Compatibility', () => {
    // Test 1: CRITICAL - The exact bug we fixed
    test('backend must send { response: string } not { message: string }', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'test frontend compatibility' });
      
      if (response.status === 200) {
        // CRITICAL: Frontend expects data.response
        expect(response.body).toHaveProperty('response');
        expect(typeof response.body.response).toBe('string');
        
        // CRITICAL: Frontend will break if we send data.message instead
        expect(response.body).not.toHaveProperty('message');
        
        // Additional validation
        expect(response.body.response).not.toBe('undefined');
        expect(response.body.response).not.toBe('null');
        expect(response.body.response.length).toBeGreaterThan(0);
      }
    });

    // Test 2: Frontend JSON parsing compatibility
    test('response should be parseable by frontend JavaScript', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'json parsing test' });
      
      if (response.status === 200) {
        // Frontend does: JSON.parse(data.response)
        // This should not throw an error
        expect(() => {
          if (response.body.response) {
            // If response contains JSON, it should be valid
            if (response.body.response.trim().startsWith('{')) {
              JSON.parse(response.body.response);
            }
          }
        }).not.toThrow();
      }
    });

    // Test 3: Chart action response format (if AI returns structured data)
    test('should handle chart action responses properly', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ 
          message: 'show me sales by month',
          currentChart: { chartType: 'lineChart', yAxis: null, xAxis: null }
        });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('response');
        
        // If the AI returns JSON for chart actions, validate structure
        const responseContent = response.body.response;
        if (responseContent && responseContent.includes('chartAction')) {
          // Frontend expects this format when parsing JSON responses
          expect(() => {
            const parsed = JSON.parse(responseContent);
            if (parsed.chartAction) {
              expect(parsed).toHaveProperty('chatResponse');
              expect(parsed.chartAction).toHaveProperty('chartType');
            }
          }).not.toThrow();
        }
      }
    });
  });

  describe('Error Response Format - Frontend Compatibility', () => {
    // Test 4: Error responses should be consistent
    test('error responses should have consistent structure', async () => {
      const response = await request(app)
        .post('/chat')
        .send({}); // Invalid request to trigger error
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
      
      // Frontend error handling expects string error messages
      expect(response.body.error.length).toBeGreaterThan(0);
    });

    // Test 5: 500 errors should have proper structure
    test('server errors should return proper error format', async () => {
      // This might trigger a 500 if OpenAI is not configured
      const response = await request(app)
        .post('/chat')
        .send({ message: 'test server error handling' });
      
      if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
        expect(typeof response.body.error).toBe('string');
        
        // Should not expose internal error details to frontend
        expect(response.body.error).not.toContain('stack');
        expect(response.body.error).not.toContain('at ');
      }
    });
  });

  describe('Frontend Request Format Validation', () => {
    // Test 6: Validate frontend sends expected request format
    test('should accept frontend request format with all expected fields', async () => {
      const frontendRequest = {
        message: 'test message',
        currentChart: {
          chartType: 'lineChart',
          yAxis: null,
          xAxis: null
        },
        chatHistory: [
          { role: 'user', content: 'previous message' },
          { role: 'assistant', content: 'previous response' }
        ]
      };
      
      const response = await request(app)
        .post('/chat')
        .send(frontendRequest);
      
      // Should accept the request without validation errors
      expect(response.status).not.toBe(400);
    });

    // Test 7: Should handle missing optional fields gracefully
    test('should work with minimal frontend request', async () => {
      const minimalRequest = {
        message: 'minimal test'
      };
      
      const response = await request(app)
        .post('/chat')
        .send(minimalRequest);
      
      // Should not fail due to missing optional fields
      expect(response.status).not.toBe(400);
    });
  });

  describe('Content-Type and Header Validation', () => {
    // Test 8: Content-Type handling
    test('should require application/json content-type', async () => {
      const response = await request(app)
        .post('/chat')
        .set('Content-Type', 'text/plain')
        .send('{"message":"test"}');
      
      // Should handle content-type requirements properly
      expect([400, 415]).toContain(response.status);
    });

    // Test 9: Response headers
    test('should return proper response headers', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'header test' });
      
      expect(response.headers['content-type']).toMatch(/application\/json/);
      
      // Should include CORS headers if needed for frontend
      // Note: Specific CORS requirements would depend on deployment
    });
  });
});

// Regression tests for specific issues
describe('Regression Tests - Specific Bug Fixes', () => {
  let app;
  
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = require('../../src-v2/app.js');
  });

  // Test 10: The undefined response bug we just fixed
  test('REGRESSION: should never return undefined in response field', async () => {
    const response = await request(app)
      .post('/chat')
      .send({ message: 'regression test for undefined bug' });
    
    if (response.status === 200) {
      // This was the exact issue: frontend got undefined
      expect(response.body.response).not.toBe(undefined);
      expect(response.body.response).not.toBe('undefined');
      expect(response.body.response).not.toBeNull();
      
      // Should be a non-empty string
      expect(typeof response.body.response).toBe('string');
      expect(response.body.response.trim().length).toBeGreaterThan(0);
    }
  });

  // Test 11: Message vs Response field regression
  test('REGRESSION: should use response field not message field', async () => {
    const response = await request(app)
      .post('/chat')
      .send({ message: 'field name regression test' });
    
    if (response.status === 200) {
      // Verify the fix: use 'response' not 'message'
      expect(response.body).toHaveProperty('response');
      expect(response.body).not.toHaveProperty('message');
      
      // Ensure we didn't accidentally create both fields
      const bodyKeys = Object.keys(response.body);
      expect(bodyKeys).toContain('response');
      expect(bodyKeys).not.toContain('message');
    }
  });

  // Test 12: JSON.parse error prevention
  test('REGRESSION: should prevent JSON.parse errors on frontend', async () => {
    const response = await request(app)
      .post('/chat')
      .send({ message: 'json parse prevention test' });
    
    if (response.status === 200) {
      const responseContent = response.body.response;
      
      // This should not cause the frontend JSON.parse(undefined) error
      expect(responseContent).toBeDefined();
      expect(responseContent).not.toBe('undefined');
      
      // If it's meant to be JSON, it should be valid JSON
      if (responseContent && responseContent.trim().startsWith('{')) {
        expect(() => JSON.parse(responseContent)).not.toThrow();
      }
    }
  });
});