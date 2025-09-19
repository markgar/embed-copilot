// Routes for src-v2 architecture using service layer
const path = require('path');
const PowerBIService = require('../services/powerbiService');
const { configService } = require('../services/configService');
const errorService = require('../services/errorService');
const utils = require('../../src/utils'); // Reuse existing validation utilities

module.exports = function mountRoutes(app) {
  // Basic route for testing
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../views/chartchat.html'));
  });

  // Keep the /chartchat route for backwards compatibility
  app.get('/chartchat', (req, res) => {
    res.sendFile(path.join(__dirname, '../../views/chartchat.html'));
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: 'src-v2', timestamp: new Date().toISOString() });
  });

  // Embed token endpoint using PowerBI service
  app.get('/getEmbedToken', async (req, res) => {
    try {
      // Validate configuration first
      const configCheckResult = utils.validateConfig();
      if (configCheckResult) {
        return res.status(400).send({ error: configCheckResult });
      }

      // Use PowerBI service to get embed info
      const powerbiService = new PowerBIService();
      const result = await powerbiService.getEmbedInfo();
      
      res.status(result.status).send(result);
    } catch (error) {
      console.error('[app] Embed token error:', error);
      res.status(500).json({ error: 'Failed to get embed token' });
    }
  });

  // Dataset metadata endpoint using PowerBI service
  app.get('/getDatasetMetadata', async (req, res) => {
    try {
      const config = configService.loadConfig();
      const powerbiService = new PowerBIService(config);
      
      const groupId = config.powerBIGroupId || req.query.groupId;
      let datasetId = config.powerBIDatasetId || req.query.datasetId;
      
      if (!groupId) {
        return res.status(400).json({ error: 'groupId is required.' });
      }
      
      // If datasetId not provided but reportId is available, derive it
      if (!datasetId && config.powerBIReportId) {
        try {
          datasetId = await powerbiService.getDatasetIdFromReport(groupId, config.powerBIReportId);
        } catch (err) {
          return res.status(400).json({ 
            error: 'Could not determine dataset ID', 
            details: err.message 
          });
        }
      }
      
      if (!datasetId) {
        return res.status(400).json({ error: 'datasetId is required.' });
      }
      
      // Get metadata using PowerBI service (includes caching)
      const metadata = await powerbiService.getDatasetMetadata(groupId, datasetId);
      res.json(metadata);
      
    } catch (error) {
      console.error('[app] Metadata error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch dataset metadata', 
        details: error.message 
      });
    }
  });

};