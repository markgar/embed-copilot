// Express app assembly (modular refactor)
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mountRoutes = require('./routes');

const app = express();

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
