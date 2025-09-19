// Express app assembly (modular refactor)
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mountRoutes = require('./routes/index'); // Updated path
const telemetry = require('../src/telemetry'); // Keep pointing to original for now

const app = express();

// Telemetry middleware - capture all requests/responses
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Skip telemetry for static assets to reduce noise
  if (req.path.startsWith('/js/') || req.path.startsWith('/css/') || req.path.startsWith('/public/')) {
    return next();
  }

  // Store original res.json and res.send to capture response data
  const originalJson = res.json;
  const originalSend = res.send;
  let responseData = null;

  res.json = function(data) {
    responseData = data;
    telemetry.logRequest(req, res, responseData, startTime);
    return originalJson.call(this, data);
  };

  res.send = function(data) {
    responseData = data;
    telemetry.logRequest(req, res, responseData, startTime);
    return originalSend.call(this, data);
  };

  next();
});

// Static assets (mirrors legacy behavior)
app.use('/js', express.static(path.join(__dirname, '../node_modules/bootstrap/dist/js/')));
app.use('/js', express.static(path.join(__dirname, '../node_modules/jquery/dist/')));
app.use('/js', express.static(path.join(__dirname, '../node_modules/powerbi-client/dist/')));
app.use('/css', express.static(path.join(__dirname, '../node_modules/bootstrap/dist/css/')));
app.use('/css', express.static(path.join(__dirname, '../public/css/')));  // Add our custom CSS
app.use('/js', express.static(path.join(__dirname, '../public/js/')));   // Add our custom JS
app.use('/public', express.static(path.join(__dirname, '../public/')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Mount routes
mountRoutes(app);

module.exports = app;