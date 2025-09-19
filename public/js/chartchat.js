// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

let models = window["powerbi-client"].models;
let reportContainer = $("#report-container").get(0);
let report = null; // Store the report instance globally
let currentMeasure = 'TotalSales'; // Track current measure state

// Track current chart configuration for partial updates
let currentChartConfig = {
    yAxis: null,
    xAxis: null,
    chartType: null
};

// Chat history to store the last 4 messages for context
let chatHistory = [];

// Global error handlers
window.addEventListener('error', function(event) {
    logError(event.error || new Error(event.message), `Global Error (${event.filename}:${event.lineno})`);
});

window.addEventListener('unhandledrejection', function(event) {
    logError(event.reason || new Error('Unhandled Promise Rejection'), 'Unhandled Promise');
});

// Override console.log to also send to backend
const originalConsoleLog = console.log;
console.log = function(...args) {
    // Call original console.log
    originalConsoleLog.apply(console, args);
    
    // Send to backend
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    fetch('/log-console', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            type: 'log',
            timestamp: new Date().toISOString()
        })
    }).catch(() => {}); // Silent fail to avoid recursion
};

// Chat input management functions
function disableChatInput(message = "Loading...") {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.disabled = true;
        chatInput.placeholder = message;
    }
}

function enableChatInput() {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = "Type your message...";
        // Return focus to the input field
        chatInput.focus();
    }
}

// Track report loading state
let reportLoadState = {
    loaded: false,
    rendered: false,
    get isReady() {
        return this.loaded && this.rendered;
    }
};

// Centralized error logging function
function logError(error, context = 'Unknown') {
    const errorDetails = {
        message: error.message || error,
        stack: error.stack || 'No stack trace',
        name: error.name || 'Unknown error type'
    };
    
    // Send to backend for logging
    fetch('/log-error', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            error: errorDetails,
            context: context,
            timestamp: new Date().toISOString()
        })
    }).catch(backendError => {
        console.error('Failed to send error to backend:', backendError);
    });
}



function addChatMessage(message, isUser = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
    
    if (isUser) {
        // Keep user messages as plain text
        messageDiv.textContent = message;
    } else {
        // Render assistant messages as markdown
        messageDiv.innerHTML = marked.parse(message);
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add message to chat history for context (skip empty messages and typing indicators)
    if (message.trim() && !message.startsWith('Thinking')) {
        chatHistory.push({
            role: isUser ? 'user' : 'assistant',
            content: message.trim()
        });
        
        // Keep only the last 4 messages
        if (chatHistory.length > 4) {
            chatHistory.shift(); // Remove the oldest message
        }
        
        console.log("Updated chat history:", chatHistory);
    }
    
    return messageDiv; // Return the element for potential manipulation
}

function handleChatInput() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (message) {
        // Disable input during processing
        disableChatInput("Processing...");
        
        // Add user message
        addChatMessage(message, true);
        
        // Clear input
        chatInput.value = '';
        
        // Auto-resize textarea back to single line
        chatInput.style.height = 'auto';
        
        // Show typing indicator with animation - start with proper formatting
        const typingDiv = addChatMessage('', false); // Start empty
        typingDiv.classList.add('typing'); // Apply typing class immediately
        
        // Set initial content with proper spacing
        let dotCount = 1;
        let direction = 1; // 1 for increasing, -1 for decreasing
        const dots = '.'.repeat(dotCount);
        const spaces = '\u00A0'.repeat(4 - dotCount);
        typingDiv.textContent = 'Thinking' + dots + spaces;
        
        const thinkingInterval = setInterval(() => {
            dotCount += direction;
            if (dotCount === 4) {
                direction = -1; // Start decreasing
            } else if (dotCount === 1) {
                direction = 1; // Start increasing
            }
            // Keep text length consistent by padding with spaces
            const dots = '.'.repeat(dotCount);
            const spaces = '\u00A0'.repeat(4 - dotCount); // Non-breaking spaces
            typingDiv.textContent = 'Thinking' + dots + spaces;
        }, 400); // Back to smooth 400ms animation
        
        // Store the interval so we can clear it later
        typingDiv.thinkingInterval = thinkingInterval;
        
        // Log the request being sent to server
        console.log("=== FRONTEND REQUEST ===");
        console.log("User message:", message);
        console.log("Current chart config:", currentChartConfig);
        console.log("Chat history:", chatHistory);
        console.log("========================");
        
        // Send message to Azure OpenAI
        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: message,
                currentChart: currentChartConfig,
                chatHistory: chatHistory
            })
        })
        .then(response => response.json())
        .then(data => {
            // Clear the thinking animation interval and remove typing indicator
            if (typingDiv.thinkingInterval) {
                clearInterval(typingDiv.thinkingInterval);
            }
            typingDiv.remove();
            
            // Re-enable input
            enableChatInput();
            
            if (data.error) {
                const errorMessage = `Server error: ${data.error}. Details: ${data.details || 'No details'}`;
                logError(new Error(errorMessage), 'Chat API Response');
                addChatMessage(`Error: ${data.error}`, false);
            } else {
                // Log the raw AI response for debugging
                console.log("=== SERVER SUCCESS RESPONSE ===");
                console.log("Raw AI response:", data.response);
                console.log("================================");
                
                // Try to parse the AI response as JSON
                try {
                    const aiResponse = JSON.parse(data.response);
                    
                    console.log("=== PARSED AI RESPONSE ===");
                    console.log("Chat Response:", aiResponse.chatResponse);
                    console.log("Chart Action:", aiResponse.chartAction);
                    console.log("==========================");
                    
                    // Add chat response to chat history
                    if (aiResponse.chatResponse) {
                        addChatMessage(aiResponse.chatResponse, false);
                    }
                    
                    // If there's a chart action, update the chart
                    if (aiResponse.chartAction) {
                        console.log("=== PROCESSING CHART ACTION ===");
                        console.log("Chart action received:", aiResponse.chartAction);
                        console.log("===============================");
                        updateChartFromAI(aiResponse.chartAction);
                    }
                    
                } catch (parseError) {
                    // If it's not JSON, treat it as a regular text response
                    logError(parseError, 'AI Response JSON Parse');
                    console.log("Non-JSON response received, treating as text");
                    addChatMessage(data.response, false);
                }
            }
        })
        .catch(error => {
            // Clear the thinking animation interval and remove typing indicator
            if (typingDiv.thinkingInterval) {
                clearInterval(typingDiv.thinkingInterval);
            }
            typingDiv.remove();
            
            // Re-enable input even on error
            enableChatInput();
            
            logError(error, 'Chat Request');
            addChatMessage('Sorry, I encountered an error. Please try again.', false);
        });
    }
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
}

