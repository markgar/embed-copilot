// Minimal bootstrap after modular refactor
// Original monolithic implementation archived under archive/server.original-20250918.js
const app = require('./app');
const port = process.env.PORT || 5300;
app.listen(port, () => console.log(`[app] Listening on port ${port}`));