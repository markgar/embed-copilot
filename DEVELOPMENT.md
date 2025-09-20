# Development Guide

This document contains important development insights and best practices learned during the v2 architecture migration.

## Key Learning: VS Code Terminal Signal Handling

### The Problem We Discovered

During development, we encountered what appeared to be server crashes:
- Server would start successfully 
- First HTTP request would cause apparent crash with `^C` in logs
- Process would be terminated

### The Real Cause

The issue was **not actual server crashes** but **VS Code terminal signal handling**:

1. When running `node server.js` followed by `curl` commands in the same terminal session
2. VS Code's terminal management sends SIGINT signals when commands complete
3. This kills the Node.js process, making it appear like a crash

### The Solution

**✅ Use proper background process management:**

```bash
# Method 1: npm scripts (recommended)
npm run dev  # Uses nodemon with proper process handling

# Method 2: Background processes
node server.js &

# Method 3: VS Code tasks
# Use the "Dev Server" task in VS Code
```

**✅ Test endpoints separately:**

```bash
# Don't combine server start and testing
curl http://localhost:5300/health
curl -X POST http://localhost:5300/chat -H "Content-Type: application/json" -d '{"message":"test"}'
```

## Architecture Migration Insights

### Service Export Patterns

**❌ Wrong:** Exporting instances
```javascript
module.exports = new MyService();
```

**✅ Correct:** Exporting classes
```javascript
module.exports = MyService;
```

### Debugging Approach

1. **Start simple:** Use minimal Express server to isolate issues
2. **Add incrementally:** Add components one by one
3. **Verify each step:** Test after each addition
4. **Use background processes:** Avoid terminal signal conflicts

## Development Workflow

### Starting Development

```bash
# 1. Start the development server
npm run dev

# 2. Verify server is running
curl http://localhost:5300/health

# 3. Test specific endpoints
curl http://localhost:5300/getEmbedToken
curl http://localhost:5300/getDatasetMetadata
curl -X POST http://localhost:5300/chat -H "Content-Type: application/json" -d '{"message":"hello"}'
```

### Debugging Issues

```bash
# 1. Use the debug server for isolation
node tools/debug-server.js &

# 2. Check processes are running
ps aux | grep server

# 3. Test with verbose output
curl -v http://localhost:5301/test
```

### Code Changes

1. **Make changes to src-v2/ files**
2. **Nodemon will auto-restart** (if using npm run dev)
3. **Test endpoints** to verify changes
4. **Check server logs** for any errors

## Common Patterns

### Error Handling
```javascript
// Always wrap async operations
try {
    const result = await service.doSomething();
    res.json(result);
} catch (error) {
    console.error('Operation failed:', error);
    res.status(500).json({ error: 'Operation failed' });
}
```

### Service Initialization
```javascript
// Proper service instantiation
const service = new MyService();
await service.initialize();
```

### Configuration Loading
```javascript
// Use the centralized config service
const config = configService.loadConfig();
```

## Tools Available

- **tools/debug-server.js**: Minimal Express server for debugging
- **tools/generate-tests.js**: Test generation utilities
- **tools/telemetry.js**: Telemetry management
- **test/**: Comprehensive test suite
- **DEBUGGING.md**: Comprehensive debugging guide using telemetry and console logs

## Architecture Notes

### Current (src-v2/)
- **Service Integration Architecture**
- **Separation of concerns:** Controllers → Services → External APIs
- **Centralized configuration**
- **Comprehensive error handling**

### Legacy (src/)
- **Monolithic structure** 
- **Direct API calls from routes**
- **Available via `npm run dev:v1`**

## Key Takeaways

1. **Terminal behavior != application behavior**
2. **Background processes are essential for development**
3. **Test each component in isolation**
4. **Document debugging insights for future reference**
5. **Use proper error handling and logging**

This knowledge ensures smooth development and debugging in the future!