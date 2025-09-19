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
    
    // Create enhanced config with environment fallbacks
    return {
        ...config,
        tenantId: getValue(config.tenantId, 'TENANT_ID'),
        clientId: getValue(config.clientId, 'CLIENT_ID'),
        clientSecret: getValue(config.clientSecret, 'CLIENT_SECRET'),
        
        powerBIWorkspaceId: getValue(config.powerBIWorkspaceId, 'POWERBI_WORKSPACE_ID'),
        powerBIReportId: getValue(config.powerBIReportId, 'POWERBI_REPORT_ID'),
        powerBIGroupId: getValue(config.powerBIGroupId, 'POWERBI_GROUP_ID'),
        powerBIDatasetId: getValue(config.powerBIDatasetId, 'POWERBI_DATASET_ID'),
        
        azureOpenAIEndpoint: getValue(config.azureOpenAIEndpoint, 'AZURE_OPENAI_ENDPOINT'),
        azureOpenAIApiKey: getValue(config.azureOpenAIApiKey, 'AZURE_OPENAI_API_KEY'),
        azureOpenAIDeploymentName: getValue(config.azureOpenAIDeploymentName, 'AZURE_OPENAI_DEPLOYMENT_NAME'),
        azureOpenAIApiVersion: getValue(config.azureOpenAIApiVersion, 'AZURE_OPENAI_API_VERSION')
    };
}

module.exports = { loadConfig };