/**
 * Microsoft Fabric Service
 * Handles Fabric REST API operations for report management
 */

const axios = require('axios');
const { URLSearchParams } = require('url');
const { loadConfig } = require('./configService');

class FabricService {
  constructor() {
    this.baseUrl = 'https://api.fabric.microsoft.com/v1';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get Fabric access token using service principal
   */
  async getAccessToken() {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const config = loadConfig();

      const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams();
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);
      params.append('scope', 'https://api.fabric.microsoft.com/.default');
      params.append('grant_type', 'client_credentials');

      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
      
      console.log('✅ Fabric access token obtained successfully');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Failed to get Fabric access token:', error.response?.data || error.message);
      throw new Error(`Failed to authenticate with Fabric API: ${error.message}`);
    }
  }

  /**
   * Check if a report exists in the workspace
   * @param {string} workspaceId - The workspace ID
   * @param {string} reportName - The report name to check for
   * @returns {Object|null} Report object if exists, null if not found
   */
  async checkReportExists(workspaceId, reportName) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(`${this.baseUrl}/workspaces/${workspaceId}/items`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          type: 'Report'
        }
      });

      // Find report by name
      const report = response.data.value?.find(item => 
        item.type === 'Report' && item.displayName === reportName
      );

      return report || null;

    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('❌ Error checking report existence:', error.response?.data || error.message);
      throw new Error(`Failed to check report existence: ${error.message}`);
    }
  }

  /**
   * Create an empty report tied to an existing dataset
   * @param {string} workspaceId - The workspace ID
   * @param {string} datasetId - The dataset ID to tie the report to
   * @param {string} reportName - The name for the new report
   * @returns {Object} Created report object
   */
  async createEmptyReport(workspaceId, datasetId, reportName) {
    try {
      const token = await this.getAccessToken();

      // Create minimal report definition
      const reportDefinition = {
        version: '5.0',
        config: JSON.stringify({
          'version': '5.0',
          'themeCollection': {},
          'settings': {},
          'objects': {},
          'dataModelSchema': [{
            'name': datasetId,
            'tables': []
          }]
        }),
        layoutOptimization: 0
      };

      // Base64 encode the definition
      const encodedDefinition = Buffer.from(JSON.stringify(reportDefinition)).toString('base64');

      const requestBody = {
        displayName: reportName,
        type: 'Report',
        definition: {
          parts: [
            {
              path: 'report.json',
              payload: encodedDefinition,
              payloadType: 'InlineBase64'
            }
          ]
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/workspaces/${workspaceId}/items`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Report '${reportName}' creation request accepted`);
      
      // Handle 202 Accepted (async operation) response - this is expected for Fabric
      if (response.status === 202) {
        const operationId = response.headers['x-ms-operation-id'];
        const retryAfter = response.headers['retry-after'];
        console.log(`📝 Report creation initiated (Operation ID: ${operationId}, retry after: ${retryAfter}s)`);
        
        // For now, return a success response indicating the operation was accepted
        // In a production system, you'd want to poll the operation status
        return {
          id: `pending-${operationId}`, // Use operation ID to create unique identifier
          displayName: reportName,
          workspaceId: workspaceId,
          type: 'Report',
          operationId: operationId,
          status: 'Accepted',
          message: 'Report creation initiated successfully'
        };
      }
      
      // Handle synchronous response (200/201)
      return response.data;

    } catch (error) {
      console.error('❌ Error creating report:', error.response?.data || error.message);
      throw new Error(`Failed to create report: ${error.message}`);
    }
  }

  /**
   * Ensure a report exists - check if it exists, create if it doesn't
   * @param {string} workspaceId - The workspace ID
   * @param {string} datasetId - The dataset ID to tie the report to
   * @param {string} reportName - The report name
   * @returns {Object} Report object with existence info
   */
  async ensureReport(workspaceId, datasetId, reportName) {
    try {
      console.log(`🔍 Checking if report '${reportName}' exists in workspace ${workspaceId}...`);
      
      // Check if report exists
      let report = await this.checkReportExists(workspaceId, reportName);
      
      if (report) {
        console.log(`✅ Report '${reportName}' already exists`);
        return {
          reportId: report.id,
          workspaceId: report.workspaceId,
          displayName: report.displayName,
          existed: true
        };
      }

      // Report doesn't exist, create it
      console.log(`📝 Creating new report '${reportName}'...`);
      report = await this.createEmptyReport(workspaceId, datasetId, reportName);

      return {
        reportId: report.id,
        workspaceId: report.workspaceId,
        displayName: report.displayName,
        existed: false
      };

    } catch (error) {
      console.error('❌ Error in ensureReport:', error.message);
      throw error;
    }
  }
}

module.exports = new FabricService();