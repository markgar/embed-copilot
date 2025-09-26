#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load all three templates (same ones our backend uses)
const pbirTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, '../templates/report/definition.pbir.template.json'), 'utf8'));
const reportTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, '../templates/report/report.template.json'), 'utf8'));
const platformTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, '../templates/report/platform.template.json'), 'utf8'));

// Create the exact same objects our backend creates
const datasetId = 'd402b331-953c-436b-879f-5ea2a88f5f05';
const reportName = 'test-exact-cli-structure';

const pbirDefinition = {
  ...pbirTemplate,
  datasetReference: {
    byConnection: {
      connectionString: pbirTemplate.datasetReference.byConnection.connectionString
        .replace('{{WORKSPACE_NAME}}', 'EmbedQuickDemo')
        .replace('{{DATASET_NAME}}', 'Store Sales')
        .replace('{{DATASET_ID}}', datasetId)
    }
  }
};

const reportJson = reportTemplate;

const platformJson = {
  ...platformTemplate,
  metadata: {
    ...platformTemplate.metadata,
    displayName: platformTemplate.metadata.displayName.replace('{{REPORT_NAME}}', reportName),
    description: platformTemplate.metadata.description.replace('{{DATASET_ID}}', datasetId)
  }
};

// Create exact JSON strings (no formatting)
const pbirJsonString = JSON.stringify(pbirDefinition);
const reportJsonString = JSON.stringify(reportJson);
const platformJsonString = JSON.stringify(platformJson);

// Base64 encode
const encodedPbirDef = Buffer.from(pbirJsonString).toString('base64');
const encodedReportJson = Buffer.from(reportJsonString).toString('base64');
const encodedPlatformJson = Buffer.from(platformJsonString).toString('base64');

console.log('=== PBIR DEFINITION ===');
console.log('JSON:', pbirJsonString);
console.log('Base64:', encodedPbirDef);
console.log('\n=== REPORT.JSON ===');
console.log('JSON (first 200 chars):', reportJsonString.substring(0, 200) + '...');
console.log('Base64 (first 100 chars):', encodedReportJson.substring(0, 100) + '...');
console.log('Base64 full length:', encodedReportJson.length);
console.log('\n=== PLATFORM.JSON ===');
console.log('JSON:', platformJsonString);
console.log('Base64:', encodedPlatformJson);

// Save for later comparison if needed
fs.writeFileSync(path.join(__dirname, 'pbir-base64.txt'), encodedPbirDef);
fs.writeFileSync(path.join(__dirname, 'report-base64.txt'), encodedReportJson);
fs.writeFileSync(path.join(__dirname, 'platform-base64.txt'), encodedPlatformJson);

console.log('\n✅ All three Base64 files saved to tools/ directory for comparison');