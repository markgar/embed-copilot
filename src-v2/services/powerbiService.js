/**
 * PowerBI Service - Comprehensive Power BI functionality
 * 
 * Consolidates ALL Power BI related logic from:
 * - authentication.js (auth functions)
 * - embedConfigService.js (embed logic) 
 * - datasetMetadata.js (metadata logic)
 * 
 * Integrates with cacheService for metadata caching and
 * errorService for consistent error handling.
 */

const { configService } = require('./configService');
const cacheService = require('./cacheService');
const errorService = require('./errorService');
const msal = require("@azure/msal-node");
const fetch = require('node-fetch');

class PowerBIService {
    constructor(config = null) {
        this.config = config || configService.loadConfig();
    }

    /**
     * Get access token using Service Principal authentication
     * @returns {Promise<Object>} Token response from MSAL
     */
    async getAccessToken() {
        const msalConfig = {
            auth: {
                clientId: this.config.clientId,
                authority: `${this.config.authorityUrl}${this.config.tenantId}`,
                clientSecret: this.config.clientSecret
            }
        };

        // Service Principal auth is the recommended by Microsoft to achieve App Owns Data Power BI embedding
        const clientApplication = new msal.ConfidentialClientApplication(msalConfig);

        const clientCredentialRequest = {
            scopes: [this.config.scopeBase],
        };

        return clientApplication.acquireTokenByClientCredential(clientCredentialRequest);
    }

    /**
     * Get request headers with authentication
     * @returns {Promise<Object>} Headers object with authorization
     */
    async getRequestHeader() {
        try {
            const tokenResponse = await this.getAccessToken();
            const token = tokenResponse.accessToken;
            
            return {
                'Content-Type': "application/json",
                'Authorization': `Bearer ${token}`
            };
        } catch (err) {
            let errorResponse;
            if (err.hasOwnProperty('error_description') && err.hasOwnProperty('error')) {
                errorResponse = err.error_description;
            } else {
                errorResponse = err.toString();
            }
            
            throw new Error(`Authentication failed: ${errorResponse}`);
        }
    }

    /**
     * Generate embed token and embed URLs for reports
     * @returns {Promise<Object>} Embed details with token, URL, and expiry
     */
    async getEmbedInfo() {
        try {
            // Get report details and embed token
            const embedParams = await this.getEmbedParamsForSingleReport(
                this.config.powerBIGroupId, 
                this.config.powerBIReportId
            );

            return {
                'accessToken': embedParams.embedToken.token,
                'embedUrl': embedParams.reportsDetail,
                'expiry': embedParams.embedToken.expiration,
                'status': 200
            };
        } catch (err) {
            // Handle fetch response errors
            if (err.json) {
                const errorBody = JSON.stringify(await err.json());
                return {
                    'status': err.status,
                    'error': `Error while retrieving report embed details\r\nStatus: ${err.status + ' ' + err.statusText}\r\nResponse: ${errorBody}\r\nRequestId: \n${err.headers.get('requestid')}`
                };
            }
            
            // Handle other errors
            throw err;
        }
    }

    /**
     * Get embed params for a single report
     * @param {string} workspaceId - Power BI workspace ID
     * @param {string} reportId - Power BI report ID
     * @param {string} additionalDatasetId - Optional additional dataset ID
     * @returns {Promise<Object>} Embed configuration object
     */
    async getEmbedParamsForSingleReport(workspaceId, reportId, additionalDatasetId) {
        const reportInGroupApi = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;
        const headers = await this.getRequestHeader();

        // Get report info by calling the PowerBI REST API
        const result = await fetch(reportInGroupApi, {
            method: 'GET',
            headers: headers,
        });

        if (!result.ok) {
            throw result;
        }

        // Convert result in json to retrieve values
        const resultJson = await result.json();

        // Add report data for embedding
        const reportDetails = {
            id: resultJson.id,
            name: resultJson.name,
            embedUrl: resultJson.embedUrl
        };

        // Create list of datasets
        let datasetIds = [resultJson.datasetId];

        // Append additional dataset to the list to achieve dynamic binding later
        if (additionalDatasetId) {
            datasetIds.push(additionalDatasetId);
        }

        // Get Embed token for resources
        const embedToken = await this.getEmbedTokenForSingleReport(reportId, datasetIds, workspaceId);
        
        return {
            reportsDetail: [reportDetails],
            embedToken: embedToken
        };
    }

