# 🔧 Embed Copilot Refactoring Plan

*Last Updated: September 19, 2025*

## 📋 Overview
This document tracks the strategic refactoring of the embed-copilot server code to improve organization and maintainability. The goal is to restructure the codebase around a **Service Integration Architecture** that reflects what the application actually does: orchestrate external services (Power BI, OpenAI) to provide an AI-enhanced Power BI embedding experience.

## 🎯 Core Problems Identified

### Architectural Issues
- [ ] **A1**: Generic `utils.js` doesn't reflect application architecture
- [ ] **A2**: Mixed concerns in routes.js (mounting, initialization, caching, business logic)
- [ ] **A3**: Code organization doesn't reflect the app's core purpose (service integration)
- [ ] **A4**: No clear separation between external service integrations

### Function Quality Issues  
- [ ] **F1**: Chat route handler mixes 5 different concerns (validation, caching, prompts, API calls, formatting)
- [ ] **F2**: Caching logic duplicated between chat and metadata routes
- [ ] **F3**: OpenAI API logic embedded in route handler (hard to test)
- [ ] **F4**: Configuration scattered across multiple concerns

### High Priority Issues
- [ ] **H1**: Inconsistent configuration property names (`powerBIWorkspaceId` vs `powerBIGroupId`)
- [ ] **H2**: Global state management in routes.js (caching variables at module level)
- [ ] **H3**: Overly long route handlers (50+ lines with nested logic)
- [ ] **H4**: Inconsistent error handling patterns across routes

### Medium Priority Issues
- [ ] **M1**: Missing JSDoc comments on exported functions
- [ ] **M2**: Magic numbers should be named constants
- [ ] **M3**: Unused functions in embedConfigService.js
- [ ] **M4**: Configuration validation could be centralized

## 🗂️ Target Architecture: Service Integration

### Architectural Philosophy
Organize code around **external service integrations** since this app primarily orchestrates Power BI and OpenAI APIs to deliver embedded reports with AI assistance.

### New File Structure (Simplified & Readable)
```
src-v2/                           # New architecture (parallel development)
├── server.js                     # Application entry point
├── app.js                       # Express app configuration
├── services/                    # Comprehensive single-file services
│   ├── powerbiService.js        # All Power BI: auth + embed + metadata (uses cacheService)
│   ├── openaiService.js         # All OpenAI: chat processing + prompts
│   ├── configService.js         # Configuration: loading + validation + constants
│   ├── cacheService.js          # Shared caching logic (eliminates global state)
│   └── errorService.js          # Standardized error response formats
├── controllers/                 # Thin route handlers
│   ├── embedController.js       # /getEmbedToken endpoint
│   ├── metadataController.js    # /getDatasetMetadata endpoint
│   ├── chatController.js        # /chat endpoint
│   └── systemController.js      # /log-error, /log-console, / endpoints
└── routes/
    └── index.js                 # All routes in one file (simple mounting)
```

**Key Simplifications from Critique:**
- **Flatter structure**: No deep nesting (`integrations/powerbi/` → `services/`)
- **Comprehensive services**: Each service contains ALL related logic, not fragmented
- **Shared utilities**: `cacheService.js` eliminates global state, `errorService.js` standardizes responses
- **Minimal routes**: Simple mounting in single file since there aren't many routes

## 📅 Execution Strategy: Dual-Tree Migration

### Migration Philosophy
Use **parallel development** with the current code (`src/`) running alongside the new architecture (`src-v2/`). This allows safe migration with side-by-side testing and validation.

**Two-Phase Quality Approach:**
- **Phase 0**: Establish testing foundation and baseline behavior validation
- **Phase 1-4**: Preserve existing functions intact during migration for safety
- **Phase 5**: Refactor large functions into proper responsibilities for code quality
- This ensures both migration safety AND excellent final code structure

