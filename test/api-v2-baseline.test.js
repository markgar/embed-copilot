const request = require('supertest');
const path = require('path');

// API tests for src-v2 architecture - baseline compatibility validation
describe('API Endpoints - src-v2 Baseline Tests', () => {
  let app;
  
  beforeAll(() => {
    // Import the src-v2 app
    process.env.NODE_ENV = 'test';
    app = require('../src-v2/app.js');
  });

  // Test 1: Basic server health check (src-v2 has different route)
  test('GET / should return response', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.text).toContain('src-v2 Server Running');
  });

  // Test 2: Health endpoint (new in src-v2)
  test('GET /health should return status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('version', 'src-v2');
  });

  // Test 3: Missing endpoints should return 404 (not implemented yet)
  test('GET /getEmbedToken should return 404 (not implemented)', async () => {
    const response = await request(app)
      .get('/getEmbedToken');
    
    expect(response.status).toBe(404);
  });

  // Test 4: Missing metadata endpoint should return 404
  test('GET /getDatasetMetadata should return 404 (not implemented)', async () => {
    const response = await request(app)
      .get('/getDatasetMetadata');
    
    expect(response.status).toBe(404);
  });

  // Test 5: Missing chat endpoint should return 404
  test('POST /chat should return 404 (not implemented)', async () => {
    const response = await request(app)
      .post('/chat')
      .send({});
    
    expect(response.status).toBe(404);
  });
});