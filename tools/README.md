# Development Tools

This directory contains development utilities and scripts for the embed-copilot project.

## Files

### `debug-server.js`
Minimal Express server for debugging server issues and testing components incrementally.

**Usage:**
```bash
node tools/debug-server.js
# Server will run on port 5301 (or DEBUG_PORT env var)
```

**Purpose:**
- Isolate server crashes or connection issues
- Test Express middleware components one by one
- Debug terminal/process signal handling problems
- Created during v2 migration debugging

**Test Endpoints:**
```bash
curl http://localhost:5301/test        # GET test
curl -X POST http://localhost:5301/test -H "Content-Type: application/json" -d '{"test":"data"}'
curl http://localhost:5301/health      # Health check
```

### `telemetry.js`
CLI tool for managing telemetry data collection.

**Usage:**
```bash
npm run telemetry <command>
```

**Commands:**
- `read` - Display collected telemetry entries
- `clear` - Clear all telemetry data  
- `export` - Export telemetry data as JSON
- `enable` - Enable telemetry collection
- `disable` - Disable telemetry collection

**Examples:**
```bash
npm run telemetry read           # View current telemetry
npm run telemetry clear          # Clear logs
npm run telemetry export > data.json  # Export to file
```

### `generate-tests.js`
Script for parsing telemetry data and generating Jest test suites.

**Usage:**
```bash
node tools/generate-tests.js [path-to-telemetry-data]
```

This script analyzes real API request/response patterns captured via telemetry and generates comprehensive Jest test cases with:
- Response structure validation
- Performance baseline checks  
- Real-world request patterns

## Workflow

1. Enable telemetry collection during development
2. Exercise the application to capture real usage patterns
3. Use `generate-tests.js` to create test suites from captured data
4. Integrate generated tests into the main test suite

## Notes

- Telemetry data files (`*.jsonl`, `*_telemetry.json`) are gitignored
- Tools require the main application dependencies to be installed
- Generated tests should be reviewed before integration