### Phase 0: Testing Foundation & Analysis (1 session)
**Goal**: Establish baseline testing infrastructure and document current behavior patterns

**Critical Issue**: The codebase currently has zero tests, making it impossible to validate that migration preserves behavior. This phase establishes the foundation needed for safe migration.

**Step 0A: Create Basic Test Infrastructure**
   - [ ] Install testing dependencies (`jest`, `supertest`)
   - [ ] Create `test/` directory structure
   - [ ] Create `test/baseline/` for current behavior validation
   - [ ] Create simple test runner script

**Step 0B: Establish Behavioral Baselines**
   - [ ] Create test for `/getEmbedToken` endpoint (success and error cases)
   - [ ] Create test for `/getDatasetMetadata` endpoint (success, caching, error cases)
   - [ ] Create test for `/chat` endpoint (success and error cases)
   - [ ] Create test for static file serving (`/`, `/chartchat`)
   - [ ] Document response formats, status codes, and error patterns

**Step 0C: Configuration Standardization (CRITICAL)**
   - [ ] **Audit configuration inconsistencies**: Document all uses of `powerBIWorkspaceId` vs `powerBIGroupId` in codebase
   - [ ] **Create configuration adapter**: Update `configLoader.js` to handle both property names transparently
   - [ ] **Test endpoint compatibility**: Verify all endpoints work with both old and new property names
   - [ ] **Standardize codebase**: Update all internal code to use consistent `powerBIGroupId` naming
   - [ ] **Validate configuration loading**: Ensure config validation works with standardized names

**Step 0D: Error Response Standardization**
   - [ ] **Document current error patterns**: Create reference for `/getEmbedToken`, `/getDatasetMetadata`, `/chat` error formats
   - [ ] **Create error response specification**: Define standard structure for 400, 500, and other error types  
   - [ ] **Design error service interface**: Plan `errorService.js` with methods like `badRequest()`, `serverError()`, etc.
   - [ ] **Test error consistency**: Ensure migration preserves exact error response formats

**Step 0E: Performance Baseline**
   - [ ] Measure response times for all endpoints under normal load
   - [ ] Document memory usage patterns
   - [ ] Create performance comparison framework for migration validation

### Phase 1: Setup Dual Environment (1 session)
**Goal**: Establish parallel development infrastructure with simplified structure

**Prerequisites**: Phase 0 complete (testing foundation and configuration standardization established)

**Step 1A: Create Simplified Directory Structure**
   - [ ] Create `src-v2/` directory
   - [ ] Create `src-v2/services/` directory 
   - [ ] Create `src-v2/controllers/` directory
   - [ ] Create `src-v2/routes/` directory

**Step 1B: Copy Entry Points with Standardized Configuration**
   - [ ] Copy `src/server.js` to `src-v2/server.js` (no changes)
   - [ ] Copy `src/app.js` to `src-v2/app.js` (update import paths)
   - [ ] Copy `src/configLoader.js` to `src-v2/services/configService.js` (including Phase 0C standardization)
   - [ ] Add constants (METADATA_CACHE_DURATION, etc.) to configService
   - [ ] Verify `src-v2/` version starts and serves basic content

**Step 1C: Baseline Compatibility Validation**
   - [ ] Run Phase 0 test suite against both `src/` and `src-v2/` versions
   - [ ] Verify identical responses for all endpoints
   - [ ] Document any differences and resolve before proceeding

### Phase 2: Build Service Architecture (2-3 sessions)
**Goal**: Create comprehensive single-file services that Copilot can confidently build and test

**Prerequisites**: Phase 0 and Phase 1 complete (testing foundation, configuration standardization, and dual environment established)

### Session 2A: Core Services & Error Handling (Single Session)
**Goal**: Extract the main business logic into well-organized services

**Step 2A-1: Create Error Service**
   - [ ] Create `src-v2/services/errorService.js` with standardized response methods
   - [ ] Implement: `badRequest(message, details)`, `serverError(message, details)`, `notFound(message)`
   - [ ] Test error service produces identical response formats to current endpoints

