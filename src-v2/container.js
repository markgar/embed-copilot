/**
 * Dependency Injection Container
 * Central location for all service instantiation and wiring
 */

const configService = require('./services/configService');
const AgentService = require('./services/agentService');
const AzureOpenAIProvider = require('./services/azureOpenAIProvider');
const ChatController = require('./controllers/chatController');
const PowerBIService = require('./services/powerbiService');
const FabricService = require('./services/fabricService');
const msal = require('@azure/msal-node');
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
   * Get MSAL Client instance
   * Lazy initialization - creates MSAL client for PowerBI authentication
   */
  getMsalClient() {
    if (!this.services.msalClient) {
      const config = this.getConfigService().loadConfig();
      
      const msalConfig = {
        auth: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          authority: `https://login.microsoftonline.com/${config.tenantId}`
        }
      };

      this.services.msalClient = new msal.ConfidentialClientApplication(msalConfig);
    }
    return this.services.msalClient;
  }

  /**
   * Get PowerBIService instance
   * Lazy initialization with injected config, msalClient, and httpClient
   */
  getPowerBIService() {
    if (!this.services.powerbiService) {
      const config = this.getConfigService().loadConfig();
      
      this.services.powerbiService = new PowerBIService(
        config,
        this.getMsalClient(),
        fetch
      );
    }
    return this.services.powerbiService;
  }

  /**
   * Get FabricService instance
   * Lazy initialization with injected config and httpClient
   */
  getFabricService() {
    if (!this.services.fabricService) {
      const config = this.getConfigService().loadConfig();
      
      this.services.fabricService = new FabricService(
        config,
        fetch
      );
    }
    return this.services.fabricService;
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
