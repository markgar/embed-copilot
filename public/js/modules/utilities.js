// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

/**
 * Utilities Module
 * Handles error logging, console management, and global error handlers
 */

// Store original console methods
const originalConsoleLog = console.log;
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

/**
 * Centralized error logging function
 * Logs errors both to console and backend for tracking
 * @param {Error|string} error - The error to log
 * @param {string} context - Context where the error occurred
 */
function logError(error, context = 'Unknown') {
  const errorDetails = {
    message: error.message || error,
    stack: error.stack || 'No stack trace',
    name: error.name || 'Unknown error type'
  };
    
  // Send to backend for logging
  fetch('/log-error', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      error: errorDetails,
      context: context,
      timestamp: new Date().toISOString()
    })
  }).catch(backendError => {
    console.error('Failed to send error to backend:', backendError);
  });
}

/**
 * Initialize global error handlers
 * Sets up window-level error and promise rejection handlers
 */
function initializeErrorHandlers() {
  // Global error handlers
  window.addEventListener('error', function(event) {
    logError(event.error || new Error(event.message), `Global Error (${event.filename}:${event.lineno})`);
  });

  window.addEventListener('unhandledrejection', function(event) {
    logError(event.reason || new Error('Unhandled Promise Rejection'), 'Unhandled Promise');
  });
}

/**
 * Initialize console overrides to send logs to backend
 * Enhances console logging with backend integration
 */
function initializeConsoleOverrides() {
  // Override console.log to also send to backend
  console.log = function(...args) {
    // Call original console.log
    originalConsoleLog.apply(console, args);
        
    // Send to backend
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
        
    fetch('/log-console', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        type: 'log',
        timestamp: new Date().toISOString()
      })
    }).catch(() => {}); // Silent fail to avoid recursion
  };

  // Override other console methods (currently just pass through to original)
  console.error = function(...args) {
    originalConsole.error.apply(console, args);
  };

  console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
  };

  console.info = function(...args) {
    originalConsole.info.apply(console, args);
  };
}

/**
 * Initialize all utilities
 * Call this function to set up error handling and console overrides
 */
function initializeUtilities() {
  initializeErrorHandlers();
  initializeConsoleOverrides();
  console.log('Utilities module initialized');
}

// Auto-initialize when this module loads
initializeUtilities();

// Export functions for use by other modules (ES6 Module exports)
export {
  logError,
  initializeErrorHandlers,
  initializeConsoleOverrides,
  initializeUtilities,
  originalConsole
};