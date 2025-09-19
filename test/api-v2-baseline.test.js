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

  // Test 1: Basic server health check (src-v2 now serves chartchat.html)
  test('GET / should return response', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.text).toContain('Chart Chat');
  });

  // Test 2: Health endpoint (new in src-v2)
  test('GET /health should return status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('version', 'src-v2');
  });

  // Test 3: Embed token endpoint should be available (may fail due to config)
  test('GET /getEmbedToken should exist (may return 400/500 if config missing)', async () => {
    const response = await request(app)
      .get('/getEmbedToken');
    
    // Should not be 404, but may be 400 (bad config) or 500 (auth error)
    expect([400, 500]).toContain(response.status);
  });

  // Test 4: Metadata endpoint should be available (may fail due to config)
  test('GET /getDatasetMetadata should exist (may return 400/500 if config missing)', async () => {
    const response = await request(app)
      .get('/getDatasetMetadata');
    
    // Should not be 404, but may be 400 (bad config) or 500 (auth error)
    expect([400, 500]).toContain(response.status);
  });

  // Test 5: Missing chat endpoint should return 404
  test('POST /chat should return 404 (not implemented)', async () => {
    const response = await request(app)
      .post('/chat')
      .send({});
    
    expect(response.status).toBe(404);
  });
});