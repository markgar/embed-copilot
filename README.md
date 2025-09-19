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

## Security Notes

- The `.env` file is excluded from git to protect your credentials
- Only Service Principal authentication is supported (secure for production)
- All secrets should be stored in environment variables or secure config management

## Troubleshooting

1. **Server won't start**: Check that all required environment variables are set in your `.env` file
2. **Power BI embed fails**: Verify your Service Principal has proper permissions in Power BI workspace
3. **Chat not working**: Confirm your Azure OpenAI endpoint and API key are correct

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request