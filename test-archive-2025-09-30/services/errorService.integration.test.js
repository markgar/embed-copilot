/**
 * Integration test to verify errorService produces identical 
 * response formats to existing endpoints
 */

const request = require('supertest');
const express = require('express');
const errorService = require('../../src-v2/services/errorService');

describe('ErrorService - Response Format Compatibility', () => {
  let app;

  beforeAll(() => {
    // Create test app with errorService
    app = express();
    app.use(express.json());

    // Test routes using errorService
    app.get('/test-bad-request', (req, res) => {
      errorService.badRequest(res, 'groupId is required.');
    });

    app.get('/test-bad-request-details', (req, res) => {
      errorService.badRequest(res, 'Could not determine dataset ID', 'Connection failed');
    });

    app.get('/test-server-error', (req, res) => {
      errorService.serverError(res, 'Failed to get embed token');
    });

    app.get('/test-server-error-details', (req, res) => {
      errorService.serverError(res, 'Failed to fetch dataset metadata', 'Network timeout');
    });

    app.get('/test-not-found', (req, res) => {
      errorService.notFound(res);
    });
  });

  describe('400 Bad Request responses', () => {
    test('should match existing format: { error: "message" }', async () => {
      const response = await request(app)
        .get('/test-bad-request')
        .expect(400);

      expect(response.body).toEqual({
        error: 'groupId is required.'
      });
    });

    test('should match existing format with details: { error: "message", details: "details" }', async () => {
      const response = await request(app)
        .get('/test-bad-request-details')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Could not determine dataset ID',
        details: 'Connection failed'
      });
    });
  });

  describe('500 Server Error responses', () => {
    test('should match existing format: { error: "message" }', async () => {
      const response = await request(app)
        .get('/test-server-error')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get embed token'
      });
    });

    test('should match existing format with details: { error: "message", details: "details" }', async () => {
      const response = await request(app)
        .get('/test-server-error-details')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to fetch dataset metadata',
        details: 'Network timeout'
      });
    });
  });

  describe('404 Not Found responses', () => {
    test('should return standard 404 format', async () => {
      const response = await request(app)
        .get('/test-not-found')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not Found'
      });
    });
  });
});