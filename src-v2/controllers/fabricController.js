/**
 * Microsoft Fabric Controller
 * Handles HTTP requests for Fabric operations
 */

class FabricController {
  constructor(fabricService) {
    if (!fabricService) {
      throw new Error('fabricService is required');
    }
    this.fabricService = fabricService;
  }

  /**
   * Ensure a report exists - check if it exists, create if it doesn't
   * POST /fabric/reports/ensure
   */
  async ensureReport(req, res) {
    try {
      const { workspaceId, datasetId, reportName, waitForCompletion } = req.body;

      // Validate required fields
      if (!workspaceId || !datasetId || !reportName) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: workspaceId, datasetId, and reportName are required'
        });
      }

      // Validate UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(workspaceId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid workspaceId format. Must be a valid UUID.'
        });
      }

      if (!uuidRegex.test(datasetId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid datasetId format. Must be a valid UUID.'
        });
      }

      // Validate report name
      if (typeof reportName !== 'string' || reportName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Report name must be a non-empty string'
        });
      }

      console.log(`📊 Fabric Controller: Ensuring report exists - ${reportName}`);

      // Call fabric service to ensure report exists
      const result = await this.fabricService.ensureReport(workspaceId, datasetId, reportName.trim(), waitForCompletion);

      // Return success response
      return res.status(200).json({
        success: true,
        data: {
          reportId: result.reportId,
          workspaceId: result.workspaceId,
          displayName: result.displayName,
          existed: result.existed,
          message: result.existed 
            ? `Report '${result.displayName}' already exists`
            : `Report '${result.displayName}' created successfully`
        }
      });

    } catch (error) {
      console.error('❌ Fabric Controller Error:', error.message);

      // Determine appropriate status code
      let statusCode = 500;
      let message = 'Internal server error occurred while managing report';

      if (error.message.includes('Failed to authenticate')) {
        statusCode = 401;
        message = 'Authentication failed with Fabric API';
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        statusCode = 404;
        message = 'Workspace or dataset not found';
      } else if (error.message.includes('permission') || error.message.includes('403')) {
        statusCode = 403;
        message = 'Insufficient permissions for Fabric operations';
      }

      return res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = FabricController;