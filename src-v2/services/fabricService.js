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

      // Generate comprehensive report definition using the new method
      const reportDef = this.generateReportDefinition(datasetId, reportName);

      // Create the PBIR definition
      const pbirDefinition = {
        '$schema': 'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json',
        version: '4.0',
        datasetReference: {
          byConnection: {
            connectionString: `Data Source=powerbi://api.powerbi.com/v1.0/myorg/EmbedQuickDemo;initial catalog="Store Sales";integrated security=ClaimsToken;semanticmodelid=${datasetId}`
          }
        }
      };

      // Create the main report definition
      const reportDefinition = reportDef.definition.report;

      // Base64 encode both definitions
      const encodedPbirDef = Buffer.from(JSON.stringify(pbirDefinition)).toString('base64');
      const encodedReportDef = Buffer.from(JSON.stringify(reportDefinition)).toString('base64');

      const requestBody = {
        displayName: reportName,
        type: 'Report',
        definition: {
          parts: [
            {
              path: 'definition.pbir',
              payload: encodedPbirDef,
              payloadType: 'InlineBase64'
            },
            {
              path: 'definition/report.json',
              payload: encodedReportDef,
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
   * Poll for operation completion
   * @param {string} operationId - The operation ID to poll
   * @param {number} maxRetries - Maximum number of retries (default: 10)
   * @param {number} retryDelay - Delay between retries in ms (default: 3000)
   * @returns {Object} Operation result when complete
   */
  async pollOperationCompletion(operationId, maxRetries = 10, retryDelay = 3000) {
    try {
      const token = await this.getAccessToken();
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`📊 Polling operation ${operationId} (attempt ${attempt}/${maxRetries})`);
        
        const response = await axios.get(
          `${this.baseUrl}/operations/${operationId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const operation = response.data;
        
        if (operation.status === 'Succeeded') {
          console.log(`✅ Operation ${operationId} completed successfully`);
          return operation.result;
        } else if (operation.status === 'Failed') {
          throw new Error(`Operation failed: ${operation.error?.message || 'Unknown error'}`);
        } else if (operation.status === 'InProgress') {
          console.log(`⏳ Operation ${operationId} still in progress, waiting ${retryDelay}ms...`);
          await new Promise(resolve => global.setTimeout(resolve, retryDelay));
          continue;
        }
      }
      
      throw new Error(`Operation ${operationId} did not complete within ${maxRetries} retries`);
      
    } catch (error) {
      console.error(`❌ Error polling operation ${operationId}:`, error.message);
      throw new Error(`Failed to poll operation completion: ${error.message}`);
    }
  }

  /**
   * Generate the PBIR report definition payload
   * @param {string} datasetId - The dataset ID to tie the report to
   * @param {string} reportName - The report name
   * @param {string} workspaceName - The workspace name (for connection string)
   * @param {string} datasetName - The dataset display name (for connection string)
   * @returns {Object} Complete PBIR report definition
   */
  generateReportDefinition(datasetId, reportName, workspaceName = 'EmbedQuickDemo', datasetName = 'Store Sales') {
    return {
      displayName: reportName,
      description: `Auto-generated report for dataset ${datasetId}`,
      definition: {
        pbir: {
          version: '4.0',
          datasetReference: {
            byConnection: {
              connectionString: `Data Source=powerbi://api.powerbi.com/v1.0/myorg/${workspaceName};initial catalog="${datasetName}";integrated security=ClaimsToken;semanticmodelid=${datasetId}`
            }
          }
        },
        report: {
          '$schema': 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/1.2.0/schema.json',
          themeCollection: {
            baseTheme: {
              name: 'CY24SU10',
              reportVersionAtImport: '5.61',
              type: 'SharedResources'
            }
          },
          layoutOptimization: 'None',
          objects: {
            section: [
              {
                properties: {
                  verticalAlignment: {
                    expr: {
                      Literal: {
                        Value: '\'Top\''
                      }
                    }
                  }
                }
              }
            ]
          },
          resourcePackages: [
            {
              name: 'SharedResources',
              type: 'SharedResources',
              items: [
                {
                  name: 'CY24SU10',
                  path: 'BaseThemes/CY24SU10.json',
                  type: 'BaseTheme'
                }
              ]
            }
          ],
          settings: {
            useStylableVisualContainerHeader: true,
            defaultDrillFilterOtherVisuals: true,
            allowChangeFilterTypes: true,
            useEnhancedTooltips: true,
            useDefaultAggregateDisplayName: true
          }
        }
      }
    };
  }

  /**
   * Ensure a report exists - check if it exists, create if it doesn't
   * @param {string} workspaceId - The workspace ID
   * @param {string} datasetId - The dataset ID to tie the report to
   * @param {string} reportName - The report name
   * @param {boolean} waitForCompletion - Whether to wait for async operations to complete (default: false)
   * @returns {Object} Report object with existence info
   */
  async ensureReport(workspaceId, datasetId, reportName, waitForCompletion = false) {
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

      // Handle async operation (202 Accepted response)
      if (report.operationId && waitForCompletion) {
        console.log('⏳ Waiting for report creation to complete...');
        await this.pollOperationCompletion(report.operationId);
        
        // After completion, re-check to get the actual report details
        const completedReport = await this.checkReportExists(workspaceId, reportName);
        if (completedReport) {
          return {
            reportId: completedReport.id,
            workspaceId: completedReport.workspaceId,
            displayName: completedReport.displayName,
            existed: false,
            message: `Report '${reportName}' created successfully`
          };
        }
      }

      return {
        reportId: report.id,
        workspaceId: report.workspaceId || workspaceId,
        displayName: report.displayName,
        existed: false,
        message: report.message || `Report '${reportName}' created successfully`
      };

    } catch (error) {
      console.error('❌ Error in ensureReport:', error.message);
      throw error;
    }
  }
}

module.exports = new FabricService();