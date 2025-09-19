const telemetry = require('../../src/telemetry');
const errorService = require('../services/errorService');
const EmbedController = require('./embedController');
const MetadataController = require('./metadataController');
const ChatController = require('./chatController');

/**
 * System Controller - Handles system-wide operations
 * Health checks, telemetry control, logging, and service status
 */
class SystemController {
    /**
     * Main health check endpoint
     * GET /health
     */
    static async healthCheck(req, res) {
        try {
            res.json({
                status: 'ok',
                version: 'src-v2',
                architecture: 'service-integration',
                timestamp: new Date().toISOString(),
                services: {
                    embed: 'use /health/embed for details',
                    metadata: 'use /health/metadata for details', 
                    chat: 'use /health/chat for details'
                }
            });
        } catch (error) {
            console.error('[SystemController] Health check error:', error);
            res.json({
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Comprehensive health check for all services
     * GET /health/detailed
     */
    static async detailedHealthCheck(req, res) {
        try {
            // Mock requests/responses for individual service health checks
            const mockReq = {};
            const services = {};

            // Check embed service
            let embedStatus;
            const embedRes = {
                json: (data) => { embedStatus = data; }
            };
            await EmbedController.healthCheck(mockReq, embedRes);

            // Check metadata service
            let metadataStatus;
            const metadataRes = {
                json: (data) => { metadataStatus = data; }
            };
            await MetadataController.healthCheck(mockReq, metadataRes);

            // Check chat service
            let chatStatus;
            const chatRes = {
                json: (data) => { chatStatus = data; }
            };
            await ChatController.healthCheck(mockReq, chatRes);

            // Aggregate status
            const allOk = embedStatus.status === 'ok' && 
                         metadataStatus.status === 'ok' && 
                         chatStatus.status === 'ok';

            res.json({
                status: allOk ? 'ok' : 'degraded',
                version: 'src-v2',
                architecture: 'service-integration',
                services: {
                    embed: embedStatus,
                    metadata: metadataStatus,
                    chat: chatStatus
                },
                telemetry: {
                    enabled: telemetry.enabled,
                    console: telemetry.console
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('[SystemController] Detailed health check error:', error);
            res.json({
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Client error logging
     * POST /log-error
     */
    static logError(req, res) {
        try {
            const { error } = req.body;
            console.error('[CLIENT]', error);
            res.json({ success: true });
        } catch (err) {
            console.error('[SystemController] Log error failed:', err);
            errorService.sendError(res, 500, 'Failed to log error');
        }
    }

    /**
     * Client console logging
     * POST /log-console
     */
    static logConsole(req, res) {
        try {
            const { message } = req.body;
            console.log('[CLIENT]', message);
            res.json({ success: true });
        } catch (err) {
            console.error('[SystemController] Log console failed:', err);
            errorService.sendError(res, 500, 'Failed to log message');
        }
    }

    /**
     * Telemetry control
     * POST /telemetry-control
     * Body: { action: 'enable' | 'disable' | 'status' | 'clear' }
     */
    static telemetryControl(req, res) {
        try {
            const { action } = req.body;
            
            switch (action) {
                case 'enable':
                    process.env.TELEMETRY_MODE = 'true';
                    process.env.TELEMETRY_CONSOLE = 'true';
                    telemetry.enabled = true;
                    telemetry.console = true;
                    res.json({ success: true, message: 'Telemetry enabled' });
                    break;

                case 'disable':
                    process.env.TELEMETRY_MODE = 'false';
                    process.env.TELEMETRY_CONSOLE = 'false';
                    telemetry.enabled = false;
                    telemetry.console = false;
                    res.json({ success: true, message: 'Telemetry disabled' });
                    break;

                case 'status':
                    res.json({
                        enabled: telemetry.enabled,
                        console: telemetry.console,
                        env_telemetry: process.env.TELEMETRY_MODE,
                        env_console: process.env.TELEMETRY_CONSOLE
                    });
                    break;

                case 'clear':
                    telemetry.clearLogs();
                    res.json({ success: true, message: 'Telemetry logs cleared' });
                    break;

                default:
                    return errorService.sendError(res, 400, 'Invalid action. Use enable, disable, status, or clear');
            }
        } catch (error) {
            console.error('[SystemController] Telemetry control error:', error);
            errorService.sendError(res, 500, 'Failed to control telemetry', error.message);
        }
    }

    /**
     * Get telemetry logs
     * GET /telemetry/logs
     */
    static getTelemetryLogs(req, res) {
        try {
            const logs = telemetry.readLogs();
            res.json({
                count: logs.length,
                logs: logs,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('[SystemController] Get telemetry logs error:', error);
            errorService.sendError(res, 500, 'Failed to read telemetry logs', error.message);
        }
    }

    /**
     * System information endpoint
     * GET /system/info
     */
    static getSystemInfo(req, res) {
        try {
            res.json({
                version: 'src-v2',
                architecture: 'service-integration',
                node_version: process.version,
                environment: process.env.NODE_ENV || 'development',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('[SystemController] System info error:', error);
            errorService.sendError(res, 500, 'Failed to get system info', error.message);
        }
    }
}

module.exports = SystemController;