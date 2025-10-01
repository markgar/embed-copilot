// Server entry point for Express application
// Service Integration Architecture: orchestrates Power BI and OpenAI APIs

const PORT = process.env.PORT || 5300;
const app = require('./app');

/* global setTimeout */

// Add global error handlers before requiring anything else
process.on('uncaughtException', (err) => {
  console.error('🚨 [FATAL] Uncaught Exception:', err);
  console.error('Stack trace:', err.stack);
    
  // Log to monitoring service if available
  // TODO: Add monitoring service integration
    
  // Perform graceful shutdown instead of immediate exit
  console.error('Attempting graceful shutdown...');
    
  // Give existing requests time to complete (max 10 seconds)
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
    
  // Close server gracefully if it exists
  if (server) {
    server.close(() => {
      console.error('HTTP server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [FATAL] Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
    
  // Log to monitoring service if available
  // TODO: Add monitoring service integration
    
  // Don't exit on unhandled rejections in production, just log them
  if (process.env.NODE_ENV === 'production') {
    console.error('Continuing execution in production mode');
  } else {
    // Exit in development for debugging
    process.exit(1);
  }
});

// Graceful shutdown handling
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('📝 [INFO] SIGTERM received, shutting down gracefully');
  gracefulShutdown();
});

process.on('SIGINT', () => {
  console.log('📝 [INFO] SIGINT received (Ctrl+C), shutting down gracefully');
  gracefulShutdown();
});

function gracefulShutdown() {
  if (server) {
    server.close(() => {
      console.log('✅ [INFO] HTTP server closed');
      process.exit(0);
    });
        
    // Force shutdown after 15 seconds
    setTimeout(() => {
      console.error('❌ [ERROR] Forced shutdown after timeout');
      process.exit(1);
    }, 15000);
  } else {
    process.exit(0);
  }
}

