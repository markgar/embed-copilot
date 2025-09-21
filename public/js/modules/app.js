// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

/**
 * ChartChat App Coordination Module
 * Main entry point that coordinates all modules and handles initialization
 * This module ties together all the modularized components
 */

// Import all dependencies
import { logError } from './utilities.js';
import { getReportLoadState } from './powerbi-core.js';
import { findChartVisual } from './chart-operations.js';
import { initializeChatInterface } from './chat-interface.js';
import { initializeDataControls } from './data-controls.js';
import { initializeTreeView } from './treeview.js';

/**
 * Initialize all modules in the correct order
 */
function initializeApplication() {
    console.log("ChartChat App: Starting initialization...");

    try {
        console.log("✅ All modules loaded, starting initialization...");

        // Initialize Chat Interface
        if (initializeChatInterface) {
            initializeChatInterface();
            console.log("✅ Chat Interface initialized");
        } else {
            console.warn("⚠️ Chat Interface initialization function not available");
        }

        // Initialize Data Controls
        if (initializeDataControls) {
            initializeDataControls();
            console.log("✅ Data Controls initialized");
        } else {
            console.warn("⚠️ Data Controls initialization function not available");
        }

        // TreeView initializes itself via DOM ready event
        console.log("✅ TreeView will auto-initialize");

        console.log("🎉 ChartChat App initialization complete!");

        // Set up inter-module communication
        setupModuleCommunication();

        // Log initial setup completion
        console.log("Chart Chat initialized - starting with empty chart");

    } catch (error) {
        console.error("❌ Error during app initialization:", error);
        if (logError) {
            logError(error, 'App Initialization');
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
        utilities: true, // Always available via ES6 imports
        powerbiCore: true,
        chartOperations: true,
        chatInterface: true,
        dataControls: true,
        treeView: true,
        powerbiState: getReportLoadState ? getReportLoadState() : null
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

// ES6 module exports
export {
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