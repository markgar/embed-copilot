// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

/**
 * Chart Operations Module
 * Handles chart manipulation, AI integration, and chart // Export module functions
window.ChartChatOperations = {
    updateChartFromAI,
    clearChartFields,
    addFieldsFromAI,
    getCurrentChartConfig,
    getCurrentChartConfiguration,
    setCurrentChartConfig,
    updateCurrentChartConfig,
    findChartVisual,
    isSupportedChartType,
    parseFieldName,
    initializeChartOperations,
    SUPPORTED_CHART_TYPES,
    // Expose currentChartConfig for other modules
    get currentChartConfig() { return currentChartConfig; },
    set currentChartConfig(value) { currentChartConfig = value; }
};acking
 */

// Track current chart configuration for partial updates
let currentChartConfig = {
    yAxis: null,
    xAxis: null,
    chartType: null
};

// Supported chart types in Power BI
const SUPPORTED_CHART_TYPES = [
    'columnChart',
    'barChart', 
    'lineChart',
    'areaChart',
    'pieChart',
    'donutChart',
    'clusteredColumnChart',
    'stackedColumnChart'
];

/**
 * Check if a visual is a supported chart type
 * @param {Object} visual - Power BI visual object
 * @returns {boolean} True if the visual is a supported chart type
 */
function isSupportedChartType(visual) {
    return SUPPORTED_CHART_TYPES.includes(visual.type);
}

/**
 * Find the first chart visual on the active page
 * @param {Object} activePage - Power BI page object
 * @returns {Object|null} Chart visual or null if not found
 */
async function findChartVisual(activePage) {
    try {
        const visuals = await activePage.getVisuals();
        console.log(`Found ${visuals.length} visuals on the page`);
        
        const chartVisual = visuals.find(visual => isSupportedChartType(visual));
        
        if (chartVisual) {
            console.log("Found chart visual:", chartVisual.type, chartVisual.title);
        } else {
            console.log("No suitable chart visual found - available types:", 
                visuals.map(v => v.type).join(', '));
        }
        
        return chartVisual;
    } catch (error) {
        console.error("Error finding chart visual:", error);
        return null;
    }
}

/**
 * Helper function to parse field names in [Table].[Field] format
 * @param {string} fieldName - Field name to parse
 * @returns {Object} Object with table and field properties
 */
function parseFieldName(fieldName) {
    // Handle dotted field names like "Sales.TotalSales" or "Time.Month"
    if (fieldName.includes('.')) {
        const [table, field] = fieldName.split('.');
        return { table, field };
    } else {
        // If no table specified, assume it's just a field name
        return { table: null, field: fieldName };
    }
}

/**
 * Update chart based on AI response
 * @param {Object} chartAction - AI response with chart configuration
 */
async function updateChartFromAI(chartAction) {
    try {
        console.log("Starting AI chart update with:", chartAction);
        
        // Get PowerBI report instance from PowerBI Core module
        const report = window.PowerBICore?.getReport();
        if (!report) {
            console.error("No report instance available");
            window.ChartChatInterface?.addChatMessage("Error: No report instance available.", false);
            return;
        }
        
        // Get the active page
        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.error("No active page found");
            window.ChartChatInterface?.addChatMessage("Error: Could not find an active page to update the chart.", false);
            return;
        }
        
        console.log("Found active page:", activePage.displayName);
        
        // Find the first chart visual
        const chartVisual = await findChartVisual(activePage);
        
        if (!chartVisual) {
            window.ChartChatInterface?.addChatMessage("Error: Could not find a chart visual to update.", false);
            return;
        }
        
        // Clear existing fields from both axes
        await clearChartFields(chartVisual);
        
        // Change chart type if specified
        if (chartAction.chartType && chartAction.chartType !== chartVisual.type) {
            console.log(`Changing chart type from ${chartVisual.type} to ${chartAction.chartType}...`);
            await chartVisual.changeType(chartAction.chartType);
            console.log(`Chart type changed to ${chartAction.chartType} successfully`);
        }
        
        // Add the new fields based on AI response
        await addFieldsFromAI(chartVisual, chartAction);
        
        // Update the current chart configuration tracking
        updateCurrentChartConfig(chartAction);
        
        console.log("Chart updated successfully by AI");
        
    } catch (error) {
        window.ChartChatUtilities?.logError(error, 'Chart Update from AI');
        window.ChartChatInterface?.addChatMessage(`Error updating chart: ${error.message}`, false);
    }
}

/**
 * Clear existing fields from the chart
 * @param {Object} chartVisual - Power BI chart visual
 */
async function clearChartFields(chartVisual) {
    try {
        // Clear Y-axis (values)
        const yAxisFields = await chartVisual.getDataFields('Y');
        if (yAxisFields && yAxisFields.length > 0) {
            console.log("Clearing Y-axis fields...");
            for (let i = yAxisFields.length - 1; i >= 0; i--) {
                await chartVisual.removeDataField('Y', i);
                console.log(`Removed Y-axis field at index ${i}`);
            }
        }
        
        // Clear X-axis (category)
        const xAxisFields = await chartVisual.getDataFields('Category');
        if (xAxisFields && xAxisFields.length > 0) {
            console.log("Clearing Category axis fields...");
            for (let i = xAxisFields.length - 1; i >= 0; i--) {
                await chartVisual.removeDataField('Category', i);
                console.log(`Removed Category axis field at index ${i}`);
            }
        }
    } catch (error) {
        console.log("Could not clear existing fields (may not exist):", error.message);
    }
}

