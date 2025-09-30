# Testability Assessment (src-v2 Architecture)

_Date: 2025-09-28_

## 1. Scope & Method
Reviewed actual source code for controllers, services, routes, app/server wiring, and supporting utilities in `src-v2` (no assumptions based on folder names alone). Focus: intrinsic testability (ease of unit/integration testing, isolation, determinism, failure observability).

Files inspected:
- Controllers: `chatController.js`, `embedController.js`, `fabricController.js`, `metadataController.js`, `systemController.js`
- Services: `configService.js`, `errorService.js`, `fabricService.js`, `openaiService.js`, `powerbiService.js`
- Routing & assembly: `routeOrchestrator.js`, individual `*Routes.js`, `app.js`, `server.js`, `utils.js`

## 2. High-Level Verdict
**Moderately testable** now. Core logic is separated by rough concern boundaries (controllers vs services) but hampered by singletons, direct construction of dependencies inside request handlers, duplicated validation logic, large monolithic prompt-building function, and hard-coded side effects (network, FS, timers, logging) with no abstraction seams.

You can achieve coverage via Jest + module mocking today, but small structural tweaks will drastically reduce friction, flakiness risk, and test boilerplate.

## 3. Strengths (Positive Indicators)
1. Clear HTTP layer vs. service layer separation.
2. Services have focused method responsibilities (e.g., `getDatasetMetadata`, `ensureReport`).
3. Minimal dynamic/meta-programming; code is statically analyzable.
4. Centralized error response helper (`errorService`) already exists.
5. Prompt builder (`buildSystemPrompt`) deterministic (good for snapshot testing after modularization).
6. Explicit validation branches in controllers (material for pure extraction tests).
7. Network boundaries obvious (raw `fetch`, `axios`).

## 4. Testability Friction Points
| Category | Issue | Concrete Evidence | Impact |
|----------|-------|-------------------|--------|
| Dependency Injection | Controllers instantiate services directly | `new PowerBIService(config)` inside methods; singleton requires | Hard to inject mock implementations |
| Singleton / Global State | `openaiService`, `fabricService` export mutable singletons | Internal flags (`initialized`, token caches) | Cross-test leakage / order dependencies |
| Mixed Concerns | Large controller methods mix validation, orchestration, logging | `ChatController.chat` ~150+ LOC | Larger test surface & branching |
| Repeated Logic | DatasetId derivation repeated 3x | In `metadataController` methods | Duplicate test coverage needed |
| Inlined Side Effects | FS reads & network inside same methods | `FabricService.createEmptyReport` reads templates | Hard to isolate pure logic vs IO failures |
| Logging Noise | Duplicate logs & verbose console use | Duplicate line in `ChatController` | Noisy test output unless silenced |
| Error Handling Inconsistency | Mixed direct `res.status(...).json` vs `errorService` | `FabricController.ensureReport` vs Chat | Harder uniform assertions |
| Validation Duplication | Config validation in `utils.js` & `configService.js` | Two different functions | Divergence risk |
| Monolithic String Logic | Single massive system prompt builder | `OpenAIService.buildSystemPrompt` | Snapshot churn & harder diffing |
| Hard-Coded Timing | Real `setTimeout` polling loops | `FabricService.pollOperationCompletion` | Slow tests / reliance on fake timers |
| Env Load at Import | `dotenv` executed on require | `configService.js` top-level | Requires module reset for per-test env variance |

## 5. File-Level Observations (Selected)
### Controllers
- `chatController`: Overly verbose logging; duplicate lines; direct service instantiation; context + orchestration + response shaping tangled.
- `metadataController`: Pattern copy-pasted across three endpoints (resolve datasetId logic). Ideal for a single helper.
- `fabricController`: Good explicit input validation; would benefit from extracted pure function `validateEnsureReportPayload`.
- `systemController`: Aggregates sub-health via mock response objects; can abstract capture pattern.

