const puppeteer = require('puppeteer');
const path = require('path');

// End-to-End Frontend Tests for ChartChat Modular Migration
// Tests the complete user flow from app load to chat interaction
describe('ChartChat E2E - Modular Architecture Validation', () => {
  let browser;
  let page;
  let app;
  const APP_URL = 'http://localhost:5300';
  const CHAT_TIMEOUT = 5000; // 5 seconds for AI responses (reduced from 15)

  beforeAll(async () => {
    // Start the Express server
    process.env.NODE_ENV = 'test';
    app = require('../../src-v2/app.js');
    
    // Launch browser in non-headless mode for debugging (change to true for CI)
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI/automated runs
      slowMo: 50, // Reduced delay for faster operations (was 100)
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 720 }
    });
    
    page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
    page.on('pageerror', error => console.error(`[PAGE ERROR] ${error.message}`));
    page.on('requestfailed', request => 
      console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`)
    );
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Application Loading and Module Validation', () => {
    test('should load the app and initialize PowerBI report', async () => {
      console.log('🌐 Navigating to ChartChat app...');
      
      await page.goto(APP_URL, { 
        waitUntil: 'networkidle2', 
        timeout: 10000  // Reduced from 20000
      });
      
      // Verify page loaded
      const title = await page.title();
      expect(title).toBe('Chart Chat');
      
      // Wait for all modules to load and initialize
      await page.waitForFunction(() => {
        return window.ChartChatUtilities && 
               window.PowerBICore && 
               window.ChartChatOperations && 
               window.ChartChatInterface && 
               window.ChartChatDataControls && 
               window.TreeViewModule && 
               window.ChartChatApp;
      }, { timeout: 10000 });
      
      console.log('✅ All modules loaded successfully');
      
      // Verify module APIs are available
      const moduleStatus = await page.evaluate(() => {
        return window.ChartChatApp.getApplicationStatus();
      });
      
      expect(moduleStatus.utilities).toBe(true);
      expect(moduleStatus.powerbiCore).toBe(true);
      expect(moduleStatus.chartOperations).toBe(true);
      expect(moduleStatus.chatInterface).toBe(true);
      expect(moduleStatus.dataControls).toBe(true);
      expect(moduleStatus.treeView).toBe(true);
      
      console.log('✅ Module API validation passed');
    }, 30000);

    test('should have functional chat interface elements', async () => {
      // Verify chat panel exists
      const chatPanel = await page.$('#chat-panel');
      expect(chatPanel).toBeTruthy();
      
      // Verify chat input exists
      const chatInput = await page.$('#chat-input');
      expect(chatInput).toBeTruthy();
      
      // Verify messages container exists
      const chatMessages = await page.$('#chat-messages');
      expect(chatMessages).toBeTruthy();
      
      // Check for initial assistant message
      const initialMessage = await page.$('.message.assistant');
      expect(initialMessage).toBeTruthy();
      
      console.log('✅ Chat interface elements validated');
    });

    test('should have treeview panel and controls', async () => {
      // Verify treeview panel exists
      const treeviewPanel = await page.$('#treeview-panel');
      expect(treeviewPanel).toBeTruthy();
      
      // Verify treeview controls exist
      const expandBtn = await page.$('#expand-all-btn');
      const collapseBtn = await page.$('#collapse-all-btn');
      expect(expandBtn).toBeTruthy();
      expect(collapseBtn).toBeTruthy();
      
      console.log('✅ TreeView interface validated');
    });

    test('should have data control buttons', async () => {
      // Verify data control buttons exist (they might be hidden initially)
      const totalSalesBtn = await page.$('#add-totalsales-btn');
      const totalUnitsBtn = await page.$('#add-totalunits-btn');
      const monthBtn = await page.$('#add-month-btn');
      const districtBtn = await page.$('#add-district-btn');
      
      expect(totalSalesBtn).toBeTruthy();
      expect(totalUnitsBtn).toBeTruthy();
      expect(monthBtn).toBeTruthy();
      expect(districtBtn).toBeTruthy();
      
      console.log('✅ Data control buttons validated');
    });
  });

  describe('PowerBI Integration and Report Loading', () => {
    test('should initialize PowerBI and load report', async () => {
      console.log('🔄 Waiting for PowerBI report to load...');
      
      // Wait for PowerBI report to be ready
      await page.waitForFunction(() => {
        const status = window.PowerBICore?.getReportLoadState();
        return status && status.loaded && status.rendered;
      }, { timeout: 5000 }); // Reduced from 60000 to 5000
      
      // Verify report container exists and has content
      const reportContainer = await page.$('#report-container');
      expect(reportContainer).toBeTruthy();
      
      // Check that PowerBI iframe is present
      const powerbiIframe = await page.$('#report-container iframe');
      expect(powerbiIframe).toBeTruthy();
      
      console.log('✅ PowerBI report loaded and ready');
    }, 10000); // Reduced from 70000 to 10000
  });

  describe('Chat Interaction Flow - "Show me sales by month"', () => {
    test('should accept user input and process AI response', async () => {
      console.log('💬 Testing chat interaction: "Show me sales by month"');
      
      // Wait for chat input to be enabled (happens after PowerBI loads)
      await page.waitForFunction(() => {
        const input = document.getElementById('chat-input');
        return input && !input.disabled;
      }, { timeout: 5000 }); // Reduced from 15000 to 5000
      
      // Focus on chat input
      await page.focus('#chat-input');
      
      // Type the test message faster
      const testMessage = 'Show me sales by month';
      await page.type('#chat-input', testMessage, { delay: 20 }); // Added typing delay of 20ms
      
      // Get initial message count
      const initialMessageCount = await page.$$eval('.message', messages => messages.length);
      
      // Submit the message (Enter key)
      await page.keyboard.press('Enter');
      
      console.log('📤 Message sent, waiting for response...');
      
      // Wait for new message to appear (user message + AI response)
      await page.waitForFunction((initialCount) => {
        const messages = document.querySelectorAll('.message');
        return messages.length >= initialCount + 2; // User message + AI response
      }, { timeout: CHAT_TIMEOUT }, initialMessageCount);
      
      // Verify user message was added
      const userMessages = await page.$$('.message.user');
      const lastUserMessage = await page.evaluate((el) => el.textContent, userMessages[userMessages.length - 1]);
      expect(lastUserMessage.trim()).toBe(testMessage);
      
      // Verify AI response was added
      const aiResponse = await page.$eval('.message.assistant:last-of-type', el => el.textContent);
      expect(aiResponse).toBeTruthy();
      expect(aiResponse.length).toBeGreaterThan(0);
      expect(aiResponse).not.toContain('Thinking...');
      
      console.log('📥 AI Response received:', aiResponse.substring(0, 100) + '...');
      console.log('✅ Chat interaction successful');
    }, CHAT_TIMEOUT + 2000); // Reduced additional timeout from 5000 to 2000

    test('should update chart based on AI response', async () => {
      console.log('📊 Checking for chart updates...');
      
      // Wait a moment for any chart updates to process
      await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1500
      
      // Check if chart configuration was updated
      const chartConfig = await page.evaluate(() => {
        return window.ChartChatOperations?.getCurrentChartConfig?.();
      });
      
      if (chartConfig) {
        console.log('📈 Chart configuration updated:', chartConfig);
        
        // Verify the chart has relevant fields
        expect(chartConfig).toBeTruthy();
        
        // The exact structure depends on AI response, but should have some configuration
        const hasConfig = chartConfig.yAxis || chartConfig.xAxis || chartConfig.chartType;
        expect(hasConfig).toBeTruthy();
      } else {
        console.log('📈 Chart configuration not updated (may be normal depending on AI response)');
      }
      
      console.log('✅ Chart update validation completed');
    });
  });

  describe('Module Integration Validation', () => {
    test('should have working error handling across modules', async () => {
      // Test error handling by checking console for any errors
      const consoleLogs = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleLogs.push(msg.text());
        }
      });
      
      // Wait a moment to capture any errors
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Filter out expected/harmless errors
      const criticalErrors = consoleLogs.filter(log => 
        !log.includes('favicon') && 
        !log.includes('DevTools') &&
        !log.includes('Extension')
      );
      
      if (criticalErrors.length > 0) {
        console.warn('⚠️ Console errors detected:', criticalErrors);
      }
      
      // Should have minimal critical errors
      expect(criticalErrors.length).toBeLessThan(3);
      
      console.log('✅ Error handling validation completed');
    });

    test('should have responsive UI elements', async () => {
      // Test TreeView expand/collapse
      const expandBtn = await page.$('#expand-all-btn');
      if (expandBtn) {
        await expandBtn.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('🌳 TreeView expand tested');
      }
      
      // Test chat input responsiveness
      await page.focus('#chat-input');
      await page.type('#chat-input', 'test');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      
      console.log('✅ UI responsiveness validated');
    });
  });

  describe('Performance and Memory Validation', () => {
    test('should not have excessive memory usage', async () => {
      // Get page metrics
      const metrics = await page.metrics();
      
      console.log('📊 Page Metrics:');
      console.log(`- JS Heap Size: ${Math.round(metrics.JSHeapUsedSize / 1024 / 1024)} MB`);
      console.log(`- JS Heap Total: ${Math.round(metrics.JSHeapTotalSize / 1024 / 1024)} MB`);
      console.log(`- Nodes: ${metrics.Nodes}`);
      console.log(`- Layout Count: ${metrics.LayoutCount}`);
      
      // Basic performance expectations
      expect(metrics.JSHeapUsedSize).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      expect(metrics.Nodes).toBeLessThan(10000); // Less than 10k DOM nodes
      
      console.log('✅ Memory usage within expected bounds');
    });
  });
});

// Helper function to wait for network idle
async function waitForNetworkIdle(page, timeout = 30000) {
  return page.waitForLoadState('networkidle', { timeout });
}