/**
 * Fabric Client - Frontend service for Microsoft Fabric API operations
 */
class FabricClient {
  constructor() {
    this.baseUrl = '/fabric';
  }



  /**
   * Ensure a report exists - check if it exists, create if it doesn't
   * @param {string} workspaceId - The workspace ID
   * @param {string} datasetId - The dataset ID to tie the report to
   * @param {string} reportName - The report name (typically the datasetId)
   * @returns {Promise<Object>} Report information
   */
  async ensureReport(workspaceId, datasetId, reportName) {
    try {
      // Validate parameters first
      this.validateParams(workspaceId, datasetId, reportName);
      
      console.log(`🔍 Fabric Client: Ensuring report '${reportName}' exists...`);
      
      const response = await fetch(`${this.baseUrl}/reports/ensure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workspaceId: workspaceId,
          datasetId: datasetId,
          reportName: reportName,
          waitForCompletion: true  // Always wait for report creation to complete
        })
      });

      // Handle network errors
      if (!response) {
        throw new Error('Network error: Unable to reach Fabric API');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Invalid JSON response from Fabric API: ${parseError.message}`);
      }

      // Handle HTTP errors with specific messages
      if (!response.ok) {
        let errorMessage = data?.message || `HTTP ${response.status}: ${response.statusText}`;
        
        switch (response.status) {
        case 400:
          errorMessage = `Bad Request: ${data?.message || 'Invalid parameters provided'}`;
          break;
        case 401:
          errorMessage = 'Authentication failed: Please check service principal credentials';
          break;
        case 403:
          errorMessage = 'Permission denied: Insufficient Fabric permissions';
          break;
        case 404:
          errorMessage = 'Not found: Workspace or dataset does not exist';
          break;
        case 500:
          errorMessage = `Server error: ${data?.message || 'Internal server error'}`;
          break;
        }
        
        throw new Error(errorMessage);
      }

      // Handle API response errors
      if (!data.success) {
        throw new Error(data.message || 'Fabric API request failed');
      }

      // Validate response data
      if (!data.data || !data.data.reportId) {
        throw new Error('Invalid response: Missing report information');
      }

      console.log(`✅ Fabric Client: Report operation completed - ${data.data.message}`);
      
      return {
        reportId: data.data.reportId,
        workspaceId: data.data.workspaceId,
        displayName: data.data.displayName,
        existed: data.data.existed,
        success: true
      };

    } catch (error) {
      console.error('❌ Fabric Client Error:', error.message);
      
      // Re-throw with more context for debugging
      const enhancedError = new Error(`Fabric Report Ensure Failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.params = { workspaceId, datasetId, reportName };
      
      throw enhancedError;
    }
  }

  /**
   * Validate required parameters for Fabric operations
   * @param {string} workspaceId - The workspace ID
   * @param {string} datasetId - The dataset ID
   * @param {string} reportName - The report name
   * @throws {Error} If validation fails
   */
  validateParams(workspaceId, datasetId, reportName) {
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new Error('workspaceId is required and must be a string');
    }

    if (!datasetId || typeof datasetId !== 'string') {
      throw new Error('datasetId is required and must be a string');
    }

    if (!reportName || typeof reportName !== 'string') {
      throw new Error('reportName is required and must be a string');
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(workspaceId)) {
      throw new Error('workspaceId must be a valid UUID format');
    }

    if (!uuidRegex.test(datasetId)) {
      throw new Error('datasetId must be a valid UUID format');
    }
  }
}

// Export as ES6 module
export { FabricClient };