const configService = require('../services/configService');
const errorService = require('../services/errorService');

/**
 * Metadata Controller - Handles Power BI dataset metadata retrieval
 * Thin wrapper around PowerBI service methods with caching support
 */
class MetadataController {
  constructor(powerbiService) {
    if (!powerbiService) {
      throw new Error('powerbiService is required');
    }
    this.powerbiService = powerbiService;
  }

  /**
   * Get dataset metadata with caching
   * GET /getDatasetMetadata?groupId=...&datasetId=...
   */
  async getDatasetMetadata(req, res) {
    try {
      const config = configService.loadConfig();
            
      // Get groupId from config or query parameters
      const groupId = config.powerBIGroupId || req.query.groupId;
      let datasetId = config.powerBIDatasetId || req.query.datasetId;
            
      // Validate required parameters
      if (!groupId) {
        return errorService.sendError(res, 400, 'groupId is required');
      }
            
      // If datasetId not provided but reportId is available, derive it
      if (!datasetId && config.powerBIReportId) {
        try {
          datasetId = await this.powerbiService.getDatasetIdFromReport(groupId, config.powerBIReportId);
        } catch (err) {
          return errorService.sendError(res, 400, 'Could not determine dataset ID', err.message);
        }
      }
            
      if (!datasetId) {
        return errorService.sendError(res, 400, 'datasetId is required');
      }
            
      // Get metadata using PowerBI service (includes automatic caching)
      const metadata = await this.powerbiService.getDatasetMetadata(groupId, datasetId);
      res.json(metadata);
            
    } catch (error) {
      console.error('[MetadataController] Metadata error:', error);
      errorService.sendError(res, 500, 'Failed to fetch dataset metadata', error.message);
    }
  }

  /**
   * Get simplified metadata for AI prompts
   * GET /getSimplifiedMetadata?groupId=...&datasetId=...
   */
  async getSimplifiedMetadata(req, res) {
    try {
      const config = configService.loadConfig();
            
      const groupId = config.powerBIGroupId || req.query.groupId;
      let datasetId = config.powerBIDatasetId || req.query.datasetId;
            
      if (!groupId) {
        return errorService.sendError(res, 400, 'groupId is required');
      }
            
      if (!datasetId && config.powerBIReportId) {
        try {
          datasetId = await this.powerbiService.getDatasetIdFromReport(groupId, config.powerBIReportId);
        } catch (err) {
          return errorService.sendError(res, 400, 'Could not determine dataset ID', err.message);
        }
      }
            
      if (!datasetId) {
        return errorService.sendError(res, 400, 'datasetId is required');
      }
            
      // Get simplified metadata for AI context
      const simplifiedMetadata = await this.powerbiService.getSimplifiedMetadata(groupId, datasetId);
            
      res.setHeader('Content-Type', 'text/plain');
      res.send(simplifiedMetadata);
            
    } catch (error) {
      console.error('[MetadataController] Simplified metadata error:', error);
      errorService.sendError(res, 500, 'Failed to fetch simplified metadata', error.message);
    }
  }

  /**
   * Get name-only schema for LLM grounding
   * GET /getNameOnlySchema?groupId=...&datasetId=...
   */
  async getNameOnlySchema(req, res) {
    try {
      const config = configService.loadConfig();
            
      const groupId = config.powerBIGroupId || req.query.groupId;
      let datasetId = config.powerBIDatasetId || req.query.datasetId;
            
      if (!groupId) {
        return errorService.sendError(res, 400, 'groupId is required');
      }
            
      if (!datasetId && config.powerBIReportId) {
        try {
          datasetId = await this.powerbiService.getDatasetIdFromReport(groupId, config.powerBIReportId);
        } catch (err) {
          return errorService.sendError(res, 400, 'Could not determine dataset ID', err.message);
        }
      }
            
      if (!datasetId) {
        return errorService.sendError(res, 400, 'datasetId is required');
      }
            
      // Get name-only schema for LLM context
      const schema = await this.powerbiService.getNameOnlySchema(groupId, datasetId);
            
      res.setHeader('Content-Type', 'text/plain');
      res.send(schema);
            
    } catch (error) {
      console.error('[MetadataController] Schema error:', error);
      errorService.sendError(res, 500, 'Failed to fetch schema', error.message);
    }
  }

  /**
   * Health check for metadata functionality
   */
  async healthCheck(req, res) {
    try {
      const config = configService.loadConfig();
            
      // Basic validation
      if (!config.powerBIGroupId) {
        return res.json({
          status: 'error',
          service: 'metadata',
          message: 'Missing powerBIGroupId configuration',
          timestamp: new Date().toISOString()
        });
      }

      // PowerBI service already instantiated via DI
      res.json({
        status: 'ok',
        service: 'metadata',
        message: 'Metadata service ready',
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      console.error('[MetadataController] Health check error:', error);
      res.json({
        status: 'error',
        service: 'metadata',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }


}

module.exports = MetadataController;