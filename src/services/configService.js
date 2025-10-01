// Load environment variables once at startup
require('dotenv').config();

// Constants
const METADATA_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Simple, clean configuration - loaded once, no complex caching
const config = {
  // PowerBI Configuration
  tenantId: process.env.TENANT_ID,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
    
  // Support both property names for backwards compatibility
  powerBIGroupId: process.env.POWERBI_GROUP_ID || process.env.POWERBI_WORKSPACE_ID,
  powerBIWorkspaceId: process.env.POWERBI_WORKSPACE_ID || process.env.POWERBI_GROUP_ID,
  powerBIDatasetId: process.env.POWERBI_DATASET_ID,
    
  // Azure OpenAI Configuration
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-12-01-preview',
    
  // Other configuration
  authorityUrl: 'https://login.microsoftonline.com/',
  scopeBase: 'https://analysis.windows.net/powerbi/api/.default',
  powerBiApiUrl: 'https://api.powerbi.com/',
    
  // Server configuration
  port: process.env.PORT || 5300
};

function loadConfig() {
  return config;
}

/**
 * Validate configuration to ensure all required fields are present and valid
 * @param {Object} [config] - Optional config object to validate (defaults to loadConfig())
 * @returns {string|null} Error message if validation fails, null if valid
 */
function validateConfig(config = null) {
  if (!config) {
    config = loadConfig();
  }

  const guid = require('guid');

  if (!config.clientId) {
    return 'ClientId is empty. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.';
  }

  if (!guid.isGuid(config.clientId)) {
    return 'ClientId must be a Guid object. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.';
  }



  if (!config.powerBIGroupId) {
    return 'WorkspaceId is empty. Please select a group you own and fill its Id in config.json.';
  }

  if (!guid.isGuid(config.powerBIGroupId)) {
    return 'WorkspaceId must be a Guid object. Please select a workspace you own and fill its Id in config.json.';
  }

  if (!config.authorityUrl) {
    return 'AuthorityUrl is empty. Please fill valid AuthorityUrl in config.json.';
  }

  // Service Principal validation
  if (!config.clientSecret || !config.clientSecret.trim()) {
    return 'ClientSecret is empty. Please fill Power BI ServicePrincipal ClientSecret in config.json.';
  }

  if (!config.tenantId) {
    return 'TenantId is empty. Please fill the TenantId in config.json.';
  }

  if (!guid.isGuid(config.tenantId)) {
    return 'TenantId must be a Guid object. Please select a workspace you own and fill its Id in config.json.';
  }

  return null; // No validation errors
}

module.exports = { 
  loadConfig,
  validateConfig,
  constants: {
    METADATA_CACHE_DURATION
  }
};