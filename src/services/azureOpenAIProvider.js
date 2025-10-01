/**
 * Azure OpenAI Provider - Handles HTTP communication with Azure OpenAI API
 * 
 * This provider is responsible ONLY for:
 * - Formatting requests for Azure OpenAI API
 * - Making HTTP calls
 * - Parsing responses
 * - Handling API-specific errors
 * 
 * It does NOT handle:
 * - Prompt building (that's AgentService's job)
 * - Business logic
 * - Domain knowledge
 */
class AzureOpenAIProvider {
  /**
   * @param {Object} providerConfig - Azure OpenAI configuration
   * @param {string} providerConfig.endpoint - Azure OpenAI endpoint URL
   * @param {string} providerConfig.apiKey - Azure OpenAI API key
   * @param {string} providerConfig.deploymentName - Azure OpenAI deployment name
   * @param {string} [providerConfig.apiVersion] - API version (defaults to 2023-12-01-preview)
   * @param {Function} httpClient - HTTP client function (e.g., fetch)
   */
  constructor(providerConfig, httpClient) {
    if (!providerConfig) {
      throw new Error('providerConfig is required');
    }
    if (!httpClient) {
      throw new Error('httpClient is required');
    }

    this._validateConfig(providerConfig);

    this.endpoint = providerConfig.endpoint;
    this.apiKey = providerConfig.apiKey;
    this.deploymentName = providerConfig.deploymentName;
    this.apiVersion = providerConfig.apiVersion || '2023-12-01-preview';
    this.httpClient = httpClient;
  }

  /**
   * Validate provider configuration
   * @private
   */
  _validateConfig(config) {
    const required = ['endpoint', 'apiKey', 'deploymentName'];
    const missing = required.filter(key => !config[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required Azure OpenAI config: ${missing.join(', ')}`);
    }
  }

  /**
   * Send a completion request to Azure OpenAI
   * 
   * @param {Object} request - Completion request
   * @param {string} request.systemPrompt - System prompt
   * @param {string} request.userMessage - User message
   * @param {number} [request.temperature=0] - Temperature (0-1)
   * @param {number} [request.maxTokens=1000] - Max tokens to generate
   * @returns {Promise<Object>} Completion response
   * @returns {boolean} .success - Whether the request succeeded
   * @returns {string} .response - The generated response text
   * @returns {Object} .usage - Token usage information
   * @returns {number} .duration - Request duration in milliseconds
   */
  async complete({ systemPrompt, userMessage, temperature = 0, maxTokens = 1000 }) {
    if (!systemPrompt) {
      throw new Error('systemPrompt is required');
    }
    if (!userMessage) {
      throw new Error('userMessage is required');
    }

    const startTime = Date.now();

    try {
      // Build Azure OpenAI endpoint URL
      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;

      console.log('[AzureOpenAIProvider] Making request to:', url);

      // Build request body
      const requestBody = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      };

      // Make HTTP request
      const response = await this.httpClient(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      console.log('[AzureOpenAIProvider] Response status:', response.status);

      // Handle errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AzureOpenAIProvider] API error:', errorText);
        throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
      }

      // Parse response
      const responseData = await response.json();
      const content = responseData.choices?.[0]?.message?.content || 'No response generated';

      console.log('[AzureOpenAIProvider] Response received, length:', content.length);

      return {
        success: true,
        response: content,
        usage: responseData.usage || null,
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.error('[AzureOpenAIProvider] Error:', error.message);
      throw new Error(`Azure OpenAI completion failed: ${error.message}`);
    }
  }
}

module.exports = AzureOpenAIProvider;
