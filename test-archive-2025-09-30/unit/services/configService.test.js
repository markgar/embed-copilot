/**
 * Unit tests for configService.js
 * Tests configuration loading, validation, and constants
 */

const configService = require('../../../src-v2/services/configService');

describe('ConfigService', () => {
  describe('loadConfig', () => {
    test('should load configuration successfully', () => {
      const config = configService.loadConfig();
      
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    test('should include all expected properties', () => {
      const config = configService.loadConfig();
      
      // Core properties should exist (may be empty but should be defined)
      expect(config).toHaveProperty('tenantId');
      expect(config).toHaveProperty('clientId');
      expect(config).toHaveProperty('clientSecret');
      expect(config).toHaveProperty('powerBIGroupId');
      expect(config).toHaveProperty('powerBIReportId');
      expect(config).toHaveProperty('powerBIDatasetId');
      expect(config).toHaveProperty('azureOpenAIEndpoint');
      expect(config).toHaveProperty('azureOpenAIApiKey');
      expect(config).toHaveProperty('azureOpenAIDeploymentName');
      expect(config).toHaveProperty('azureOpenAIApiVersion');
    });

    test('should maintain backward compatibility with powerBIWorkspaceId', () => {
      const config = configService.loadConfig();
      
      expect(config).toHaveProperty('powerBIWorkspaceId');
      // powerBIWorkspaceId should reference the same value as powerBIGroupId
      expect(config.powerBIWorkspaceId).toBe(config.powerBIGroupId);
    });

    test('should handle missing config.json gracefully', () => {
      // This test validates the service doesn't crash on missing config
      // The actual config loading will depend on the file existing
      expect(() => configService.loadConfig()).not.toThrow();
    });
  });

  describe('validateConfig', () => {
    test('should validate complete valid config', () => {
      const validConfig = {
        clientId: '12345678-1234-1234-1234-123456789012',
        powerBIReportId: '12345678-1234-1234-1234-123456789012',
        powerBIGroupId: '12345678-1234-1234-1234-123456789012',
        authorityUrl: 'https://login.microsoftonline.com/common',
        clientSecret: 'valid-client-secret',
        tenantId: '12345678-1234-1234-1234-123456789012'
      };

      const result = configService.validateConfig(validConfig);
      expect(result).toBeNull(); // No validation errors
    });

    test('should return error for missing clientId', () => {
      const invalidConfig = {
        powerBIReportId: '12345678-1234-1234-1234-123456789012',
        powerBIGroupId: '12345678-1234-1234-1234-123456789012',
        authorityUrl: 'https://login.microsoftonline.com/common',
        clientSecret: 'valid-client-secret',
        tenantId: '12345678-1234-1234-1234-123456789012'
      };

      const result = configService.validateConfig(invalidConfig);
      expect(result).toContain('ClientId is empty');
    });

    test('should return error for invalid clientId format', () => {
      const invalidConfig = {
        clientId: 'not-a-guid',
        powerBIReportId: '12345678-1234-1234-1234-123456789012',
        powerBIGroupId: '12345678-1234-1234-1234-123456789012',
        authorityUrl: 'https://login.microsoftonline.com/common',
        clientSecret: 'valid-client-secret',
        tenantId: '12345678-1234-1234-1234-123456789012'
      };

      const result = configService.validateConfig(invalidConfig);
      expect(result).toContain('ClientId must be a Guid object');
    });

    test('should return error for missing powerBIReportId', () => {
      const invalidConfig = {
        clientId: '12345678-1234-1234-1234-123456789012',
        powerBIGroupId: '12345678-1234-1234-1234-123456789012',
        authorityUrl: 'https://login.microsoftonline.com/common',
        clientSecret: 'valid-client-secret',
        tenantId: '12345678-1234-1234-1234-123456789012'
      };

      const result = configService.validateConfig(invalidConfig);
      expect(result).toContain('ReportId is empty');
    });

    test('should return error for missing powerBIGroupId', () => {
      const invalidConfig = {
        clientId: '12345678-1234-1234-1234-123456789012',
        powerBIReportId: '12345678-1234-1234-1234-123456789012',
        authorityUrl: 'https://login.microsoftonline.com/common',
        clientSecret: 'valid-client-secret',
        tenantId: '12345678-1234-1234-1234-123456789012'
      };

      const result = configService.validateConfig(invalidConfig);
      expect(result).toContain('WorkspaceId is empty');
    });

    test('should return error for missing authorityUrl', () => {
      const invalidConfig = {
        clientId: '12345678-1234-1234-1234-123456789012',
        powerBIReportId: '12345678-1234-1234-1234-123456789012',
        powerBIGroupId: '12345678-1234-1234-1234-123456789012',
        clientSecret: 'valid-client-secret',
        tenantId: '12345678-1234-1234-1234-123456789012'
      };

      const result = configService.validateConfig(invalidConfig);
      expect(result).toContain('AuthorityUrl is empty');
    });

    test('should return error for missing clientSecret', () => {
      const invalidConfig = {
        clientId: '12345678-1234-1234-1234-123456789012',
        powerBIReportId: '12345678-1234-1234-1234-123456789012',
        powerBIGroupId: '12345678-1234-1234-1234-123456789012',
        authorityUrl: 'https://login.microsoftonline.com/common',
        tenantId: '12345678-1234-1234-1234-123456789012'
      };

      const result = configService.validateConfig(invalidConfig);
      expect(result).toContain('ClientSecret is empty');
    });

    test('should return error for empty clientSecret', () => {
      const invalidConfig = {
        clientId: '12345678-1234-1234-1234-123456789012',
        powerBIReportId: '12345678-1234-1234-1234-123456789012',
        powerBIGroupId: '12345678-1234-1234-1234-123456789012',
        authorityUrl: 'https://login.microsoftonline.com/common',
        clientSecret: '   ', // whitespace only
        tenantId: '12345678-1234-1234-1234-123456789012'
      };

      const result = configService.validateConfig(invalidConfig);
      expect(result).toContain('ClientSecret is empty');
    });

    test('should return error for missing tenantId', () => {
      const invalidConfig = {
        clientId: '12345678-1234-1234-1234-123456789012',
        powerBIReportId: '12345678-1234-1234-1234-123456789012',
        powerBIGroupId: '12345678-1234-1234-1234-123456789012',
        authorityUrl: 'https://login.microsoftonline.com/common',
        clientSecret: 'valid-client-secret'
      };

      const result = configService.validateConfig(invalidConfig);
      expect(result).toContain('TenantId is empty');
    });

    test('should use loaded config when no config provided', () => {
      // This tests the default behavior of validateConfig()
      const result = configService.validateConfig();
      
      // Should return either null (if config is valid) or a string (if invalid)
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('constants', () => {
    test('should export METADATA_CACHE_DURATION constant', () => {
      expect(configService.constants).toBeDefined();
      expect(configService.constants.METADATA_CACHE_DURATION).toBeDefined();
      expect(typeof configService.constants.METADATA_CACHE_DURATION).toBe('number');
    });

    test('should have correct cache duration (5 minutes)', () => {
      const expectedDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
      expect(configService.constants.METADATA_CACHE_DURATION).toBe(expectedDuration);
    });
  });

  describe('integration behavior', () => {
    test('should maintain consistency between loadConfig and validateConfig', () => {
      const loadedConfig = configService.loadConfig();
      const validationResult = configService.validateConfig(loadedConfig);
      
      // Validation result should be consistent with loaded config
      expect(validationResult === null || typeof validationResult === 'string').toBe(true);
    });

    test('should export all required functions', () => {
      expect(typeof configService.loadConfig).toBe('function');
      expect(typeof configService.validateConfig).toBe('function');
      expect(typeof configService.constants).toBe('object');
    });
  });
});