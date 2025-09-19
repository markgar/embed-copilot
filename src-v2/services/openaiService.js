const configService = require('./configService');
const telemetry = require('../../src/telemetry');

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
     * Initialize the service with current configuration
     */
    async initialize() {
        try {
            this.config = await configService.loadConfig();
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
    _validateConfig() {
        this._ensureInitialized();
        
        const required = ['azureOpenAIEndpoint', 'azureOpenAIApiKey', 'azureOpenAIDeploymentName'];
        const missing = required.filter(key => !this.config[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing Azure OpenAI configuration: ${missing.join(', ')}`);
        }
    }

    /**
     * Build dynamic system prompt based on dataset metadata
     * Migrated from /src/agent.js buildDynamicSystemPrompt()
     * 
     * @param {Object} metadata - Dataset metadata from PowerBI
     * @returns {string} - Constructed system prompt
     */
    buildSystemPrompt(metadata = null) {
        this._ensureInitialized();

        let basePrompt = `You are a helpful assistant that helps users understand and analyze Power BI data. 
You have access to a Power BI dataset and can help users create DAX queries, understand data relationships, and provide insights.

Always respond in a helpful, professional manner. If you're asked to create DAX queries, ensure they are syntactically correct and follow best practices.`;

        // Add dataset-specific information if metadata is available
        if (metadata) {
            basePrompt += '\n\nDataset Information:';
            
            if (metadata.tables && metadata.tables.length > 0) {
                basePrompt += '\n\nAvailable Tables:';
                metadata.tables.forEach(table => {
                    basePrompt += `\n- ${table.name}`;
                    if (table.columns && table.columns.length > 0) {
                        basePrompt += ' (Columns: ';
                        const columnNames = table.columns.map(col => `${col.name}:${col.dataType}`).join(', ');
                        basePrompt += columnNames + ')';
                    }
                });
            }

            if (metadata.measures && metadata.measures.length > 0) {
                basePrompt += '\n\nAvailable Measures:';
                metadata.measures.forEach(measure => {
                    basePrompt += `\n- ${measure.name}`;
                    if (measure.expression) {
                        basePrompt += ` = ${measure.expression}`;
                    }
                });
            }

            if (metadata.relationships && metadata.relationships.length > 0) {
                basePrompt += '\n\nTable Relationships:';
                metadata.relationships.forEach(rel => {
                    basePrompt += `\n- ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}`;
                });
            }
        }

        basePrompt += '\n\nPlease use this information to provide accurate and helpful responses about the data.';
        
        return basePrompt;
    }

    /**
     * Process chat completion request
     * Migrated from /src/routes.js chat endpoint logic
     * 
     * @param {string} message - User message
     * @param {Object} metadata - Optional dataset metadata for context
     * @param {Object} telemetryContext - Request context for telemetry
     * @returns {Object} - Chat completion response
     */
    async processChat(message, metadata = null, telemetryContext = {}) {
        this._ensureInitialized();
        
        try {
            this._validateConfig();
        } catch (error) {
            throw new Error(`Chat completion failed: ${error.message}`);
        }

        const startTime = Date.now();
        
        try {
            // Build system prompt with dataset context
            const systemPrompt = this.buildSystemPrompt(metadata);

            // Prepare Azure OpenAI request
            const apiVersion = this.config.azureOpenAIApiVersion || '2023-12-01-preview';
            const endpoint = `${this.config.azureOpenAIEndpoint}/openai/deployments/${this.config.azureOpenAIDeploymentName}/chat/completions?api-version=${apiVersion}`;
            
            const requestBody = {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: 1000,
                temperature: 0.7
            };

            // Make API request
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.config.azureOpenAIApiKey
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
            }

            const responseData = await response.json();
            
            // Extract response content
            const content = responseData.choices?.[0]?.message?.content || 'No response generated';
            
            // Log telemetry if enabled
            this._logChatTelemetry(message, content, startTime, telemetryContext, null, metadata);

            return {
                success: true,
                response: content,
                usage: responseData.usage || null,
                duration: Date.now() - startTime
            };

        } catch (error) {
            // Log error telemetry
            this._logChatTelemetry(message, null, startTime, telemetryContext, error, metadata);
            
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
     */
    _logChatTelemetry(message, response, startTime, context = {}, error = null, metadata = null) {
        try {
            const telemetryData = {
                type: 'chat_completion',
                timestamp: new Date().toISOString(),
                duration: Date.now() - startTime,
                request: {
                    message: message,
                    hasMetadata: !!metadata
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

module.exports = new OpenAIService();