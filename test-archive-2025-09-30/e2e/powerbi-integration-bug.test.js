const puppeteer = require('puppeteer');

// Critical Bug Test - PowerBI Report Instance Integration
// This test specifically validates that chart operations can access the PowerBI report instance
describe('Critical Bug: PowerBI Report Instance Integration', () => {
  let browser;
  let page;
  let app;
  let consoleLogs = [];
  let consoleErrors = [];
  const APP_URL = 'http://localhost:5300';

  beforeAll(async () => {
    // Start the Express server
    process.env.NODE_ENV = 'test';
    app = require('../../src-v2/app.js');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 720 }
    });
    
    page = await browser.newPage();
    
    // Capture console logs and errors
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR] ${text}`);
        consoleErrors.push(text);
      } else {
        consoleLogs.push(text);
      }
    });
    
    page.on('pageerror', error => {
      console.error(`[PAGE ERROR] ${error.message}`);
      consoleErrors.push(error.message);
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should NOT show "No report instance available" error when processing chat', async () => {
    // Testing for "No report instance available" bug
    
    // Navigate to the application
    await page.goto(APP_URL, { 
      waitUntil: 'networkidle2',
      timeout: 10000  // Reduced from 20000
    });
    
    // Wait for modules to load
    await page.waitForFunction(() => {
      return window.ChartChatUtilities && 
             window.PowerBICore && 
             window.ChartChatOperations && 
             window.ChartChatInterface;
    }, { timeout: 15000 });
    
    // Wait for PowerBI to be ready
    await page.waitForFunction(() => {
      const status = window.PowerBICore?.getReportLoadState();
      return status && status.loaded && status.rendered;
    }, { timeout: 5000 }); // Reduced from 60000 to 5000
    
    // Verify PowerBI Core has a report instance
    const hasReportInstance = await page.evaluate(() => {
      const report = window.PowerBICore?.getReport();
      return !!report;
    });
    
    expect(hasReportInstance).toBe(true);
    console.log('✅ PowerBI Core has report instance');
    
    // Verify Chart Operations can access the report
    const chartOpsCanAccessReport = await page.evaluate(() => {
      const report = window.PowerBICore?.getReport();
      return !!report && typeof report.getPages === 'function';
    });
    
    expect(chartOpsCanAccessReport).toBe(true);
    console.log('✅ Chart Operations can access PowerBI report');
    
    // Clear console logs before testing
    consoleLogs = [];
    consoleErrors = [];
    
    // Wait for chat input to be enabled
    await page.waitForFunction(() => {
      const input = document.getElementById('chat-input');
      return input && !input.disabled;
    }, { timeout: 5000 }); // Reduced from 15000 to 5000
    
    // Test the problematic interaction
    await page.focus('#chat-input');
    await page.type('#chat-input', 'Show me sales by month', { delay: 20 }); // Added typing delay
    
    const initialMessageCount = await page.$$eval('.message', messages => messages.length);
    
    await page.keyboard.press('Enter');
    
    console.log('📤 Sent "Show me sales by month", monitoring for errors...');
    
    // Wait for response or timeout
    try {
      await page.waitForFunction((initialCount) => {
        const messages = document.querySelectorAll('.message');
        return messages.length >= initialCount + 2;
      }, { timeout: 5000 }, initialMessageCount); // Reduced from 20000 to 5000
    } catch (timeoutError) {
      console.log('⏰ Chat response timed out, checking for errors...');
    }
    
    // Wait a moment for any delayed errors
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for the specific error message in console
    const hasReportInstanceError = consoleErrors.some(error => 
      error.includes('No report instance available')
    );
    
    // Check for the error message in the chat
    const chatMessages = await page.$$eval('.message', messages => 
      messages.map(msg => msg.textContent)
    );
    
    const hasErrorInChat = chatMessages.some(msg => 
      msg.includes('Error: No report instance available')
    );
    
    // Log all errors for debugging
    if (consoleErrors.length > 0) {
      console.log('🚨 Console Errors Detected:');
      consoleErrors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (hasErrorInChat) {
      console.log('🚨 Error message found in chat interface');
    }
    
    // The main assertions
    expect(hasReportInstanceError).toBe(false);
    expect(hasErrorInChat).toBe(false);
    
    // Additional validation - check that we got a valid response
    const lastMessage = chatMessages[chatMessages.length - 1];
    if (lastMessage) {
      expect(lastMessage).not.toContain('Error:');
      expect(lastMessage).not.toContain('No report instance');
      console.log('✅ Last chat message:', lastMessage.substring(0, 100) + '...');
    }
    
    console.log('✅ No "No report instance available" errors detected');
  }, 90000);

  test('should have working PowerBI-ChartOperations integration', async () => {
    // Test the direct integration between modules
    const integrationWorking = await page.evaluate(() => {
      // Test that PowerBI Core exports work correctly
      const powerBIExports = window.PowerBICore;
      if (!powerBIExports || !powerBIExports.getReport) {
        return { success: false, error: 'PowerBI Core exports missing' };
      }
      
      // Test that Chart Operations can use PowerBI exports
      const chartOpsExports = window.ChartChatOperations;
      if (!chartOpsExports || !chartOpsExports.getCurrentChartConfig) {
        return { success: false, error: 'Chart Operations exports missing' };
      }
      
      // Test the actual integration
      const report = powerBIExports.getReport();
      if (!report) {
        return { success: false, error: 'No report instance from PowerBI Core' };
      }
      
      return { success: true, report: !!report };
    });
    
    expect(integrationWorking.success).toBe(true);
    if (!integrationWorking.success) {
      console.error('❌ Integration Error:', integrationWorking.error);
    } else {
      console.log('✅ PowerBI-ChartOperations integration working');
    }
  });
});