// Update chart based on AI response
async function updateChartFromAI(chartAction) {
    try {
        console.log("Starting AI chart update with:", chartAction);
        
        // Try API calls without switching to edit mode (permissions.All should be sufficient)
        
        // Get the active page
        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.error("No active page found");
            addChatMessage("Error: Could not find an active page to update the chart.", false);
            return;
        }
        
        console.log("Found active page:", activePage.displayName);
        
        // Get all visuals on the page
        const visuals = await activePage.getVisuals();
        console.log(`Found ${visuals.length} visuals on the page`);
        
        // Find the first chart visual
        const chartVisual = visuals.find(visual => 
            visual.type === 'columnChart' || 
            visual.type === 'barChart' || 
            visual.type === 'lineChart' || 
            visual.type === 'areaChart' ||
            visual.type === 'pieChart' ||
            visual.type === 'donutChart' ||
            visual.type === 'clusteredColumnChart' ||
            visual.type === 'stackedColumnChart'
        );
        
        if (!chartVisual) {
            console.error("No suitable chart visual found");
            addChatMessage("Error: Could not find a chart visual to update.", false);
            return;
        }
        
        console.log("Found chart visual:", chartVisual.type, chartVisual.title);
        
        // Clear existing fields from both axes
        await clearChartFields(chartVisual);
        
        // Change chart type if specified
        if (chartAction.chartType && chartAction.chartType !== chartVisual.type) {
            console.log(`Changing chart type from ${chartVisual.type} to ${chartAction.chartType}...`);
            await chartVisual.changeType(chartAction.chartType);
            console.log(`Chart type changed to ${chartAction.chartType} successfully`);
        }
        
        // Add the new fields based on AI response
        await addFieldsFromAI(chartVisual, chartAction);
        
        // Update the current chart configuration tracking
        updateCurrentChartConfig(chartAction);
        
        console.log("Chart updated successfully by AI");
        
    } catch (error) {
        logError(error, 'Chart Update from AI');
        addChatMessage(`Error updating chart: ${error.message}`, false);
    }
}

// Clear existing fields from the chart
async function clearChartFields(chartVisual) {
    try {
        // Clear Y-axis (values)
        const yAxisFields = await chartVisual.getDataFields('Y');
        if (yAxisFields && yAxisFields.length > 0) {
            console.log("Clearing Y-axis fields...");
            for (let i = yAxisFields.length - 1; i >= 0; i--) {
                await chartVisual.removeDataField('Y', i);
                console.log(`Removed Y-axis field at index ${i}`);
            }
        }
        
        // Clear X-axis (category)
        const xAxisFields = await chartVisual.getDataFields('Category');
        if (xAxisFields && xAxisFields.length > 0) {
            console.log("Clearing Category axis fields...");
            for (let i = xAxisFields.length - 1; i >= 0; i--) {
                await chartVisual.removeDataField('Category', i);
                console.log(`Removed Category axis field at index ${i}`);
            }
        }
    } catch (error) {
        console.log("Could not clear existing fields (may not exist):", error.message);
    }
}

