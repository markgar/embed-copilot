import React from 'react'
import { PowerBIEmbed } from 'powerbi-client-react'
import { powerBIStyles } from '../utils/styles'
import MetadataPanel from './MetadataPanel'
import ChatPanel from './ChatPanel'

const AppLayout = ({ 
  metadataPanelCollapsed, 
  onToggleMetadataPanel,
  mainContentStyle,
  mainContentClassName,
  embedConfig,
  eventHandlers,
  getEmbeddedComponent 
}) => {
  return (
    <>
      {/* Metadata Panel */}
      <MetadataPanel 
        isCollapsed={metadataPanelCollapsed}
        onToggle={onToggleMetadataPanel}
      />
      
      {/* Chat Panel */}
      <ChatPanel />
      
      {/* PowerBI report container with margin-based positioning like vanilla app */}
      <div 
        className={mainContentClassName}
        style={mainContentStyle}
      >
        <PowerBIEmbed
          embedConfig={embedConfig}
          eventHandlers={eventHandlers}
          getEmbeddedComponent={getEmbeddedComponent}
          cssClassName="powerbi-report-container"
          style={powerBIStyles.container}
        />
      </div>
    </>
  )
}

export default AppLayout