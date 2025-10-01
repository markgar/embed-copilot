// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

/**
 * Data Controls Module
 * Handles button interactions, measure switching, and dimension controls
 */

// Import dependencies
import { getReport } from './powerbi-core.js';
import { findChartVisual } from './chart-operations.js';

// Track current measure state
let currentMeasure = 'TotalSales';

/**
 * Show error in the error container
 * @param {string} errorMessage - Error message to display
 */
function updateErrorContainer(errorMessage) {
  const errorContainer = document.querySelector('.error-container');
  if (errorContainer) {
    errorContainer.style.display = 'block';
    errorContainer.innerHTML = `
            <h4>Error:</h4>
            <p>${errorMessage}</p>
        `;
  }
}

/**
 * Get the report instance and active page
 * @returns {Object} Object with report and activePage, or null if not available
 */
async function getReportAndPage() {
  const report = getReport();
  if (!report) {
    console.error('No report instance available');
    return null;
  }

  const pages = await report.getPages();
  const activePage = pages.find(page => page.isActive) || pages[0];
    
  if (!activePage) {
    console.error('No active page found');
    return null;
  }

  return { report, activePage };
}

/**
 * Ensure report is in edit mode for chart modifications
 * @param {Object} report - Power BI report instance
 */
async function ensureEditMode(report) {
  if (report.mode !== 'edit') {
    console.log('Switching report to edit mode');
    await report.switchMode('edit');
  }
}

/**
 * Update button text based on current measure
 */
function updateButtonText() {
  const nextMeasure = currentMeasure === 'TotalSales' ? 'TotalUnits' : 'TotalSales';
  const button = document.getElementById('add-totalsales-btn');
  if (button) {
    button.textContent = `Switch to ${nextMeasure}`;
  }
}

/**
 * Toggle between TotalSales and TotalUnits measures
 */
async function toggleMeasure() {
  try {
    console.log('Button clicked - removing TotalSales and adding TotalUnits');
        
    // First remove TotalSales
    await removeTotalSalesFromChart();
        
    // Then add TotalUnits
    await addTotalUnitsToChart();
        
    console.log('Successfully completed toggle operation');
        
  } catch (error) {
    console.error('Error in toggle operation:', error.message || error);
    updateErrorContainer(`Error toggling measures: ${error.message || error}`);
  }
}

/**
 * Show TotalSales measure on the chart
 * Removes existing measures and adds TotalSales
 */
async function showTotalSales() {
  try {
    console.log('Starting showTotalSales function');
        
    const reportData = await getReportAndPage();
    if (!reportData) return;
        
    const { report, activePage } = reportData;
    await ensureEditMode(report);
        
    console.log('Found active page:', activePage.displayName);
        
    // Find chart visual using the chart operations module
    const chartVisual = await findChartVisual(activePage);
        
    if (!chartVisual) {
      console.error('No suitable chart visual found');
      return;
    }
        
    console.log('Found chart visual:', chartVisual.type, chartVisual.title);
        
    // Get current data fields to remove existing measures
    try {
      const dataFields = await chartVisual.getDataFields('Y');
      console.log('Current data fields in Y axis:', dataFields);
            
      // Remove existing measures from the 'Y' data role
      if (dataFields && dataFields.length > 0) {
        console.log('Removing existing measures from Y axis...');
        for (let i = dataFields.length - 1; i >= 0; i--) {
          await chartVisual.removeDataField('Y', i);
          console.log(`Removed measure at index ${i}`);
        }
      }
    } catch (error) {
      console.log('Could not get current data fields, proceeding to add TotalSales:', error.message);
    }
        
    // Define the TotalSales measure target
    const totalSalesTarget = {
      $schema: 'http://powerbi.com/product/schema#measure',
      table: 'Sales',
      measure: 'TotalSales'
    };
        
    console.log('Adding TotalSales to chart...');
    await chartVisual.addDataField('Y', totalSalesTarget);
    console.log('TotalSales added successfully');
        
    // Update current measure tracking
    currentMeasure = 'TotalSales';
    updateButtonText();
        
  } catch (error) {
    console.error('Error in showTotalSales:', error);
    updateErrorContainer('Error showing TotalSales: ' + error.message);
  }
}

