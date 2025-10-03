/**
 * Chart Operations Service
 * Handles chart manipulation, AI integration, and chart creation/update operations
 * React equivalent of vanilla's chart-operations.js
 */

import { getReportInstance } from './powerbiService'
import { serverLog, logErrorToServer } from '../utils/logging'

/* global window, CustomEvent */

// Track current chart configuration for partial updates
let currentChartConfig = {
  yAxis: null,
  xAxis: null,
  chartType: null,
  series: null
}

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
]

/**
 * Check if a visual is a supported chart type
 */
const isSupportedChartType = (visual) => {
  return SUPPORTED_CHART_TYPES.includes(visual.type)
}

/**
 * Find the first chart visual on the active page
 */
const findChartVisual = async (activePage) => {
  try {
    const visuals = await activePage.getVisuals()
    serverLog(`Chart Operations: Found ${visuals.length} visuals on the page`)
        
    const chartVisual = visuals.find(visual => isSupportedChartType(visual))
        
    if (chartVisual) {
      serverLog(`Chart Operations: Found chart visual: ${chartVisual.type} ${chartVisual.title || ''}`)
    } else {
      serverLog(`Chart Operations: No suitable chart visual found - available types: ${visuals.map(v => v.type).join(', ')}`)
    }
        
    return chartVisual
  } catch (error) {
    serverLog(`Chart Operations: Error finding chart visual: ${error.message}`)
    return null
  }
}

/**
 * Helper function to parse field names in [Table].[Field] format
 */
const parseFieldName = (fieldName) => {
  // Handle dotted field names like "Sales.TotalSales" or "Time.Month"
  if (fieldName.includes('.')) {
    const [table, field] = fieldName.split('.')
    return { table, field }
  } else {
    // If no table specified, assume it's just a field name
    return { table: null, field: fieldName }
  }
}

/**
 * Clear existing fields from the chart
 */
const clearChartFields = async (chartVisual) => {
  try {
    // Clear Y-axis (values)
    const yAxisFields = await chartVisual.getDataFields('Y')
    if (yAxisFields && yAxisFields.length > 0) {
      serverLog('Chart Operations: Clearing Y-axis fields...')
      for (let i = yAxisFields.length - 1; i >= 0; i--) {
        await chartVisual.removeDataField('Y', i)
        serverLog(`Chart Operations: Removed Y-axis field at index ${i}`)
      }
    }
        
    // Clear X-axis (category)
    const xAxisFields = await chartVisual.getDataFields('Category')
    if (xAxisFields && xAxisFields.length > 0) {
      serverLog('Chart Operations: Clearing Category axis fields...')
      for (let i = xAxisFields.length - 1; i >= 0; i--) {
        await chartVisual.removeDataField('Category', i)
        serverLog(`Chart Operations: Removed Category axis field at index ${i}`)
      }
    }

    // Clear Legend fields (for series/grouping)
    try {
      const legendFields = await chartVisual.getDataFields('Legend')
      if (legendFields && legendFields.length > 0) {
        serverLog('Chart Operations: Clearing Legend fields...')
        for (let i = legendFields.length - 1; i >= 0; i--) {
          await chartVisual.removeDataField('Legend', i)
          serverLog(`Chart Operations: Removed Legend field at index ${i}`)
        }
      }
    } catch (legendError) {
      serverLog(`Chart Operations: Could not clear Legend fields (may not exist): ${legendError.message}`)
      // Try alternative data role names
      try {
        const seriesFields = await chartVisual.getDataFields('Series')
        if (seriesFields && seriesFields.length > 0) {
          serverLog('Chart Operations: Clearing Series fields...')
          for (let i = seriesFields.length - 1; i >= 0; i--) {
            await chartVisual.removeDataField('Series', i)
            serverLog(`Chart Operations: Removed Series field at index ${i}`)
          }
        }
      } catch (seriesError) {
        serverLog(`Chart Operations: Could not clear Series fields either: ${seriesError.message}`)
      }
    }
  } catch (error) {
    serverLog(`Chart Operations: Could not clear existing fields (may not exist): ${error.message}`)
  }
}

/**
 * Add fields based on AI chartAction
 */
