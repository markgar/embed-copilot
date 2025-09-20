/**
 * Debug Server - Minimal Express server for debugging issues
 * 
 * Purpose: Isolate server crashes and test Express components incrementally
 * Usage: node tools/debug-server.js
 * 
 * This script was created during v2 migration debugging to isolate
 * what appeared to be server crashes but were actually VS Code terminal
 * signal handling issues. Keep for future debugging needs.
 */

const express = require('express');
const path = require('path');

console.log('🔧 [DEBUG-SERVER] Starting minimal Express server...');

// Comprehensive error handling
process.on('uncaughtException', (err) => {
    console.error('🚨 [DEBUG-SERVER] Uncaught Exception:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 [DEBUG-SERVER] Unhandled Rejection:', reason);
    process.exit(1);
});

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`📨 [DEBUG-SERVER] ${req.method} ${req.path}`);
    next();
});

// Test routes
app.get('/test', (req, res) => {
    console.log('✅ Basic GET route working');
    res.json({ 
        status: 'ok', 
        message: 'Debug server working',
        timestamp: new Date().toISOString()
    });
});

app.post('/test', (req, res) => {
    console.log('✅ POST route working, body:', req.body);
    res.json({ 
        status: 'ok', 
        message: 'POST test working',
        received: req.body,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', server: 'debug-server' });
});

const port = process.env.DEBUG_PORT || 5301;

const server = app.listen(port, () => {
    console.log(`✅ [DEBUG-SERVER] Listening on port ${port}`);
    console.log(`   Test endpoints:`);
    console.log(`   GET  http://localhost:${port}/test`);
    console.log(`   POST http://localhost:${port}/test`);
    console.log(`   GET  http://localhost:${port}/health`);
});

server.on('error', (err) => {
    console.error('🚨 [DEBUG-SERVER] Server error:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 [DEBUG-SERVER] SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('📴 [DEBUG-SERVER] Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📴 [DEBUG-SERVER] SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('📴 [DEBUG-SERVER] Process terminated');
        process.exit(0);
    });
});