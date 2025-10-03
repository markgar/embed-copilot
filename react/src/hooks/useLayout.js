/**
 * Layout Hook
 * Manages UI layout state (panel collapse, etc.)
 */

import { useState } from 'react'

export const useLayout = () => {
  const [metadataPanelCollapsed, setMetadataPanelCollapsed] = useState(false)

  const toggleMetadataPanel = () => {
    setMetadataPanelCollapsed(!metadataPanelCollapsed)
  }

  // Calculate layout styles based on panel state
  const getMainContentStyle = () => ({
    flex: 1,
    position: 'relative',
    transition: 'margin-left 0.3s ease',
    marginLeft: metadataPanelCollapsed ? '50px' : '300px',
    marginRight: '30%',
    height: '100vh'
  })

  const getMainContentClassName = () => 
    `main-content ${metadataPanelCollapsed ? 'metadata-collapsed' : ''}`

  return {
    metadataPanelCollapsed,
    toggleMetadataPanel,
    getMainContentStyle,
    getMainContentClassName
  }
}