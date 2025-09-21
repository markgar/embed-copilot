// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

/**
 * ChartChat App Coordination Module
 * Main entry point that coordinates all modules and handles initialization
 * This module ties together all the modularized components
 */

(function() {
    'use strict';

    /**
     * Initialize all modules in the correct order
     */
    function initializeApplication() {
        console.log("ChartChat App: Starting initialization...");

        // Ensure all required modules are loaded
        if (!window.ChartChatUtilities) {
            console.error("ChartChatUtilities module not loaded");
            return;
        }

        if (!window.PowerBICore) {
            console.error("PowerBICore module not loaded");
            return;
        }

        if (!window.ChartChatOperations) {
            console.error("ChartChatOperations module not loaded");
            return;
        }

        if (!window.ChartChatInterface) {
            console.error("ChartChatInterface module not loaded");
            return;
        }

        if (!window.ChartChatDataControls) {
            console.error("ChartChatDataControls module not loaded");
            return;
        }

        if (!window.TreeViewModule) {
            console.error("TreeViewModule module not loaded");
            return;
        }

        console.log("All modules loaded successfully");

        // Initialize modules in dependency order
        try {
            // 1. Utilities (no dependencies) - auto-initializes
            console.log("✓ Utilities module initialized");

            // 2. PowerBI Core (depends on utilities) - auto-initializes
            console.log("✓ PowerBI Core module initialized");

            // 3. Chart Operations (depends on utilities, powerbi-core) - auto-initializes
            console.log("✓ Chart Operations module initialized");

            // 4. Chat Interface (depends on utilities, chart-operations)
            if (window.ChartChatInterface.initializeChatInterface) {
                window.ChartChatInterface.initializeChatInterface();
                console.log("✓ Chat Interface module initialized");
            }

            // 5. Data Controls (depends on utilities, powerbi-core)
            if (window.ChartChatDataControls.initializeDataControls) {
                window.ChartChatDataControls.initializeDataControls();
                console.log("✓ Data Controls module initialized");
            }

            // 6. TreeView (depends on utilities) - auto-initializes
            console.log("✓ TreeView module initialized");

            console.log("ChartChat App: All modules initialized successfully!");

            // Set up inter-module communication
            setupModuleCommunication();

            // Log initial setup completion
            console.log("Chart Chat initialized - starting with empty chart");

        } catch (error) {
            console.error("Error during module initialization:", error);
            if (window.ChartChatUtilities && window.ChartChatUtilities.logError) {
                window.ChartChatUtilities.logError(error, 'App Initialization');
            }
        }
    }

    /**
     * Set up communication between modules
     */
    function setupModuleCommunication() {
        // Listen for PowerBI state changes
        window.addEventListener('powerbi-state-change', function(event) {
            console.log('PowerBI state changed:', event.detail);
            
            // Other modules can react to PowerBI state changes here
            // For example, enable/disable UI elements based on report ready state
        });

        // Set up any other cross-module event listeners as needed
        console.log("Inter-module communication established");
    }

    /**
     * Get application status
     * @returns {Object} Status of all modules
     */
    function getApplicationStatus() {
        return {
            utilities: !!window.ChartChatUtilities,
            powerbiCore: !!window.PowerBICore,
            chartOperations: !!window.ChartChatOperations,
            chatInterface: !!window.ChartChatInterface,
            dataControls: !!window.ChartChatDataControls,
            treeView: !!window.TreeViewModule,
            powerbiState: window.PowerBICore ? window.PowerBICore.getReportLoadState() : null
        };
    }

    /**
     * Emergency module reload (for debugging)
     */
    function reloadModules() {
        console.log("Attempting to reload modules...");
        // This could be expanded to reload individual modules if needed
        location.reload();
    }

    // Export app-level functions
    window.ChartChatApp = {
        initializeApplication,
        getApplicationStatus,
        reloadModules
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApplication);
    } else {
        // DOM is already ready
        initializeApplication();
    }

    // Also initialize with jQuery ready for compatibility
    $(document).ready(function() {
        // Double initialization protection
        if (!window.ChartChatApp._initialized) {
            window.ChartChatApp._initialized = true;
            console.log("ChartChat App: jQuery ready initialization");
        }
    });

})();