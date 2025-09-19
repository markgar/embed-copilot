// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

const { loadConfig } = require('./configLoader');

function getAuthHeader(accessToken) {

    // Function to append Bearer against the Access Token
    return "Bearer ".concat(accessToken);
}

function validateConfig() {
    const config = loadConfig();

    // Validation function to check whether the Configurations are available in the config.json file or not

    let guid = require("guid");

    if (!config.clientId) {
        return "ClientId is empty. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.";
    }

    if (!guid.isGuid(config.clientId)) {
        return "ClientId must be a Guid object. Please register your application as Native app in https://dev.powerbi.com/apps and fill Client Id in config.json.";
    }

    if (!config.powerBIReportId) {
        return "ReportId is empty. Please select a report you own and fill its Id in config.json.";
    }

    if (!guid.isGuid(config.powerBIReportId)) {
        return "ReportId must be a Guid object. Please select a report you own and fill its Id in config.json.";
    }

    if (!config.powerBIWorkspaceId) {
        return "WorkspaceId is empty. Please select a group you own and fill its Id in config.json.";
    }

    if (!guid.isGuid(config.powerBIWorkspaceId)) {
        return "WorkspaceId must be a Guid object. Please select a workspace you own and fill its Id in config.json.";
    }

    if (!config.authorityUrl) {
        return "AuthorityUrl is empty. Please fill valid AuthorityUrl in config.json.";
    }

    // Service Principal validation
    if (!config.clientSecret || !config.clientSecret.trim()) {
        return "ClientSecret is empty. Please fill Power BI ServicePrincipal ClientSecret in config.json.";
    }

    if (!config.tenantId) {
        return "TenantId is empty. Please fill the TenantId in config.json.";
    }

    if (!guid.isGuid(config.tenantId)) {
        return "TenantId must be a Guid object. Please select a workspace you own and fill its Id in config.json.";
    }
}

module.exports = {
    getAuthHeader: getAuthHeader,
    validateConfig: validateConfig,
}