/**
 * Show TotalUnits measure on the chart
 * Removes existing measures and adds TotalUnits
 */
async function showTotalUnits() {
  try {
    console.log('Starting showTotalUnits function');
        
    const reportData = await getReportAndPage();
    if (!reportData) return;
        
    const { report, activePage } = reportData;
    await ensureEditMode(report);
        
    console.log('Found active page:', activePage.displayName);
        
    // Find chart visual using the chart operations module
    const chartVisual = await findChartVisual(activePage);
        
    if (!chartVisual) {
      console.error('No suitable chart visual found');
      return;
    }
        
    console.log('Found chart visual:', chartVisual.type, chartVisual.title);
        
    // Get current data fields to remove existing measures
    try {
      const dataFields = await chartVisual.getDataFields('Y');
      console.log('Current data fields in Y axis:', dataFields);
            
      // Remove existing measures from the 'Y' data role
      if (dataFields && dataFields.length > 0) {
        console.log('Removing existing measures from Y axis...');
        for (let i = dataFields.length - 1; i >= 0; i--) {
          await chartVisual.removeDataField('Y', i);
          console.log(`Removed measure at index ${i}`);
        }
      }
    } catch (error) {
      console.log('Could not get current data fields, proceeding to add TotalUnits:', error.message);
    }
        
    // Define the TotalUnits measure target
    const totalUnitsTarget = {
      $schema: 'http://powerbi.com/product/schema#measure',
      table: 'Sales',
      measure: 'TotalUnits'
    };
        
    console.log('Adding TotalUnits to chart...');
    await chartVisual.addDataField('Y', totalUnitsTarget);
    console.log('TotalUnits added successfully');
        
    // Update current measure tracking
    currentMeasure = 'TotalUnits';
    updateButtonText();
        
  } catch (error) {
    console.error('Error in showTotalUnits:', error);
    updateErrorContainer('Error showing TotalUnits: ' + error.message);
  }
}

/**
 * Add TotalUnits measure to existing chart
 * (Alternative method for adding without removing existing)
 */
