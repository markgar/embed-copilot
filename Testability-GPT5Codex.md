# Testability Assessment – Services/Controllers/Routes Architecture

_Date: September 28, 2025_

This document captures a focused code-review of the `src-v2` service/controller/route architecture, with an emphasis on seams, isolation, and the effort required to write reliable automated tests. All observations are grounded in the actual code—no assumptions made from folder names alone.

---

## High-Level Structure

- **App assembly** (`src-v2/app.js`): configures express, middleware, static assets, then mounts all routes via `routeOrchestrator`.
- **Routing layer** (`src-v2/routes/**/*`): thin express routers that delegate directly to controller methods.
- **Controller layer** (`src-v2/controllers/**/*`): orchestrates request validation, service invocation, and error responses. Controllers are class-based, but most exported as static methods.
- **Service layer** (`src-v2/services/**/*`): encapsulates Power BI, OpenAI, Fabric, configuration, and error handling concerns. Most services are implemented as singletons (`module.exports = new Service()`), with the notable exception of `PowerBIService`, which exports the class.

This layering is a good starting point for testability: routing is mechanical, controllers are thin, and services hold most integrations. The gaps show up in how dependencies are wired and how state is managed.

---

## Strengths ✨

| Area | What Works Well | Why It Helps Testing |
| --- | --- | --- |
| Thin controllers | Example: `EmbedController.getEmbedToken` and `MetadataController.getDatasetMetadata` perform minimal validation before delegating to services. | Unit tests can focus on input validation & branches without mocking large logic blocks. |
| Centralized errors | `errorService.sendError` standardizes response shapes. | Assertions in controller tests are straightforward and consistent. |
| Service encapsulation | `powerbiService.js` houses auth, embed token, and metadata logic; `openaiService.js` handles prompt building. | Jest module mocks can replace whole services when exercising controllers. |
| Route composition | `routeOrchestrator` mounts routers cleanly, so supertest integration runs can hit the entire surface with minimal setup. | Enables end-to-end tests that exercise the full request pipeline. |

---

## Pain Points 🧩

### 1. Dependency Coupling

- **Controllers instantiate services directly**
  - `ChatController.chat` constructs `new PowerBIService(config)` and imports the singleton `openaiService`. Without constructor injection, unit tests require module-level jest mocks; swapping in fakes per test isnt possible.
- **Singleton export pattern**
  - `FabricController` exports `module.exports = new FabricController();`, and internally references `require('../services/fabricService')`, another singleton. To substitute dependencies, tests must mock the module before the require executes—limiting isolation and requiring careful cache resets.

### 2. Configuration Loading

- `configService.js` executes `require('dotenv').config()` on load and captures environment variables into a constant `config` object. Once the module is imported, values are frozen unless tests mutate `process.env` _before_ the first require or reset the module cache. This complicates tests that need per-case config variations.

### 3. External I/O Hard-Wiring

- `powerbiService.js` uses `@azure/msal-node` and `node-fetch` directly.
- `fabricService.js` uses `axios`, `URLSearchParams`, and `fs.readFileSync` on every call.

Without injection points, tests must globally stub `fetch`, `axios`, and `fs`, and an unmocked path will reach real network/filesystem boundaries.

### 4. Shared Mutable State

- `openaiService` keeps `initialized` and `config` on the exported singleton. Tests interacting with the real module need to manually reset state between runs.
- `fabricService` caches `accessToken` and `tokenExpiry` on the singleton instance. Testing token-expiry logic requires reaching into internal fields or resetting the module cache.

### 5. Test Suite Drift

- `test/integration/controllers.test.js` mocks APIs not present in the v2 controllers (e.g., `MetadataController.clearCache`, `SystemController.telemetryControl`). This indicates tests lagging behind the actual architecture, leading to false positives and missed regressions.

---

## Opportunities 🚀

1. **Introduce Dependency Injection Hooks**
   - Allow controllers to accept service instances (e.g., export factory functions or constructor parameters). Tests could pass stubbed services without relying on global jest mocks.

2. **Export Service Classes Alongside Singletons**
   - e.g., `module.exports = { FabricService, fabricService: new FabricService() };`
   - Tests can instantiate fresh copies with injected collaborators or resettable state.

3. **Make `loadConfig` Dynamic**
   - Read environment variables on each call or accept overrides (`loadConfig({ overrides })`). This keeps tests independent and avoids module cache gymnastics.

4. **Abstract External Clients**
   - Wrap `fetch`/`axios` access in thin adapters or allow them to be passed to constructors. Simplifies mocking and unlocks failure-mode tests.

5. **Expose Reset/Test Utilities**
   - Provide explicit reset helpers (e.g., `openaiService._resetForTest()`, `fabricService.clearTokenCache()`) so tests can clean up without reloading modules.

6. **Align Integration Tests with Reality**
   - Update routes under test to match current controllers (`GET /getEmbedToken`, no `clearCache`, etc.). This ensures CI exercises the actual API surface.

---

## Suggested Test Strategy

| Layer | Recommended Approach | Notes |
| --- | --- | --- |
| Services | Unit tests around pure logic (prompt construction, metadata formatting) by instantiating classes or using exported singletons with reset hooks. | Requires injection seams or reset helpers for stateful services. |
| Controllers | Unit tests with dependency injection (post-refactor) or module mocks to focus on validation + error handling. | Aim for per-controller test files mirroring `controllers/*.js`. |
| Routes | Supertest integration using the real `app` after `mountRoutes`. Mock only outbound network calls. | Ensure environment/config defaults are set before app import. |

---

## Summary

The architecture is close to test-friendly: clear layering, consistent error handling, and manageable routing. The main blockers are singleton coupling, static configuration snapshots, and hardwired external clients. Addressing these with small refactors will reduce test friction dramatically and unlock more granular coverage without brittle global mocks.

---

## Next Steps

1. Decide on a dependency injection pattern (factories vs. constructor parameters) and refactor controllers/services accordingly.
2. Adjust `configService` to read environment dynamically or accept overrides for tests.
3. Introduce per-layer test suites aligned to the table above and prune outdated mocks/tests.
4. Provide reset hooks or alternative exports for services that cache state.

With those tweaks, the services/controllers/routes stack becomes straightforward to unit-test, and integration tests can rely on well-isolated collaborators rather than `jest.mock` gymnastics.
