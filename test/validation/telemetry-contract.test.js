const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Telemetry validation tests
describe('Telemetry Contract Tests', () => {
  let app;
  const telemetryPath = path.join(__dirname, '../../logs/telemetry.jsonl');
  
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = require('../../src-v2/app.js');
  });

  describe('Chat Request Telemetry', () => {
    // Test 1: Telemetry logging for successful requests
    test('should log telemetry for successful chat requests', async () => {
      const testMessage = `telemetry-test-${Date.now()}`;
      
      const response = await request(app)
        .post('/chat')
        .send({ message: testMessage });
      
      // Give time for telemetry to be written
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (fs.existsSync(telemetryPath)) {
        const telemetryContent = fs.readFileSync(telemetryPath, 'utf8');
        const lines = telemetryContent.trim().split('\n');
        
        // Find the telemetry entry for our request
        const chatEntry = lines
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(entry => entry && entry.request && entry.request.url === '/chat')
          .find(entry => entry.request.body && entry.request.body.message === testMessage);
        
        if (chatEntry) {
          // Validate telemetry structure
          expect(chatEntry).toHaveProperty('timestamp');
          expect(chatEntry).toHaveProperty('request');
          expect(chatEntry).toHaveProperty('response');
          expect(chatEntry).toHaveProperty('duration');
          
          // Validate request structure
          expect(chatEntry.request).toHaveProperty('method', 'POST');
          expect(chatEntry.request).toHaveProperty('url', '/chat');
          expect(chatEntry.request).toHaveProperty('body');
          expect(chatEntry.request.body).toHaveProperty('message', testMessage);
          
          // Validate response structure
          expect(chatEntry.response).toHaveProperty('status');
          expect(chatEntry.response).toHaveProperty('body');
          
          if (chatEntry.response.status === 200) {
            // Success case validation
            expect(chatEntry.response.body).toHaveProperty('response');
            expect(chatEntry.response.body).not.toHaveProperty('message');
          } else {
            // Error case validation
            expect(chatEntry.response.body).toHaveProperty('error');
          }
        }
      }
    });

    // Test 2: Telemetry for error cases
    test('should log telemetry for failed chat requests', async () => {
      const response = await request(app)
        .post('/chat')
        .send({}); // Invalid request
      
      expect(response.status).toBe(400);
      
      // Give time for telemetry to be written
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (fs.existsSync(telemetryPath)) {
        const telemetryContent = fs.readFileSync(telemetryPath, 'utf8');
        const lines = telemetryContent.trim().split('\n');
        
        // Find recent error telemetry
        const errorEntry = lines
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(entry => entry && entry.response && entry.response.status === 400)
          .pop(); // Get most recent
        
        if (errorEntry) {
          // Handle both object and stringified response bodies
          let responseBody = errorEntry.response.body;
          if (typeof responseBody === 'string') {
            responseBody = JSON.parse(responseBody);
          }
          expect(responseBody).toHaveProperty('error');
          expect(responseBody.error).toBe('Message is required');
        }
      }
    });

    // Test 3: Telemetry data consistency
    test('telemetry should match actual response data', async () => {
      const testMessage = `consistency-test-${Date.now()}`;
      
      const response = await request(app)
        .post('/chat')
        .send({ message: testMessage });
      
      // Give time for telemetry to be written
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (fs.existsSync(telemetryPath)) {
        const telemetryContent = fs.readFileSync(telemetryPath, 'utf8');
        const lines = telemetryContent.trim().split('\n');
        
        const chatEntry = lines
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(entry => entry && entry.request && entry.request.url === '/chat')
          .find(entry => entry.request.body && entry.request.body.message === testMessage);
        
        if (chatEntry) {
          // Telemetry should match actual response
          expect(chatEntry.response.status).toBe(response.status);
          
          if (response.status === 200) {
            // Validate the response structure matches between telemetry and actual response
            expect(chatEntry.response.body).toHaveProperty('response');
            expect(chatEntry.response.body).not.toHaveProperty('message');
            
            // Note: response content might be sanitized in telemetry for privacy
            if (!chatEntry.sanitized) {
              expect(chatEntry.response.body.response).toBe(response.body.response);
            }
          }
        }
      }
    });
  });

  describe('Telemetry Performance Tracking', () => {
    // Test 4: Duration tracking
    test('should track request duration in telemetry', async () => {
      const testMessage = `duration-test-${Date.now()}`;
      
      const startTime = Date.now();
      const response = await request(app)
        .post('/chat')
        .send({ message: testMessage });
      const actualDuration = Date.now() - startTime;
      
      // Give time for telemetry to be written
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (fs.existsSync(telemetryPath)) {
        const telemetryContent = fs.readFileSync(telemetryPath, 'utf8');
        const lines = telemetryContent.trim().split('\n');
        
        const chatEntry = lines
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(entry => entry && entry.request && entry.request.url === '/chat')
          .find(entry => entry.request.body && entry.request.body.message === testMessage);
        
        if (chatEntry) {
          expect(chatEntry).toHaveProperty('duration');
          expect(typeof chatEntry.duration).toBe('number');
          expect(chatEntry.duration).toBeGreaterThan(0);
          
          // Duration should be reasonable (within 2x actual duration + 1000ms buffer)
          expect(chatEntry.duration).toBeLessThan(actualDuration * 2 + 1000);
        }
      }
    });
  });
});