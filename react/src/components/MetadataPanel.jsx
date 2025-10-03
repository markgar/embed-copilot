import React, { useState, useEffect } from 'react'
import './MetadataPanel.css'

const MetadataPanel = ({ isCollapsed, onToggle }) => {
  const [tablesData, setTablesData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedTables, setExpandedTables] = useState(new Set())

  useEffect(() => {
    loadMetadata()
  }, [])

  const loadMetadata = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Loading metadata...')
      
      const response = await fetch('/getDatasetMetadata')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Metadata loaded:', data)
      setTablesData(data)
    } catch (err) {
      console.error('Error loading metadata:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleTable = (tableName) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const expandAll = () => {
    if (tablesData?.tables) {
      const allTableNames = tablesData.tables.map(table => table.name)
      setExpandedTables(new Set(allTableNames))
    }
  }

  const collapseAll = () => {
    setExpandedTables(new Set())
  }

  const handleColumnClick = (columnName, columnType) => {
    console.log(`Column clicked: ${columnName} (${columnType})`)
    // Future: Could add functionality to insert column into chat or copy to clipboard
  }

  const getColumnIcon = (column) => {
    if (column.isMeasure || column.type === 'measure') {
      return '∑' // Sigma for measures
    }
    
    switch (column.type) {
      case 'number':
      case 'decimal':
      case 'integer':
        return '#'
      case 'currency':
        return '$'
      case 'date':
        return '📅'
      case 'text':
      default:
        return 'Abc'
    }
  }

  const getDisplayType = (column) => {
    if (column.isMeasure || column.type === 'measure') {
      return column.dataType || 'measure'
    }
    return column.type
  }

  return (
    <div className={`metadata-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="metadata-header">
        <span 
          className="metadata-title" 
          onClick={onToggle}
          title="Toggle Schema Panel"
        >
          Dataset Schema
        </span>
        <button 
          className="metadata-toggle" 
          onClick={onToggle}
          title="Toggle Schema Panel"
        >
          <span className="toggle-open">≡</span>
          <span className="toggle-close">&lt;</span>
        </button>
      </div>
      
      <div className="metadata-controls">
        <button 
          className="metadata-control-btn" 
          onClick={expandAll}
          title="Expand All Tables"
        >
          Expand All
        </button>
        <button 
          className="metadata-control-btn" 
          onClick={collapseAll}
          title="Collapse All Tables"
        >
          Collapse All
        </button>
      </div>

      <div className="metadata-content">
        {loading && (
          <div className="metadata-loading">Loading schema...</div>
        )}
        
        {error && (
          <div className="metadata-error">
            <p>Error loading schema data</p>
            <p>{error}</p>
            <button onClick={loadMetadata}>Retry</button>
          </div>
        )}
        
        {tablesData && tablesData.tables && (
          <div className="metadata-tree">
            {tablesData.tables.map(table => (
              <div 
                key={table.name} 
                className={`metadata-table ${expandedTables.has(table.name) ? 'expanded' : ''}`}
              >
                <div 
                  className="metadata-table-header"
                  onClick={() => toggleTable(table.name)}
                >
                  <span className="metadata-expand-icon">&gt;</span>
                  <span className="metadata-table-name">{table.name}</span>
                  <span className="metadata-column-count">
                    ({table.columns ? table.columns.length : 0})
                  </span>
                </div>
                
                <div className="metadata-table-content">
                  {table.columns && table.columns.length > 0 ? (
                    <div className="metadata-columns">
                      {table.columns.map(column => (
                        <div 
                          key={column.name}
                          className={`metadata-column ${column.isMeasure ? 'metadata-measure' : ''}`}
                          onClick={() => handleColumnClick(column.name, getDisplayType(column))}
                        >
                          <span className="metadata-column-icon">
                            {getColumnIcon(column)}
                          </span>
                          <span className="metadata-column-name">{column.name}</span>
                          <span className="metadata-column-type">
                            {getDisplayType(column)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="metadata-no-columns">No columns available</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {tablesData && (!tablesData.tables || tablesData.tables.length === 0) && (
          <div className="metadata-empty">No tables available</div>
        )}
      </div>
    </div>
  )
}

export default MetadataPanel