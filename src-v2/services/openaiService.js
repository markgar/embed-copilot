const configService = require('./configService');
const axios = require('axios');
const telemetry = require('./telemetryService');
const fetch = require('node-fetch');

/**
 * OpenAI Service - Handles all OpenAI/Azure OpenAI interactions
 * Consolidates chat completion, system prompt building, and telemetry logging
 */
class OpenAIService {
    constructor() {
        this.initialized = false;
        this.config = null;
    }

    /**
     * Initialize the service
     */
    async initialize() {
        try {
            this.config = configService.loadConfig();
            this.initialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize OpenAI service: ${error.message}`);
        }
    }

    /**
     * Ensure service is initialized before operations
     */
    _ensureInitialized() {
        if (!this.initialized) {
            throw new Error('OpenAI service not initialized. Call initialize() first.');
        }
    }

    /**
     * Validate Azure OpenAI configuration
     */
    _validateConfig(config = null) {
        this._ensureInitialized();
        
        // Use provided config or stored config
        const configToValidate = config || this.config;
        
        if (!configToValidate) {
            throw new Error('Configuration object is required');
        }
        
        const required = ['azureOpenAIEndpoint', 'azureOpenAIApiKey', 'azureOpenAIDeploymentName'];
        const missing = required.filter(key => !configToValidate[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing Azure OpenAI configuration: ${missing.join(', ')}`);
        }
    }

    /**
     * Build dynamic system prompt based on dataset metadata
     * EXACT COPY from /src/agent.js buildDynamicSystemPrompt()
     * 
     * @param {Object} metadata - Dataset metadata from PowerBI
     * @param {Object} currentChart - Current chart context
     * @param {Array} chatHistory - Chat history for context
     * @returns {string} - Constructed system prompt
     */
    buildSystemPrompt(metadata = null, currentChart = null, chatHistory = null) {
        this._ensureInitialized();

        const basePrompt = `You are a specialized Power BI chart creation assistant. Use ONLY the fields explicitly listed in the schema section. Never invent or guess field names.

CORE RESPONSIBILITIES:
1. Create and modify charts using available dataset fields
2. Answer questions about the dataset schema (tables, columns, data types) to help users understand what's available
3. Provide guidance on field usage and chart creation

DATA UNDERSTANDING:
- Measures: Numeric values that can be aggregated (typically go on value axes) - examples: TotalSales, Revenue, Count, etc.
- Dimensions: Categorical or time-based fields used for grouping (typically go on category axes) - examples: Month, District, Category, Date, etc.
- The system will attempt to use any field names you specify - if a field doesn't exist, Power BI will return an error

SCOPE AND LIMITATIONS:
- PRIMARY: You help with creating charts using fields available in the Power BI dataset
- SECONDARY: You MUST answer questions about the dataset schema when asked (tables, columns, data types)
- When users ask "what tables are available?", "show me the schema", "what fields can I use?", etc., provide the information from the SCHEMA section below
- If a field doesn't exist, the system will show an error and you can suggest alternatives
- If users ask about non-chart related tasks (like data modeling, report formatting, or other Power BI features), politely decline and redirect them to chart creation

CHART TYPES:
1. If user explicitly specifies a chart type (e.g., "bar chart", "pie chart"), use their preference
2. AUTOMATIC CHART TYPE SELECTION based on data:
   - MULTI-DIMENSIONAL with time + categorical: "sales by month by district" = clusteredColumnChart (time on x-axis, categorical as series)
   - Single time-based dimension: "sales by month" = lineChart  
   - Single categorical dimension: "sales by district" = columnChart
   - Examples: 
     * "sales by month" = lineChart
     * "sales by region" = columnChart  
     * "sales by month by district" = clusteredColumnChart
     * "revenue by quarter by category" = clusteredColumnChart
3. Default fallback: columnChart only if no time dimension is present
- Valid chart types: columnChart, clusteredColumnChart, barChart, lineChart, areaChart, pieChart

CRITICAL: Multi-dimensional queries with BOTH time and categorical dimensions should use clusteredColumnChart to show groups over time

AXIS ASSIGNMENT RULES (FOLLOW EXACTLY):
CRITICAL: After deciding on the chart type, you MUST apply the correct axis assignments for that specific chart type:

1. **Column Charts & Clustered Column Charts**: 
   - X-axis: Dimensions/categories (e.g., District.District, Time.Month)
   - Y-axis: Measures (e.g., Sales.TotalSales)

2. **Bar Charts** (SPECIAL CASE - AXES ARE SWAPPED):
   - Y-axis: Dimensions/categories (e.g., District.District) 
   - X-axis: Measures (e.g., Sales.TotalSales)
   - REMEMBER: Bar charts are horizontal, so dimensions go on Y-axis!

3. **Line Charts & Area Charts**: 
   - X-axis: Time dimensions (preferred) or other dimensions
   - Y-axis: Measures

4. **Pie Charts**: 
   - xAxis: Categories as slices
   - yAxis: Measures as values

CRITICAL BAR CHART RULE: When the user requests a "bar chart" or you decide on barChart, you MUST swap the axes compared to column charts. Dimensions go on Y-axis, measures go on X-axis.

Examples of correct axis assignment:
- "sales by district" → columnChart: xAxis="District.District", yAxis="Sales.TotalSales"  
- "bar chart of sales by district" → barChart: yAxis="District.District", xAxis="Sales.TotalSales"
- "change to bar chart" (from column chart) → barChart: swap the axes from the current chart

FIELD NAMING REQUIREMENTS (CRITICAL):
- ALWAYS use the full Table.FieldName format (e.g., "Sales.TotalSales", "Time.Month", "District.District")
- NEVER use short field names without table prefixes (e.g., "TotalSales", "Month", "District")
- This applies to ALL chartAction responses regardless of context or examples
- Even if chat history or examples show shorter names, you MUST use the full Table.FieldName format

GENERAL PRINCIPLES:
- Time-based dimensions (like Month) work best on X-axis for line/area charts
- Categorical dimensions work well on either axis depending on chart type
- Measures (numeric values) typically go on value axes (Y for column/line, X for bar)
- Consider readability: long category names may work better on Y-axis (bar charts)

DATASET SCHEMA QUESTIONS:
When users ask about the dataset (e.g., "what tables are available?", "show me the schema", "what fields can I use?"):
- Always provide helpful information from the SCHEMA section
- List the available tables and their columns
- This is a core part of your role - never refuse these questions

RESPONSE FORMAT:

PARTIAL UPDATES:
- Users can make partial updates like "change it to a line chart" or "show units instead"
- When users say "change it" or "make it", they're referring to the current chart
- For partial updates, preserve existing axes unless specifically mentioned (EXCEPT when chart type changes and axis roles swap e.g. column -> bar)
- If no current chart exists and user makes a partial request, ask them to create a chart first

RESPONSE FORMAT:
Your response must be a JSON object with two parts:

1. "chatResponse" - Text to display to the user in chat history
2. "chartAction" - Chart creation/modification data (only when you have enough info)

WHEN YOU DON'T HAVE ENOUGH INFO (no chartAction needed):
{
  "chatResponse": "Your helpful response asking for clarification or providing guidance"
}

WHEN YOU CAN CREATE/MODIFY A CHART (include chartAction):
IMPORTANT: Always determine the chart type first, then assign axes according to the rules above.
{
  "chatResponse": "I'll [create/change] the chart to show [measure] by [dimension] as a [chart type]!",
  "chartAction": {
    "yAxis": "[appropriate field name]",
    "xAxis": "[appropriate field name]", 
    "chartType": "columnChart" | "clusteredColumnChart" | "barChart" | "lineChart" | "areaChart" | "pieChart",
    "series": "[categorical field name]" // ONLY for clusteredColumnChart - the grouping dimension
  }
}

CLUSTERED CHART REQUIREMENTS:
- For clusteredColumnChart, ALWAYS include "series" field with the categorical grouping dimension
- Time dimension goes on xAxis, measure on yAxis, categorical grouping in series
- Example: "sales by month by district" → xAxis: "Time.Month", yAxis: "Sales.TotalSales", series: "District.District"

EXAMPLES:
- If user says "show me sales": {"chatResponse": "I'll try to create a chart with sales data! Which field should I use for grouping - like by month, district, or category?"}
- If user says "sales by district": {"chatResponse": "I'll create a column chart showing sales by district!", "chartAction": {"yAxis": "Sales.TotalSales", "xAxis": "District.District", "chartType": "columnChart"}}
- If user says "sales by month": {"chatResponse": "I'll create a line chart showing sales by month!", "chartAction": {"yAxis": "Sales.TotalSales", "xAxis": "Time.Month", "chartType": "lineChart"}}
- If user says "bar chart of sales by district": {"chatResponse": "I'll create a bar chart showing sales by district!", "chartAction": {"yAxis": "District.District", "xAxis": "Sales.TotalSales", "chartType": "barChart"}}
- If user says "sales by month by district": {"chatResponse": "I'll create a clustered column chart showing sales by month grouped by district!", "chartAction": {"yAxis": "Sales.TotalSales", "xAxis": "Time.Month", "series": "District.District", "chartType": "clusteredColumnChart"}}
- If user says "revenue by quarter by category": {"chatResponse": "I'll create a clustered column chart showing revenue by quarter grouped by category!", "chartAction": {"yAxis": "Sales.Revenue", "xAxis": "Time.Quarter", "series": "Item.Category", "chartType": "clusteredColumnChart"}}
- If user says "bar chart of revenue by month": {"chatResponse": "I'll create a bar chart showing revenue by month!", "chartAction": {"yAxis": "Time.Month", "xAxis": "Sales.TotalSales", "chartType": "barChart"}}
- If current chart exists and user says "change to bar chart": {"chatResponse": "I'll change it to a bar chart!", "chartAction": {"yAxis": "[current xAxis]", "xAxis": "[current yAxis]", "chartType": "barChart"}}
- If field doesn't exist: {"chatResponse": "I'll try that field name. If it doesn't exist in the dataset, you'll see an error and can try a different field name."}
- If user asks "what tables are available?" or "show me the schema": {"chatResponse": "## Dataset Schema\\n\\nHere are the available tables and their fields:\\n\\n### Sales\\n- \`TotalSales\` - Total sales amount\\n- \`TotalUnits\` - Total units sold\\n\\n### Time\\n- \`Month\` - Month of the year\\n\\n### District\\n- \`District\` - Sales district name\\n\\n### Item\\n- \`Category\` - Product category\\n- \`Segment\` - Product segment"}
- If user asks "what fields can I use?": {"chatResponse": "## Available Fields\\n\\nYou can use these fields for creating charts:\\n\\n**Sales**:\\n- \`Sales.TotalSales\` - Total sales amount\\n- \`Sales.TotalUnits\` - Total units sold\\n\\n**Time**:\\n- \`Time.Month\` - Month of the year\\n\\n**District**:\\n- \`District.District\` - Sales district name\\n\\n**Item**:\\n- \`Item.Category\` - Product category\\n- \`Item.Segment\` - Product segment"}

IMPORTANT: For partial updates, ALWAYS include all three fields (yAxis, xAxis, chartType) in chartAction. Reevaluate & swap axes as needed.

VALIDATION RULES:
- If the user references a term not in the schema, ask them to restate using available field names (provide closest matches if obvious).
- Never introduce new field names not present in the schema list.
- Prefer explicit measure vs dimension placement per AXIS ASSIGNMENT RULES.
- For ambiguous requests (e.g. "show sales"), ask which dimension to group by rather than guessing.

Always respond with ONLY valid JSON and no extra commentary.`;

        let schemaSection = '\nSCHEMA (table.column [type]):\n';
        if (metadata && metadata.tables) {
            for (const t of metadata.tables) {
                if (!t.columns) continue;
                for (const c of t.columns) {
                    schemaSection += `${t.name}.${c.name} [${c.type}]\n`;
                }
            }
        } else {
            schemaSection += 'Schema temporarily unavailable. If user asks about schema, explain that there was an issue retrieving the dataset metadata and suggest they try again.\n';
        }

        const enforcement = `\nSCHEMA USAGE INSTRUCTIONS:\n- Only use fields exactly as shown (case sensitive).\n- If user uses a synonym (e.g. "sales" vs "TotalSales"), map to the closest valid field and mention it in chatResponse.\n- If no dimension provided with a measure request, ask user to choose one (do NOT fabricate).`;

        let prompt = basePrompt + schemaSection + enforcement;

        if (currentChart && (currentChart.yAxis || currentChart.xAxis || currentChart.chartType)) {
            prompt += `\n\nCURRENT CHART CONTEXT:\n` +
                `The user currently has a chart with:\n` +
                `- Y-axis: ${currentChart.yAxis || 'none'}\n` +
                `- X-axis: ${currentChart.xAxis || 'none'}\n` +
                `- Chart Type: ${currentChart.chartType || 'unknown'}\n` +
                `\nWhen the user makes partial update requests (like "change it to a bar chart"), you MUST:\n` +
                `1. First determine the new chart type\n` +
                `2. Then reevaluate the proper axis assignments according to the AXIS ASSIGNMENT RULES above\n` +
                `3. For chart type changes, DO NOT preserve axes if they need to be swapped (e.g., column to bar chart)\n` +
                `4. Always include ALL THREE fields (yAxis, xAxis, chartType) in your chartAction response with the correct axis assignments for the new chart type`;
        }

        // Add chat history for context if available
        if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
            prompt += `\n\nCONVERSATION HISTORY FOR CONTEXT:\n` +
                `The following is the recent conversation history (up to last 4 messages) to provide context for the current request. ` +
                `Use this history to understand references like "it", "that chart", "change the previous one", etc. ` +
                `Only look as far back as needed to understand the current request - you don't need to process all historical messages.\n\n` +
                `IMPORTANT - CLARIFICATION FOLLOW-UP HANDLING:\n` +
                `If your most recent message (Assistant) was asking for clarification about field names, chart types, or other specifics, ` +
                `and the current user message appears to be answering that question (even if brief like "District" or "yes"), ` +
                `then piece together the original request with the user's clarification response to complete the full action.\n\n` +
                `Examples:\n` +
                `- If you asked "Do you want me to show Sales.TotalSales by District.District instead?" and user responds "District" or "yes" → create the chart\n` +
                `- If you asked "Which chart type would you prefer?" and user responds "bar chart" → apply that chart type to the previous request\n` +
                `- If you asked "Which field should I use for grouping?" and user responds "month" → combine with the original measure request\n\n` +
                `If the user's response doesn't clearly answer your clarification question, proceed with your best interpretation and move forward.\n\n`;
            
            chatHistory.forEach((msg, index) => {
                const speaker = msg.role === 'user' ? 'User' : 'Assistant';
                prompt += `${speaker}: ${msg.content}\n`;
            });
            
            prompt += `\nCurrent user message follows below this context section.`;
        }

        return prompt;
    }

    /**
     * Process chat completion request
     * Migrated from /src/routes.js chat endpoint logic
     * 
     * @param {string} message - User message
     * @param {Object} metadata - Optional dataset metadata for context
     * @param {Object} currentChart - Current chart context from frontend
     * @param {Array} chatHistory - Chat history for context
     * @param {Object} telemetryContext - Request context for telemetry
     * @returns {Object} - Chat completion response
     */
    async processChat(message, metadata = null, currentChart = null, chatHistory = null, telemetryContext = {}) {
        console.log('[OpenAIService] processChat called with message:', message);
        console.log('[OpenAIService] currentChart:', currentChart);
        console.log('[OpenAIService] chatHistory:', chatHistory);
        this._ensureInitialized();
        
        // Use stored configuration and validate it
        try {
            console.log('[OpenAIService] Validating configuration...');
            this._validateConfig();
            console.log('[OpenAIService] Configuration valid');
        } catch (error) {
            console.log('[OpenAIService] Configuration validation failed:', error.message);
            throw new Error(`Chat completion failed: ${error.message}`);
        }

        const config = this.config;

        const startTime = Date.now();
        
        try {
            console.log('[OpenAIService] Building system prompt...');
            // Build system prompt with dataset context - using exact original parameters
            const systemPrompt = this.buildSystemPrompt(metadata, currentChart, chatHistory);
            console.log('[OpenAIService] System prompt built, length:', systemPrompt.length);

            // Prepare Azure OpenAI request
            const apiVersion = config.azureOpenAIApiVersion || '2023-12-01-preview';
            const endpoint = `${config.azureOpenAIEndpoint}/openai/deployments/${config.azureOpenAIDeploymentName}/chat/completions?api-version=${apiVersion}`;
            console.log('[OpenAIService] Making request to endpoint:', endpoint);
            console.log('[OpenAIService] Making request to endpoint:', endpoint);
            
            const requestBody = {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: 1000,
                temperature: 0.1 // Low temperature for consistent chart logic, minimal text variation
            };

            console.log('[OpenAIService] Sending request to Azure OpenAI...');
            // Make API request
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': config.azureOpenAIApiKey
                },
                body: JSON.stringify(requestBody)
            });

            console.log('[OpenAIService] Received response, status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log('[OpenAIService] API error response:', errorText);
                throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
            }

            const responseData = await response.json();
            console.log('[OpenAIService] Response data received:', JSON.stringify(responseData, null, 2));
            
            // Extract response content
            const content = responseData.choices?.[0]?.message?.content || 'No response generated';
            console.log('[OpenAIService] Extracted content:', content);
            
            // Log telemetry if enabled
            this._logChatTelemetry(message, content, startTime, telemetryContext, null, metadata, currentChart);

            console.log('[OpenAIService] Returning result...');
            return {
                success: true,
                response: content,
                usage: responseData.usage || null,
                duration: Date.now() - startTime
            };

        } catch (error) {
            console.log('[OpenAIService] Error in processChat:', error.message);
            // Log error telemetry
            this._logChatTelemetry(message, null, startTime, telemetryContext, error, metadata, currentChart);
            
            throw new Error(`Chat completion failed: ${error.message}`);
        }
    }

    /**
     * Log chat interaction telemetry
     * 
     * @param {string} message - User message
     * @param {string|null} response - AI response (null if error)
     * @param {number} startTime - Request start time
     * @param {Object} context - Request context
     * @param {Error|null} error - Error if any
     * @param {Object|null} metadata - Dataset metadata
     * @param {Object|null} currentChart - Current chart context
     */
    _logChatTelemetry(message, response, startTime, context = {}, error = null, metadata = null, currentChart = null) {
        try {
            const telemetryData = {
                type: 'chat_completion',
                timestamp: new Date().toISOString(),
                duration: Date.now() - startTime,
                request: {
                    message: message,
                    hasMetadata: !!metadata,
                    currentChart: telemetry.sanitizeObject(currentChart)
                },
                response: error ? null : {
                    generated: !!response,
                    length: response ? response.length : 0
                },
                error: error ? {
                    message: error.message,
                    type: error.constructor.name
                } : null,
                context: {
                    endpoint: '/chat',
                    service: 'openai',
                    ...context
                }
            };

            // Use existing telemetry system for consistent logging
            if (context.req && context.res) {
                telemetry.logRequest(context.req, context.res, telemetryData, startTime);
            }
        } catch (telemetryError) {
            console.error('[OpenAI Service] Telemetry logging failed:', telemetryError.message);
        }
    }

    /**
     * Get service status and configuration summary
     */
    getStatus() {
        return {
            initialized: this.initialized,
            hasConfig: !!this.config,
            configValid: this.initialized ? this._isConfigValid() : false
        };
    }

    /**
     * Check if current configuration is valid
     */
    _isConfigValid() {
        try {
            this._validateConfig();
            return true;
        } catch (error) {
            return false;
        }
    }
}

// Export a singleton instance
module.exports = new OpenAIService();