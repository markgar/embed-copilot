const request = require('supertest');

// Enhanced test suite generated from telemetry data
describe('API Endpoints - Telemetry-Based Tests', () => {
  let app;
  
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = require('../../../src-v2/app.js');
  });

  // Test generated from GET /getDatasetMetadata telemetry
  test('GET /getDatasetMetadata should return expected structure', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .get('/getDatasetMetadata');
    
    const responseTime = Date.now() - startTime;
    
    // Status code validation
    expect(response.status).toBe(200);
    
    // Response structure validation
    expect(response.body).toHaveProperty('dataset');
    expect(response.body).toHaveProperty('dimensions');
    expect(response.body).toHaveProperty('lastUpdated');
    expect(response.body).toHaveProperty('measures');
    expect(response.body).toHaveProperty('tables');
    
    // Performance baseline (with tolerance)
    expect(responseTime).toBeLessThan(200);
  });

  // Test generated from GET /getEmbedToken telemetry
  test('GET /getEmbedToken should return expected structure', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .get('/getEmbedToken');
    
    const responseTime = Date.now() - startTime;
    
    // Status code validation
    expect(response.status).toBe(200);
    
    // Response structure validation
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('embedUrl');
    expect(response.body).toHaveProperty('expiry');
    expect(response.body).toHaveProperty('status');
    
    // Performance baseline (with tolerance)
    expect(responseTime).toBeLessThan(2000);
  });

  // Test generated from POST /chat telemetry
  test('POST /chat should return expected structure', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .post('/chat')
      .send({
      "message": "show me sales by month",
      "currentChart": {
            "chartType": "lineChart",
            "yAxis": null,
            "xAxis": null
      },
      "chatHistory": [
            {
                  "role": "user",
                  "content": "show me sales by month"
            }
      ]
});
    
    const responseTime = Date.now() - startTime;
    
    // Status code validation
    expect(response.status).toBe(200);
    
    // Response structure validation
    expect(response.body).toHaveProperty('response');
    
    // Performance baseline (with tolerance)
    expect(responseTime).toBeLessThan(1500);
  });

});
