const path = require('path');
const express = require('express');

// Import route modules
const embedRoutes = require('./embedRoutes');
const metadataRoutes = require('./metadataRoutes');
const chatRoutes = require('./chatRoutes');
const systemRoutes = require('./systemRoutes');
const fabricRoutes = require('./fabricRoutes');

module.exports = function mountRoutes(app) {
  console.log('[Routes] Mounting routes...');
  
  // Views - chartchat is now the default page
  app.get('/', (req, res) => {
    console.log('[Routes] Root route accessed');
    res.sendFile(path.join(__dirname, '../../client/views/chartchat.html'));
  });

  // Keep the /chartchat route for backwards compatibility
  app.get('/chartchat', (req, res) => {
    console.log('[Routes] Chartchat route accessed');
    res.sendFile(path.join(__dirname, '../../client/views/chartchat.html'));
  });

  // React app routes
  app.use('/react', express.static(path.join(__dirname, '../../react/dist')));
  app.get('/react/*', (req, res) => {
    console.log('[Routes] React route accessed');
    res.sendFile(path.join(__dirname, '../../react/dist/index.html'));
  });

  console.log('[Routes] Mounting API routes...');
  // Mount API routes
  app.use('/', embedRoutes);      // /getEmbedToken
  app.use('/', metadataRoutes);   // /getDatasetMetadata, /debug/metadata
  app.use('/', chatRoutes);       // /chat
  app.use('/', systemRoutes);     // /health, /log-error, /log-console
  app.use('/fabric', fabricRoutes); // /fabric/reports/ensure
  
  console.log('[Routes] All routes mounted successfully');
};