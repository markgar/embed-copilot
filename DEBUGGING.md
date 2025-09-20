# Debugging Guide for Embed-Copilot

This guide provides a comprehensive strategy for debugging the embed-copilot application using both telemetry data and console logs.

## 🎯 **When to Use Each Debugging Method**

### **Console Logs (Live Debugging)**
**Best for:** Real-time development, immediate feedback, troubleshooting active issues

**Use when:**
- Developing new features
- Testing endpoint behavior in real-time
- Need immediate visibility into server state
- Debugging frontend-backend communication
- Working with Power BI embedding issues

**Access:** 
```bash
# View live server logs
npm run dev

# Or check task output
```

### **Telemetry Logs (Historical Analysis)**
**Best for:** Post-mortem analysis, pattern identification, API usage tracking

**Use when:**
- Analyzing past failures
- Identifying usage patterns
- Tracking API performance over time
- Investigating intermittent issues
- Copilot is helping debug past issues

**Access:**
```bash
# View recent telemetry
tail -20 logs/telemetry.jsonl

# Search for specific patterns
grep "POST /chat" logs/telemetry.jsonl
grep "status.*400\|status.*500" logs/telemetry.jsonl
```

---

## 🔍 **Debugging Strategy by Issue Type**

### **1. Chat Endpoint Failures**

#### **Step 1: Check Console Logs**
Look for these patterns in console output:
```
[ChatController] Chat request received: {...}
[OpenAIService] processChat called with message: ...
[OpenAIService] Received response, status: 200
[CLIENT] === SERVER SUCCESS RESPONSE ===
```

#### **Step 2: Check Telemetry Data**
```bash
# Find recent chat requests
tail -50 logs/telemetry.jsonl | grep '"method":"POST","url":"/chat"'
```

**Key telemetry indicators:**
- `"status":400` → Bad request (missing message, malformed JSON)
- `"status":200` → Success
- `"body":{}` → Empty request body (validation failure)
- `"duration":###` → Performance timing

#### **Common Chat Failures:**

**Empty Body (400 Error):**
```json
{
  "request": {"method":"POST","url":"/chat","body":{}},
  "response": {"status":400,"body":{"error":"Message is required"}}
}
```
**Solution:** Check frontend is sending proper JSON with `message` field

**Frontend JSON Parse Error:**
```
[CLIENT] Raw AI response: undefined
[CLIENT] SyntaxError: "undefined" is not valid JSON
```
**Solution:** Backend response format issue - check chat controller response structure

### **2. Power BI Integration Issues**

#### **Console Indicators:**
```
[CLIENT] Embed token received successfully
[CLIENT] Report loaded successfully
[CLIENT] Report rendered successfully
```

#### **Telemetry Patterns:**
```bash
# Check embed token requests
grep '"url":"/getEmbedToken"' logs/telemetry.jsonl | tail -5
```

**Success Pattern:**
```json
{
  "request": {"method":"GET","url":"/getEmbedToken"},
  "response": {"status":200,"body":{"accessToken":"[TOKEN]","embedUrl":[...]}}
}
```

### **3. OpenAI Service Issues**

#### **Console Debug Sequence:**
```
[OpenAIService] processChat called with message: ...
[OpenAIService] Validating configuration...
[OpenAIService] Configuration valid
[OpenAIService] Making request to endpoint: ...
[OpenAIService] Sending request to Azure OpenAI...
[OpenAIService] Received response, status: 200
```

#### **Performance Analysis:**
```bash
# Check OpenAI response times via telemetry
grep '"url":"/chat"' logs/telemetry.jsonl | grep '"duration"' | tail -10
```

---

## 🛠 **Debugging Commands**

### **Live Server Monitoring**
```bash
# Start server with full logging
npm run dev

# Monitor specific endpoints
curl -X POST http://localhost:5300/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

### **Telemetry Analysis**
```bash
# Recent activity overview
tail -30 logs/telemetry.jsonl | jq '.timestamp, .request.url, .response.status'

# Find all errors (4xx/5xx status codes)
grep -E '"status":(4|5)[0-9][0-9]' logs/telemetry.jsonl

# Chat endpoint performance
grep '"url":"/chat"' logs/telemetry.jsonl | jq '.response.duration'

# Count requests by endpoint
grep -o '"url":"[^"]*"' logs/telemetry.jsonl | sort | uniq -c

# Find empty request bodies
grep '"body":{}' logs/telemetry.jsonl