// Add fields based on AI chartAction
async function addFieldsFromAI(chartVisual, chartAction) {
    try {
        // Helper function to parse field names in [Table].[Field] format
        function parseFieldName(fieldName) {
            // Handle dotted field names like "Sales.TotalSales" or "Time.Month"
            if (fieldName.includes('.')) {
                const [table, field] = fieldName.split('.');
                return { table, field };
            } else {
                // If no table specified, assume it's just a field name
                return { table: null, field: fieldName };
            }
        }

        // Add Y-axis field (measures)
        if (chartAction.yAxis) {
            const { table, field } = parseFieldName(chartAction.yAxis);
            const target = {
                $schema: "http://powerbi.com/product/schema#measure",
                table: table,
                measure: field
            };
            console.log(`Adding ${chartAction.yAxis} (measure) to Y data role...`);
            console.log('Target object:', JSON.stringify(target, null, 2));
            await chartVisual.addDataField('Y', target);
            console.log(`${chartAction.yAxis} added to Y data role successfully`);
        }

        // Add X-axis field (dimensions)
        if (chartAction.xAxis) {
            const { table, field } = parseFieldName(chartAction.xAxis);
            const target = {
                $schema: "http://powerbi.com/product/schema#column",
                table: table,
                column: field
            };
            console.log(`Adding ${chartAction.xAxis} (dimension) to Category data role...`);
            console.log('Target object:', JSON.stringify(target, null, 2));
            await chartVisual.addDataField('Category', target);
            console.log(`${chartAction.xAxis} added to Category data role successfully`);
        }
        
        console.log(`Chart configured with ${chartAction.yAxis} by ${chartAction.xAxis} as ${chartAction.chartType}`);
        
    } catch (error) {
        console.error("Error adding fields from AI:", error);
        throw error;
    }
}

// Chart configuration tracking functions
async function getCurrentChartConfig() {
    try {
        if (!report) {
            console.log("No report instance available");
            return null;
        }

        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.log("No active page found");
            return null;
        }

        const visuals = await activePage.getVisuals();
        const chartVisual = visuals.find(visual => 
            visual.type === 'columnChart' || 
            visual.type === 'barChart' || 
            visual.type === 'lineChart' || 
            visual.type === 'areaChart' ||
            visual.type === 'pieChart' ||
            visual.type === 'donutChart' ||
            visual.type === 'clusteredColumnChart' ||
            visual.type === 'stackedColumnChart'
        );

        if (!chartVisual) {
            console.log("No chart visual found");
            return null;
        }

        // Get current data fields
        const yAxisFields = await chartVisual.getDataFields('Y');
        const xAxisFields = await chartVisual.getDataFields('Category');

        const config = {
            chartType: chartVisual.type,
            yAxis: null,
            xAxis: null
        };

        // Determine Y-axis measure
        if (yAxisFields && yAxisFields.length > 0) {
            const yField = yAxisFields[0];
            if (yField.column === 'TotalSales') {
                config.yAxis = 'TotalSales';
            } else if (yField.column === 'TotalUnits') {
                config.yAxis = 'TotalUnits';
            }
        }

        // Determine X-axis dimension
        if (xAxisFields && xAxisFields.length > 0) {
            const xField = xAxisFields[0];
            if (xField.column === 'Month') {
                config.xAxis = 'Month';
            } else if (xField.column === 'District') {
                config.xAxis = 'District';
            }
        }

        console.log("Current chart config:", config);
        return config;

    } catch (error) {
        console.error("Error getting current chart config:", error);
        return null;
    }
}

function updateCurrentChartConfig(chartAction) {
    // For partial updates, preserve existing values if not provided
    const newConfig = {
        yAxis: chartAction.yAxis || currentChartConfig.yAxis,
        xAxis: chartAction.xAxis || currentChartConfig.xAxis,
        chartType: chartAction.chartType || currentChartConfig.chartType
    };
    
    // Only update if we have valid values
    if (newConfig.yAxis && newConfig.xAxis && newConfig.chartType) {
        currentChartConfig = newConfig;
        console.log("Updated current chart config:", currentChartConfig);
    } else {
        console.warn("Incomplete chart action received, preserving current config:", chartAction);
        console.log("Current config remains:", currentChartConfig);
    }
}

// Override console methods to capture logs
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

console.log = function(...args) {
    originalConsole.log.apply(console, args);
};

console.error = function(...args) {
    originalConsole.error.apply(console, args);
};

console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
};

console.info = function(...args) {
    originalConsole.info.apply(console, args);
};

// Initialize iframe for embedding report
powerbi.bootstrap(reportContainer, { type: "report" });

// Function to update button text based on current measure
function updateButtonText() {
    const nextMeasure = currentMeasure === 'TotalSales' ? 'TotalUnits' : 'TotalSales';
    $("#add-totalsales-btn").text(`Switch to ${nextMeasure}`);
}

// Function to toggle between TotalSales and TotalUnits
async function toggleMeasure() {
    try {
        console.log("Button clicked - removing TotalSales and adding TotalUnits");
        
        // First remove TotalSales
        await removeTotalSalesFromChart();
        
        // Then add TotalUnits
        await addTotalUnitsToChart();
        
        console.log("Successfully completed toggle operation");
        
    } catch (error) {
        console.error("Error in toggle operation:", error.message || error);
        // Show user-friendly error
        $(".error-container").show();
        $(".error-container").html(`
            <h4>Error toggling measures:</h4>
            <p>${error.message || error}</p>
        `);
    }
}

