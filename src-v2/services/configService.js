const fs = require('fs');
const path = require('path');

// Load environment variables if .env exists
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

// Constants (extracted from global usage patterns)
const METADATA_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function loadConfig() {
    const config = require('../../config/config.json');
    
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

/**
 * Validate configuration to ensure all required fields are present and valid
 * @param {Object} [config] - Optional config object to validate (defaults to loadConfig())
 * @returns {string|null} Error message if validation fails, null if valid
 */
function validateConfig(config = null) {
    if (!config) {
        config = loadConfig();
    }

    const guid = require("guid");

    if (!config.clientId) {
        return "ClientId is empty. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.";
    }

    if (!guid.isGuid(config.clientId)) {
        return "ClientId must be a Guid object. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.";
    }

    if (!config.powerBIReportId) {
        return "ReportId is empty. Please select a report you own and fill its Id in config.json.";
    }

    if (!guid.isGuid(config.powerBIReportId)) {
        return "ReportId must be a Guid object. Please select a report you own and fill its Id in config.json.";
    }

    if (!config.powerBIGroupId) {
        return "WorkspaceId is empty. Please select a group you own and fill its Id in config.json.";
    }

    if (!guid.isGuid(config.powerBIGroupId)) {
        return "WorkspaceId must be a Guid object. Please select a workspace you own and fill its Id in config.json.";
    }

    if (!config.authorityUrl) {
        return "AuthorityUrl is empty. Please fill valid AuthorityUrl in config.json.";
    }

    // Service Principal validation
    if (!config.clientSecret || !config.clientSecret.trim()) {
        return "ClientSecret is empty. Please fill Power BI ServicePrincipal ClientSecret in config.json.";
    }

    if (!config.tenantId) {
        return "TenantId is empty. Please fill the TenantId in config.json.";
    }

    if (!guid.isGuid(config.tenantId)) {
        return "TenantId must be a Guid object. Please select a workspace you own and fill its Id in config.json.";
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