# Recent chat requests with details
grep '"url":"/chat"' logs/telemetry.jsonl | tail -5 | jq '.'
```

### **Error Tracking**
```bash
# Frontend errors
grep 'POST /log-error' logs/telemetry.jsonl | tail -5

# Backend validation errors
grep '"error":"Message is required"' logs/telemetry.jsonl

# OpenAI API errors
grep -A5 -B5 '"OpenAIService.*error"' logs/telemetry.jsonl
```

---

## 📊 **Log Data Structure**

### **Console Log Types**
- `[Express]` → HTTP request/response logging
- `[ChatController]` → Chat processing flow
- `[OpenAIService]` → AI service operations
- `[CLIENT]` → Frontend browser logs (via /log-console)
- `[Routes]` → Route mounting and navigation

### **Telemetry JSON Structure**
```json
{
  "timestamp": "2025-09-19T19:34:42.802Z",
  "request": {
    "method": "POST",
    "url": "/chat",
    "headers": {...},
    "body": {"message": "...", "currentChart": {...}}
  },
  "response": {
    "status": 200,
    "headers": {...},
    "body": {...}
  },
  "duration": 732,
  "sanitized": true
}
```

**Key Fields:**
- `timestamp` → When the request occurred
- `request.method` + `request.url` → What endpoint was called
- `request.body` → Request payload (sanitized for sensitive data)
- `response.status` → HTTP status code
- `response.body` → Response payload (sanitized)
- `duration` → Request processing time in milliseconds

---

## 🚨 **Common Issue Patterns**

### **Pattern 1: Chat Frontend-Backend Disconnect**
**Console Symptoms:**
```
[CLIENT] === FRONTEND REQUEST ===
[CLIENT] Raw AI response: undefined
[CLIENT] SyntaxError: "undefined" is not valid JSON
```

**Telemetry Symptoms:**
```json
{"response": {"status": 200, "body": {"response": "..."}}}
```

**Root Cause:** Frontend expects AI response in different format than backend provides

### **Pattern 2: Empty Chat Requests**
**Console Symptoms:**
```
[ChatController] Chat request received: {}
```

**Telemetry Symptoms:**
```json
{"request": {"body": {}}, "response": {"status": 400, "body": {"error": "Message is required"}}}
```

**Root Cause:** Frontend not properly sending request body

### **Pattern 3: Power BI Token Refresh Issues**
**Telemetry Pattern:**
```json
{"url": "/getEmbedToken", "response": {"status": 200}, "duration": 1100}
{"url": "/getEmbedToken", "response": {"status": 200}, "duration": 1098}
{"url": "/getEmbedToken", "response": {"status": 200}, "duration": 1109}
```

**Analysis:** Multiple rapid token requests suggest token expiry or frontend refresh loop

---

## 🎯 **For GitHub Copilot Usage**

When Copilot is helping debug:

### **Step 1: Provide Context**
```bash
# Get recent activity snapshot
echo "=== Recent Console Activity ===" && tail -50 task_output
echo "=== Recent Telemetry ===" && tail -20 logs/telemetry.jsonl
```

### **Step 2: Specific Issue Analysis**
```bash
# For chat issues
grep -A3 -B3 '"url":"/chat"' logs/telemetry.jsonl | tail -20

# For Power BI issues  
grep -A2 -B2 '"url":"/getEmbedToken\|/getDatasetMetadata"' logs/telemetry.jsonl | tail -15

# For error analysis
grep -E '"status":(4|5)[0-9][0-9]' logs/telemetry.jsonl | tail -10
```

### **Step 3: Pattern Identification**
- Telemetry is better for **historical analysis** and **pattern detection**
- Console logs are better for **real-time debugging** and **immediate feedback**
- Combine both for complete picture when troubleshooting with Copilot

---

## 🔧 **Debugging Workflow**

### **For Active Development:**
1. **Start with console logs** → `npm run dev`
2. **Test endpoints** → Use curl or frontend
3. **Check immediate feedback** → Console output
4. **Validate with telemetry** → Check `logs/telemetry.jsonl`

### **For Issue Investigation:**
1. **Check telemetry first** → Historical data and patterns
2. **Reproduce with console logs** → Live debugging
3. **Cross-reference both sources** → Complete understanding
4. **Document findings** → Update this guide

### **For Copilot Assistance:**
1. **Provide recent telemetry** → `tail -20 logs/telemetry.jsonl`
2. **Include console context** → Recent console output
3. **Specify the issue** → What behavior you're seeing
4. **Share error patterns** → Grep results for specific issues

This approach ensures efficient debugging whether working solo or with AI assistance!