import React, { useState, useEffect, useRef } from 'react'
import { PowerBIEmbed } from 'powerbi-client-react'
import { models } from 'powerbi-client'
import 'powerbi-report-authoring'
import { serverLog, logErrorToServer } from './utils/logging'
import MetadataPanel from './components/MetadataPanel'
import ChatPanel from './components/ChatPanel'

function App() {
  const [embedConfig, setEmbedConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState('Starting...')
  const [metadataPanelCollapsed, setMetadataPanelCollapsed] = useState(false)
  const reportRef = useRef(null) // Use ref to store report instance
  const visualCreated = useRef(false) // Flag to prevent multiple visual creation

  useEffect(() => {
    // Get the frontend config and setup Power BI embedding
    const initializePowerBI = async () => {
      try {
        serverLog('React App: Starting Power BI initialization...')
        setDebugInfo('Starting Power BI initialization...')
        
        // Get config from backend
        serverLog('React App: Fetching config...')
        setDebugInfo('Fetching config...')
        const configResponse = await fetch('/system/config')
        if (!configResponse.ok) {
          throw new Error('Failed to load configuration')
        }
        const config = await configResponse.json()
        serverLog('React App: Config loaded successfully')
        setDebugInfo('Config loaded successfully')

        // Create or discover the report using the same logic as vanilla version
        serverLog('React App: Ensuring report exists...')
        setDebugInfo('Ensuring report exists...')
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
        serverLog('React App: Report result from fabric received')
        setDebugInfo('Report ensured successfully')
        // serverLog('React App: Report result from fabric:', reportResult)
        
        // Extract reportId from the response structure
        if (!reportResult.success || !reportResult.data || !reportResult.data.reportId) {
          throw new Error('Invalid report response structure')
        }
        const reportId = reportResult.data.reportId
        serverLog(`React App: Extracted reportId: ${reportId}`)
        setDebugInfo(`Extracted reportId: ${reportId}`)
        // serverLog('React App: Extracted reportId:', reportId)

        // Get embed token
        serverLog(`React App: Getting embed token for reportId: ${reportId}`)
        serverLog(`React App: reportId type: ${typeof reportId}`)
        serverLog(`React App: reportId length: ${reportId ? reportId.length : 'undefined'}`)
        setDebugInfo(`Getting embed token for reportId: ${reportId}`)
        
        if (!reportId) {
          throw new Error('reportId is undefined or empty')
        }
        
        const tokenUrl = `/getEmbedToken?reportId=${encodeURIComponent(reportId)}`
        serverLog(`React App: Token URL: ${tokenUrl}`)
        const tokenResponse = await fetch(tokenUrl)
        if (!tokenResponse.ok) {
          throw new Error('Failed to get embed token')
        }
        const embedData = await tokenResponse.json()
        serverLog('React App: Token received successfully')
        setDebugInfo('Token received successfully')
        // serverLog('React App: Token received successfully')

        // Extract the correct data structure from embedData
        if (!embedData.embedUrl || !Array.isArray(embedData.embedUrl) || embedData.embedUrl.length === 0) {
          throw new Error('Invalid embed token response structure')
        }
        
        const embedInfo = embedData.embedUrl[0] // Get the first (and likely only) report
        const embedUrl = embedInfo.embedUrl
        const accessToken = embedData.accessToken

        // Set up embed config
        setEmbedConfig({
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
        })
        serverLog('React App: Embed configuration ready')
        setDebugInfo('Embed configuration ready')
        setLoading(false)
      } catch (err) {
        const errorMessage = `React App Error: ${err.message}`
        serverLog(`React App Error: ${err.message}`)
        logErrorToServer(errorMessage, err)
        setError(errorMessage)
        setLoading(false)
      }
    }

    initializePowerBI()
  }, [])

  // Function to create default visual (matching vanilla app behavior)
  const createDefaultVisual = async (report) => {
    try {
      serverLog('React App: Creating default visual...')
      serverLog(`React App: Report object type: ${typeof report}`)
      serverLog(`React App: Report methods available: ${Object.getOwnPropertyNames(report).join(', ')}`)
      
      // Get the active page
      serverLog('React App: Getting pages from report...')
      const pages = await report.getPages()
      serverLog(`React App: Pages retrieved, count: ${pages ? pages.length : 'undefined'}`)
      
      const activePage = pages.find(page => page.isActive) || pages[0]
      serverLog(`React App: Active page found: ${activePage ? activePage.name || 'unnamed' : 'none'}`)
      
      if (!activePage) {
        throw new Error('No active page found')
      }

      // Create a simple line chart visual with layout (matching vanilla app)
      const customLayout = {
        width: 1242,
        height: 682,
        x: 19,
        y: 18,
        displayState: {
          mode: models.VisualContainerDisplayMode.Visible
        }
      }
      
      serverLog('React App: Creating visual with layout and type lineChart')
      const createVisualResponse = await activePage.createVisual('lineChart', customLayout)
      serverLog('React App: Default visual created successfully!')
      
      return createVisualResponse
    } catch (error) {
      serverLog(`React App: Error creating default visual: ${error.message}`)
      serverLog(`React App: Error stack: ${error.stack}`)
      logErrorToServer('React App: Error creating default visual', error)
      throw error
    }
  }

  const eventHandlers = new Map([
    ['loaded', async (event) => {
      serverLog('React App: Report loaded event triggered')
      
      // Only create visual once, exactly like vanilla app
      if (!visualCreated.current && reportRef.current) {
        try {
          serverLog('React App: Creating default visual on report load...')
          await createDefaultVisual(reportRef.current)
          visualCreated.current = true // Mark as created
          serverLog('React App: Default visual created successfully on report load')
        } catch (error) {
          serverLog(`React App: Error creating default visual on report load: ${error.message}`)
          logErrorToServer('React App: Error creating default visual on report load', error)
        }
      } else if (visualCreated.current) {
        serverLog('React App: Visual already created, skipping')
      } else {
        serverLog('React App: No report reference available for creating default visual')
      }
      
      // Enable chat when report is loaded
      window.dispatchEvent(new CustomEvent('powerbi-chat-state', {
        detail: { enableChat: true }
      }))
    }],
    ['rendered', () => {
      serverLog('React App: Report rendered event triggered')
      // Exactly like vanilla app - NO visual creation in rendered event
    }],
    ['error', (event) => logErrorToServer('React App: PowerBI Error', event.detail)]
  ])

  const toggleMetadataPanel = () => {
    setMetadataPanelCollapsed(!metadataPanelCollapsed)
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        flexDirection: 'column'
      }}>
        <h2>Loading Power BI Report...</h2>
        <p>Debug: {debugInfo}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        flexDirection: 'column'
      }}>
        <h2>Error Loading Report</h2>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    )
  }

  return (
    <>
      {/* Metadata Panel */}
      <MetadataPanel 
        isCollapsed={metadataPanelCollapsed}
        onToggle={toggleMetadataPanel}
      />
      
      {/* Chat Panel - Real implementation */}
      <ChatPanel />
      
      {/* PowerBI report container with margin-based positioning like vanilla app */}
      <div 
        className={`main-content ${metadataPanelCollapsed ? 'metadata-collapsed' : ''}`}
        style={{ 
          flex: 1,
          position: 'relative',
          transition: 'margin-left 0.3s ease',
          marginLeft: metadataPanelCollapsed ? '50px' : '300px',
          marginRight: '30%',
          height: '100vh'
        }}
      >
        <PowerBIEmbed
          embedConfig={embedConfig}
          eventHandlers={eventHandlers}
          getEmbeddedComponent={(embeddedReport) => {
            serverLog('React App: getEmbeddedComponent called')
            serverLog(`React App: Embedded report type: ${typeof embeddedReport}`)
            serverLog(`React App: Embedded report constructor: ${embeddedReport.constructor.name}`)
            
            // Check if this object has the getPages method
            if (typeof embeddedReport.getPages === 'function') {
              serverLog('React App: Found getPages method on embeddedReport!')
              reportRef.current = embeddedReport
              serverLog('React App: Report reference captured from getEmbeddedComponent')
            } else {
              serverLog('React App: No getPages method found on embeddedReport')
              // Still store it for comparison
              reportRef.current = embeddedReport
              serverLog('React App: Report reference captured from getEmbeddedComponent (without getPages)')
            }
            
            // Check for other potential properties that might contain the report
            const propNames = Object.getOwnPropertyNames(embeddedReport)
            propNames.forEach(prop => {
              try {
                const propValue = embeddedReport[prop]
                if (propValue && typeof propValue === 'object' && typeof propValue.getPages === 'function') {
                  serverLog(`React App: Found getPages method on property '${prop}'!`)
                  reportRef.current = propValue
                }
              } catch (e) {
                // Ignore errors accessing properties
              }
            })
            
            // Don't create visual here - let the loaded event handle it to avoid duplicates
          }}
          cssClassName="powerbi-report-container"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%'
          }}
        />
      </div>
    </>
  )
}

export default App