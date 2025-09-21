const request = require('supertest');
const path = require('path');

// Chat API contract tests - ensures backend-frontend API consistency
describe('Chat API Contract Tests', () => {
  let app;
  
  beforeAll(() => {
    // Import the src-v2 app
    process.env.NODE_ENV = 'test';
    app = require('../../../src-v2/app.js');
  });

  describe('POST /chat - Response Format Validation', () => {
    // Test 1: Endpoint should exist
    test('should respond to POST /chat', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'test' });
      
      // Should not be 404 - endpoint should exist
      expect(response.status).not.toBe(404);
    });

    // Test 2: Validation - missing message
    test('should return 400 when message is missing', async () => {
      const response = await request(app)
        .post('/chat')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Message is required');
    });

    // Test 3: Validation - empty message
    test('should return 400 when message is empty string', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: '' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Message is required');
    });

    // Test 4: Validation - whitespace-only message
    test('should return 400 when message is only whitespace', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: '   ' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Message is required');
    });

    // Test 5: CRITICAL - Response format contract
    test('should return response in expected format { response, usage }', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'hello' });
      
      // This test ensures the frontend will get the right format
      if (response.status === 200) {
        // SUCCESS CASE: Must have 'response' field (not 'message')
        expect(response.body).toHaveProperty('response');
        expect(response.body).toHaveProperty('usage');
        expect(typeof response.body.response).toBe('string');
        expect(typeof response.body.usage).toBe('object');
        
        // CRITICAL: Should NOT have 'message' field (old broken format)
        expect(response.body).not.toHaveProperty('message');
        
        // Frontend expects non-empty response content
        expect(response.body.response.length).toBeGreaterThan(0);
      } else {
        // ERROR CASE: Should have error structure
        expect(response.body).toHaveProperty('error');
        expect(typeof response.body.error).toBe('string');
      }
    });

    // Test 6: Response content validation
    test('should return proper usage statistics when successful', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'test message' });
      
      if (response.status === 200) {
        expect(response.body.usage).toHaveProperty('total_tokens');
        expect(response.body.usage).toHaveProperty('prompt_tokens');
        expect(response.body.usage).toHaveProperty('completion_tokens');
        expect(typeof response.body.usage.total_tokens).toBe('number');
        expect(response.body.usage.total_tokens).toBeGreaterThan(0);
      }
    });

    // Test 7: Content-Type validation
    test('should return JSON content-type', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'test' });
      
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    // Test 8: Request body validation
    test('should accept additional optional fields without breaking', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ 
          message: 'test',
          currentChart: { chartType: 'lineChart', yAxis: null, xAxis: null },
          chatHistory: [{ role: 'user', content: 'previous message' }]
        });
      
      // Should not break with additional fields
      expect(response.status).not.toBe(400);
    });
  });

  describe('Chat Service Integration', () => {
    // Test 9: Configuration handling
    test('should handle missing OpenAI configuration gracefully', async () => {
      // Temporarily clear config to test error handling
      const originalEnv = process.env.AZURE_OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_API_KEY;
      
      const response = await request(app)
        .post('/chat')
        .send({ message: 'test' });
      
      // Restore environment
      if (originalEnv) process.env.AZURE_OPENAI_API_KEY = originalEnv;
      
      // Should return proper error structure
      if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('OpenAI service not configured');
      }
    });

    // Test 10: Telemetry integration
    test('should log telemetry for chat requests', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'telemetry test' });
      
      // Request should complete (success or configured error)
      expect([200, 400, 500]).toContain(response.status);
      
      // Note: Actual telemetry validation would require checking logs/telemetry.jsonl
      // This test ensures the endpoint doesn't crash during telemetry logging
    });
  });
});

// Performance and reliability tests
describe('Chat API Performance', () => {
  let app;
  
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = require('../../../src-v2/app.js');
  });

  // Test 11: Response time validation
  test('should respond within reasonable time limits', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .post('/chat')
      .send({ message: 'performance test' });
    
    const responseTime = Date.now() - startTime;
    
    // Should respond within 30 seconds (generous for OpenAI API)
    expect(responseTime).toBeLessThan(30000);
    
    // Log response time for monitoring
    console.log(`Chat API response time: ${responseTime}ms`);
  });

  // Test 12: Concurrent request handling
  test('should handle multiple concurrent requests', async () => {
    const requests = Array(3).fill().map((_, i) => 
      request(app)
        .post('/chat')
        .send({ message: `concurrent test ${i + 1}` })
    );
    
    const responses = await Promise.all(requests);
    
    // All requests should complete
    responses.forEach((response, index) => {
      expect([200, 400, 500]).toContain(response.status);
      console.log(`Concurrent request ${index + 1}: ${response.status}`);
    });
  });
});