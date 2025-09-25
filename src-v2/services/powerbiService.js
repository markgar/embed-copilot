/**
 * PowerBI Service - Comprehensive Power BI functionality
 * 
 * Consolidates ALL Power BI related logic from:
 * - authentication.js (auth functions)
 * - embedConfigService.js (embed logic) 
 * - datasetMetadata.js (metadata logic)
 * 
 * Simplified architecture without caching complexity for demo applications.
 */

const configService = require('./configService');
const msal = require('@azure/msal-node');
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
            
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      return headers;
    } catch (err) {
      let errorResponse;
      if (Object.prototype.hasOwnProperty.call(err, 'error_description') && Object.prototype.hasOwnProperty.call(err, 'error')) {
        errorResponse = err.error_description;
      } else {
        errorResponse = err.toString();
      }
            
      throw new Error(`Authentication failed: ${errorResponse}`);
    }
  }

  /**
     * Generate embed token and embed URLs for reports
     * @param {string} reportId - The Power BI report ID (optional, falls back to config)
     * @returns {Promise<Object>} Embed details with token, URL, and expiry
     */
  async getEmbedInfo(reportId = null) {
    try {
      // Use provided reportId or fall back to config
      const targetReportId = reportId || this.config.powerBIReportId;
      
      if (!targetReportId) {
        throw new Error('No report ID provided and no default configured');
      }

      // Get report details and embed token
      const embedParams = await this.getEmbedParamsForSingleReport(
        this.config.powerBIGroupId, 
        targetReportId
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
    const datasetIds = [resultJson.datasetId];

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
    const formData = {
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

    const embedTokenApi = 'https://api.powerbi.com/v1.0/myorg/GenerateToken';
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
     * Fetches and transforms live dataset metadata using DAX queries.
     * @param {string} groupId The Power BI group ID.
     * @param {string} datasetId The Power BI dataset ID.
     * @returns {Promise<Object>} The structured dataset metadata.
     */
  async getMetadataWithDax(groupId, datasetId) {
    try {
      // Step 1: Get all tables
      const tablesQuery = 'EVALUATE INFO.VIEW.TABLES()';
      const tablesResult = await this._executeDaxQuery(groupId, datasetId, tablesQuery);
            
      // Step 2: Get all columns
      const columnsQuery = 'EVALUATE INFO.VIEW.COLUMNS()';
      const columnsResult = await this._executeDaxQuery(groupId, datasetId, columnsQuery);
            
      // Step 3: Get all measures
      const measuresQuery = 'EVALUATE INFO.VIEW.MEASURES()';
      const measuresResult = await this._executeDaxQuery(groupId, datasetId, measuresQuery);
            
      // Process tables and create a map for easy lookup
      const tablesMap = new Map();
      const visibleTables = [];
            
      if (tablesResult && tablesResult.tables && tablesResult.tables[0] && tablesResult.tables[0].rows) {
        tablesResult.tables[0].rows.forEach(row => {
          // Only include non-hidden, non-private tables
          if (!row['[IsHidden]'] && !row['[IsPrivate]']) {
            const table = {
              name: row['[Name]'] || 'Unknown',
              description: row['[Description]'] || '',
              type: row['[DataCategory]'] === 'Time' ? 'dimension' : 'dimension', // We'll refine this logic later
              columns: []
            };
            tablesMap.set(row['[Name]'], table);
            visibleTables.push(table);
          }
        });
      }
            
      // Process columns and add them to their respective tables
      const dimensions = [];
            
      if (columnsResult && columnsResult.tables && columnsResult.tables[0] && columnsResult.tables[0].rows) {
        columnsResult.tables[0].rows.forEach(row => {
          const tableName = row['[Table]'];
          const table = tablesMap.get(tableName);
                    
          if (table && !row['[IsHidden]']) { // Only include non-hidden columns from visible tables
            const column = {
              name: row['[Name]'],
              type: (row['[DataType]'] || 'text').toLowerCase(),
              description: row['[Description]'] || `${row['[Name]']} column from ${tableName} table`
            };
                        
            table.columns.push(column);
                        
            // Add to dimensions (we'll filter out measures later)
            dimensions.push({
              table: tableName,
              name: column.name,
              dataType: column.type,
              description: column.description
            });
          }
        });
      }
            
      // Process measures and add them to their respective tables
      const measures = [];
            
      if (measuresResult && measuresResult.tables && measuresResult.tables[0] && measuresResult.tables[0].rows) {
        measuresResult.tables[0].rows.forEach(row => {
          if (!row['[IsHidden]']) { // Only include non-hidden measures
            const tableName = row['[Table]'] || 'Unknown';
            const measure = {
              table: tableName,
              name: row['[Name]'],
              dataType: (row['[DataType]'] || 'number').toLowerCase(),
              description: row['[Description]'] || `${row['[Name]']} measure`
            };
            measures.push(measure);
                        
            // Add measure to its table (create table if it doesn't exist)
            let table = tablesMap.get(tableName);
            if (!table) {
              // Create a new table for measures that don't have a dimension table
              table = {
                name: tableName,
                description: `${tableName} measures`,
                type: 'measures',
                columns: []
              };
              tablesMap.set(tableName, table);
              visibleTables.push(table);
            }
                        
            // Add measure as a special column to the table
            table.columns.push({
              name: row['[Name]'],
              type: 'measure',
              dataType: (row['[DataType]'] || 'number').toLowerCase(),
              description: row['[Description]'] || `${row['[Name]']} measure`,
              isMeasure: true
            });
          }
        });
      }
            
      return {
        dataset: { name: 'Dynamic Dataset' },
        lastUpdated: new Date().toISOString(),
        tables: visibleTables,
        measures: measures,
        dimensions: dimensions
      };
            
    } catch (error) {
      console.error('Metadata query failed:', error.message);
      throw error;
    }
  }

  /**
     * Get complete dataset metadata with caching
     * @param {string} groupId - Power BI group ID
     * @param {string} datasetId - Power BI dataset ID
     * @returns {Promise<Object>} Complete dataset metadata
     */
  async getDatasetMetadata(groupId, datasetId) {
    try {
      const metadata = await this.getMetadataWithDax(groupId, datasetId);
      return metadata;
    } catch (error) {
      console.error('DAX metadata query failed:', error.message);
      throw error;
    }
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
      result += '\nMeasures:\n';
      for (const m of metadata.measures) {
        result += `- ${m.name} (table: ${m.table}, type: ${m.dataType}): ${m.description}\n`;
      }
    }

    if (metadata.dimensions?.length) {
      result += '\nDimensions:\n';
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

    
  /**
     * Get metadata context for chat - alias for getDatasetMetadata
     * This method exists for compatibility with chat controller expectations
     */
  async getMetadataContext(groupId, datasetId) {
    return await this.getDatasetMetadata(groupId, datasetId);
  }

  /**
     * Executes an array of DAX queries against a dataset.
     * @param {string} groupId The Power BI group ID.
     * @param {string} datasetId The Power BI dataset ID.
     * @param {Array<string>} queries An array of DAX query strings.
     * @returns {Promise<Object>} The results from the Power BI REST API.
     * @private
     */
  async _executeDaxQuery(groupId, datasetId, query) {
    const headers = await this.getRequestHeader();
    const apiUrl = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/datasets/${datasetId}/executeQueries`;

    const requestBody = {
      queries: [{ query: query }],
      serializerSettings: {
        includeNulls: true
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`DAX query failed with status ${response.status}: ${response.statusText}. Response: ${errorBody}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse.results[0];
  }
}

module.exports = PowerBIService;