    /**
     * Get embed token for single report and datasets
     * @param {string} reportId - Report ID
     * @param {Array<string>} datasetIds - Array of dataset IDs
     * @param {string} targetWorkspaceId - Target workspace ID
     * @returns {Promise<Object>} Embed token response
     */
    async getEmbedTokenForSingleReport(reportId, datasetIds, targetWorkspaceId) {
        // Add report id in the request
        let formData = {
            'reports': [{
                'id': reportId,
                'allowEdit': true  // Enable edit mode for the report
            }]
        };

        // Add dataset ids in the request
        formData['datasets'] = [];
        for (const datasetId of datasetIds) {
            formData['datasets'].push({
                'id': datasetId
            });
        }

        // Add targetWorkspace id in the request
        if (targetWorkspaceId) {
            formData['targetWorkspaces'] = [];
            formData['targetWorkspaces'].push({
                'id': targetWorkspaceId
            });
        }

        const embedTokenApi = "https://api.powerbi.com/v1.0/myorg/GenerateToken";
        const headers = await this.getRequestHeader();

        // Generate Embed token for single report, workspace, and multiple datasets
        const result = await fetch(embedTokenApi, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(formData)
        });

        if (!result.ok) {
            throw result;
        }
        
        return result.json();
    }

    /**
     * Get dataset ID from report ID (for cases where dataset ID is not directly configured)
     * @param {string} groupId - Power BI group/workspace ID
     * @param {string} reportId - Power BI report ID
     * @returns {Promise<string>} Dataset ID
     */
    async getDatasetIdFromReport(groupId, reportId) {
        const reportInGroupApi = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports/${reportId}`;
        const headers = await this.getRequestHeader();

        const result = await fetch(reportInGroupApi, {
            method: 'GET',
            headers: headers,
        });

        if (!result.ok) {
            throw new Error(`Failed to get report details: ${result.status} ${result.statusText}`);
        }

        const resultJson = await result.json();
        return resultJson.datasetId;
    }

    /**
     * Get complete dataset metadata with caching
     * @param {string} groupId - Power BI group ID
     * @param {string} datasetId - Power BI dataset ID
     * @returns {Promise<Object>} Complete dataset metadata
     */
    async getDatasetMetadata(groupId, datasetId) {
        // Check cache first
        const cachedData = cacheService.getCachedMetadata();
        if (cachedData) {
            return cachedData;
        }

        // For now, return hardcoded metadata (as per current implementation)
        // In a real implementation, this would call Power BI REST API
        const metadata = await this.getHardcodedMetadata();
        
        // Cache the result
        cacheService.setCachedMetadata(metadata);
        
        return metadata;
    }

    /**
     * Get hardcoded metadata (current implementation)
     * @returns {Promise<Object>} Hardcoded dataset metadata
     */
    async getHardcodedMetadata() {
        const tables = [
            {
                name: "Sales",
                type: "fact",
                columns: [
                    { name: "TotalUnits", type: "number", description: "Total units sold" },
                    { name: "TotalSales", type: "currency", description: "Total sales amount" }
                ]
            },
            {
                name: "Time",
                type: "dimension",
                columns: [
                    { name: "Month", type: "date", description: "Month of the year" },
                    { name: "FiscalMonth", type: "text", description: "Fiscal month" },
                    { name: "FiscalYear", type: "number", description: "Fiscal year" },
                    { name: "Year", type: "number", description: "Calendar year" },
                    { name: "Quarter", type: "text", description: "Calendar quarter" },
                    { name: "Day", type: "date", description: "Day of the month" }
                ]
            },
            {
                name: "District",
                type: "dimension",
                columns: [
                    { name: "District", type: "text", description: "Sales district name" },
                    { name: "DM", type: "text", description: "District Manager" }
                ]
            },
            {
                name: "Item",
                type: "dimension",
                columns: [
                    { name: "Category", type: "text", description: "Product category" },
                    { name: "Segment", type: "text", description: "Product segment classification" },
                    { name: "Buyer", type: "text", description: "Product buyer" },
                    { name: "FamilyName", type: "text", description: "Product family name" }
                ]
            },
            {
                name: "Store",
                type: "dimension",
                columns: [
                    { name: "Chain", type: "text", description: "Store chain name" },
                    { name: "City", type: "text", description: "Store city location" },
                    { name: "Name", type: "text", description: "Store name" },
                    { name: "Store Type", type: "text", description: "Type of store" },
                    { name: "Territory", type: "geography", description: "Store territory" }
                ]
            }
        ];

        // Derive measures & dimensions arrays
        const measures = [
            { table: "Sales", name: "TotalSales", dataType: "currency", description: "Total sales amount" },
            { table: "Sales", name: "TotalUnits", dataType: "number", description: "Total units sold" }
        ];

        const dimensions = [
            { table: "Time", name: "Month", dataType: "date", description: "Month of the year" },
            { table: "Time", name: "FiscalMonth", dataType: "text", description: "Fiscal month" },
            { table: "Time", name: "FiscalYear", dataType: "number", description: "Fiscal year" },
            { table: "Time", name: "Year", dataType: "number", description: "Calendar year" },
            { table: "Time", name: "Quarter", dataType: "text", description: "Calendar quarter" },
            { table: "Time", name: "Day", dataType: "date", description: "Day of the month" },
            { table: "District", name: "District", dataType: "text", description: "Sales district name" },
            { table: "District", name: "DM", dataType: "text", description: "District Manager" },
            { table: "Item", name: "Category", dataType: "text", description: "Product category" },
            { table: "Item", name: "Segment", dataType: "text", description: "Product segment classification" },
            { table: "Item", name: "Buyer", dataType: "text", description: "Product buyer" },
            { table: "Item", name: "FamilyName", dataType: "text", description: "Product family name" },
            { table: "Store", name: "Chain", dataType: "text", description: "Store chain name" },
            { table: "Store", name: "City", dataType: "text", description: "Store city location" },
            { table: "Store", name: "Name", dataType: "text", description: "Store name" },
            { table: "Store", name: "Store Type", dataType: "text", description: "Type of store" },
            { table: "Store", name: "Territory", dataType: "geography", description: "Store territory" }
        ];

        return {
            dataset: { name: "Store Sales" },
            lastUpdated: new Date().toISOString(),
            tables,
            measures,
            dimensions
        };
    }

    /**
     * Get simplified metadata for AI prompts
     * @param {string} groupId - Power BI group ID
     * @param {string} datasetId - Power BI dataset ID
     * @returns {Promise<string>} Simplified metadata as formatted text
     */
    async getSimplifiedMetadata(groupId, datasetId) {
        const metadata = await this.getDatasetMetadata(groupId, datasetId);
        
        let result = `Dataset: ${metadata.dataset?.name || 'Unknown'}\nLast Updated: ${metadata.lastUpdated}\n\nTables:\n`;

        for (const table of metadata.tables) {
            result += `- ${table.name} (${table.type}):\n`;
            for (const column of table.columns) {
                result += `  - ${column.name} (${column.type}): ${column.description}\n`;
            }
        }

        if (metadata.measures?.length) {
            result += `\nMeasures:\n`;
            for (const m of metadata.measures) {
                result += `- ${m.name} (table: ${m.table}, type: ${m.dataType}): ${m.description}\n`;
            }
        }

        if (metadata.dimensions?.length) {
            result += `\nDimensions:\n`;
            for (const d of metadata.dimensions) {
                result += `- ${d.name} (table: ${d.table}, type: ${d.dataType}): ${d.description}\n`;
            }
        }

        return result;
    }

    /**
     * Get schema in name-only format for LLM grounding
     * @param {string} groupId - Power BI group ID
     * @param {string} datasetId - Power BI dataset ID
     * @returns {Promise<string>} Schema as table.column [type] format
     */
    async getNameOnlySchema(groupId, datasetId) {
        const metadata = await this.getDatasetMetadata(groupId, datasetId);
        const lines = [];
        
        for (const table of metadata.tables) {
            for (const col of table.columns) {
                lines.push(`${table.name}.${col.name} [${col.type}]`);
            }
        }
        
        return lines.join('\n');
    }
}

module.exports = PowerBIService;