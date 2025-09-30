const puppeteer = require('puppeteer');

// Quick E2E Test for CI/Automated Testing
// Simplified version that runs headless and focuses on core functionality
describe('ChartChat E2E - Quick Validation', () => {
  let browser;
  let page;
  let app;
  const APP_URL = 'http://localhost:5300';

  beforeAll(async () => {
    // Start the Express server
    process.env.NODE_ENV = 'test';
    app = require('../../src-v2/app.js');
    
    // Launch browser in headless mode for CI
    browser = await puppeteer.launch({
      headless: true, // Always headless for CI
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 1280, height: 720 }
    });
    
    page = await browser.newPage();
    
    // Suppress console logs for CI
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
      }
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should load app, initialize modules, and process chat message', async () => {
    // Navigate to the application
    await page.goto(APP_URL, { 
      waitUntil: 'networkidle2',
      timeout: 10000  // Reduced from 20000
    });
    
    // Verify page loaded
    const title = await page.title();
    expect(title).toBe('Chart Chat');
    
    // Wait for all modules to load
    await page.waitForFunction(() => {
      return window.ChartChatUtilities && 
             window.PowerBICore && 
             window.ChartChatOperations && 
             window.ChartChatInterface && 
             window.ChartChatDataControls && 
             window.TreeViewModule && 
             window.ChartChatApp;
    }, { timeout: 15000 });
    
    // Wait for PowerBI to be ready
    await page.waitForFunction(() => {
      const status = window.PowerBICore?.getReportLoadState();
      return status && status.loaded && status.rendered;
    }, { timeout: 5000 }); // Reduced from 60000 to 5000
    
    // Wait for chat input to be enabled
    await page.waitForFunction(() => {
      const input = document.getElementById('chat-input');
      return input && !input.disabled;
    }, { timeout: 5000 }); // Reduced from 15000 to 5000
    
    // Test chat interaction
    await page.focus('#chat-input');
    await page.type('#chat-input', 'Show me sales by month', { delay: 20 }); // Added typing delay
    
    const initialMessageCount = await page.$$eval('.message', messages => messages.length);
    
    await page.keyboard.press('Enter');
    
    await page.click('#send-btn');
    
    // Wait for response
    await page.waitForFunction((initialCount) => {
      const messages = document.querySelectorAll('.message');
      return messages.length >= initialCount + 2;
    }, { timeout: 5000 }, initialMessageCount); // Reduced from 15000 to 5000
    
    // Verify we got a response
    const finalMessageCount = await page.$$eval('.message', messages => messages.length);
    expect(finalMessageCount).toBeGreaterThan(initialMessageCount);
    
    // Basic performance check
    const metrics = await page.metrics();
    expect(metrics.JSHeapUsedSize).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
  }, 90000);
});