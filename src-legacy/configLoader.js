const fs = require('fs');
const path = require('path');

// Load environment variables if .env exists
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

function loadConfig() {
    const config = require('../config/config.json');
    
    // Helper function to get value from config or environment
    const getValue = (configValue, envKey) => {
        return configValue && configValue.trim() !== '' ? configValue : process.env[envKey] || '';
    };
    
    // Get group ID from either property name (standardize on powerBIGroupId)
    const groupId = getValue(config.powerBIGroupId, 'POWERBI_GROUP_ID') || 
                   getValue(config.powerBIWorkspaceId, 'POWERBI_WORKSPACE_ID');
    
    // Create enhanced config with environment fallbacks
    const enhancedConfig = {
        ...config,
        tenantId: getValue(config.tenantId, 'TENANT_ID'),
        clientId: getValue(config.clientId, 'CLIENT_ID'),
        clientSecret: getValue(config.clientSecret, 'CLIENT_SECRET'),
        
        // Standardize on powerBIGroupId for internal use
        powerBIGroupId: groupId,
        powerBIReportId: getValue(config.powerBIReportId, 'POWERBI_REPORT_ID'),
        powerBIDatasetId: getValue(config.powerBIDatasetId, 'POWERBI_DATASET_ID'),
        
        azureOpenAIEndpoint: getValue(config.azureOpenAIEndpoint, 'AZURE_OPENAI_ENDPOINT'),
        azureOpenAIApiKey: getValue(config.azureOpenAIApiKey, 'AZURE_OPENAI_API_KEY'),
        azureOpenAIDeploymentName: getValue(config.azureOpenAIDeploymentName, 'AZURE_OPENAI_DEPLOYMENT_NAME'),
        azureOpenAIApiVersion: getValue(config.azureOpenAIApiVersion, 'AZURE_OPENAI_API_VERSION')
    };
    
    // Keep powerBIWorkspaceId for backwards compatibility but make it reference the same value
    enhancedConfig.powerBIWorkspaceId = groupId;
    
    return enhancedConfig;
}

module.exports = { loadConfig };