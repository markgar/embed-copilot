/**
 * React Logging Utilities
 * Sends console logs and errors to the server for easier debugging
 */

/* eslint-disable no-console, no-undef */

/**
 * Send a log message to the server
 * @param {string} message - Message to log
 * @param {string} type - Type of log (log, error, warn)
 */
export const logToServer = async (message, type = 'log') => {
  try {
    await fetch(`/log-${type === 'error' ? 'error' : 'console'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: typeof message === 'object' ? JSON.stringify(message, null, 2) : String(message),
        type: type,
        timestamp: new Date().toISOString()
      })
    })
  } catch (err) {
    // Silent fail to avoid recursion
    console.error('Failed to send log to server:', err)
  }
}

/**
 * Log error to server
 * @param {Error|string} error - Error to log
 * @param {string} context - Context where error occurred
 */
export const logErrorToServer = async (error, context = 'React App') => {
  const errorDetails = {
    message: error.message || error,
    stack: error.stack || 'No stack trace',
    name: error.name || 'Unknown error type'
  }

  try {
    await fetch('/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: errorDetails,
        context: context,
        timestamp: new Date().toISOString()
      })
    })
  } catch (err) {
    console.error('Failed to send error to server:', err)
  }
}

/**
 * Enhanced console.log that also sends to server
 * @param {...any} args - Arguments to log
 */
export const serverLog = (...args) => {
  // Log to browser console
  console.log(...args)
  
  // Send to server
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')
  
  logToServer(message, 'log')
}