// Add click handlers
$(document).ready(function() {
    $("#add-totalsales-btn").click(function() {
        console.log("Show TotalSales button clicked");
        showTotalSales();
    });
    
    $("#add-totalunits-btn").click(function() {
        console.log("Show TotalUnits button clicked");
        showTotalUnits();
    });
    
    $("#add-month-btn").click(function() {
        console.log("Show by Month button clicked");
        showByMonth();
    });
    
    $("#add-district-btn").click(function() {
        console.log("Show by District button clicked");
        showByDistrict();
    });
    
    // Chat input handlers
    $("#chat-input").on('input', function() {
        autoResizeTextarea(this);
    });
    
    $("#chat-input").keypress(function(e) {
        if (e.which === 13 && !e.shiftKey) { // Enter key without Shift
            e.preventDefault();
            // Only handle input if not disabled
            if (!this.disabled) {
                handleChatInput();
            }
        }
    });
    
    // Log initial setup
    console.log("Chart Chat initialized - starting with empty chart");
});

// AJAX request to get the report details from the API and pass it to the UI
$.ajax({
    type: "GET",
    url: "/getEmbedToken",
    dataType: "json",
    success: function (embedData) {
        console.log("Embed token received successfully");

        // Create a config object with type of the object, Embed details and Token Type
        let reportLoadConfig = {
            type: "report",
            tokenType: models.TokenType.Embed,
            accessToken: embedData.accessToken,

            // Use other embed report config based on the requirement. We have used the first one for demo purpose
            embedUrl: embedData.embedUrl[0].embedUrl,

            // Keep edit permissions for API access but use view mode to hide edit UI
            permissions: models.Permissions.All,
            viewMode: models.ViewMode.View,

            // Enable this setting to remove gray shoulders from embedded report
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
                        visible: false
                    },
                    pageNavigation: {
                        visible: true
                    },
                    visualizations: {
                        expanded: false,
                        visible: false
                    },
                    fields: {
                        expanded: false,
                        visible: false
                    }
                }
            }
        };

        console.log("Embedding report...");
        // Embed the report and display it within the div container.
        report = powerbi.embed(reportContainer, reportLoadConfig);

        // Clear any other loaded handler events
        report.off("loaded");

        // Triggers when a report schema is successfully loaded
        report.on("loaded", function () {
            console.log("Report loaded successfully - no automatic field addition");
            reportLoadState.loaded = true;
            
            if (reportLoadState.isReady) {
                enableChatInput();
                console.log("Report is fully ready - chat input enabled");
            } else {
                disableChatInput("Report rendering...");
            }
            // No automatic measure addition - start with empty chart
        });

        // Clear any other rendered handler events
        report.off("rendered");

        // Triggers when a report is successfully embedded in UI
        report.on("rendered", function () {
            console.log("Report rendered successfully");
            reportLoadState.rendered = true;
            
            if (reportLoadState.isReady) {
                enableChatInput();
                console.log("Report is fully ready - chat input enabled");
            }
            
            // Get initial chart configuration after a short delay to ensure visuals are ready
            setTimeout(async () => {
                try {
                    const config = await getCurrentChartConfig();
                    if (config) {
                        currentChartConfig = config;
                        console.log("Initial chart configuration loaded:", currentChartConfig);
                    }
                } catch (error) {
                    logError(error, 'Initial Chart Config Load');
                }
            }, 1000);
        });

        // Clear any other error handler events
        report.off("error");

        // Below patch of code is for handling errors that occur during embedding
        report.on("error", function (event) {
            let errorMsg = event.detail;
            logError(new Error(errorMsg), 'Power BI Report Embedding');

            // Show error container
            $(".error-container").show();
            $(".error-container").html(`
                <h4>Error occurred while embedding the report:</h4>
                <p>${errorMsg}</p>
            `);
        });

        // Handle visual selection for editing
        report.on("visualClicked", function (event) {
        });

        // Handle when a visual is rendered
        report.on("visualRendered", function (event) {
        });

        // Handle data selection events
        report.on("dataSelected", function (event) {
        });
    },
    error: function (err) {
        const errorMessage = err.responseText || err.statusText || 'Unknown token error';
        logError(new Error(errorMessage), 'Embed Token Request');
        
        // Show error container
        $(".error-container").show();
        $(".error-container").html(`
            <h4>Error occurred while getting embed token:</h4>
            <p>${errorMessage}</p>
        `);
    }
});

