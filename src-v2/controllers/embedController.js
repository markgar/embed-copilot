const PowerBIService = require('../services/powerbiService');
const errorService = require('../services/errorService');
const utils = require('../utils'); // Use v2 utils with configService

/**
 * Embed Controller - Handles Power BI embed token generation
 * Thin wrapper around PowerBI service methods
 */
class EmbedController {
    /**
     * Get embed token and configuration for Power BI reports
     * GET /getEmbedToken
     */
    static async getEmbedToken(req, res) {
        try {
            // Validate configuration first using existing utils
            const configCheckResult = utils.validateConfig();
            if (configCheckResult) {
                return errorService.sendError(res, 400, configCheckResult);
            }

            // Use PowerBI service to get embed info
            const powerbiService = new PowerBIService();
            const result = await powerbiService.getEmbedInfo();
            
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
    static async healthCheck(req, res) {
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

            // Try to create PowerBI service instance
            const powerbiService = new PowerBIService();
            
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