### Services
- `powerbiService`: Clear method boundaries; `_executeDaxQuery` already isolated. Could inject auth client & fetch for easier mocking.
- `fabricService`: Template FS reads each call; token caching & polling with real delays; should inject `fs`, `http`, `sleep`.
- `openaiService`: Artificial `initialize()` state step; prompt builder monolithic; config validation minimal.
- `configService`: Single config object returned—simple, but environment capture happens once; test overrides require module reload.

### Server / Routing
- `server.js`: Global process handlers inside same file; not easily testable without side effects—split `createServer` vs `start`.
- `routeOrchestrator`: Clear route mounting (good for supertest).

## 6. Improvement Roadmap (Prioritized)
1. **Introduce lightweight DI seams**: Factory functions for handlers (e.g., `createChatHandler`).
2. **Extract pure helpers**: Validation (`validateChatRequest`, `validateEnsureReportPayload`) & dataset ID resolution.
3. **Modularize prompt composition**: Break into composable functions (`composeBaseRules`, `composeSchema`, `composeCurrentChart`, `composeHistory`).
4. **Parameterize side effects**: Constructors accept `{ http, fs, logger, sleep }` with sensible defaults.
5. **Unify config validation**: Remove duplicate in `utils.js`; return structured result `{ valid, errors: [] }`.
6. **Add singleton reset hooks**: `openaiService.reset()`, `fabricService.reset()` for test isolation (or export classes instead).
7. **Abstract external APIs**: Thin clients (`fabricApiClient`, `powerBiApiClient`, `azureOpenAiClient`) consumed by services.
8. **Refine error handling**: Always use `errorService` for consistent shape (add typed error categories optional).
9. **Introduce logger abstraction**: Replace raw console calls; enable silent mode in tests.
10. **Make polling test-friendly**: Inject `sleep` & support immediate resolution under tests.

## 7. Example Micro-Refactors
### 7.1 Chat Handler Factory
```js
// chatHandlerFactory.js
function createChatHandler({ openAI, powerBIServiceFactory, configService, errorService, logger }) {
  return async function chat(req, res) {
    const { message, currentChart, chatHistory } = req.body || {};
    if (!message || !message.trim()) {
      return errorService.sendError(res, 400, 'Message is required');
    }

    const config = configService.loadConfig();
    if (!config.azureOpenAIApiKey && !config.openaiApiKey) {
      return errorService.sendError(res, 500, 'OpenAI service not configured');
    }

    let context = null;
    if (config.powerBIGroupId && config.powerBIDatasetId) {
      try {
        const pbi = powerBIServiceFactory(config);
        context = await pbi.getMetadataContext(config.powerBIGroupId, config.powerBIDatasetId);
      } catch (e) {
        return errorService.sendError(res, 500, 'Failed to retrieve data context', e.message);
      }
    }

    try {
      await openAI.initialize();
      const result = await openAI.processChat(message, context, currentChart, chatHistory);
      return res.json({ response: result.response, usage: result.usage });
    } catch (e) {
      return errorService.sendError(res, 500, 'Failed to generate response', e.message);
    }
  };
}
module.exports = { createChatHandler };
```

### 7.2 Validation Extraction
```js
function validateEnsureReportPayload({ workspaceId, datasetId, reportName }) {
  const errors = [];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!workspaceId) errors.push('workspaceId required');
  else if (!uuid.test(workspaceId)) errors.push('workspaceId invalid');
  if (!datasetId) errors.push('datasetId required');
  else if (!uuid.test(datasetId)) errors.push('datasetId invalid');
  if (!reportName || !reportName.trim()) errors.push('reportName required');
  return { valid: errors.length === 0, errors };
}
```

### 7.3 Prompt Composition Slice
```js
function composeSchema(metadata) {
  if (!metadata?.tables) {
    return 'Schema temporarily unavailable. If user asks, explain retrieval issue.';
  }
  return metadata.tables
    .flatMap(t => (t.columns || []).map(c => `${t.name}.${c.name} [${c.type}]`))
    .join('\n');
}
```

