# Power BI Embed with Chat

A Node.js application that embeds Power BI reports and provides an AI-powered chat interface for data visualization.

## Features

- 🚀 Power BI report embedding with Service Principal authentication
- 🤖 Azure OpenAI integration for natural language chart creation
- 📊 Interactive data visualization controls
- 🔒 Secure configuration management with environment variables

## Quick Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd embed-copilot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your credentials**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your actual credentials:
   - Azure tenant ID and Power BI app registration details
   - Power BI workspace, report, group, and dataset IDs
   - Azure OpenAI endpoint, API key, and deployment name

4. **Run the application**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5300`

## Configuration

The application supports two configuration methods:

### Option 1: Environment Variables (Recommended)
Edit the `.env` file with your credentials. This keeps secrets out of your codebase.

### Option 2: Config File
Alternatively, you can fill in the values directly in `config/config.json`, though this is not recommended for production.

## Required Credentials

### Power BI Setup
- **Tenant ID**: Your Azure Active Directory tenant ID
- **Client ID**: Power BI app registration client ID
- **Client Secret**: Power BI app registration client secret
- **Workspace ID**: Power BI workspace containing your report
- **Report ID**: The specific Power BI report to embed
- **Group ID**: Power BI group/workspace ID (often same as workspace ID)
- **Dataset ID**: Power BI dataset ID for metadata access

### Azure OpenAI Setup
- **Endpoint**: Your Azure OpenAI service endpoint URL
- **API Key**: Azure OpenAI API key
- **Deployment Name**: Name of your deployed GPT model
- **API Version**: Azure OpenAI API version (default: "2024-02-15-preview")

## Development

The application uses:
- **Express.js** for the web server
- **Power BI JavaScript SDK** for report embedding
- **Azure OpenAI** for natural language processing
- **Service Principal authentication** for secure Power BI access

### Architecture

- **src-v2/**: Current production architecture (Service Integration pattern)
- **src/**: Legacy architecture (maintained for compatibility)
- **npm run dev**: Runs the v2 architecture by default
- **npm run dev:v1**: Available to run legacy v1 architecture

### Development Best Practices

#### ✅ **Proper Server Management in VS Code**

**Recommended Method:**
```bash
# Use npm scripts with VS Code tasks
npm run dev
# This runs nodemon with proper background handling
```

**Testing Endpoints:**
```bash
# Always test in separate terminal commands
curl http://localhost:5300/health
curl -X POST http://localhost:5300/chat -H "Content-Type: application/json" -d '{"message":"test"}'
```

**Contract Validation:**
```bash
# Quick contract validation (ensure server is running first)
node test/validate-contract.js

# Run comprehensive test suites
npm test

# Test specific contract components
npm test -- chat-api-contract.test.js
npm test -- backend-frontend-contract.test.js
npm test -- telemetry-contract.test.js
```

#### ⚠️ **Common Pitfalls to Avoid**

**DON'T:** Run server and tests in the same synchronous session
```bash
# This can cause signal handling issues
node server.js && curl http://localhost:5300/test
```

**DO:** Use proper background processes
```bash
# For debugging, use background processes
node server.js &
# Then test separately
curl http://localhost:5300/test
```

#### 🔧 **Debugging Server Issues**

If you encounter apparent "server crashes":

1. **Check if it's a real crash or terminal signal handling:**
   ```bash
   # Use background process method
   node src-v2/server.js &
   ps aux | grep server  # Verify process is running
   ```

2. **Use the debug server for isolation:**
   ```bash
   node tools/debug-server.js
   # Minimal Express server for testing
   ```

3. **Look for actual error messages vs terminal signals:**
   - `^C` in logs might be VS Code terminal management, not crashes
   - Real errors will show stack traces and error messages

📖 **For comprehensive debugging strategies, see [DEBUGGING.md](DEBUGGING.md)**

#### 📁 **Project Structure**

- **src-v2/**: Service Integration Architecture (current)
  - `services/`: Business logic (PowerBI, OpenAI, Config)
  - `controllers/`: Thin request handlers
  - `routes/`: Express route definitions
- **tools/**: Development utilities and debugging scripts
- **test/**: Comprehensive test suite

## Security Notes

- The `.env` file is excluded from git to protect your credentials
- Only Service Principal authentication is supported (secure for production)
- All secrets should be stored in environment variables or secure config management

## Troubleshooting

📖 **For comprehensive debugging guide, see [DEBUGGING.md](DEBUGGING.md)**

### Server Issues

#### "Server appears to crash on requests"
**Symptoms:** Server starts fine but seems to crash when receiving HTTP requests, showing `^C` in logs.

**Root Cause:** This is usually VS Code terminal signal handling, not an actual server crash.

**Solution:**
1. **Use proper background processes:**
   ```bash
   # Instead of synchronous terminal commands
   node server.js &  # Background process
   ```

2. **Use npm scripts:**
   ```bash
   npm run dev  # Uses nodemon with proper process management
   ```

3. **Test separately:**
   ```bash
   # Don't run server and test in same command
   curl http://localhost:5300/test  # Separate command
   ```

**Verification:** Check if process is actually running:
```bash
ps aux | grep server  # Should show running process
```

### Common Issues

1. **Server won't start**: Check that all required environment variables are set in your `.env` file
2. **Power BI embed fails**: Verify your Service Principal has proper permissions in Power BI workspace
3. **Chat not working**: Confirm your Azure OpenAI endpoint and API key are correct
4. **"Constructor not found" errors**: Check service exports (should export class, not instance)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request