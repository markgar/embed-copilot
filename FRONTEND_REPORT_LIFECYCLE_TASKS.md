# Frontend Report Lifecycle Implementation - Task Tracker

## Overview
Transform the frontend from using a hardcoded reportId to dynamically creating/finding reports based on dataset names.

## Workflow
1. Frontend loads → Check if report exists (named after datasetId)
2. If exists → Generate embed token → Load report
3. If doesn't exist → Create empty report tied to dataset → Loop back to step 1

---

## Task List

### Phase 1: Backend API Integration ✅ COMPLETE
- ✅ **Task 1.1**: Create frontend service to call `/fabric/reports/ensure` endpoint
  - ✅ Created `public/js/modules/fabric-client.js` with `ensureReport()` method
  - ✅ Frontend service provides clean API for backend Fabric operations
- ✅ **Task 1.2**: Add error handling for Fabric API calls in frontend
  - ✅ Added comprehensive error handling: parameter validation, HTTP status codes, network errors
  - ✅ Enhanced error messages for better debugging and user experience
- ✅ **Task 1.3**: Test backend endpoint works with valid workspace/dataset IDs
  - ✅ Fixed authentication and configuration issues in backend
  - ✅ Implemented proper handling of Fabric API async operations (202 Accepted)
  - ✅ Successfully tested with real workspace/dataset IDs from .env file

### Phase 2: Frontend Report Discovery Logic  
- ⬜ **Task 2.1**: Modify `embedReport()` function to accept dynamic reportId parameter
- ⬜ **Task 2.2**: Create `discoverReport()` function that calls fabric service with datasetId as reportName
- ⬜ **Task 2.3**: Update embed token request to use discovered reportId instead of config reportId

### Phase 3: Integration & Flow Control
- ⬜ **Task 3.1**: Modify `initializePowerBI()` to call `discoverReport()` first
- ⬜ **Task 3.2**: Chain the flow: discover → embed → render
- ⬜ **Task 3.3**: Add loading states during report discovery/creation process

### Phase 4: Configuration Updates
- ⬜ **Task 4.1**: Remove dependency on `powerBIReportId` from config
- ⬜ **Task 4.2**: Ensure `powerBIDatasetId` and `powerBIWorkspaceId` are available in frontend
- ⬜ **Task 4.3**: Update any remaining hardcoded reportId references

### Phase 5: Error Handling & UX
- ⬜ **Task 5.1**: Handle case where workspace/dataset doesn't exist
- ⬜ **Task 5.2**: Add proper loading indicators during report creation
- ⬜ **Task 5.3**: Handle authentication errors gracefully

### Phase 6: Testing & Validation
- ⬜ **Task 6.1**: Test with existing report (should find and load)
- ⬜ **Task 6.2**: Test with non-existing report (should create then load)
- ⬜ **Task 6.3**: Test error scenarios (invalid workspace, permissions, etc.)

---

## Current Status
**Phase 1**: ✅ **COMPLETE** - Backend API Integration finished
**Next Phase**: Phase 2 - Frontend Report Discovery Logic
**Next Task**: Task 2.1 - Modify `embedReport()` function to accept dynamic reportId parameter

### Phase 1 Summary
✅ **Completed**: 
- Frontend service (`fabric-client.js`) with robust error handling
- Backend endpoint testing and async operation handling
- Microsoft Fabric API integration working properly with real workspace/dataset IDs

---

## Technical Notes

### Key Files to Modify
- `public/js/modules/powerbi-core.js` - Main embedding logic
- Create new: `public/js/modules/fabric-client.js` - Frontend Fabric API client
- Possibly: `public/js/modules/utilities.js` - Shared utilities

### API Flow
```
Frontend → POST /fabric/reports/ensure → Backend Fabric Service → Microsoft Fabric API
```

### Data Flow
```
datasetId (from config) → reportName → fabric/reports/ensure → reportId → embed token → embed report
```

---

## Dependencies
- Backend Fabric implementation ✅ (Complete)
- Frontend config must have workspaceId and datasetId
- Service principal must have proper Fabric permissions

---

## Risk Mitigation
- Each task is small and testable
- Can fallback to original hardcoded approach if needed
- Maintain existing embed logic as much as possible