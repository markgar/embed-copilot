// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

/**
 * Chart Operations Module
 * Handles chart manipulation, AI integration, and chart creation/update operations
 */

// ES6 Module imports
import { logError } from './utilities.js';
import { getReport, getReportLoadState } from './powerbi-core.js';

// Track current chart configuration for partial updates
let currentChartConfig = {
  yAxis: null,
  xAxis: null,
  chartType: null,
  series: null
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
      console.log('Found chart visual:', chartVisual.type, chartVisual.title);
    } else {
      console.log('No suitable chart visual found - available types:', 
        visuals.map(v => v.type).join(', '));
    }
        
    return chartVisual;
  } catch (error) {
    console.error('Error finding chart visual:', error);
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
    console.log('Starting AI chart update with:', chartAction);
        
    // Get PowerBI report instance from PowerBI Core module
    const report = getReport();
    if (!report) {
      console.error('No report instance available');
      window.dispatchEvent(new CustomEvent('chart-error', {
        detail: { message: 'Error: No report instance available.' }
      }));
      return;
    }
        
    // Get the active page
    const pages = await report.getPages();
    const activePage = pages.find(page => page.isActive) || pages[0];
        
    if (!activePage) {
      console.error('No active page found');
      window.dispatchEvent(new CustomEvent('chart-error', {
        detail: { message: 'Error: Could not find an active page to update the chart.' }
      }));
      return;
    }
        
    console.log('Found active page:', activePage.displayName);
        
    // Find the first chart visual
    const chartVisual = await findChartVisual(activePage);
        
    if (!chartVisual) {
      window.dispatchEvent(new CustomEvent('chart-error', {
        detail: { message: 'Error: Could not find a chart visual to update.' }
      }));
      return;
    }
        
    // Clear existing fields from both axes
    await clearChartFields(chartVisual);
        
    // Change chart type if specified
    if (chartAction.chartType && chartAction.chartType !== chartVisual.type) {
      console.log(`Changing chart type from ${chartVisual.type} to ${chartAction.chartType}...`);
      await chartVisual.changeType(chartAction.chartType);
      console.log(`Chart type changed to ${chartAction.chartType} successfully`);
            
      // Debug: After changing to clustered column, let's see what data roles are available
      if (chartAction.chartType === 'clusteredColumnChart') {
        try {
          const dataRoles = await chartVisual.getDataRoles();
          console.log('Available data roles for clusteredColumnChart:', dataRoles);
        } catch (roleError) {
          console.log('Could not get data roles after chart type change:', roleError.message);
        }
      }
    }
        
    // Add the new fields based on AI response
    await addFieldsFromAI(chartVisual, chartAction);
        
    // Update the current chart configuration tracking
    updateCurrentChartConfig(chartAction);
        
    console.log('Chart updated successfully by AI');
        
  } catch (error) {
    logError(error, 'Chart Update from AI');
    window.dispatchEvent(new CustomEvent('chart-error', {
      detail: { message: `Error updating chart: ${error.message}` }
    }));
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
      console.log('Clearing Y-axis fields...');
      for (let i = yAxisFields.length - 1; i >= 0; i--) {
        await chartVisual.removeDataField('Y', i);
        console.log(`Removed Y-axis field at index ${i}`);
      }
    }
        
    // Clear X-axis (category)
    const xAxisFields = await chartVisual.getDataFields('Category');
    if (xAxisFields && xAxisFields.length > 0) {
      console.log('Clearing Category axis fields...');
      for (let i = xAxisFields.length - 1; i >= 0; i--) {
        await chartVisual.removeDataField('Category', i);
        console.log(`Removed Category axis field at index ${i}`);
      }
    }

    // Clear Legend fields (for series/grouping)
    try {
      const legendFields = await chartVisual.getDataFields('Legend');
      if (legendFields && legendFields.length > 0) {
        console.log('Clearing Legend fields...');
        for (let i = legendFields.length - 1; i >= 0; i--) {
          await chartVisual.removeDataField('Legend', i);
          console.log(`Removed Legend field at index ${i}`);
        }
      }
    } catch (legendError) {
      console.log('Could not clear Legend fields (may not exist):', legendError.message);
      // Try alternative data role names
      try {
        const seriesFields = await chartVisual.getDataFields('Series');
        if (seriesFields && seriesFields.length > 0) {
          console.log('Clearing Series fields...');
          for (let i = seriesFields.length - 1; i >= 0; i--) {
            await chartVisual.removeDataField('Series', i);
            console.log(`Removed Series field at index ${i}`);
          }
        }
      } catch (seriesError) {
        console.log('Could not clear Series fields either:', seriesError.message);
      }
    }
  } catch (error) {
    console.log('Could not clear existing fields (may not exist):', error.message);
  }
}

/**
 * Add fields based on AI chartAction
 * @param {Object} chartVisual - Power BI chart visual
 * @param {Object} chartAction - AI response with field configuration
 */
