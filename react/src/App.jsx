import React, { useState, useEffect } from 'react'
import { PowerBIEmbed } from 'powerbi-client-react'
import { models } from 'powerbi-client'
import { serverLog, logErrorToServer } from './utils/logging'
import MetadataPanel from './components/MetadataPanel'
import ChatPanel from './components/ChatPanel'

function App() {
  const [embedConfig, setEmbedConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState('Starting...')
  const [metadataPanelCollapsed, setMetadataPanelCollapsed] = useState(false)

  useEffect(() => {
    // Get the frontend config and setup Power BI embedding
    const initializePowerBI = async () => {
      try {
        console.log('React App: Starting Power BI initialization...')
        setDebugInfo('Starting Power BI initialization...')
        serverLog('React App: Starting Power BI initialization...')
        
        // Get config from backend
        console.log('React App: Fetching config...')
        setDebugInfo('Fetching config...')
        const configResponse = await fetch('/system/config')
        if (!configResponse.ok) {
          throw new Error('Failed to load configuration')
        }
        const config = await configResponse.json()
        console.log('React App: Config loaded:', config)
        setDebugInfo('Config loaded successfully')
        serverLog('React App: Config loaded successfully')

        // Create or discover the report using the same logic as vanilla version
        console.log('React App: Ensuring report exists...')
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
        console.log('React App: Report result from fabric:', reportResult)
        setDebugInfo('Report ensured successfully')
        // serverLog('React App: Report result from fabric:', reportResult)
        
        // Extract reportId from the response structure
        if (!reportResult.success || !reportResult.data || !reportResult.data.reportId) {
          throw new Error('Invalid report response structure')
        }
        const reportId = reportResult.data.reportId
        console.log('React App: Extracted reportId:', reportId)
        setDebugInfo(`Extracted reportId: ${reportId}`)
        // serverLog('React App: Extracted reportId:', reportId)

        // Get embed token
        console.log('React App: Getting embed token for reportId:', reportId)
        console.log('React App: reportId type:', typeof reportId)
        console.log('React App: reportId length:', reportId ? reportId.length : 'undefined')
        setDebugInfo(`Getting embed token for reportId: ${reportId}`)
        
        if (!reportId) {
          throw new Error('reportId is undefined or empty')
        }
        
        const tokenUrl = `/getEmbedToken?reportId=${encodeURIComponent(reportId)}`
        console.log('React App: Token URL:', tokenUrl)
        const tokenResponse = await fetch(tokenUrl)
        if (!tokenResponse.ok) {
          throw new Error('Failed to get embed token')
        }
        const embedData = await tokenResponse.json()
        console.log('React App: Token received:', embedData)
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
          settings: {
            panes: {
              filters: {
                expanded: false,
                visible: false
              }
            }
          }
        })
        serverLog('React App: Embed configuration ready')
        setDebugInfo('Embed configuration ready')
        setLoading(false)
      } catch (err) {
        const errorMessage = `React App Error: ${err.message}`
        console.error('React App Error:', err)
        logErrorToServer(errorMessage, err)
        setError(errorMessage)
        setLoading(false)
      }
    }

    initializePowerBI()
  }, [])

  const eventHandlers = new Map([
    ['loaded', () => {
      serverLog('React App: Report loaded')
      // Enable chat when report is loaded
      window.dispatchEvent(new CustomEvent('powerbi-chat-state', {
        detail: { enableChat: true }
      }))
    }],
    ['rendered', () => serverLog('React App: Report rendered')],
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