### 7.4 Injectable Sleep (Polling)
```js
class FabricService {
  constructor({ http = require('axios'), fs = require('fs'), sleep = (ms)=>new Promise(r=>setTimeout(r,ms)) } = {}) {
    this.http = http; this.fs = fs; this.sleep = sleep;
  }
  async pollOperationCompletion(opId, max=10, delay=3000) {
    for (let attempt=1; attempt<=max; attempt++) {
      const op = await this.http.get(...);
      if (op.status === 'Succeeded') return op.result;
      if (op.status === 'Failed') throw new Error(...);
      if (attempt < max) await this.sleep(delay);
    }
    throw new Error(`Operation ${opId} timeout`);
  }
}
```

## 8. Recommended Test Types & Targets
| Test Type | Target | Intent |
|-----------|--------|--------|
| Pure Unit | Validation helpers, prompt composition functions | Deterministic correctness |
| Service Unit (HTTP mocked) | `FabricService.ensureReport`, `PowerBIService._executeDaxQuery`, `OpenAIService.processChat` (error paths) | API contract & error mapping |
| Snapshot (scoped) | Factored prompt composition output | Detect accidental rule deletions |
| Integration (supertest) | `/chat`, `/getDatasetMetadata`, `/fabric/reports/ensure` | Route wiring & response shape |
| Error Handling | Forced network failures | Uniform error structure |
| Performance/Speed (optional) | Polling logic with fake timers | Avoid real waiting |

## 9. Immediate Low-Effort Wins
1. Deduplicate repeated `console.log` lines in `chatController`.
2. Consolidate config validation (remove `utils.validateConfig*`).
3. Add `reset()` to singletons or migrate to factory usage for isolation.
4. Extract dataset ID derivation helper (reduce 3 copies).
5. Wrap polling delay in injectable function for fast tests.

## 10. Risks If Left Unchanged
- Increased flakiness from shared mutable singleton state.
- Slower test suite (real sleeps, file reads each call).
- Higher maintenance cost (duplicate validation & schema resolution logic).
- Undetected behavioral drift in prompt instructions (no modular tests).
- Harder onboarding (implicit env capture & side effects at import).

## 11. Coverage Strategy (Practical Rollout)
Phase 1 (Day 1–2): Extract helpers + add unit tests (quick ~30–40% meaningful coverage). 
Phase 2 (Day 3–4): Introduce handler factories + snapshot prompt tests. 
Phase 3: Service client abstraction + remove singleton state; add integration tests. 
Phase 4 (Optional): Structured logger & typed error classification.

## 12. Coverage Map (Proposed)
| Component | Key Paths | Test Style | Priority |
|----------|-----------|------------|----------|
| Chat Flow | Valid request, missing message, metadata failure, OpenAI failure | Handler unit (DI) | High |
| Prompt Builder | Base rules, schema injection, chart context, history folding | Pure + snapshot | High |
| Fabric Report Ensure | Exists vs create, async operation (202), failures (401/403/404) | Service unit | High |
| Metadata Retrieval | Dataset ID resolution fallback, DAX failure path | Service + helper | Medium |
| Config Validation | Missing clientId, bad GUIDs | Pure unit | Medium |
| Polling | Success, failure, timeout | Unit with fake timers | Medium |
| Error Service | `sendError` uniformity | Pure unit | Low |

## 13. Architectural Guiding Principles (Going Forward)
- Every controller method should ideally orchestrate only already-pure service calls; no business logic inline.
- Every service method that touches IO should be thin and delegate transform logic to pure helpers (maximizes cheap testing).
- Avoid global mutable singletons unless they hold immutable configuration.
- Keep large string templates composable; ensure drift is observable via targeted snapshot diffs.

## 14. Next Optional Enhancements
- Introduce a schema validation lib (e.g., zod) for config & request bodies to shrink handwritten validation + unify error shapes.
- Add correlation ID middleware (improves log-based test assertions & tracing).
- Provide a lightweight in-memory cache abstraction if metadata calls become performance-sensitive (injectable for tests).

---
**Summary:** Solid foundation with clear separation of concerns; modest refinements (DI seams, pure helper extraction, modular prompt composition, side-effect injection) will yield disproportionately large testability gains while keeping current behavior stable.

If you want, I can implement Phase 1 (helpers + basic tests) next—just ask.
