// Temporary basic routes for src-v2 to enable server startup
// This will be replaced with proper controller architecture in Phase 2
const path = require('path');

module.exports = function mountRoutes(app) {
  // Basic route for testing - will redirect to original for now
  app.get('/', (req, res) => {
    res.send(`
      <h1>src-v2 Server Running</h1>
      <p>This is the new architecture server. Routes are being migrated.</p>
      <p>For full functionality, please use the original server on a different port.</p>
    `);
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: 'src-v2', timestamp: new Date().toISOString() });
  });
};