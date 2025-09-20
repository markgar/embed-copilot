// Server entry point for refactored src-v2 architecture
// Service Integration Architecture: orchestrates Power BI and OpenAI APIs

// Add global error handlers before requiring anything else
process.on('uncaughtException', (err) => {
    console.error('🚨 [FATAL] Uncaught Exception:', err);
    console.error('Stack trace:', err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 [FATAL] Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    process.exit(1);
});

const app = require('./app');
const port = process.env.PORT || 5300;

// Initialize services on startup
console.log('[server] Starting embed-copilot server (src-v2 architecture)...');
console.log('[server] Service Integration Architecture: PowerBI + OpenAI orchestration');

app.listen(port, () => {
    console.log(`[server] Listening on port ${port}`);
    console.log(`[server] Architecture: src-v2 (Service Integration)`);
    console.log(`[server] Health check: http://localhost:${port}/health`);
    console.log(`[server] Main app: http://localhost:${port}/`);
});