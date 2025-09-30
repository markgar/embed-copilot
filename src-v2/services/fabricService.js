/**
 * Microsoft Fabric Service
 * Handles Fabric REST API operations for report management
 */

const fetch = require('node-fetch');
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

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      
      console.log('✅ Fabric access token obtained successfully');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Failed to get Fabric access token:', error.message);
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
      
      const url = `${this.baseUrl}/workspaces/${workspaceId}/items?type=Report`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Find report by name
      const report = data.value?.find(item => 
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

      // Load EXACT CLI-exported templates
      const fs = require('fs');
      const path = require('path');
      
      // Load template files for PBIR-Legacy format (3 files: definition.pbir, report.json, .platform)
      const pbirTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, '../../templates/report/definition.pbir.template.json'), 'utf8'));
      const reportTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, '../../templates/report/report.template.json'), 'utf8'));
      const platformTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, '../../templates/report/platform.template.json'), 'utf8'));
      
      // Replace placeholders in PBIR template (EXACT CLI structure)
      const pbirDefinition = {
        ...pbirTemplate,
        datasetReference: {
          byConnection: {
            connectionString: pbirTemplate.datasetReference.byConnection.connectionString
              .replace('{{WORKSPACE_NAME}}', 'EmbedQuickDemo')
              .replace('{{DATASET_NAME}}', 'Store Sales')
              .replace('{{DATASET_ID}}', datasetId)
          }
        }
      };
      
      // Use EXACT CLI-exported report.json template
      const reportJson = reportTemplate;

      // Replace placeholders in platform template
      const platformJson = {
        ...platformTemplate,
        metadata: {
          ...platformTemplate.metadata,
          displayName: platformTemplate.metadata.displayName.replace('{{REPORT_NAME}}', reportName),
          description: platformTemplate.metadata.description.replace('{{DATASET_ID}}', datasetId)
        }
      };

      // Create exact JSON strings for PBIR-Legacy format (no formatting for exact match)
      const pbirJsonString = JSON.stringify(pbirDefinition);
      const reportJsonString = JSON.stringify(reportJson);
      const platformJsonString = JSON.stringify(platformJson);
      
      // Base64 encode exactly as CLI exports them
      const encodedPbirDef = Buffer.from(pbirJsonString).toString('base64');
      const encodedReportJson = Buffer.from(reportJsonString).toString('base64');
      const encodedPlatformJson = Buffer.from(platformJsonString).toString('base64');
      
      console.log('🔍 PBIR JSON (exact):', pbirJsonString);
      console.log('🔍 Report JSON (exact):', reportJsonString.substring(0, 200) + '...');
      console.log('🔍 Platform JSON (exact):', platformJsonString);
      console.log('🔍 Using PBIR-Legacy format (3 parts: definition.pbir v1.0, report.json, .platform)');

      // Create request with PBIR-Legacy format (3 parts: definition.pbir, report.json, .platform)
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
              path: 'report.json',
              payload: encodedReportJson,
              payloadType: 'InlineBase64'
            },
            {
              path: '.platform',
              payload: encodedPlatformJson,
              payloadType: 'InlineBase64'
            }
          ]
        }
      };

      const response = await fetch(
        `${this.baseUrl}/workspaces/${workspaceId}/items`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      console.log(`✅ Report '${reportName}' creation request accepted`);
      
      // Handle 202 Accepted (async operation) response - this is expected for Fabric
      if (response.status === 202) {
        const operationId = response.headers.get('x-ms-operation-id');
        const retryAfter = response.headers.get('retry-after');
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
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();

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
        
        const response = await fetch(
          `${this.baseUrl}/operations/${operationId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const operation = await response.json();
        
        if (operation.status === 'Succeeded') {
          console.log(`✅ Operation ${operationId} completed successfully`);
          return operation.result;
        } else if (operation.status === 'Failed') {
          console.error('❌ Operation failed - Full error details:', JSON.stringify(operation.error, null, 2));
          console.error('❌ Operation failed - Full operation response:', JSON.stringify(operation, null, 2));
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