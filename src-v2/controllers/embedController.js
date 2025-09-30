const errorService = require('../services/errorService');
const utils = require('../utils'); // Use v2 utils with configService

/**
 * Embed Controller - Handles Power BI embed token generation
 * Thin wrapper around PowerBI service methods
 */
class EmbedController {
  constructor(powerbiService) {
    if (!powerbiService) {
      throw new Error('powerbiService is required');
    }
    this.powerbiService = powerbiService;
  }

  /**
   * Get embed token and configuration for Power BI reports
   * GET /getEmbedToken?reportId=<reportId>
   */
  async getEmbedToken(req, res) {
    try {
      // Get reportId from query parameters
      const { reportId } = req.query;
      
      if (!reportId) {
        return errorService.sendError(res, 400, 'reportId query parameter is required');
      }

      // Validate configuration (skip reportId check since we're using dynamic reportId)
      const configCheckResult = utils.validateConfigForDynamicReport();
      if (configCheckResult) {
        return errorService.sendError(res, 400, configCheckResult);
      }

      // Use PowerBI service to get embed info with dynamic reportId
      const result = await this.powerbiService.getEmbedInfo(reportId);
            
      // Send response with original status from service
      res.status(result.status).send(result);
            
    } catch (error) {
      console.error('[EmbedController] Embed token error:', error);
      errorService.sendError(res, 500, 'Failed to get embed token', error.message);
    }
  }

  /**
   * Health check for embed functionality
   * Can be used to verify PowerBI service configuration
   */
  async healthCheck(req, res) {
    try {
      // Check if configuration is valid
      const configCheckResult = utils.validateConfig();
      if (configCheckResult) {
        return res.json({
          status: 'error',
          service: 'embed',
          message: configCheckResult,
          timestamp: new Date().toISOString()
        });
      }

      // PowerBI service already instantiated via DI
      res.json({
        status: 'ok',
        service: 'embed',
        message: 'PowerBI service ready',
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      console.error('[EmbedController] Health check error:', error);
      res.json({
        status: 'error',
        service: 'embed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = EmbedController;