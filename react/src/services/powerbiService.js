/**
 * PowerBI Service
 * Handles PowerBI embedding, authentication, and core event management
 * React equivalent of vanilla's powerbi-core.js
 */

import { models } from 'powerbi-client'
import 'powerbi-report-authoring'
import { serverLog, logErrorToServer } from '../utils/logging'

// For browser globals
/* global fetch, window, CustomEvent */

// Track current report instance and state
let reportInstance = null
let reportState = {
  loaded: false,
  rendered: false,
  get isReady() {
    return this.loaded && this.rendered
  }
}

/**
 * Initialize PowerBI embedding configuration
 */
export const initializePowerBI = async () => {
  try {
    serverLog('PowerBI Service: Starting Power BI initialization...')
    
    // Get config from backend
    serverLog('PowerBI Service: Fetching config...')
    const configResponse = await fetch('/system/config')
    if (!configResponse.ok) {
      throw new Error('Failed to load configuration')
    }
    const config = await configResponse.json()
    serverLog('PowerBI Service: Config loaded successfully')

    // Create or discover the report using the same logic as vanilla version
    serverLog('PowerBI Service: Ensuring report exists...')
    const reportResponse = await fetch('/fabric/reports/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: config.powerBIWorkspaceId,
        datasetId: config.powerBIDatasetId,
        reportName: config.powerBIDatasetId
      })
    })
    
    if (!reportResponse.ok) {
      throw new Error('Failed to ensure report exists')
    }
    const reportResult = await reportResponse.json()
    serverLog('PowerBI Service: Report result from fabric received')
    
    // Extract reportId from the response structure
    if (!reportResult.success || !reportResult.data || !reportResult.data.reportId) {
      throw new Error('Invalid report response structure')
    }
    const reportId = reportResult.data.reportId
    serverLog(`PowerBI Service: Extracted reportId: ${reportId}`)

    // Get embed token
    serverLog(`PowerBI Service: Getting embed token for reportId: ${reportId}`)
    const tokenUrl = `/getEmbedToken?reportId=${encodeURIComponent(reportId)}`
    const tokenResponse = await fetch(tokenUrl)
    if (!tokenResponse.ok) {
      throw new Error('Failed to get embed token')
    }
    const embedData = await tokenResponse.json()
    serverLog('PowerBI Service: Token received successfully')

    // Extract the correct data structure from embedData
    if (!embedData.embedUrl || !Array.isArray(embedData.embedUrl) || embedData.embedUrl.length === 0) {
      throw new Error('Invalid embed token response structure')
    }
    
    const embedInfo = embedData.embedUrl[0] // Get the first (and likely only) report
    const embedUrl = embedInfo.embedUrl
    const accessToken = embedData.accessToken

    // Set up embed config (matching vanilla app exactly)
    const embedConfig = {
      type: 'report',
      id: reportId,
      embedUrl: embedUrl,
      accessToken: accessToken,
      tokenType: models.TokenType.Embed,
      // Enable view mode by default, with all permissions for when we need edit mode (matching vanilla app)
      permissions: models.Permissions.All,
      viewMode: models.ViewMode.View,
      settings: {
        background: models.BackgroundType.Transparent,
        commands: [
          {
            // Hide drill up/down buttons
            drill: { displayOption: models.CommandDisplayOption.Hidden },
            // Hide expand/collapse buttons  
            expandCollapse: { displayOption: models.CommandDisplayOption.Hidden },
            // Hide export data button
            exportData: { displayOption: models.CommandDisplayOption.Hidden },
            // Hide spotlight button
            spotlight: { displayOption: models.CommandDisplayOption.Hidden },
            // Hide see data button
            seeData: { displayOption: models.CommandDisplayOption.Hidden },
            // Hide sort button
            sort: { displayOption: models.CommandDisplayOption.Hidden }
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
            visible: false  // Hide the filter pane completely
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
    }
    
    serverLog('PowerBI Service: Embed configuration ready')
    return embedConfig
    
  } catch (err) {
    const errorMessage = `PowerBI Service Error: ${err.message}`
    serverLog(errorMessage)
    logErrorToServer(errorMessage, err)
    throw err
  }
}

/**
 * Set report instance (called from App.jsx when PowerBIEmbed component mounts)
 */
export const setReportInstance = (report) => {
  reportInstance = report
  serverLog('PowerBI Service: Report instance set')
}

/**
 * Get current report instance
 */
export const getReportInstance = () => {
  return reportInstance
}

/**
 * Get report state
 */
export const getReportState = () => {
  return { ...reportState }
}

/**
 * Update report state
 */
export const updateReportState = (newState) => {
  Object.assign(reportState, newState)
  
  // Dispatch events for other components to listen to
  window.dispatchEvent(new CustomEvent('powerbi-chat-state', {
    detail: {
      enableChat: reportState.isReady,
      disableReason: reportState.loaded && !reportState.rendered ? 'Report rendering...' : null
    }
  }))
}

/**
 * Create a default visual on the active page (matching vanilla app)
 */
export const createDefaultVisual = async (report) => {
  try {
    serverLog('PowerBI Service: Creating default visual...')
    serverLog(`PowerBI Service: Report object type: ${typeof report}`)
    serverLog(`PowerBI Service: Report methods available: ${Object.getOwnPropertyNames(report).join(', ')}`)
    
    // Get the active page
    serverLog('PowerBI Service: Getting pages from report...')
    const pages = await report.getPages()
    serverLog(`PowerBI Service: Pages retrieved, count: ${pages ? pages.length : 'undefined'}`)
    
    const activePage = pages.find(page => page.isActive) || pages[0]
    serverLog(`PowerBI Service: Active page found: ${activePage ? activePage.name || 'unnamed' : 'none'}`)
    
    if (!activePage) {
      throw new Error('No active page found')
    }

    // Create a simple line chart visual with layout (matching vanilla app exactly)
    const customLayout = {
      width: 1242,
      height: 682,
      x: 19,
      y: 18,
      displayState: {
        mode: models.VisualContainerDisplayMode.Visible
      }
    }
    
    serverLog('PowerBI Service: Creating visual with layout and type lineChart')
    const createVisualResponse = await activePage.createVisual('lineChart', customLayout)
    serverLog('PowerBI Service: Default visual created successfully!')
    
    return createVisualResponse
  } catch (error) {
    serverLog(`PowerBI Service: Error creating default visual: ${error.message}`)
    logErrorToServer('PowerBI Service: Error creating default visual', error)
    throw error
  }
}