const addFieldsFromAI = async (chartVisual, chartAction) => {
  try {
    serverLog('Chart Operations: addFieldsFromAI called with chartAction:', chartAction)
        
    // Add Y-axis field (measures)
    if (chartAction.yAxis) {
      const { table, field } = parseFieldName(chartAction.yAxis)
      const target = {
        $schema: 'http://powerbi.com/product/schema#measure',
        table: table,
        measure: field
      }
      serverLog(`Chart Operations: Adding ${chartAction.yAxis} (measure) to Y data role...`)
      await chartVisual.addDataField('Y', target)
      serverLog(`Chart Operations: ${chartAction.yAxis} added to Y data role successfully`)
    }

    // Add X-axis field (dimensions)
    if (chartAction.xAxis) {
      const { table, field } = parseFieldName(chartAction.xAxis)
      const target = {
        $schema: 'http://powerbi.com/product/schema#column',
        table: table,
        column: field
      }
      serverLog(`Chart Operations: Adding ${chartAction.xAxis} (dimension) to Category data role...`)
      await chartVisual.addDataField('Category', target)
      serverLog(`Chart Operations: ${chartAction.xAxis} added to Category data role successfully`)
    }

    // Add series field (for clustered charts) - goes to Legend data role
    if (chartAction.series) {
      const { table, field } = parseFieldName(chartAction.series)
      const target = {
        $schema: 'http://powerbi.com/product/schema#column',
        table: table,
        column: field
      }
      serverLog(`Chart Operations: Adding ${chartAction.series} (series) to Legend data role...`)
            
      try {
        await chartVisual.addDataField('Legend', target)
        serverLog(`Chart Operations: ${chartAction.series} added to Legend data role successfully`)
      } catch (legendError) {
        serverLog(`Chart Operations: Failed to add to Legend data role, trying Series: ${legendError.message}`)
        try {
          await chartVisual.addDataField('Series', target)
          serverLog(`Chart Operations: ${chartAction.series} added to Series data role successfully`)
        } catch (seriesError) {
          serverLog(`Chart Operations: Failed to add to Series data role, trying Column Series: ${seriesError.message}`)
          try {
            await chartVisual.addDataField('ColumnSeries', target)
            serverLog(`Chart Operations: ${chartAction.series} added to ColumnSeries data role successfully`)
          } catch (finalError) {
            serverLog(`Chart Operations: Failed to add series field to any data role: ${finalError.message}`)
            // Don't throw - continue with other fields
          }
        }
      }
    }
        
    const configuredFields = []
    if (chartAction.yAxis) configuredFields.push(`Y: ${chartAction.yAxis}`)
    if (chartAction.xAxis) configuredFields.push(`X: ${chartAction.xAxis}`)
    if (chartAction.series) configuredFields.push(`Series: ${chartAction.series}`)
    
    serverLog(`Chart Operations: Chart configured with fields: ${configuredFields.join(', ')}`)
        
  } catch (error) {
    serverLog(`Chart Operations: Error adding fields from AI: ${error.message}`)
    logErrorToServer('Chart Operations: Error adding fields from AI', error)
    throw error
  }
}

/**
 * Update the current chart configuration tracking
 */
const updateCurrentChartConfig = (chartAction) => {
  if (chartAction.yAxis) currentChartConfig.yAxis = chartAction.yAxis
  if (chartAction.xAxis) currentChartConfig.xAxis = chartAction.xAxis
  if (chartAction.chartType) currentChartConfig.chartType = chartAction.chartType
  if (chartAction.series) currentChartConfig.series = chartAction.series
  
  serverLog('Chart Operations: Updated current chart config:', currentChartConfig)
}

/**
 * Update chart based on AI response (main export function)
 */
export const updateChartFromAI = async (chartAction) => {
  try {
    serverLog('Chart Operations: Starting AI chart update with:', chartAction)
        
    // Get PowerBI report instance from PowerBI Service
    const report = getReportInstance()
    if (!report) {
      serverLog('Chart Operations: No report instance available')
      window.dispatchEvent(new CustomEvent('chart-error', {
        detail: { message: 'Error: No report instance available.' }
      }))
      return
    }
        
    // Get the active page
    const pages = await report.getPages()
    const activePage = pages.find(page => page.isActive) || pages[0]
        
    if (!activePage) {
      serverLog('Chart Operations: No active page found')
      window.dispatchEvent(new CustomEvent('chart-error', {
        detail: { message: 'Error: Could not find an active page to update the chart.' }
      }))
      return
    }
        
    serverLog(`Chart Operations: Found active page: ${activePage.displayName || activePage.name || 'unnamed'}`)
        
    // Find the first chart visual
    const chartVisual = await findChartVisual(activePage)
        
    if (!chartVisual) {
      window.dispatchEvent(new CustomEvent('chart-error', {
        detail: { message: 'Error: Could not find a chart visual to update.' }
      }))
      return
    }
        
    // Clear existing fields from both axes
    await clearChartFields(chartVisual)
        
    // Change chart type if specified
    if (chartAction.chartType && chartAction.chartType !== chartVisual.type) {
      serverLog(`Chart Operations: Changing chart type from ${chartVisual.type} to ${chartAction.chartType}...`)
      await chartVisual.changeType(chartAction.chartType)
      serverLog(`Chart Operations: Chart type changed to ${chartAction.chartType} successfully`)
    }
        
    // Add the new fields based on AI response
    await addFieldsFromAI(chartVisual, chartAction)
        
    // Update the current chart configuration tracking
    updateCurrentChartConfig(chartAction)
        
    serverLog('Chart Operations: Chart updated successfully by AI')
        
  } catch (error) {
    const errorMessage = `Chart Operations: Error updating chart: ${error.message}`
    serverLog(errorMessage)
    logErrorToServer('Chart Operations: Error updating chart from AI', error)
    window.dispatchEvent(new CustomEvent('chart-error', {
      detail: { message: errorMessage }
    }))
  }
}

/**
 * Get current chart configuration
 */
export const getCurrentChartConfig = () => {
  return { ...currentChartConfig }
}