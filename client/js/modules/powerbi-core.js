/**
 * PowerBI Core Module
 * Handles PowerBI embedding, authentication, and core event management
 * Extracted from chartchat.js as part of modularization effort
 */

// ES6 Module imports
import { logError } from './utilities.js';
import { FabricClient } from './fabric-client.js';

// PowerBI client models and core variables
const models = window['powerbi-client'].models;
const reportContainer = $('#report-container').get(0);
let report = null; // Store the report instance globally

// Track report loading state
const reportLoadState = {
  loaded: false,
  rendered: false,
  get isReady() {
    return this.loaded && this.rendered;
  }
};

/**
     * Cleanup PowerBI report instance and event listeners
     */
function cleanupPowerBIReport() {
  if (report) {
    try {
      console.log('PowerBI Core: Cleaning up report instance...');
                
      // Remove all PowerBI event listeners
      report.off('loaded');
      report.off('rendered');
      report.off('error');
      report.off('saved');
      report.off('dataSelected');
      report.off('pageChanged');
                
      // Reset the report container
      if (reportContainer) {
        reportContainer.innerHTML = '';
      }
                
      // Clear the global report reference
      report = null;
                
      // Reset load state
      reportLoadState.loaded = false;
      reportLoadState.rendered = false;
                
      console.log('✅ PowerBI Core: Cleanup completed');
    } catch (error) {
      console.error('PowerBI Core: Error during cleanup:', error);
    }
  }
}

/**
     * Initialize PowerBI embedding
     */
function initializePowerBI() {
  console.log('Initializing PowerBI Core...');
        
  // Initialize iframe for embedding report
  powerbi.bootstrap(reportContainer, { type: 'report' });
        
  // Start the report discovery/creation process
  discoverAndEmbedReport();
}

/**
     * Discover or create report, then embed it
     */
async function discoverAndEmbedReport() {
  try {
    console.log('🔍 Starting report discovery/creation process...');
    
    // Get frontend configuration from backend
    const config = await getFrontendConfig();
    if (!config.powerBIWorkspaceId || !config.powerBIDatasetId) {
      throw new Error('Missing workspace ID or dataset ID in configuration');
    }

    console.log('📋 Config loaded:', { 
      workspaceId: config.powerBIWorkspaceId, 
      datasetId: config.powerBIDatasetId 
    });

    // Use datasetId as the report name (as per requirements)
    const reportName = config.powerBIDatasetId;
    
    // Initialize Fabric client and ensure report exists
    const fabricClient = new FabricClient();
    const reportResult = await fabricClient.ensureReport(
      config.powerBIWorkspaceId,
      config.powerBIDatasetId,
      reportName
    );

    console.log('✅ Report ready:', reportResult);

    // Now embed the report using the discovered/created reportId
    embedReport(reportResult.reportId);

  } catch (error) {
    console.error('❌ Report discovery/creation failed:', error);
    logError(error, 'Report Discovery/Creation');
    showEmbedError(`Failed to discover or create report: ${error.message}`);
  }
}

/**
     * Get frontend configuration from backend
     * @returns {Promise<Object>} Frontend configuration
     */
