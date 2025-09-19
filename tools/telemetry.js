#!/usr/bin/env node

// Telemetry control script
const telemetry = require('../src/telemetry');
const command = process.argv[2];

switch (command) {
  case 'clear':
    telemetry.clearLogs();
    console.log('✅ Telemetry logs cleared');
    break;
    
  case 'read':
    const logs = telemetry.readLogs();
    console.log(`📊 Found ${logs.length} telemetry entries:`);
    logs.forEach((log, index) => {
      console.log(`\n--- Entry ${index + 1} ---`);
      console.log(`${log.request.method} ${log.request.url} -> ${log.response.status} (${log.response.duration}ms)`);
      if (log.response.body && typeof log.response.body === 'object') {
        const keys = Object.keys(log.response.body);
        console.log(`Response keys: ${keys.join(', ')}`);
      }
    });
    break;
    
  case 'export':
    const allLogs = telemetry.readLogs();
    console.log(JSON.stringify(allLogs, null, 2));
    break;
    
  default:
    console.log(`
📡 Telemetry Control

Usage: node telemetry.js <command>

Commands:
  clear   - Clear all telemetry logs
  read    - Show summary of telemetry entries  
  export  - Export all telemetry data as JSON

To enable telemetry:
  TELEMETRY_MODE=true npm run dev

To enable console output:
  TELEMETRY_MODE=true TELEMETRY_CONSOLE=true npm run dev
`);
}