**Step 2A-2: Create Configuration Service**  
   - [ ] Create comprehensive `src-v2/services/configService.js`
   - [ ] Include: config loading, validation, and constants (METADATA_CACHE_DURATION, etc.)
   - [ ] Apply standardized property names from Phase 0
   - [ ] Test configuration service loads identical config objects

**Step 2A-3: Create Cache Service**
   - [ ] Create `src-v2/services/cacheService.js` to eliminate global state
   - [ ] Include: `getCachedMetadata()`, `setCachedMetadata()`, `isCacheStale()` methods
   - [ ] Design for shared use across multiple endpoints  
   - [ ] Test caching behavior matches current global variables

**Step 2A-4: Validation Checkpoint**
   - [ ] Run test suite to ensure services work in isolation
   - [ ] Verify no regressions in `src-v2/` basic functionality

### Session 2B: PowerBI Service (Single Session)  
**Goal**: Consolidate ALL Power BI related functionality into one comprehensive service

**Step 2B-1: Create PowerBI Service**
   - [ ] Create `src-v2/services/powerbiService.js` with ALL Power BI logic:
     - Authentication functions from `src/authentication.js`
     - Embed logic from `src/embedConfigService.js`  
     - Metadata logic from `src/datasetMetadata.js`
     - Integration with cacheService (created in Phase 2A) for metadata caching
   - [ ] Design as class with methods: `getAccessToken()`, `getEmbedInfo()`, `getDatasetMetadata()`, `getDatasetIdFromReport()`

**Step 2B-2: Update Endpoints to Use PowerBI Service**
   - [ ] Update `/getEmbedToken` route in `src-v2/` to use powerbiService
   - [ ] Update `/getDatasetMetadata` route in `src-v2/` to use powerbiService
   - [ ] Test both endpoints return identical responses to `src/` version

**Step 2B-3: Validation Checkpoint**
   - [ ] Run comprehensive endpoint tests comparing `src/` vs `src-v2/`
   - [ ] Verify caching behavior is identical
   - [ ] Performance check: response times within 50% of original

### Session 2C: OpenAI Service & Controllers (Single Session)
**Goal**: Extract OpenAI logic and create clean controller layer

**Step 2C-1: Create OpenAI Service**
   - [ ] Create `src-v2/services/openaiService.js` with ALL OpenAI logic:
     - Chat processing from `/chat` route in `src/routes.js`
     - Prompt building from `src/agent.js`
     - Message formatting and API communication
   - [ ] Design as class with methods: `processChat(message, currentChart, chatHistory)`, `buildPrompt(metadata, currentChart, chatHistory)`

**Step 2C-2: Create Controllers**  
   - [ ] Create `src-v2/controllers/embedController.js` - thin wrapper calling powerbiService.getEmbedInfo()
   - [ ] Create `src-v2/controllers/metadataController.js` - thin wrapper calling powerbiService.getDatasetMetadata()
   - [ ] Create `src-v2/controllers/chatController.js` - thin wrapper calling openaiService.processChat()
   - [ ] Create `src-v2/controllers/systemController.js` - logging endpoints

**Step 2C-3: Update Routes & Final Integration**
   - [ ] Create `src-v2/routes/index.js` with all route mounting (simple, single file)
   - [ ] Update all routes to call controllers instead of inline logic
   - [ ] Update `src-v2/app.js` to use new route structure

**Step 2C-4: Final Validation**
   - [ ] Run complete test suite comparing ALL endpoints between `src/` and `src-v2/`
   - [ ] Test error scenarios to ensure identical error responses
   - [ ] Verify chat functionality with metadata caching works identically
   - [ ] Performance validation: confirm response times are comparable

## 🔍 **Validation Guidelines for Copilot**

### **"Identical Response" Validation Checklist**
When testing migration steps, Copilot should verify:

