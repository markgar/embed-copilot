/**
 * TreeView Module
 * Handles schema display and navigation in the sidebar
 * Extracted from chartchat.js as part of modularization effort
 */

// Import dependencies
import { logError } from './utilities.js';

// Global references
let currentTablesData = null;

    /**
     * Initialize TreeView functionality
     */
    function initializeTreeView() {
        console.log("Initializing TreeView...");
        setupEventListeners();
        loadTreeViewData();
    }

    /**
     * Set up event listeners for TreeView interactions
     */
    function setupEventListeners() {
        // Hook into existing HTML buttons
        const expandAllBtn = document.getElementById('expand-all-btn');
        const collapseAllBtn = document.getElementById('collapse-all-btn');
        const toggleBtn = document.getElementById('treeview-toggle');
        const titleBtn = document.getElementById('treeview-title');
        
        if (expandAllBtn) {
            expandAllBtn.addEventListener('click', expandAllTables);
        }
        
        if (collapseAllBtn) {
            collapseAllBtn.addEventListener('click', collapseAllTables);
        }
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTreeViewPanel);
        }
        
        if (titleBtn) {
            titleBtn.addEventListener('click', toggleTreeViewPanel);
        }

        // Use event delegation for dynamically created content (table interactions)
        document.addEventListener('click', function(event) {
            const action = event.target.getAttribute('data-action');
            
            if (action === 'refresh') {
                refreshTreeView();
            } else if (action === 'column-click') {
                const columnName = event.target.getAttribute('data-column-name');
                const columnType = event.target.getAttribute('data-column-type');
                if (columnName && columnType) {
                    handleColumnClick(columnName, columnType);
                }
            }
        });
    }

    /**
     * Load TreeView data from the server
     */
    async function loadTreeViewData() {
        try {
            console.log("Loading TreeView data...");
            
            // Make API call to get dataset metadata (matches working endpoint)
            const response = await fetch('/getDatasetMetadata');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("TreeView data received:", data);
            
            currentTablesData = data;
            renderTreeView(data);
            
        } catch (error) {
            console.error("Error loading TreeView data:", error);
            
            // Show error in TreeView container
            const container = document.getElementById('treeview-content');
            if (container) {
                container.innerHTML = `
                    <div class="tree-error">
                        <p>Error loading schema data</p>
                        <p>${error.message}</p>
                        <button data-action="refresh">Retry</button>
                    </div>
                `;
            }
        }
    }

    /**
     * Render the TreeView with the provided data
     * @param {Object} data - The tables data to render
     */
    function renderTreeView(data) {
        const container = document.getElementById('treeview-content');
        if (!container) {
            console.error("TreeView container not found");
            return;
        }

        if (!data || !data.tables || data.tables.length === 0) {
            container.innerHTML = '<div class="tree-empty">No tables available</div>';
            return;
        }

        // Create TreeView HTML structure
        let html = '<div class="tree-view">';

        // Add tables (no duplicate controls - use existing HTML buttons)
        data.tables.forEach(table => {
            html += createTableElement(table);
        });

        html += '</div>';
        container.innerHTML = html;

        console.log(`TreeView rendered with ${data.tables.length} tables`);
    }

    /**
     * Create HTML element for a table
     * @param {Object} table - Table data object
     * @returns {string} HTML string for the table element
     */
    function createTableElement(table) {
        let html = `
            <div class="tree-table" data-table-name="${table.name}">
                <div class="tree-table-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <span class="tree-expand-icon">></span>
                    <span class="tree-table-name">${table.name}</span>
                    <span class="tree-column-count">(${table.columns ? table.columns.length : 0})</span>
                </div>
                <div class="tree-table-content">
        `;

        // Add columns if they exist
        if (table.columns && table.columns.length > 0) {
            html += '<div class="tree-columns">';
            table.columns.forEach(column => {
                html += createColumnElement(column);
            });
            html += '</div>';
        } else {
            html += '<div class="tree-no-columns">No columns available</div>';
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Create HTML element for a column
     * @param {Object} column - Column data object
     * @returns {string} HTML string for the column element
     */
    function createColumnElement(column) {
        // Determine icon based on column type and if it's a measure
        let iconText = 'Abc'; // default
        let displayType = column.type;
        
        if (column.isMeasure || column.type === 'measure') {
            iconText = '∑'; // Sigma symbol for measures
            displayType = column.dataType || 'measure';
        } else {
            switch (column.type) {
                case 'number':
                case 'decimal':
                case 'integer':
                    iconText = '#';
                    break;
                case 'currency':
                    iconText = '$';
                    break;
                case 'date':
                    iconText = '📅';
                    break;
                case 'text':
                default:
                    iconText = 'Abc';
                    break;
            }
        }

        return `
            <div class="tree-column${column.isMeasure ? ' tree-measure' : ''}" data-column-name="${column.name}" data-action="column-click" data-column-name="${column.name}" data-column-type="${displayType}">
                <span class="tree-column-icon">${iconText}</span>
                <span class="tree-column-name">${column.name}</span>
                <span class="tree-column-type">${displayType}</span>
            </div>
        `;
    }

    /**
     * Handle column click events
     * @param {string} columnName - Name of the clicked column
     * @param {string} columnType - Type of the clicked column
     */
    function handleColumnClick(columnName, columnType) {
        console.log(`Column clicked: ${columnName} (${columnType})`);
        // Future: Could add functionality to insert column into chat or copy to clipboard
    }

    /**
     * Refresh the TreeView data
     */
    function refreshTreeView() {
        console.log("Refreshing TreeView data...");
        loadTreeViewData();
    }

    /**
     * Expand all tables in the TreeView
     */
    function expandAllTables() {
        const tableElements = document.querySelectorAll('.tree-table');
        tableElements.forEach(table => {
            table.classList.add('expanded');
        });
        console.log("Expanded all tables");
    }

    /**
     * Collapse all tables in the TreeView
     */
    function collapseAllTables() {
        const tableElements = document.querySelectorAll('.tree-table');
        tableElements.forEach(table => {
            table.classList.remove('expanded');
        });
        console.log("Collapsed all tables");
    }

    /**
     * Get current tables data
     * @returns {Object|null} Current tables data
     */
    function getCurrentTablesData() {
        return currentTablesData;
    }

    /**
     * Toggle the TreeView panel collapsed state
     */
    function toggleTreeViewPanel() {
        const panel = document.getElementById('treeview-panel');
        const reportContainer = document.getElementById('report-container');
        
        if (panel && reportContainer) {
            // Toggle the collapsed class on both elements
            panel.classList.toggle('collapsed');
            reportContainer.classList.toggle('treeview-collapsed');
            
            console.log("TreeView panel toggled:", panel.classList.contains('collapsed') ? 'collapsed' : 'expanded');
        } else {
            console.error("TreeView panel or report container not found");
        }
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeTreeView);
    } else {
        initializeTreeView();
    }

// ES6 module exports
export {
    initializeTreeView,
    loadTreeViewData,
    renderTreeView,
    refreshTreeView,
    expandAllTables,
    collapseAllTables,
    handleColumnClick,
    getCurrentTablesData,
    toggleTreeViewPanel
};