import React from 'react'
import { usePowerBI } from './hooks/usePowerBI'
import { useLayout } from './hooks/useLayout'
import LoadingScreen from './components/LoadingScreen'
import ErrorScreen from './components/ErrorScreen'
import AppLayout from './components/AppLayout'

function App() {
  // PowerBI state and logic
  const {
    embedConfig,
    loading,
    error,
    debugInfo,
    eventHandlers,
    getEmbeddedComponent
  } = usePowerBI()

  // Layout state and logic
  const {
    metadataPanelCollapsed,
    toggleMetadataPanel,
    getMainContentStyle,
    getMainContentClassName
  } = useLayout()

  // Render loading state
  if (loading) {
    return <LoadingScreen debugInfo={debugInfo} />
  }

  // Render error state
  if (error) {
    return <ErrorScreen error={error} />
  }

  // Render main application
  return (
    <AppLayout 
      metadataPanelCollapsed={metadataPanelCollapsed}
      onToggleMetadataPanel={toggleMetadataPanel}
      mainContentStyle={getMainContentStyle()}
      mainContentClassName={getMainContentClassName()}
      embedConfig={embedConfig}
      eventHandlers={eventHandlers}
      getEmbeddedComponent={getEmbeddedComponent}
    />
  )
}

export default App