async function addTotalUnitsToChart() {
  try {
    console.log('Starting addTotalUnitsToChart function');
        
    const reportData = await getReportAndPage();
    if (!reportData) return;
        
    const { report, activePage } = reportData;
    await ensureEditMode(report);
        
    console.log('Found active page:', activePage.displayName);
        
    // Find chart visual using the chart operations module
    const chartVisual = await findChartVisual(activePage);
        
    if (!chartVisual) {
      console.error('No suitable chart visual found');
      return;
    }
        
    console.log('Found chart visual:', chartVisual.type, chartVisual.title);
        
    // Define the TotalUnits measure target
    const totalUnitsTarget = {
      $schema: 'http://powerbi.com/product/schema#measure',
      table: 'Sales',
      measure: 'TotalUnits'
    };
        
    console.log('Target configuration:', totalUnitsTarget);
        
    // Check if the visual has authoring methods available
    if (typeof chartVisual.addDataField !== 'function') {
      const errorMsg = 'The visual does not support addDataField method. Make sure the powerbi-report-authoring library is loaded and the report is in edit mode.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
        
    // Add TotalUnits to the 'Y' data role
    console.log('Adding TotalUnits to data role: Y');
    await chartVisual.addDataField('Y', totalUnitsTarget);
    console.log('Successfully added TotalUnits to the chart');
        
    // Update current measure tracking
    currentMeasure = 'TotalUnits';
    updateButtonText();
        
  } catch (error) {
    console.error('Error in addTotalUnitsToChart:', error.message || error);
    updateErrorContainer(`Error adding TotalUnits measure: ${error.message || error}`);
  }
}

/**
 * Generic function to add a measure to an existing chart
 * @param {string} measureName - Name of the measure to add
 */
async function addMeasureToChart(measureName) {
  try {
    console.log(`Starting addMeasureToChart function with measure: ${measureName}`);
        
    const reportData = await getReportAndPage();
    if (!reportData) return;
        
    const { report, activePage } = reportData;
    await ensureEditMode(report);
        
    console.log('Found active page:', activePage.displayName);
        
    // Find chart visual using the chart operations module
    const chartVisual = await findChartVisual(activePage);
        
    if (!chartVisual) {
      console.error('No suitable chart visual found');
      return;
    }
        
    console.log('Found chart visual:', chartVisual.type, chartVisual.title);
        
    // Define the measure target
    const measureTarget = {
      $schema: 'http://powerbi.com/product/schema#measure',
      table: 'Sales',
      measure: measureName
    };
        
    console.log('Target configuration:', measureTarget);
        
    // Check if the visual has authoring methods available
    if (typeof chartVisual.addDataField !== 'function') {
      const errorMsg = 'The visual does not support addDataField method. Make sure the powerbi-report-authoring library is loaded and the report is in edit mode.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
        
    // Remove existing data field from Y role using index (Microsoft's pattern)
    try {
      console.log('Attempting to remove existing field from Y role at index 0');
      await chartVisual.removeDataField('Y', 0);
      console.log('Successfully removed existing field from Y role');
    } catch (removeError) {
      console.warn('Could not remove existing field (may not exist):', removeError.message);
    }
        
    // Add the new measure to the 'Y' data role
    console.log(`Adding ${measureName} to data role: Y`);
    await chartVisual.addDataField('Y', measureTarget);
    console.log(`Successfully added ${measureName} to the chart`);
        
    // Update current measure tracking
    currentMeasure = measureName;
    updateButtonText();
        
  } catch (error) {
    console.error(`Error in addMeasureToChart with ${measureName}:`, error.message || error);
    updateErrorContainer(`Error adding ${measureName} measure: ${error.message || error}. Please check that the ${measureName} measure exists in your data model.`);
  }
}

/**
 * Show data by Month dimension
 * Removes existing categories and adds Month to X-axis
 */
async function showByMonth() {
  try {
    console.log('Starting showByMonth function');
        
    const reportData = await getReportAndPage();
    if (!reportData) return;
        
    const { report, activePage } = reportData;
    await ensureEditMode(report);
        
    console.log('Found active page:', activePage.displayName);
        
    // Find chart visual using the chart operations module
    const chartVisual = await findChartVisual(activePage);
        
    if (!chartVisual) {
      console.error('No suitable chart visual found');
      return;
    }
        
    console.log('Found chart visual:', chartVisual.type, chartVisual.title);
        
    // Get current data fields to remove existing categories from X-axis
    try {
      const dataFields = await chartVisual.getDataFields('Category');
      console.log('Current data fields in Category axis:', dataFields);
            
      // Remove existing categories from the 'Category' data role
      if (dataFields && dataFields.length > 0) {
        console.log('Removing existing categories from Category axis...');
        for (let i = dataFields.length - 1; i >= 0; i--) {
          await chartVisual.removeDataField('Category', i);
          console.log(`Removed category at index ${i}`);
        }
      }
    } catch (error) {
      console.log('Could not get current data fields, proceeding to add Month:', error.message);
    }
        
    // Define the Month column target
    const monthTarget = {
      $schema: 'http://powerbi.com/product/schema#column',
      table: 'Time',
      column: 'Month'
    };
        
    console.log('Adding Month to chart Category axis...');
    await chartVisual.addDataField('Category', monthTarget);
    console.log('Month added successfully');
        
  } catch (error) {
    console.error('Error in showByMonth:', error);
    updateErrorContainer('Error showing by Month: ' + error.message);
  }
}

/**
 * Show data by District dimension
 * Removes existing categories and adds District to X-axis
 */
async function showByDistrict() {
  try {
    console.log('Starting showByDistrict function');
        
    const reportData = await getReportAndPage();
    if (!reportData) return;
        
    const { report, activePage } = reportData;
    await ensureEditMode(report);
        
    console.log('Found active page:', activePage.displayName);
        
    // Find chart visual using the chart operations module
    const chartVisual = await findChartVisual(activePage);
        
    if (!chartVisual) {
      console.error('No suitable chart visual found');
      return;
    }
        
    console.log('Found chart visual:', chartVisual.type, chartVisual.title);
        
    // Get current data fields to remove existing categories from X-axis
    try {
      const dataFields = await chartVisual.getDataFields('Category');
      console.log('Current data fields in Category axis:', dataFields);
            
      // Remove existing categories from the 'Category' data role
      if (dataFields && dataFields.length > 0) {
        console.log('Removing existing categories from Category axis...');
        for (let i = dataFields.length - 1; i >= 0; i--) {
          await chartVisual.removeDataField('Category', i);
          console.log(`Removed category at index ${i}`);
        }
      }
    } catch (error) {
      console.log('Could not get current data fields, proceeding to add District:', error.message);
    }
        
    // Define the District column target
    const districtTarget = {
      $schema: 'http://powerbi.com/product/schema#column',
      table: 'District',
      column: 'District'
    };
        
    console.log('Adding District to chart Category axis...');
    await chartVisual.addDataField('Category', districtTarget);
    console.log('District added successfully');
        
  } catch (error) {
    console.error('Error in showByDistrict:', error);
    updateErrorContainer('Error showing by District: ' + error.message);
  }
}

/**
 * Remove TotalSales from chart (used in toggle function)
 * TODO: Implement this function if needed for toggle functionality
 */
async function removeTotalSalesFromChart() {
  console.log('removeTotalSalesFromChart function called - implementation needed');
  // This function was referenced but not found in original code
  // It could be implemented using the clearChartFields functionality
}

/**
 * Initialize data controls event handlers
 */
function initializeDataControls() {
  // Set up button click handlers
  const totalSalesBtn = document.getElementById('add-totalsales-btn');
  if (totalSalesBtn) {
    totalSalesBtn.addEventListener('click', function() {
      console.log('Show TotalSales button clicked');
      showTotalSales();
    });
  }
    
  const totalUnitsBtn = document.getElementById('add-totalunits-btn');
  if (totalUnitsBtn) {
    totalUnitsBtn.addEventListener('click', function() {
      console.log('Show TotalUnits button clicked');
      showTotalUnits();
    });
  }
    
  const monthBtn = document.getElementById('add-month-btn');
  if (monthBtn) {
    monthBtn.addEventListener('click', function() {
      console.log('Show by Month button clicked');
      showByMonth();
    });
  }
    
  const districtBtn = document.getElementById('add-district-btn');
  if (districtBtn) {
    districtBtn.addEventListener('click', function() {
      console.log('Show by District button clicked');
      showByDistrict();
    });
  }
    
  // Initialize button text
  updateButtonText();
    
  console.log('Data controls initialized');
}

// Accessor functions for currentMeasure
function getCurrentMeasure() {
  return currentMeasure;
}

function setCurrentMeasure(value) {
  currentMeasure = value;
}

// ES6 module exports
export {
  updateButtonText,
  toggleMeasure,
  showTotalSales,
  showTotalUnits,
  addTotalUnitsToChart,
  addMeasureToChart,
  showByMonth,
  showByDistrict,
  removeTotalSalesFromChart,
  updateErrorContainer,
  initializeDataControls,
  getCurrentMeasure,
  setCurrentMeasure
};

// Backward compatibility (will be removed after migration)
const ChartChatDataControls = {
  updateButtonText,
  toggleMeasure,
  showTotalSales,
  showTotalUnits,
  addTotalUnitsToChart,
  addMeasureToChart,
  showByMonth,
  showByDistrict,
  removeTotalSalesFromChart,
  updateErrorContainer,
  initializeDataControls,
  // Expose currentMeasure for other modules
  get currentMeasure() { return currentMeasure; },
  set currentMeasure(value) { currentMeasure = value; }
};

// Export to global scope for backward compatibility
window.ChartChatDataControls = ChartChatDataControls;