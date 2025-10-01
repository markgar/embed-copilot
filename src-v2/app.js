// Express app assembly (modular refactor)
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mountRoutes = require('./routes/routeOrchestrator');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.path} - Body:`, req.body);
  next();
});

// Static assets (mirrors legacy behavior)
app.use('/js', express.static(path.join(__dirname, '../node_modules/bootstrap/dist/js/')));
app.use('/js', express.static(path.join(__dirname, '../node_modules/jquery/dist/')));
app.use('/js', express.static(path.join(__dirname, '../node_modules/powerbi-client/dist/')));
app.use('/css', express.static(path.join(__dirname, '../node_modules/bootstrap/dist/css/')));
app.use('/css', express.static(path.join(__dirname, '../client/css/')));  // Client CSS
app.use('/js', express.static(path.join(__dirname, '../client/js/')));   // Client JS
app.use('/client', express.static(path.join(__dirname, '../client/')));  // Client assets

// Mount routes
mountRoutes(app);

module.exports = app;