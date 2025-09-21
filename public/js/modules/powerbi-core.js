/**
 * PowerBI Core Module
 * Handles PowerBI embedding, authentication, and core event management
 * Extracted from chartchat.js as part of modularization effort
 */

// ES6 Module imports
import { logError } from './utilities.js';

// PowerBI client models and core variables
let models = window["powerbi-client"].models;
let reportContainer = $("#report-container").get(0);
let report = null; // Store the report instance globally

    // Track report loading state
    let reportLoadState = {
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
                console.log("PowerBI Core: Cleaning up report instance...");
                
                // Remove all PowerBI event listeners
                report.off("loaded");
                report.off("rendered");
                report.off("error");
                report.off("saved");
                report.off("dataSelected");
                report.off("pageChanged");
                
                // Reset the report container
                if (reportContainer) {
                    reportContainer.innerHTML = '';
                }
                
                // Clear the global report reference
                report = null;
                
                // Reset load state
                reportLoadState.loaded = false;
                reportLoadState.rendered = false;
                
                console.log("✅ PowerBI Core: Cleanup completed");
            } catch (error) {
                console.error("PowerBI Core: Error during cleanup:", error);
            }
        }
    }

    /**
     * Initialize PowerBI embedding
     */
    function initializePowerBI() {
        console.log("Initializing PowerBI Core...");
        
        // Initialize iframe for embedding report
        powerbi.bootstrap(reportContainer, { type: "report" });
        
        // Start the embedding process
        embedReport();
    }

    /**
     * Get embed token and embed the report
     */
    function embedReport() {
        // AJAX request to get the report details from the API and pass it to the UI
        $.ajax({
            type: "GET",
            url: "/getEmbedToken",
            dataType: "json",
            success: function (embedData) {
                console.log("Embed token received successfully");

                // Create a config object with type of the object, Embed details and Token Type
                let reportLoadConfig = {
                    type: "report",
                    tokenType: models.TokenType.Embed,
                    accessToken: embedData.accessToken,

                    // Use other embed report config based on the requirement. We have used the first one for demo purpose
                    embedUrl: embedData.embedUrl[0].embedUrl,

                    // Keep edit permissions for API access but use view mode to hide edit UI
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
                                visible: false
                            },
                            pageNavigation: {
                                visible: true
                            },
                            visualizations: {
                                expanded: false,
                                visible: false
                            },
                            fields: {
                                expanded: false,
                                visible: false
                            }
                        }
                    }
                };

                console.log("Embedding report...");
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
        report.off("loaded");

        // Triggers when a report schema is successfully loaded
        report.on("loaded", function () {
            console.log("Report loaded successfully - no automatic field addition");
            reportLoadState.loaded = true;
            
            // Notify other modules about report ready state
            notifyReportStateChange();
            
            // No automatic measure addition - start with empty chart
        });

        // Clear any other rendered handler events
        report.off("rendered");

        // Triggers when a report is successfully embedded in UI
        report.on("rendered", function () {
            console.log("Report rendered successfully");
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
                        console.log("Report ready event dispatched");
                    }
                } catch (error) {
                    logError(error, 'Initial Chart Config Load');
                }
            }, 1000);
        });

        // Clear any other error handler events
        report.off("error");

        // Below patch of code is for handling errors that occur during embedding
        report.on("error", function (event) {
            let errorMsg = event.detail;
            
            logError(new Error(errorMsg), 'Power BI Report Embedding');

            // Show error container
            showEmbedError(`Error occurred while embedding the report: ${errorMsg}`);
        });

        // Handle visual selection for editing
        report.on("visualClicked", function (event) {
            console.log("Visual clicked:", event);
            // Future: Could add visual selection handling
        });

        // Handle when a visual is rendered
        report.on("visualRendered", function (event) {
            console.log("Visual rendered:", event);
            // Future: Could add visual render tracking
        });

        // Handle data selection events
        report.on("dataSelected", function (event) {
            console.log("Data selected:", event);
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
                disableReason: reportLoadState.loaded && !reportLoadState.rendered ? "Report rendering..." : null
            }
        }));

        if (reportLoadState.isReady) {
            console.log("Report is fully ready - chat enabled event dispatched");
        } else if (reportLoadState.loaded && !reportLoadState.rendered) {
            console.log("Report rendering - chat disabled event dispatched");
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
        const errorContainer = $(".error-container");
        if (errorContainer.length) {
            errorContainer.show();
            errorContainer.html(`<h4>${message}</h4>`);
        } else {
            console.error("Error container not found. Error:", message);
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
            throw new Error("Report not initialized");
        }
        
        if (report.mode !== 'edit') {
            console.log("Switching report to edit mode");
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
            throw new Error("Report not initialized");
        }
        
        if (report.mode !== 'view') {
            console.log("Switching report to view mode");
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
            throw new Error("Report not initialized");
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

    // Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePowerBI);
} else {
    initializePowerBI();
}

// ES6 Module exports
export {
    initializePowerBI,
    embedReport,
    getReport,
    getReportContainer,
    getReportLoadState,
    getModels,
    switchToEditMode,
    switchToViewMode,
    getPages,
    getActivePage,
    cleanupPowerBIReport
};