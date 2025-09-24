# Checklist: Migrating to DAX-Based Dynamic Metadata

This document outlines the step-by-step plan to migrate the application from using hard-coded metadata to a dynamic implementation that fetches live metadata from Power BI using DAX queries.

### Phase 1: Establish a Testing Baseline
- [x] **Create a new integration test file** at `test/integration/metadata-contract.test.js`.
- [x] **Write a "contract" test** that calls the `GET /getDatasetMetadata` endpoint. This test must:
    -   Assert the HTTP status is 200.
    -   Validate the top-level properties exist: `dataset`, `tables`, `measures`, `dimensions`, `lastUpdated`.
    -   Validate the shape of the first item in the `tables` array (e.g., it has `name` and `columns` properties).
    -   Validate the shape of the first item in the `columns` array within a table (e.g., it has `name`, `type`, `description`).
    -   Validate the shape of the first `measure` and `dimension`.
- [x] **Run the test** and confirm it passes against the current hard-coded implementation. This test is now your safety net.

### Phase 2: Implement DAX Query Execution
- [ ] **Add a new private method** to `powerbiService.js`: `async _executeDaxQueries(groupId, datasetId, queries)`. This method will accept an array of DAX queries.
- [ ] **Implement the logic** within `_executeDaxQueries` to:
    -   Get an authentication header using `this.getRequestHeader()`.
    -   Construct the API endpoint URL: `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/datasets/${datasetId}/executeQueries`.
    -   Create the request body by mapping the `queries` array into the format `{ queries: [...] }`.
    -   Use `node-fetch` to make a single `POST` request to the Power BI API.
    -   **Add robust error handling**: If the API response is not `ok` (e.g., 400, 401, 500), throw a detailed error including the status text and response body.
    -   Return the `results` array from the parsed JSON response.

### Phase 3: Fetch and Transform Live Metadata
- [ ] **Create a new method** in `powerbiService.js`: `async getMetadataWithDax(groupId, datasetId)`.
- [ ] **Inside `getMetadataWithDax`**, define the required DAX queries:
    -   `tablesQuery = "EVALUATE INFO.TABLES()"`
    -   `columnsQuery = "EVALUATE INFO.COLUMNS()"`
    -   `measuresQuery = "EVALUATE INFO.MEASURES()"`
- [ ] **Execute all queries in parallel** using `Promise.all` and the `_executeDaxQueries` method to get the raw data for tables, columns, and measures.
- [ ] **Implement transformation logic** to process the raw API results:
    -   Create a `Map` of tables for efficient lookup.
    -   Iterate through the raw columns list, adding each column to the correct table in your `Map`.
    -   Iterate through the raw measures list, adding each measure to a new `measures` array.
    -   Create the `dimensions` array by filtering the columns list (e.g., based on table type or other criteria if available from the DAX query results).
    -   Assemble the final object with `dataset: { name: 'Dynamic Dataset' }`, `lastUpdated`, and the transformed `tables`, `measures`, and `dimensions` arrays.

### Phase 4: Switch Over and Verify
- [ ] **Modify the `getDatasetMetadata` method** in `powerbiService.js`.
- [ ] **Remove the calls** to `cacheService.getCachedMetadata()` and `cacheService.setCachedMetadata()`.
- [ ] **Replace the call** to `this.getHardcodedMetadata()` with a call to `this.getMetadataWithDax(groupId, datasetId)`.
- [ ] **Run the integration test** from Phase 1. It should still pass. If it fails, debug the transformation logic from Phase 3 until the test passes.

### Phase 5: Final Cleanup
- [ ] **Delete the `getHardcodedMetadata` method** from `powerbiService.js` as it is no longer used.
- [ ] **Review all new code** for clarity, comments, and adherence to the project's style.
- [ ] **Merge the changes.**