async function getFrontendConfig() {
  try {
    const response = await fetch('/system/config');
    if (!response.ok) {
      throw new Error(`Config request failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to load frontend config:', error);
    throw new Error(`Configuration loading failed: ${error.message}`);
  }
}

/**
     * Get embed token and embed the report
     * @param {string} reportId - The Power BI report ID to embed
     */
function embedReport(reportId) {
  if (!reportId) {
    showEmbedError('No report ID provided for embedding');
    return;
  }

  console.log('Embedding report with ID:', reportId);

  // AJAX request to get the report details from the API and pass it to the UI
  $.ajax({
    type: 'GET',
    url: `/getEmbedToken?reportId=${encodeURIComponent(reportId)}`,
    dataType: 'json',
    success: function (embedData) {
      console.log('Embed token received successfully');

      // Create a config object with type of the object, Embed details and Token Type
      const reportLoadConfig = {
        type: 'report',
        tokenType: models.TokenType.Embed,
        accessToken: embedData.accessToken,

        // Use other embed report config based on the requirement. We have used the first one for demo purpose
        embedUrl: embedData.embedUrl[0].embedUrl,

        // Enable view mode by default, with all permissions for when we need edit mode
        permissions: models.Permissions.All,
        viewMode: models.ViewMode.View,

        // Enable this setting to remove gray shoulders from embedded report
        settings: {
          background: models.BackgroundType.Transparent,
          commands: [
            {
              exportData: { displayOption: models.CommandDisplayOption.Hidden },
              drill: { displayOption: models.CommandDisplayOption.Hidden },
              spotlight: { displayOption: models.CommandDisplayOption.Hidden },
              sort: { displayOption: models.CommandDisplayOption.Hidden },
              seeData: { displayOption: models.CommandDisplayOption.Hidden }
            }
          ],
          visualSettings: {
            visualHeaders: [
              {
                settings: {
                  visible: false
                }
              }
            ]
          },
          panes: {
            filters: {
              expanded: false,
              visible: true
            },
            pageNavigation: {
              visible: true
            },
            visualizations: {
              expanded: false,
              visible: true
            },
            fields: {
              expanded: false,
              visible: true
            }
          }
        }
      };

      console.log('Embedding report...');
      // Embed the report and display it within the div container.
      report = powerbi.embed(reportContainer, reportLoadConfig);

      // Set up event handlers
      setupReportEventHandlers();

    },
    error: function (err) {
      const errorMessage = err.responseText || err.statusText || 'Unknown token error';
                
      // Use error service if available, otherwise fallback to console
      logError(new Error(errorMessage), 'Embed Token Request');
                
      // Show error container
      showEmbedError(`Error occurred while getting embed token: ${errorMessage}`);
    }
  });
}

/**
     * Set up PowerBI report event handlers
     */
function setupReportEventHandlers() {
  // Clear any other loaded handler events
  report.off('loaded');

  // Triggers when a report schema is successfully loaded
  report.on('loaded', async function () {
    console.log('Report loaded successfully - creating default visual');
    reportLoadState.loaded = true;
            
    // Notify other modules about report ready state
    notifyReportStateChange();
            
    // Automatically create a default visual when report loads
    try {
      await createDefaultVisual();
      console.log('Default visual created successfully on report load');
    } catch (error) {
      console.error('Error creating default visual on report load:', error);
      logError(error, 'Auto-Create Default Visual');
    }
  });

  // Clear any other rendered handler events
  report.off('rendered');

  // Triggers when a report is successfully embedded in UI
  report.on('rendered', function () {
    console.log('Report rendered successfully');
    reportLoadState.rendered = true;
            
    // Notify other modules about report ready state
    notifyReportStateChange();
            
    // Get initial chart configuration after a short delay to ensure visuals are ready
    setTimeout(async () => {
      try {
        // Notify other modules that report is ready for chart operations
        if (reportLoadState.rendered) {
          window.dispatchEvent(new CustomEvent('powerbi-report-ready', {
            detail: { reportReady: true }
          }));
          console.log('Report ready event dispatched');
        }
      } catch (error) {
        logError(error, 'Initial Chart Config Load');
      }
    }, 1000);
  });

  // Clear any other error handler events
  report.off('error');

  // Below patch of code is for handling errors that occur during embedding
  report.on('error', function (event) {
    const errorMsg = event.detail;
            
    logError(new Error(errorMsg), 'Power BI Report Embedding');

    // Show error container
    showEmbedError(`Error occurred while embedding the report: ${errorMsg}`);
  });

  // Handle visual selection for editing
  report.on('visualClicked', function (event) {
    console.log('Visual clicked:', event);
    // Future: Could add visual selection handling
  });

  // Handle when a visual is rendered
  report.on('visualRendered', function (event) {
    console.log('Visual rendered:', event);
    // Future: Could add visual render tracking
  });

  // Handle data selection events
  report.on('dataSelected', function (event) {
    console.log('Data selected:', event);
    // Future: Could add data selection handling
  });
}

/**
     * Notify other modules about report state changes
     */
function notifyReportStateChange() {
  // Dispatch events for other modules to listen to
  window.dispatchEvent(new CustomEvent('powerbi-chat-state', {
    detail: {
      enableChat: reportLoadState.isReady,
      disableReason: reportLoadState.loaded && !reportLoadState.rendered ? 'Report rendering...' : null
    }
  }));

  if (reportLoadState.isReady) {
    console.log('Report is fully ready - chat enabled event dispatched');
  } else if (reportLoadState.loaded && !reportLoadState.rendered) {
    console.log('Report rendering - chat disabled event dispatched');
  }

  // Notify other modules that might be interested in report state
  window.dispatchEvent(new CustomEvent('powerbi-state-change', {
    detail: {
      loaded: reportLoadState.loaded,
      rendered: reportLoadState.rendered,
      isReady: reportLoadState.isReady
    }
  }));
}

/**
     * Show embedding error
     * @param {string} message - Error message to display
     */
function showEmbedError(message) {
  const errorContainer = $('.error-container');
  if (errorContainer.length) {
    errorContainer.show();
    errorContainer.html(`<h4>${message}</h4>`);
  } else {
    console.error('Error container not found. Error:', message);
  }
}

/**
     * Get the current report instance
     * @returns {Object|null} Current PowerBI report instance
     */
function getReport() {
  return report;
}

/**
     * Get the report container element
     * @returns {HTMLElement} Report container element
     */
function getReportContainer() {
  return reportContainer;
}

/**
     * Get the current report load state
     * @returns {Object} Report load state object
     */
function getReportLoadState() {
  return { ...reportLoadState }; // Return a copy to prevent external modification
}

/**
     * Get PowerBI models
     * @returns {Object} PowerBI client models
     */
function getModels() {
  return models;
}

/**
     * Switch report to edit mode
     * @returns {Promise} Promise that resolves when mode is switched
     */
async function switchToEditMode() {
  if (!report) {
    throw new Error('Report not initialized');
  }
        
  if (report.mode !== 'edit') {
    console.log('Switching report to edit mode');
    await report.switchMode('edit');
  }
        
  return report;
}

/**
     * Switch report to view mode
     * @returns {Promise} Promise that resolves when mode is switched
     */
async function switchToViewMode() {
  if (!report) {
    throw new Error('Report not initialized');
  }
        
  if (report.mode !== 'view') {
    console.log('Switching report to view mode');
    await report.switchMode('view');
  }
        
  return report;
}

/**
     * Get all pages from the report
     * @returns {Promise<Array>} Promise that resolves to array of pages
     */
async function getPages() {
  if (!report) {
    throw new Error('Report not initialized');
  }
        
  return await report.getPages();
}

/**
 * Get the active page
 * @returns {Promise<Object>} Promise that resolves to active page
 */
async function getActivePage() {
  const pages = await getPages();
  return pages.find(page => page.isActive) || pages[0];
}

/**
 * Create a default visual on the active page
 * @returns {Promise<Object>} Promise that resolves to the created visual response
 */
async function createDefaultVisual() {
  try {
    if (!report) {
      throw new Error('Report not initialized');
    }

    console.log('Creating default visual...');
    
    // Get the active page
    const activePage = await getActivePage();
    if (!activePage) {
      throw new Error('No active page found');
    }

    // Create a simple line chart visual with layout (based on showcase pattern)
    const customLayout = {
      width: 1242,
      height: 682,
      x: 19,
      y: 18,
      displayState: {
        mode: models.VisualContainerDisplayMode.Visible
      }
    };
    
    const createVisualResponse = await activePage.createVisual('lineChart', customLayout);
    console.log('Visual created successfully:', createVisualResponse);
    
    return createVisualResponse;
  } catch (error) {
    console.error('Error creating default visual:', error);
    logError(error, 'Create Default Visual');
    throw error;
  }
}// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePowerBI);
} else {
  initializePowerBI();
}

// ES6 Module exports
export {
  initializePowerBI,
  embedReport,
  discoverAndEmbedReport,
  getFrontendConfig,
  getReport,
  getReportContainer,
  getReportLoadState,
  getModels,
  switchToEditMode,
  switchToViewMode,
  getPages,
  getActivePage,
  cleanupPowerBIReport,
  createDefaultVisual
};