**JSON Response Validation:**
- [ ] Same HTTP status code (200, 400, 500)
- [ ] Same response Content-Type header
- [ ] Same JSON structure (same property names and nesting)
- [ ] Same data types for each property (string, number, boolean, array)
- [ ] Ignore dynamic values: timestamps, UUIDs, expiry times
- [ ] For arrays: same length and structure of items

**Error Response Validation:**
- [ ] Same error HTTP status code
- [ ] Same error message text (exact match)
- [ ] Same error object structure (`{error: "message"}` vs `{message: "error"}`)

**Performance Validation:**
- [ ] Response time within 50% of original (not strict performance test)
- [ ] No memory leaks (process doesn't grow over multiple calls)

**Caching Validation:**
- [ ] First call fetches data (slower)
- [ ] Second call uses cache (faster)
- [ ] Cache expiry works (slow call after timeout)

### **Simple Test Template for Copilot**
```javascript
// Template for testing "identical" responses
async function validateIdenticalResponse(originalEndpoint, newEndpoint, testCase) {
  const [original, updated] = await Promise.all([
    fetch(originalEndpoint),
    fetch(newEndpoint)
  ]);
  
  // Status codes must match
  assert.equal(original.status, updated.status);
  
  // Content types must match
  assert.equal(
    original.headers.get('content-type'),
    updated.headers.get('content-type')
  );
  
  const [originalData, updatedData] = await Promise.all([
    original.json(),
    updated.json()
  ]);
  
  // Structure comparison (ignoring dynamic values)
  const normalize = (obj) => JSON.stringify(obj, (key, value) => {
    // Ignore common dynamic fields
    if (['timestamp', 'expiry', 'id', 'token'].includes(key)) return '[DYNAMIC]';
    return value;
  });
  
  assert.equal(normalize(originalData), normalize(updatedData));
}
```

### Phase 3: Migration Validation & Switchover (1 session)
**Goal**: Validate complete equivalence and execute safe switchover

**Step 3A: Comprehensive Validation**
   - [ ] **End-to-end testing**: Create automated test comparing all endpoints between `src/` and `src-v2/`
   - [ ] **Performance validation**: Verify response times are comparable (within 50%)  
   - [ ] **Error scenario testing**: Test all error conditions return identical responses
   - [ ] **Static asset verification**: Confirm frontend, CSS, and JS files work identically

**Step 3B: Safe Switchover Execution**
   - [ ] **Create backup**: Archive current `src/` to `src-legacy/` as safety net
   - [ ] **Switch entry point**: Update `package.json` main entry to `src-v2/server.js`
   - [ ] **Rename directories**: Move `src-v2/` to `src/` for final structure
   - [ ] **Integration testing**: Run dev server and verify all functionality works
   - [ ] **Documentation update**: Update README with new architecture explanation

### Phase 4: Code Quality Refinement (1 session) 
**Goal**: Break down large functions for improved readability and maintainability

**Step 4A: Service Method Refinement**
   - [ ] **Chat service decomposition**: Break `/chat` route logic into smaller, focused methods:
     - `validateChatInput(message)` - Input validation
     - `buildMessageArray(systemPrompt, userMessage)` - Message construction  
     - `formatChatResponse(aiResponse)` - Response formatting
     - `processChatRequest()` - Main orchestration calling above methods
   - [ ] **PowerBI service cleanup**: Extract any remaining large methods into focused functions
   - [ ] **Error handling standardization**: Ensure all services use errorService consistently

**Step 4B: Documentation & Architecture Polish**
   - [ ] **JSDoc comments**: Add comprehensive documentation to all service methods
   - [ ] **Architecture documentation**: Create README sections explaining service integration pattern
   - [ ] **Developer onboarding**: Update setup instructions reflecting new code organization
   - [ ] **Final validation**: Run complete test suite to ensure no regressions

**Note**: Phase 4 is optional if Phase 3 results in satisfactory code quality. The service extraction in Phase 2 already achieves the primary architectural goals.

## 🔄 Progress Tracking

### Completed Tasks
*None yet - starting fresh*

### Current Focus
- Setting up dual-tree migration infrastructure
- Creating `src-v2/` directory structure
- Establishing integration tests for API compatibility

### Next Up
- Building Power BI integration layer in new architecture
- Extracting and consolidating service integrations

### Blocked/Questions
*None currently*

## 📝 Session Notes

### Session 1 - September 19, 2025
**Analysis & Planning**
- Completed initial code review and identified organizational issues
- Analyzed multiple architectural approaches (domain-driven, layered, capability-based, user journey, service integration)
- **Decision**: Chose **Service Integration Architecture** as most natural fit for this Power BI + OpenAI integration app
- Designed dual-tree migration strategy to minimize risk
- Updated refactoring plan with new approach

**Plan Critique & Improvements:**
- **Simplified file structure**: Moved from deeply nested `integrations/powerbi/` to flat `services/` directory
- **Consolidated execution phases**: Reduced from 50+ micro-steps to 3 meaningful sessions in Phase 2
- **Moved critical fixes earlier**: Configuration standardization moved from Phase 5 to Phase 0
- **Added error handling strategy**: Explicit `errorService.js` for consistent response formats
- **Streamlined validation**: Focus on meaningful compatibility checkpoints vs micro-validations

**Key Insights:**
- App is fundamentally about orchestrating external services (Power BI, OpenAI)
- Current `utils.js` is too generic and doesn't reflect app purpose  
- Dual-tree approach allows safe migration with side-by-side validation
- Service integration pattern best reflects what the application actually does
- **Copilot works better with meaningful chunks than micro-steps**

**Architecture Decision Rationale:**
- **Service Integration** chosen over domain-driven because app is primarily a service orchestrator
- Organizes code around external dependencies (Power BI, OpenAI, frontend)
- Clear boundaries for each integration with distinct APIs and auth
- Natural place for utils.js functions (auth headers → powerbiService.js, validation → configService.js)

**Simplified Final Structure:**
```
src/
├── services/
│   ├── powerbiService.js      # All Power BI: auth + embed + metadata
│   ├── openaiService.js       # All OpenAI: chat + prompts  
│   ├── configService.js       # Configuration + validation
│   ├── cacheService.js        # Shared caching (eliminates global state)
│   └── errorService.js        # Standardized error responses
├── controllers/               # Thin route handlers
└── routes/index.js           # Simple route mounting
```

**Next Session Goals:**
- Execute Phase 0: Testing foundation + configuration standardization
- Create `src-v2/` directory structure  
- Begin Phase 1: Dual environment setup

---

## 🚀 How to Use This Plan

### Before Each Coding Session:
1. Review this document to recall context and architectural decisions
2. Check current focus and next steps
3. Ensure both `src/` (current) and `src-v2/` (new) are in working state

### During Each Session:
1. Work in `src-v2/` for new architecture implementation
2. Keep `src/` untouched and working (safety net)
3. Update checkboxes as you complete tasks
4. Run compatibility tests frequently

### After Each Session:
1. Update "Session Notes" with what was accomplished
2. Note any architectural decisions or discoveries
3. Ensure both versions are still working
4. Plan next session's focus

### Migration Safety Rules:
1. **Never modify `src/` during architecture migration**
2. **Always maintain API compatibility in `src-v2/`**
3. **Run integration tests before ending each session**
4. **Document any deviations from planned structure**

### When Ready to Switch:
1. Verify 100% API compatibility via automated tests
2. Performance benchmark comparison
3. Manual testing of all user workflows
4. Switch package.json pointer from `src/` to `src-v2/`

---

*This document should be your single source of truth for the refactoring effort. Keep it updated and refer back to it to maintain momentum across sessions.*