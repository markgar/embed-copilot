// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

const configService = require('./services/configService');

function getAuthHeader(accessToken) {
  // Function to append Bearer against the Access Token
  return 'Bearer '.concat(accessToken);
}

function validateConfig() {
  const config = configService.loadConfig();

  // Validation function to check whether the Configurations are available in the config.json file or not

  const guid = require('guid');

  if (!config.clientId) {
    return 'ClientId is empty. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.';
  }

  if (!guid.isGuid(config.clientId)) {
    return 'ClientId must be a Guid object. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.';
  }

  if (!config.powerBIReportId) {
    return 'ReportId is empty. Please select a report you own and fill its Id in config.json.';
  }

  if (!guid.isGuid(config.powerBIReportId)) {
    return 'ReportId must be a Guid object. Please select a report you own and fill its Id in config.json.';
  }

  if (!config.powerBIGroupId) {
    return 'WorkspaceId is empty. Please select a group you own and fill its Id in config.json.';
  }

  if (!guid.isGuid(config.powerBIGroupId)) {
    return 'WorkspaceId must be a Guid object. Please select a workspace you own and fill its Id in config.json.';
  }

  if (!config.authorityUrl) {
    return 'AuthorityUrl is empty. Please fill valid AuthorityUrl in config.json.';
  }

  // Service Principal validation
  if (!config.clientSecret || !config.clientSecret.trim()) {
    return 'ClientSecret is empty. Please fill Power BI ServicePrincipal ClientSecret in config.json.';
  }

  if (!config.tenantId) {
    return 'TenantId is empty. Please fill the TenantId in config.json.';
  }

  if (!guid.isGuid(config.tenantId)) {
    return 'TenantId must be a Guid object. Please select a workspace you own and fill its Id in config.json.';
  }

  return null; // Return null if all validations pass
}

function validateConfigForDynamicReport() {
  const config = configService.loadConfig();

  // Validation function for dynamic reports (skip static reportId validation)
  const guid = require('guid');

  if (!config.clientId) {
    return 'ClientId is empty. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.';
  }

  if (!guid.isGuid(config.clientId)) {
    return 'ClientId must be a Guid object. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.';
  }

  // Skip powerBIReportId validation for dynamic reports

  if (!config.powerBIGroupId) {
    return 'WorkspaceId is empty. Please select a group you own and fill its Id in config.json.';
  }

  if (!guid.isGuid(config.powerBIGroupId)) {
    return 'WorkspaceId must be a Guid object. Please select a workspace you own and fill its Id in config.json.';
  }

  if (!config.authorityUrl) {
    return 'AuthorityUrl is empty. Please fill valid AuthorityUrl in config.json.';
  }

  // Service Principal validation
  if (!config.clientSecret || !config.clientSecret.trim()) {
    return 'ClientSecret is empty. Please fill Power BI ServicePrincipal ClientSecret in config.json.';
  }

  if (!config.tenantId) {
    return 'TenantId is empty. Please fill the TenantId in config.json.';
  }

  if (!guid.isGuid(config.tenantId)) {
    return 'TenantId must be a Guid object. Please select a workspace you own and fill its Id in config.json.';
  }

  return null; // Return null if all validations pass
}

module.exports = {
  getAuthHeader: getAuthHeader,
  validateConfig: validateConfig,
  validateConfigForDynamicReport: validateConfigForDynamicReport,
};