// Function to remove TotalSales measure from chart
// Show TotalSales: Check for existing measures, remove them, then add TotalSales
async function showTotalSales() {
    try {
        console.log("Starting showTotalSales function");
        
        // Make sure the report is in edit mode
        if (report.mode !== 'edit') {
            console.log("Switching report to edit mode");
            await report.switchMode('edit');
        }
        
        // Get the active page
        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.error("No active page found");
            return;
        }
        
        console.log("Found active page:", activePage.displayName);
        
        // Get all visuals on the page
        const visuals = await activePage.getVisuals();
        console.log(`Found ${visuals.length} visuals on the page`);
        
        // Find the first chart visual
        const chartVisual = visuals.find(visual => 
            visual.type === 'columnChart' || 
            visual.type === 'barChart' || 
            visual.type === 'lineChart' || 
            visual.type === 'areaChart' ||
            visual.type === 'pieChart' ||
            visual.type === 'donutChart' ||
            visual.type === 'clusteredColumnChart' ||
            visual.type === 'stackedColumnChart'
        );
        
        if (!chartVisual) {
            console.error("No suitable chart visual found");
            return;
        }
        
        console.log("Found chart visual:", chartVisual.type, chartVisual.title);
        
        // Get current data fields to remove existing measures
        try {
            const dataFields = await chartVisual.getDataFields('Y');
            console.log("Current data fields in Y axis:", dataFields);
            
            // Remove existing measures from the 'Y' data role
            if (dataFields && dataFields.length > 0) {
                console.log("Removing existing measures from Y axis...");
                for (let i = dataFields.length - 1; i >= 0; i--) {
                    await chartVisual.removeDataField('Y', i);
                    console.log(`Removed measure at index ${i}`);
                }
            }
        } catch (error) {
            console.log("Could not get current data fields, proceeding to add TotalSales:", error.message);
        }
        
        // Define the TotalSales measure target
        const totalSalesTarget = {
            $schema: "http://powerbi.com/product/schema#measure",
            table: "Sales",
            measure: "TotalSales"
        };
        
        console.log("Adding TotalSales to chart...");
        await chartVisual.addDataField('Y', totalSalesTarget);
        console.log("TotalSales added successfully");
        
    } catch (error) {
        console.error("Error in showTotalSales:", error);
        updateErrorContainer("Error showing TotalSales: " + error.message);
    }
}

// Show TotalUnits: Check for existing measures, remove them, then add TotalUnits
async function showTotalUnits() {
    try {
        console.log("Starting showTotalUnits function");
        
        // Make sure the report is in edit mode
        if (report.mode !== 'edit') {
            console.log("Switching report to edit mode");
            await report.switchMode('edit');
        }
        
        // Get the active page
        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.error("No active page found");
            return;
        }
        
        console.log("Found active page:", activePage.displayName);
        
        // Get all visuals on the page
        const visuals = await activePage.getVisuals();
        console.log(`Found ${visuals.length} visuals on the page`);
        
        // Find the first chart visual
        const chartVisual = visuals.find(visual => 
            visual.type === 'columnChart' || 
            visual.type === 'barChart' || 
            visual.type === 'lineChart' || 
            visual.type === 'areaChart' ||
            visual.type === 'pieChart' ||
            visual.type === 'donutChart' ||
            visual.type === 'clusteredColumnChart' ||
            visual.type === 'stackedColumnChart'
        );
        
        if (!chartVisual) {
            console.error("No suitable chart visual found");
            return;
        }
        
        console.log("Found chart visual:", chartVisual.type, chartVisual.title);
        
        // Get current data fields to remove existing measures
        try {
            const dataFields = await chartVisual.getDataFields('Y');
            console.log("Current data fields in Y axis:", dataFields);
            
            // Remove existing measures from the 'Y' data role
            if (dataFields && dataFields.length > 0) {
                console.log("Removing existing measures from Y axis...");
                for (let i = dataFields.length - 1; i >= 0; i--) {
                    await chartVisual.removeDataField('Y', i);
                    console.log(`Removed measure at index ${i}`);
                }
            }
        } catch (error) {
            console.log("Could not get current data fields, proceeding to add TotalUnits:", error.message);
        }
        
        // Define the TotalUnits measure target
        const totalUnitsTarget = {
            $schema: "http://powerbi.com/product/schema#measure",
            table: "Sales",
            measure: "TotalUnits"
        };
        
        console.log("Adding TotalUnits to chart...");
        await chartVisual.addDataField('Y', totalUnitsTarget);
        console.log("TotalUnits added successfully");
        
    } catch (error) {
        console.error("Error in showTotalUnits:", error);
        updateErrorContainer("Error showing TotalUnits: " + error.message);
    }
}

