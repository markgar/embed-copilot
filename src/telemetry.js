const fs = require('fs');
const path = require('path');

class TelemetryLogger {
  constructor() {
    this.enabled = process.env.TELEMETRY_MODE === 'true';
    this.logFile = path.join(__dirname, '../logs/telemetry.jsonl'); // JSON Lines format
    this.console = process.env.TELEMETRY_CONSOLE === 'true';
  }

  sanitizeValue(key, value) {
    // Sanitize sensitive data while keeping structure
    if (typeof value === 'string') {
      // Token patterns
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key')) {
        return '[TOKEN]';
      }
      // GUID patterns
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return '[GUID]';
      }
      // Timestamp patterns
      if (key.toLowerCase().includes('timestamp') || key.toLowerCase().includes('expiry') || 
          key.toLowerCase().includes('time') || /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return '[TIMESTAMP]';
      }
      // URL patterns (may contain sensitive workspace IDs)
      if (key.toLowerCase().includes('url') && value.includes('powerbi.com')) {
        return value.replace(/\/groups\/[^\/]+/g, '/groups/[GUID]')
                   .replace(/\/reports\/[^\/]+/g, '/reports/[GUID]')
                   .replace(/\/datasets\/[^\/]+/g, '/datasets/[GUID]');
      }
    }
    return value;
  }

  sanitizeObject(obj, depth = 0) {
    if (depth > 10) return '[MAX_DEPTH]'; // Prevent infinite recursion
    
    if (obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }
    
    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(this.sanitizeValue(key, value), depth + 1);
      }
      return sanitized;
    }
    
    return obj;
  }

  logRequest(req, res, responseData, startTime) {
    if (!this.enabled) return;

    const endTime = Date.now();
    const duration = endTime - startTime;

    const logEntry = {
      timestamp: new Date().toISOString(),
      request: {
        method: req.method,
        url: req.url,
        path: req.path,
        query: this.sanitizeObject(req.query),
        headers: this.sanitizeObject(req.headers),
        body: this.sanitizeObject(req.body)
      },
      response: {
        status: res.statusCode,
        headers: this.sanitizeObject(res.getHeaders()),
        body: this.sanitizeObject(responseData),
        duration: duration
      },
      sanitized: true
    };

    // Log to console if enabled
    if (this.console) {
      console.log('\n=== TELEMETRY ===');
      console.log(JSON.stringify(logEntry, null, 2));
      console.log('=== END TELEMETRY ===\n');
    }

    // Log to file
    try {
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('[Telemetry] Failed to write log:', error.message);
    }
  }

  clearLogs() {
    if (fs.existsSync(this.logFile)) {
      fs.unlinkSync(this.logFile);
    }
  }

  readLogs() {
    if (!fs.existsSync(this.logFile)) {
      return [];
    }
    
    const content = fs.readFileSync(this.logFile, 'utf8');
    return content.trim().split('\n').map(line => JSON.parse(line));
  }
}

module.exports = new TelemetryLogger();