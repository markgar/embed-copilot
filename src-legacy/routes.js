// Route handlers & shared state modularized from split/routes.js
const path = require('path');
const embedToken = require('./embedConfigService');
const utils = require('./utils');
const DatasetMetadataService = require('./datasetMetadata');
const fetch = require('node-fetch');
const { buildDynamicSystemPrompt } = require('./agent');
const { loadConfig } = require('./configLoader');
const telemetry = require('./telemetry');

// Shared state
let metadataService;
let cachedMetadata = null;
let metadataLastFetched = null;
const METADATA_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function initializeMetadataService() {
  try {
    const config = loadConfig();
    metadataService = new DatasetMetadataService(config);
    console.log('[app] Dataset metadata service initialized');
  } catch (error) {
    console.error('[app] Failed to initialize metadata service:', error);
  }
}

module.exports = function mountRoutes(app) {
  // Views - chartchat is now the default page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/chartchat.html'));
  });

  // Keep the /chartchat route for backwards compatibility
  app.get('/chartchat', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/chartchat.html'));
  });

  // Embed token
  app.get('/getEmbedToken', async (req, res) => {
    const configCheckResult = utils.validateConfig();
    if (configCheckResult) {
      return res.status(400).send({ error: configCheckResult });
    }
    try {
      const result = await embedToken.getEmbedInfo();
      res.status(result.status).send(result);
    } catch (e) {
      console.error('[app] Embed token error:', e);
      res.status(500).json({ error: 'Failed to get embed token' });
    }
  });

  // Metadata
  app.get('/getDatasetMetadata', async (req, res) => {
    try {
      const now = Date.now();
      if (cachedMetadata && metadataLastFetched && (now - metadataLastFetched) < METADATA_CACHE_DURATION) {
        return res.json(cachedMetadata);
      }
      // Metadata service is initialized on startup, no need to check again
      const config = loadConfig();
      const groupId = config.powerBIGroupId || req.query.groupId;
      let datasetId = config.powerBIDatasetId || req.query.datasetId;
      if (!groupId) return res.status(400).json({ error: 'groupId is required.' });
      if (!datasetId && config.powerBIReportId) {
        try {
          datasetId = await metadataService.getDatasetIdFromReport(groupId, config.powerBIReportId);
        } catch (err) {
          return res.status(400).json({ error: 'Could not determine dataset ID', details: err.message });
        }
      }
      if (!datasetId) return res.status(400).json({ error: 'datasetId is required.' });
      const metadata = await metadataService.getCompleteDatasetMetadata(groupId, datasetId);
      cachedMetadata = metadata;
      metadataLastFetched = now;
      res.json(metadata);
    } catch (error) {
      console.error('[app] Metadata error:', error);
      res.status(500).json({ error: 'Failed to fetch dataset metadata', details: error.message });
    }
  });

  // Debug metadata
  app.get('/debug/metadata', (req, res) => {
    try {
      if (!cachedMetadata) {
        return res.json({ status: 'no_cache', message: 'No metadata cached yet', cacheInfo: { lastFetched: metadataLastFetched, cacheAge: null } });
      }
      const now = Date.now();
      const cacheAge = metadataLastFetched ? now - metadataLastFetched : null;
      const isStale = cacheAge && cacheAge > METADATA_CACHE_DURATION;
      res.json({
        status: 'cached',
        cacheInfo: { lastFetched: new Date(metadataLastFetched).toISOString(), cacheAgeMs: cacheAge, isStale, cacheDurationMs: METADATA_CACHE_DURATION },
        dataset: cachedMetadata.dataset
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to get debug metadata' });
    }
  });

  // Chat
  app.post('/chat', async (req, res) => {
    try {
      const { message, currentChart, chatHistory } = req.body;
      if (!message) return res.status(400).json({ error: 'Message is required' });
      const config = loadConfig();
      const url = `${config.azureOpenAIEndpoint}openai/deployments/${config.azureOpenAIDeploymentName}/chat/completions?api-version=${config.azureOpenAIApiVersion}`;
      let metadata = null;
      try {
        // Metadata service is initialized on startup, no need to check again
        const now = Date.now();
        if (cachedMetadata && metadataLastFetched && (now - metadataLastFetched) < METADATA_CACHE_DURATION) {
          metadata = cachedMetadata;
        } else {
          // If no cached metadata, fetch it now for the chat
          const config = loadConfig();
          const groupId = config.powerBIGroupId;
          const datasetId = config.powerBIDatasetId;
          if (groupId && datasetId) {
            metadata = await metadataService.getCompleteDatasetMetadata(groupId, datasetId);
            cachedMetadata = metadata;
            metadataLastFetched = now;
          }
        }
      } catch (_) {}
      let systemContent = buildDynamicSystemPrompt(metadata, currentChart, chatHistory);
      if (currentChart && (currentChart.yAxis || currentChart.xAxis || currentChart.chartType)) {
        systemContent += `\nCURRENT CHART CONTEXT: ${JSON.stringify(currentChart)}`;
      }

      // Build the messages array with system prompt and current user message
      const messages = [
        { role: 'system', content: systemContent },
        { role: 'user', content: message }
      ];

      const requestBody = { messages: messages, max_tokens: 500, temperature: 0.7 };
      
      // Log OpenAI interaction for telemetry
      if (telemetry.enabled) {
        console.log('[Telemetry] OpenAI Request:', {
          url: url.replace(/api-key=[^&]+/, 'api-key=[REDACTED]'),
          messages: telemetry.sanitizeObject(messages),
          currentChart: telemetry.sanitizeObject(currentChart),
          hasMetadata: !!metadata
        });
      }
      
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': config.azureOpenAIApiKey }, body: JSON.stringify(requestBody) });
      if (!response.ok) throw new Error(`Azure OpenAI API error: ${response.status}`);
      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || '';
      
      // Log OpenAI response for telemetry
      if (telemetry.enabled) {
        console.log('[Telemetry] OpenAI Response:', {
          response: aiResponse,
          usage: data.usage
        });
      }
      
      res.json({ response: aiResponse });
    } catch (error) {
      console.error('[app] Chat error:', error);
      res.status(500).json({ error: 'Failed to get AI response', details: error.message });
    }
  });

    // Logging
  app.post('/log-error', (req, res) => {
    const { error } = req.body;
    console.error('[CLIENT]', error);
    res.json({ success: true });
  });

  app.post('/log-console', (req, res) => {
    const { message } = req.body;
    console.log('[CLIENT]', message);
    res.json({ success: true });
  });

  // Telemetry control endpoint
  app.post('/telemetry-control', (req, res) => {
    const { action } = req.body;
    
    if (action === 'enable') {
      process.env.TELEMETRY_MODE = 'true';
      process.env.TELEMETRY_CONSOLE = 'true';
      telemetry.enabled = true;
      telemetry.console = true;
      res.json({ success: true, message: 'Telemetry enabled' });
    } else if (action === 'disable') {
      process.env.TELEMETRY_MODE = 'false';
      process.env.TELEMETRY_CONSOLE = 'false';
      telemetry.enabled = false;
      telemetry.console = false;
      res.json({ success: true, message: 'Telemetry disabled' });
    } else if (action === 'status') {
      res.json({ 
        enabled: telemetry.enabled,
        console: telemetry.console,
        env_telemetry: process.env.TELEMETRY_MODE,
        env_console: process.env.TELEMETRY_CONSOLE
      });
    } else {
      res.status(400).json({ error: 'Invalid action. Use enable, disable, or status' });
    }
  });

  // Initialize metadata service on startup
  initializeMetadataService();
};
