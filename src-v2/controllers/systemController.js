const errorService = require('../services/errorService');
const configService = require('../services/configService');
const EmbedController = require('./embedController');
const MetadataController = require('./metadataController');
const ChatController = require('./chatController');

/**
 * System Controller - Handles system-wide operations
 * Health checks, logging, and service status
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

  /**
     * Frontend configuration endpoint
     * GET /system/config
     */
  static getFrontendConfig(req, res) {
    try {
      const config = configService.loadConfig();
      
      // Only send frontend-safe configuration
      const frontendConfig = {
        powerBIWorkspaceId: config.powerBIWorkspaceId,
        powerBIDatasetId: config.powerBIDatasetId
      };

      res.json(frontendConfig);
    } catch (error) {
      console.error('[SystemController] Frontend config error:', error);
      errorService.sendError(res, 500, 'Failed to get frontend config', error.message);
    }
  }
}

module.exports = SystemController;