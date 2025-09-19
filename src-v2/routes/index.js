const express = require('express');
const path = require('path');

// Import route modules
const embedRoutes = require('./embedRoutes');
const metadataRoutes = require('./metadataRoutes');
const chatRoutes = require('./chatRoutes');
const systemRoutes = require('./systemRoutes');

module.exports = function mountRoutes(app) {
  // Views - chartchat is now the default page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../views/chartchat.html'));
  });

  // Keep the /chartchat route for backwards compatibility
  app.get('/chartchat', (req, res) => {
    res.sendFile(path.join(__dirname, '../../views/chartchat.html'));
  });

  // Mount API routes
  app.use('/', embedRoutes);      // /getEmbedToken
  app.use('/', metadataRoutes);   // /getDatasetMetadata, /debug/metadata
  app.use('/', chatRoutes);       // /chat
  app.use('/', systemRoutes);     // /health, /log-error, /log-console, /telemetry-control
};