// Function to add TotalUnits measure to chart
async function addTotalUnitsToChart() {
    try {
        console.log("Starting addTotalUnitsToChart function");
        
        // Make sure the report is in edit mode
        if (report.mode !== 'edit') {
            console.log("Switching report to edit mode");
            await report.switchMode('edit');
        }
        
        // Get the active page
        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.error("No active page found");
            return;
        }
        
        console.log("Found active page:", activePage.displayName);
        
        // Get all visuals on the page
        const visuals = await activePage.getVisuals();
        console.log(`Found ${visuals.length} visuals on the page`);
        
        // Find the first chart visual
        const chartVisual = visuals.find(visual => 
            visual.type === 'columnChart' || 
            visual.type === 'barChart' || 
            visual.type === 'lineChart' || 
            visual.type === 'areaChart' ||
            visual.type === 'pieChart' ||
            visual.type === 'donutChart' ||
            visual.type === 'clusteredColumnChart' ||
            visual.type === 'stackedColumnChart'
        );
        
        if (!chartVisual) {
            console.error("No suitable chart visual found");
            return;
        }
        
        console.log("Found chart visual:", chartVisual.type, chartVisual.title);
        
        // Define the TotalUnits measure target
        const totalUnitsTarget = {
            $schema: "http://powerbi.com/product/schema#measure",
            table: "Sales",
            measure: "TotalUnits"
        };
        
        console.log("Target configuration:", totalUnitsTarget);
        
        // Check if the visual has authoring methods available
        if (typeof chartVisual.addDataField !== 'function') {
            const errorMsg = "The visual does not support addDataField method. Make sure the powerbi-report-authoring library is loaded and the report is in edit mode.";
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        // Add TotalUnits to the 'Y' data role
        console.log("Adding TotalUnits to data role: Y");
        await chartVisual.addDataField('Y', totalUnitsTarget);
        console.log("Successfully added TotalUnits to the chart");
        
    } catch (error) {
        console.error("Error in addTotalUnitsToChart:", error.message || error);
        // Show user-friendly error
        $(".error-container").show();
        $(".error-container").html(`
            <h4>Error adding TotalUnits measure:</h4>
            <p>${error.message || error}</p>
        `);
    }
}

// Generic function to add a measure to an existing chart
async function addMeasureToChart(measureName) {
    try {
        console.log(`Starting addMeasureToChart function with measure: ${measureName}`);
        
        // Make sure the report is in edit mode
        if (report.mode !== 'edit') {
            console.log("Switching report to edit mode");
            await report.switchMode('edit');
        }
        
        // Get the active page
        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.error("No active page found");
            return;
        }
        
        console.log("Found active page:", activePage.displayName);
        
        // Get all visuals on the page
        const visuals = await activePage.getVisuals();
        console.log(`Found ${visuals.length} visuals on the page`);
        
        // Find the first chart visual (excluding cards, text boxes, etc.)
        const chartVisual = visuals.find(visual => 
            visual.type === 'columnChart' || 
            visual.type === 'barChart' || 
            visual.type === 'lineChart' || 
            visual.type === 'areaChart' ||
            visual.type === 'pieChart' ||
            visual.type === 'donutChart' ||
            visual.type === 'clusteredColumnChart' ||
            visual.type === 'stackedColumnChart'
        );
        
        if (!chartVisual) {
            console.error("No suitable chart visual found");
            return;
        }
        
        console.log("Found chart visual:", chartVisual.type, chartVisual.title);
        
        // Define the measure target
        const measureTarget = {
            $schema: "http://powerbi.com/product/schema#measure",
            table: "Sales",
            measure: measureName
        };
        
        console.log("Target configuration:", measureTarget);
        
        // Check if the visual has authoring methods available
        if (typeof chartVisual.addDataField !== 'function') {
            const errorMsg = "The visual does not support addDataField method. Make sure the powerbi-report-authoring library is loaded and the report is in edit mode.";
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        // Remove existing data field from Y role using index (Microsoft's pattern)
        try {
            console.log("Attempting to remove existing field from Y role at index 0");
            await chartVisual.removeDataField('Y', 0);
            console.log("Successfully removed existing field from Y role");
        } catch (removeError) {
            console.warn("Could not remove existing field (may not exist):", removeError.message);
        }
        
        // Add the new measure to the 'Y' data role
        console.log(`Adding ${measureName} to data role: Y`);
        await chartVisual.addDataField('Y', measureTarget);
        console.log(`Successfully added ${measureName} to the chart`);
        
    } catch (error) {
        console.error(`Error in addMeasureToChart with ${measureName}:`, error.message || error);
        // Show user-friendly error
        $(".error-container").show();
        $(".error-container").html(`
            <h4>Error adding ${measureName} measure:</h4>
            <p>${error.message || error}</p>
            <p>Please check that the ${measureName} measure exists in your data model.</p>
        `);
    }
}