/**
 * Add fields based on AI chartAction
 * @param {Object} chartVisual - Power BI chart visual
 * @param {Object} chartAction - AI response with field configuration
 */
async function addFieldsFromAI(chartVisual, chartAction) {
    try {
        // Add Y-axis field (measures)
        if (chartAction.yAxis) {
            const { table, field } = parseFieldName(chartAction.yAxis);
            const target = {
                $schema: "http://powerbi.com/product/schema#measure",
                table: table,
                measure: field
            };
            console.log(`Adding ${chartAction.yAxis} (measure) to Y data role...`);
            console.log('Target object:', JSON.stringify(target, null, 2));
            await chartVisual.addDataField('Y', target);
            console.log(`${chartAction.yAxis} added to Y data role successfully`);
        }

        // Add X-axis field (dimensions)
        if (chartAction.xAxis) {
            const { table, field } = parseFieldName(chartAction.xAxis);
            const target = {
                $schema: "http://powerbi.com/product/schema#column",
                table: table,
                column: field
            };
            console.log(`Adding ${chartAction.xAxis} (dimension) to Category data role...`);
            console.log('Target object:', JSON.stringify(target, null, 2));
            await chartVisual.addDataField('Category', target);
            console.log(`${chartAction.xAxis} added to Category data role successfully`);
        }
        
        console.log(`Chart configured with ${chartAction.yAxis} by ${chartAction.xAxis} as ${chartAction.chartType}`);
        
    } catch (error) {
        console.error("Error adding fields from AI:", error);
        throw error;
    }
}

/**
 * Get current chart configuration from the active chart
 * @returns {Object|null} Current chart configuration or null if not available
 */
async function getCurrentChartConfig() {
    try {
        const report = window.PowerBICore?.getReport();
        if (!report) {
            console.log("No report instance available for chart config");
            return null;
        }

        // Check if report is fully loaded
        if (!window.PowerBICore?.getReportLoadState()?.rendered) {
            console.log("Report not yet fully rendered, skipping chart config load");
            return null;
        }

        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.log("No active page found for chart config");
            return null;
        }

        const chartVisual = await findChartVisual(activePage);

        if (!chartVisual) {
            console.log("No chart visual found for config");
            return null;
        }

        // Get current data fields
        const yAxisFields = await chartVisual.getDataFields('Y');
        const xAxisFields = await chartVisual.getDataFields('Category');

        const config = {
            chartType: chartVisual.type,
            yAxis: null,
            xAxis: null
        };

        // Determine Y-axis measure
        if (yAxisFields && yAxisFields.length > 0) {
            const yField = yAxisFields[0];
            if (yField.column === 'TotalSales') {
                config.yAxis = 'TotalSales';
            } else if (yField.column === 'TotalUnits') {
                config.yAxis = 'TotalUnits';
            } else if (yField.measure) {
                config.yAxis = yField.measure;
            }
        }

        // Determine X-axis dimension
        if (xAxisFields && xAxisFields.length > 0) {
            const xField = xAxisFields[0];
            if (xField.column === 'Month') {
                config.xAxis = 'Month';
            } else if (xField.column === 'District') {
                config.xAxis = 'District';
            } else if (xField.column) {
                config.xAxis = xField.column;
            }
        }

        console.log("Current chart config:", config);
        return config;

    } catch (error) {
        console.error("Error getting current chart config:", error);
        return null;
    }
}

/**
 * Update the current chart configuration tracking
 * @param {Object} chartAction - Chart action with new configuration
 */
function updateCurrentChartConfig(chartAction) {
    // For partial updates, preserve existing values if not provided
    const newConfig = {
        yAxis: chartAction.yAxis || currentChartConfig.yAxis,
        xAxis: chartAction.xAxis || currentChartConfig.xAxis,
        chartType: chartAction.chartType || currentChartConfig.chartType
    };
    
    // Only update if we have valid values
    if (newConfig.yAxis && newConfig.xAxis && newConfig.chartType) {
        currentChartConfig = newConfig;
        console.log("Updated current chart config:", currentChartConfig);
    } else {
        console.warn("Incomplete chart action received, preserving current config:", chartAction);
        console.log("Current config remains:", currentChartConfig);
    }
}

/**
 * Get the current chart configuration
 * @returns {Object} Current chart configuration
 */
function getCurrentChartConfiguration() {
    return { ...currentChartConfig }; // Return a copy to prevent external modification
}

/**
 * Set the current chart configuration
 * @param {Object} config - Chart configuration to set
 */
function setCurrentChartConfig(config) {
    currentChartConfig = { ...config };
    console.log("Chart configuration updated:", currentChartConfig);
}

/**
 * Initialize chart operations module
 */
function initializeChartOperations() {
    console.log('Chart operations module initialized');
    console.log('Supported chart types:', SUPPORTED_CHART_TYPES);
}

// Export functions for use by other modules
window.ChartChatOperations = {
    updateChartFromAI,
    clearChartFields,
    addFieldsFromAI,
    getCurrentChartConfig,
    updateCurrentChartConfig,
    findChartVisual,
    isSupportedChartType,
    parseFieldName,
    initializeChartOperations,
    SUPPORTED_CHART_TYPES,
    // Expose currentChartConfig for other modules
    get currentChartConfig() { return currentChartConfig; },
    set currentChartConfig(value) { currentChartConfig = value; }
};