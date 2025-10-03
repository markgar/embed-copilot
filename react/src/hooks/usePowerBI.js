/**
 * PowerBI Hook
 * Custom React hook for managing PowerBI embedding state and lifecycle
 */

import { useState, useEffect, useRef } from 'react'
import { initializePowerBI, setReportInstance, updateReportState, createDefaultVisual } from '../services/powerbiService'
import { serverLog, logErrorToServer } from '../utils/logging'

export const usePowerBI = () => {
  const [embedConfig, setEmbedConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState('Starting...')
  
  const reportRef = useRef(null)
  const visualCreated = useRef(false)

  useEffect(() => {
    const setupPowerBI = async () => {
      try {
        setDebugInfo('Starting Power BI initialization...')
        const config = await initializePowerBI()
        setEmbedConfig(config)
        setDebugInfo('Embed configuration ready')
        setLoading(false)
      } catch (err) {
        const errorMessage = `PowerBI Hook Error: ${err.message}`
        setError(errorMessage)
        setDebugInfo('Failed to initialize')
        setLoading(false)
      }
    }

    setupPowerBI()
  }, [])

  // Event handlers for PowerBI embed component
  const eventHandlers = new Map([
    ['loaded', async () => {
      serverLog('PowerBI Hook: Report loaded event triggered')
      updateReportState({ loaded: true })
      
      // Only create visual once, exactly like vanilla app
      if (!visualCreated.current && reportRef.current) {
        try {
          serverLog('PowerBI Hook: Creating default visual on report load...')
          await createDefaultVisual(reportRef.current)
          visualCreated.current = true
          serverLog('PowerBI Hook: Default visual created successfully on report load')
        } catch (error) {
          serverLog(`PowerBI Hook: Error creating default visual on report load: ${error.message}`)
          logErrorToServer('PowerBI Hook: Error creating default visual on report load', error)
        }
      } else if (visualCreated.current) {
        serverLog('PowerBI Hook: Visual already created, skipping')
      } else {
        serverLog('PowerBI Hook: No report reference available for creating default visual')
      }
    }],
    ['rendered', () => {
      serverLog('PowerBI Hook: Report rendered event triggered')
      updateReportState({ rendered: true })
      // Exactly like vanilla app - NO visual creation in rendered event
    }],
    ['error', (event) => {
      logErrorToServer('PowerBI Hook: PowerBI Error', event.detail)
      setError(`PowerBI Error: ${event.detail}`)
    }]
  ])

  // Callback for when PowerBI component is embedded
  const getEmbeddedComponent = (embeddedReport) => {
    serverLog('PowerBI Hook: getEmbeddedComponent called')
    serverLog(`PowerBI Hook: Embedded report type: ${typeof embeddedReport}`)
    serverLog(`PowerBI Hook: Embedded report constructor: ${embeddedReport.constructor.name}`)
    
    // Check if this object has the getPages method
    if (typeof embeddedReport.getPages === 'function') {
      serverLog('PowerBI Hook: Found getPages method on embeddedReport!')
      reportRef.current = embeddedReport
      setReportInstance(embeddedReport)
      serverLog('PowerBI Hook: Report reference captured from getEmbeddedComponent')
    } else {
      serverLog('PowerBI Hook: No getPages method found on embeddedReport')
      // Still store it for comparison
      reportRef.current = embeddedReport
      setReportInstance(embeddedReport)
      serverLog('PowerBI Hook: Report reference captured from getEmbeddedComponent (without getPages)')
    }
  }

  return {
    embedConfig,
    loading,
    error,
    debugInfo,
    eventHandlers,
    getEmbeddedComponent
  }
}