// Show by Month: Check for existing X-axis categories, remove them, then add Month
async function showByMonth() {
    try {
        console.log("Starting showByMonth function");
        
        // Make sure the report is in edit mode
        if (report.mode !== 'edit') {
            console.log("Switching report to edit mode");
            await report.switchMode('edit');
        }
        
        // Get the active page
        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.error("No active page found");
            return;
        }
        
        console.log("Found active page:", activePage.displayName);
        
        // Get all visuals on the page
        const visuals = await activePage.getVisuals();
        console.log(`Found ${visuals.length} visuals on the page`);
        
        // Find the first chart visual
        const chartVisual = visuals.find(visual => 
            visual.type === 'columnChart' || 
            visual.type === 'barChart' || 
            visual.type === 'lineChart' || 
            visual.type === 'areaChart' ||
            visual.type === 'pieChart' ||
            visual.type === 'donutChart' ||
            visual.type === 'clusteredColumnChart' ||
            visual.type === 'stackedColumnChart'
        );
        
        if (!chartVisual) {
            console.error("No suitable chart visual found");
            return;
        }
        
        console.log("Found chart visual:", chartVisual.type, chartVisual.title);
        
        // Get current data fields to remove existing categories from X-axis
        try {
            const dataFields = await chartVisual.getDataFields('Category');
            console.log("Current data fields in Category axis:", dataFields);
            
            // Remove existing categories from the 'Category' data role
            if (dataFields && dataFields.length > 0) {
                console.log("Removing existing categories from Category axis...");
                for (let i = dataFields.length - 1; i >= 0; i--) {
                    await chartVisual.removeDataField('Category', i);
                    console.log(`Removed category at index ${i}`);
                }
            }
        } catch (error) {
            console.log("Could not get current data fields, proceeding to add Month:", error.message);
        }
        
        // Define the Month column target
        const monthTarget = {
            $schema: "http://powerbi.com/product/schema#column",
            table: "Time",
            column: "Month"
        };
        
        console.log("Adding Month to chart Category axis...");
        await chartVisual.addDataField('Category', monthTarget);
        console.log("Month added successfully");
        
    } catch (error) {
        console.error("Error in showByMonth:", error);
        updateErrorContainer("Error showing by Month: " + error.message);
    }
}

// Show by District: Check for existing X-axis categories, remove them, then add District
async function showByDistrict() {
    try {
        console.log("Starting showByDistrict function");
        
        // Make sure the report is in edit mode
        if (report.mode !== 'edit') {
            console.log("Switching report to edit mode");
            await report.switchMode('edit');
        }
        
        // Get the active page
        const pages = await report.getPages();
        const activePage = pages.find(page => page.isActive) || pages[0];
        
        if (!activePage) {
            console.error("No active page found");
            return;
        }
        
        console.log("Found active page:", activePage.displayName);
        
        // Get all visuals on the page
        const visuals = await activePage.getVisuals();
        console.log(`Found ${visuals.length} visuals on the page`);
        
        // Find the first chart visual
        const chartVisual = visuals.find(visual => 
            visual.type === 'columnChart' || 
            visual.type === 'barChart' || 
            visual.type === 'lineChart' || 
            visual.type === 'areaChart' ||
            visual.type === 'pieChart' ||
            visual.type === 'donutChart' ||
            visual.type === 'clusteredColumnChart' ||
            visual.type === 'stackedColumnChart'
        );
        
        if (!chartVisual) {
            console.error("No suitable chart visual found");
            return;
        }
        
        console.log("Found chart visual:", chartVisual.type, chartVisual.title);
        
        // Get current data fields to remove existing categories from X-axis
        try {
            const dataFields = await chartVisual.getDataFields('Category');
            console.log("Current data fields in Category axis:", dataFields);
            
            // Remove existing categories from the 'Category' data role
            if (dataFields && dataFields.length > 0) {
                console.log("Removing existing categories from Category axis...");
                for (let i = dataFields.length - 1; i >= 0; i--) {
                    await chartVisual.removeDataField('Category', i);
                    console.log(`Removed category at index ${i}`);
                }
            }
        } catch (error) {
            console.log("Could not get current data fields, proceeding to add District:", error.message);
        }
        
        // Define the District column target
        const districtTarget = {
            $schema: "http://powerbi.com/product/schema#column",
            table: "District",
            column: "District"
        };
        
        console.log("Adding District to chart Category axis...");
        await chartVisual.addDataField('Category', districtTarget);
        console.log("District added successfully");
        
    } catch (error) {
        console.error("Error in showByDistrict:", error);
        updateErrorContainer("Error showing by District: " + error.message);
    }
}

// TreeView functionality
let treeviewData = null;

/**
 * Initialize the TreeView functionality
 */
function initializeTreeView() {
    console.log("Initializing TreeView...");
    
    // Set up toggle functionality
    const toggleButton = document.getElementById('treeview-toggle');
    const treeviewPanel = document.getElementById('treeview-panel');
    const mainContent = document.querySelector('.main-content');
    const reportContainer = document.getElementById('report-container');
    
    if (toggleButton && treeviewPanel) {
        toggleButton.addEventListener('click', function() {
            const isCollapsed = treeviewPanel.classList.contains('collapsed');
            
            if (isCollapsed) {
                // Expand
                treeviewPanel.classList.remove('collapsed');
                mainContent.classList.remove('treeview-collapsed');
                reportContainer.classList.remove('treeview-collapsed');
            } else {
                // Collapse
                treeviewPanel.classList.add('collapsed');
                mainContent.classList.add('treeview-collapsed');
                reportContainer.classList.add('treeview-collapsed');
            }
        });
    }
    
    // Set up expand/collapse all buttons
    const expandAllBtn = document.getElementById('expand-all-btn');
    const collapseAllBtn = document.getElementById('collapse-all-btn');
    
    if (expandAllBtn) {
        expandAllBtn.addEventListener('click', function() {
            expandAllTables();
        });
    }
    
    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', function() {
            collapseAllTables();
        });
    }
    
    // Load the schema data
    loadTreeViewData();
}

