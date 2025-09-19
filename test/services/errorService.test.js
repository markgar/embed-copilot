/**
 * Unit tests for errorService.js
 * Tests standardized error response methods
 */

const errorService = require('../../src-v2/services/errorService');

describe('ErrorService', () => {
  let mockRes;

  beforeEach(() => {
    // Create mock Express response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  describe('badRequest', () => {
    test('should send 400 status with error message', () => {
      const message = 'Missing required field';
      
      errorService.badRequest(mockRes, message);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: message });
    });

    test('should include details when provided', () => {
      const message = 'Validation failed';
      const details = 'Field "email" is not a valid email address';
      
      errorService.badRequest(mockRes, message, details);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: message, 
        details: details 
      });
    });
  });

  describe('serverError', () => {
    test('should send 500 status with error message', () => {
      const message = 'Database connection failed';
      
      errorService.serverError(mockRes, message);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: message });
    });

    test('should include details when provided', () => {
      const message = 'API call failed';
      const details = 'Connection timeout after 30 seconds';
      
      errorService.serverError(mockRes, message, details);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: message, 
        details: details 
      });
    });
  });

  describe('notFound', () => {
    test('should send 404 status with default message', () => {
      errorService.notFound(mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not Found' });
    });

    test('should send 404 status with custom message', () => {
      const message = 'User not found';
      
      errorService.notFound(mockRes, message);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: message });
    });
  });

  describe('success', () => {
    test('should send 200 status with data by default', () => {
      const data = { message: 'Operation successful', id: 123 };
      
      errorService.success(mockRes, data);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(data);
    });

    test('should send custom status with data', () => {
      const data = { message: 'Resource created', id: 456 };
      const status = 201;
      
      errorService.success(mockRes, data, status);
      
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(data);
    });
  });

  describe('handleError', () => {
    let consoleSpy;

    beforeEach(() => {
      // Mock console.error to avoid noise in test output
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test('should log error and send 500 response', () => {
      const error = new Error('Database error');
      const message = 'Failed to save user';
      
      errorService.handleError(mockRes, error, message);
      
      expect(consoleSpy).toHaveBeenCalledWith('[errorService]', message, error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: message, 
        details: error.message 
      });
    });

    test('should use default message when none provided', () => {
      const error = new Error('Network error');
      
      errorService.handleError(mockRes, error);
      
      expect(consoleSpy).toHaveBeenCalledWith('[errorService]', 'An error occurred', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'An error occurred', 
        details: error.message 
      });
    });
  });
});