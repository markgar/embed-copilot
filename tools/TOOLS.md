# Tools

Development utilities for debugging and test generation.

## Scripts

**`debug-server.js`** - Minimal Express server for testing endpoints  
Usage: `node tools/debug-server.js` (runs on port 5301)

**`telemetry.js`** - CLI for managing telemetry data  
Usage: `npm run telemetry <read|clear|export>`

**`generate-tests.js`** - Generates Jest tests from telemetry data  
Usage: `node tools/generate-tests.js` (requires `clean_telemetry.json`)