/**
 * Error Service - Standardized error response handling
 * 
 * Provides consistent error response formats that match the existing
 * API patterns used throughout the application.
 */

/**
 * Send a 400 Bad Request response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {string} [details] - Optional error details
 * @returns {Object} Express response
 */
function badRequest(res, message, details = null) {
  const errorResponse = { error: message };
  if (details) {
    errorResponse.details = details;
  }
  return res.status(400).json(errorResponse);
}

/**
 * Send a 500 Internal Server Error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {string} [details] - Optional error details
 * @returns {Object} Express response
 */
function serverError(res, message, details = null) {
  const errorResponse = { error: message };
  if (details) {
    errorResponse.details = details;
  }
  return res.status(500).json(errorResponse);
}

/**
 * Send a 404 Not Found response
 * @param {Object} res - Express response object
 * @param {string} [message] - Optional error message (defaults to standard message)
 * @returns {Object} Express response
 */
function notFound(res, message = 'Not Found') {
  return res.status(404).json({ error: message });
}

/**
 * Send a success response with data
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {number} [status=200] - HTTP status code
 * @returns {Object} Express response
 */
function success(res, data, status = 200) {
  return res.status(status).json(data);
}

/**
 * Handle errors from try/catch blocks and send appropriate response
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} [message] - Optional custom error message
 * @returns {Object} Express response
 */
function handleError(res, error, message = 'An error occurred') {
  console.error('[errorService]', message, error);
  return serverError(res, message, error.message);
}

/**
 * Generic error sender that dispatches to appropriate error type
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {string} [details] - Optional error details
 * @returns {Object} Express response
 */
function sendError(res, status, message, details = null) {
  const errorResponse = { error: message };
  if (details) {
    errorResponse.details = details;
  }
  return res.status(status).json(errorResponse);
}

module.exports = {
  badRequest,
  serverError,
  notFound,
  success,
  handleError,
  sendError
};