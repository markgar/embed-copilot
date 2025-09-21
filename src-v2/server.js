// Server entry point for refactored src-v2 architecture
// Service Integration Architecture: orchestrates Power BI and OpenAI APIs

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
let server;

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

const app = require('./app');
const { validateConfig } = require('./services/configService');
const port = process.env.PORT || 5300;

// Initialize services on startup
console.log('[server] Starting embed-copilot server (src-v2 architecture)...');
console.log('[server] Service Integration Architecture: PowerBI + OpenAI orchestration');

// Validate configuration on startup
console.log('[server] Validating configuration...');
const configError = validateConfig();
if (configError) {
    console.error('🚨 [FATAL] Configuration Error:', configError);
    console.error('Please check your .env file or config/config.json');
    process.exit(1);
}
console.log('✅ [server] Configuration validated successfully');

server = app.listen(port, () => {
    console.log(`[server] Listening on port ${port}`);
    console.log(`[server] Architecture: src-v2 (Service Integration)`);
    console.log(`[server] Health check: http://localhost:${port}/health`);
    console.log(`[server] Main app: http://localhost:${port}/`);
    console.log('✅ [server] Graceful shutdown handlers installed');
});