/**
 * Fetch and load the schema data for the TreeView
 */
async function loadTreeViewData() {
    try {
        console.log("Loading TreeView data...");
        const treeviewContent = document.getElementById('treeview-content');
        
        if (!treeviewContent) {
            console.error("TreeView content container not found");
            return;
        }
        
        // Show loading state
        treeviewContent.innerHTML = '<div class="treeview-loading">Loading schema...</div>';
        
        // Fetch metadata from existing endpoint
        const response = await fetch('/getDatasetMetadata');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const metadata = await response.json();
        console.log("Received metadata:", metadata);
        
        if (!metadata.tables || !Array.isArray(metadata.tables)) {
            throw new Error("Invalid metadata structure - missing tables array");
        }
        
        treeviewData = metadata;
        renderTreeView(metadata.tables);
        
    } catch (error) {
        console.error("Error loading TreeView data:", error);
        const treeviewContent = document.getElementById('treeview-content');
        if (treeviewContent) {
            treeviewContent.innerHTML = `
                <div class="treeview-loading" style="color: #dc3545;">
                    Error loading schema: ${error.message}
                </div>
            `;
        }
    }
}

/**
 * Render the TreeView from tables data
 * @param {Array} tables - Array of table objects from metadata
 */
function renderTreeView(tables) {
    const treeviewContent = document.getElementById('treeview-content');
    
    if (!treeviewContent) {
        console.error("TreeView content container not found");
        return;
    }
    
    if (!tables || tables.length === 0) {
        treeviewContent.innerHTML = '<div class="treeview-loading">No tables found in dataset</div>';
        return;
    }
    
    console.log("Rendering TreeView for", tables.length, "tables");
    
    const treeContainer = document.createElement('div');
    treeContainer.className = 'tree-container';
    
    tables.forEach(table => {
        const tableElement = createTableElement(table);
        treeContainer.appendChild(tableElement);
    });
    
    // Clear loading and add tree
    treeviewContent.innerHTML = '';
    treeviewContent.appendChild(treeContainer);
    
    // Default to expanded - expand all tables after rendering
    setTimeout(() => {
        expandAllTables();
    }, 100);
}

/**
 * Create a table element for the TreeView
 * @param {Object} table - Table object with name, type, and columns
 * @returns {HTMLElement} The table element
 */
function createTableElement(table) {
    const tableDiv = document.createElement('div');
    tableDiv.className = 'tree-table';
    
    // Create table header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'tree-table-header';
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'tree-table-icon';
    iconSpan.textContent = '▶';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tree-table-name';
    nameSpan.textContent = table.name;
    
    const typeSpan = document.createElement('span');
    typeSpan.className = 'tree-table-type';
    typeSpan.textContent = table.type || 'table';
    
    headerDiv.appendChild(iconSpan);
    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(typeSpan);
    
    // Create columns container
    const columnsDiv = document.createElement('div');
    columnsDiv.className = 'tree-columns';
    
    if (table.columns && Array.isArray(table.columns)) {
        table.columns.forEach(column => {
            const columnElement = createColumnElement(column);
            columnsDiv.appendChild(columnElement);
        });
    }
    
    // Add click handler for expand/collapse
    headerDiv.addEventListener('click', function() {
        const isExpanded = tableDiv.classList.contains('expanded');
        
        if (isExpanded) {
            tableDiv.classList.remove('expanded');
        } else {
            tableDiv.classList.add('expanded');
        }
    });
    
    tableDiv.appendChild(headerDiv);
    tableDiv.appendChild(columnsDiv);
    
    return tableDiv;
}

/**
 * Create a column element for the TreeView
 * @param {Object} column - Column object with name, type, and description
 * @returns {HTMLElement} The column element
 */
function createColumnElement(column) {
    const columnDiv = document.createElement('div');
    columnDiv.className = 'tree-column';
    columnDiv.title = column.description || `${column.name} (${column.type})`;
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'tree-column-icon';
    
    // Set icon based on column type
    switch (column.type) {
        case 'number':
        case 'currency':
            iconSpan.textContent = '#';
            break;
        case 'date':
            iconSpan.textContent = '📅';
            break;
        case 'text':
        default:
            iconSpan.textContent = 'Abc';
            break;
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tree-column-name';
    nameSpan.textContent = column.name;
    
    const typeSpan = document.createElement('span');
    typeSpan.className = 'tree-column-type';
    typeSpan.textContent = column.type;
    
    columnDiv.appendChild(iconSpan);
    columnDiv.appendChild(nameSpan);
    columnDiv.appendChild(typeSpan);
    
    // Add click handler for potential future functionality
    columnDiv.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log(`Column clicked: ${column.name} (${column.type})`);
        // Future: Could add functionality to insert column into chat or copy to clipboard
    });
    
    return columnDiv;
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

// Initialize TreeView when DOM is ready
$(document).ready(function() {
    initializeTreeView();
});