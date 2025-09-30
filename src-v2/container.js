/**
 * Dependency Injection Container
 * Central location for all service instantiation and wiring
 */

const configService = require('./services/configService');
const AgentService = require('./services/agentService');
const AzureOpenAIProvider = require('./services/azureOpenAIProvider');
const ChatController = require('./controllers/chatController');
const fetch = require('node-fetch');

class Container {
  constructor() {
    this.services = {};
  }

  /**
   * Get ConfigService instance
   * ConfigService is stateless, so we use the module directly
   */
  getConfigService() {
    return configService;
  }

  /**
   * Get AzureOpenAIProvider instance
   * Lazy initialization - creates on first request
   */
  getAzureOpenAIProvider() {
    if (!this.services.azureOpenAIProvider) {
      const config = this.getConfigService().loadConfig();

      // Map application config to provider-specific config
      const providerConfig = {
        endpoint: config.azureOpenAIEndpoint,
        apiKey: config.azureOpenAIApiKey,
        deploymentName: config.azureOpenAIDeploymentName,
        apiVersion: config.azureOpenAIApiVersion
      };

      this.services.azureOpenAIProvider = new AzureOpenAIProvider(
        providerConfig,
        fetch
      );
    }
    return this.services.azureOpenAIProvider;
  }

  /**
   * Get AgentService instance
   * Lazy initialization - creates on first request with provider
   */
  getAgentService() {
    if (!this.services.agentService) {
      this.services.agentService = new AgentService(
        this.getAzureOpenAIProvider()
      );
    }
    return this.services.agentService;
  }

  /**
   * Get ChatController instance
   * Lazy initialization with injected AgentService
   */
  getChatController() {
    if (!this.services.chatController) {
      this.services.chatController = new ChatController(this.getAgentService());
    }
    return this.services.chatController;
  }

  /**
   * Reset all services (useful for testing)
   */
  reset() {
    this.services = {};
  }

  /**
   * Override a service (useful for testing)
   */
  setService(name, instance) {
    this.services[name] = instance;
  }
}

// Export singleton container instance
module.exports = new Container();
