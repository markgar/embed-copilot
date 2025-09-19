// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

const getAccessToken = async function () {
    // Load configuration with environment variable fallbacks
    const { loadConfig } = require('./configLoader');
    const config = loadConfig();

    // Use MSAL.js for authentication
    const msal = require("@azure/msal-node");

    const msalConfig = {
        auth: {
            clientId: config.clientId,
            authority: `${config.authorityUrl}${config.tenantId}`,
            clientSecret: config.clientSecret
        }
    };

    // Service Principal auth is the recommended by Microsoft to achieve App Owns Data Power BI embedding
    const clientApplication = new msal.ConfidentialClientApplication(msalConfig);

    const clientCredentialRequest = {
        scopes: [config.scopeBase],
    };

    return clientApplication.acquireTokenByClientCredential(clientCredentialRequest);
}

module.exports.getAccessToken = getAccessToken;