async function addFieldsFromAI(chartVisual, chartAction) {
  try {
    console.log('DEBUG: addFieldsFromAI called with chartAction:', chartAction);
        
    // Debug: Let's see what data roles are available
    try {
      const dataRoles = await chartVisual.getDataRoles();
      console.log('Available data roles:', dataRoles);
    } catch (roleError) {
      console.log('Could not get data roles:', roleError.message);
    }
        
    // Add Y-axis field (measures)
    if (chartAction.yAxis) {
      const { table, field } = parseFieldName(chartAction.yAxis);
      const target = {
        $schema: 'http://powerbi.com/product/schema#measure',
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
        $schema: 'http://powerbi.com/product/schema#column',
        table: table,
        column: field
      };
      console.log(`Adding ${chartAction.xAxis} (dimension) to Category data role...`);
      console.log('Target object:', JSON.stringify(target, null, 2));
      await chartVisual.addDataField('Category', target);
      console.log(`${chartAction.xAxis} added to Category data role successfully`);
    }

    // Add series field (for clustered charts) - goes to Legend data role
    if (chartAction.series) {
      const { table, field } = parseFieldName(chartAction.series);
      const target = {
        $schema: 'http://powerbi.com/product/schema#column',
        table: table,
        column: field
      };
      console.log(`Adding ${chartAction.series} (series) to Legend data role...`);
      console.log('Target object:', JSON.stringify(target, null, 2));
            
      try {
        await chartVisual.addDataField('Legend', target);
        console.log(`${chartAction.series} added to Legend data role successfully`);
      } catch (legendError) {
        console.log(`Failed to add to Legend data role, trying Series: ${legendError.message}`);
        try {
          await chartVisual.addDataField('Series', target);
          console.log(`${chartAction.series} added to Series data role successfully`);
        } catch (seriesError) {
          console.log(`Failed to add to Series data role, trying Column Series: ${seriesError.message}`);
          try {
            await chartVisual.addDataField('ColumnSeries', target);
            console.log(`${chartAction.series} added to ColumnSeries data role successfully`);
          } catch (finalError) {
            console.error(`Failed to add series field to any data role: ${finalError.message}`);
            // Don't throw - continue with other fields
          }
        }
      }
    }
        
    const configuredFields = [];
    if (chartAction.yAxis) configuredFields.push(`Y: ${chartAction.yAxis}`);
    if (chartAction.xAxis) configuredFields.push(`X: ${chartAction.xAxis}`);
    if (chartAction.series) configuredFields.push(`Series: ${chartAction.series}`);
        
    console.log(`Chart configured as ${chartAction.chartType} with fields: ${configuredFields.join(', ')}`);
        
  } catch (error) {
    console.error('Error adding fields from AI:', error);
    throw error;
  }
}

/**
 * Get current chart configuration from the active chart
 * @returns {Object|null} Current chart configuration or null if not available
 */
async function getCurrentChartConfig() {
  try {
    const report = getReport();
    if (!report) {
      console.log('No report instance available for chart config');
      return null;
    }

    // Check if report is fully loaded
    if (!getReportLoadState()?.rendered) {
      console.log('Report not yet fully rendered, skipping chart config load');
      return null;
    }

    const pages = await report.getPages();
    const activePage = pages.find(page => page.isActive) || pages[0];
        
    if (!activePage) {
      console.log('No active page found for chart config');
      return null;
    }

    const chartVisual = await findChartVisual(activePage);

    if (!chartVisual) {
      console.log('No chart visual found for config');
      return null;
    }

    // Get current data fields
    const yAxisFields = await chartVisual.getDataFields('Y');
    const xAxisFields = await chartVisual.getDataFields('Category');
        
    let legendFields = null;
    try {
      legendFields = await chartVisual.getDataFields('Legend');
    } catch (legendError) {
      console.log('Legend data role not available, trying Series:', legendError.message);
      try {
        legendFields = await chartVisual.getDataFields('Series');
      } catch (seriesError) {
        console.log('Series data role not available either:', seriesError.message);
      }
    }

    const config = {
      chartType: chartVisual.type,
      yAxis: null,
      xAxis: null,
      series: null
    };

    // Determine Y-axis measure - use whatever the LLM provided
    if (yAxisFields && yAxisFields.length > 0) {
      const yField = yAxisFields[0];
      if (yField.measure) {
        config.yAxis = yField.measure;
      } else if (yField.column) {
        config.yAxis = yField.column;
      }
    }

    // Determine X-axis dimension - use whatever the LLM provided
    if (xAxisFields && xAxisFields.length > 0) {
      const xField = xAxisFields[0];
      if (xField.column) {
        config.xAxis = xField.column;
      }
    }

    // Determine series/legend dimension (for clustered charts) - use whatever the LLM provided
    if (legendFields && legendFields.length > 0) {
      const legendField = legendFields[0];
      if (legendField.column) {
        // Try to build full table.column name if table is provided
        const tableName = legendField.table || 'Unknown';
        config.series = `${tableName}.${legendField.column}`;
      }
    }

    console.log('Current chart config:', config);
    return config;

  } catch (error) {
    console.error('Error getting current chart config:', error);
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
    chartType: chartAction.chartType || currentChartConfig.chartType,
    series: chartAction.series || currentChartConfig.series
  };
    
  // Only update if we have valid core values
  if (newConfig.yAxis && newConfig.xAxis && newConfig.chartType) {
    currentChartConfig = newConfig;
    console.log('Updated current chart config:', currentChartConfig);
  } else {
    console.warn('Incomplete chart action received, preserving current config:', chartAction);
    console.log('Current config remains:', currentChartConfig);
  }
}



/**
 * Initialize chart operations module
 */
function initializeChartOperations() {
  console.log('Chart operations module initialized');
  console.log('Supported chart types:', SUPPORTED_CHART_TYPES);
}

// ES6 Module exports
export {
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
  currentChartConfig
};