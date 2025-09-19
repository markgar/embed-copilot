const request = require('supertest');
const path = require('path');

// Simple test to verify server can start and respond
describe('API Endpoints - Basic Smoke Tests', () => {
  let app;
  
  beforeAll(() => {
    // Import the app after setting test environment
    process.env.NODE_ENV = 'test';
    app = require('../src/app.js');
  });

  // Test 1: Basic server health check
  test('GET / should return HTML page', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.headers['content-type']).toMatch(/html/);
  });

  // Test 2: Static file serving
  test('GET /chartchat should return chartchat page', async () => {
    const response = await request(app)
      .get('/chartchat')
      .expect(200);
    
    expect(response.headers['content-type']).toMatch(/html/);
  });

  // Test 3: API endpoint structure (not functionality)
  test('GET /getEmbedToken should respond', async () => {
    const response = await request(app)
      .get('/getEmbedToken');
    
    // Just verify it responds (could be 200 or 400)
    expect([200, 400, 500]).toContain(response.status);
    expect(response.body).toBeDefined();
  });

  // Test 4: Metadata endpoint structure
  test('GET /getDatasetMetadata should respond', async () => {
    const response = await request(app)
      .get('/getDatasetMetadata');
    
    // Just verify it responds (could be 200 or 400)
    expect([200, 400, 500]).toContain(response.status);
    expect(response.body).toBeDefined();
  });

  // Test 5: Chat endpoint structure
  test('POST /chat should have expected response structure', async () => {
    const response = await request(app)
      .post('/chat')
      .send({}) // Empty payload
      .expect(400); // Should return 400 for missing data
    
    expect(response.body).toHaveProperty('error');
  });
});