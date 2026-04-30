# Plan: Fix QA Analyzer Individual Report Data (v1)

The individual report data in the QA Analyzer (`qa-analyzer/reports/data`) is currently showing an error ("Tidak ada data audit") or an empty state when it should show data. This is caused by overly restrictive filtering in the data fetching logic that excludes perfect scores and phantom sessions.

## Objective
Fix the individual data report to correctly display audit data, including "Clean Sessions" (phantom padding) and perfect scores (100%), when an individual agent is selected.

## Analysis & Root Cause
1.  **Restrictive Period Detection**: `getLastAuditedMonthAction` in `app/(main)/qa-analyzer/actions.ts` filters out phantom padding sessions. If an agent only has "Clean Sessions" (Perfect Score), the system fails to detect an audited month, setting `endMonth` to 0.
2.  **Restrictive Data Fetching**: `getDataReportRows` in `app/(main)/qa-analyzer/services/qaService.server.ts` filters out `nilai = 3` (perfect score) and `is_phantom_padding = true`. While this is correct for a "Findings Report", it prevents trainers from seeing complete individual audit histories.

## Proposed Changes

### 1. Update `getLastAuditedMonthAction`
Include phantom sessions when searching for the last audited month so the correct period context is displayed.
- **File**: `app/(main)/qa-analyzer/actions.ts`
- **Change**: Remove the `is_phantom_padding` filter.

### 2. Update `getDataReportRows`
Relax filters when a `pesertaId` (individual agent) is provided to show full audit records.
- **File**: `app/(main)/qa-analyzer/services/qaService.server.ts`
- **Logic**: 
    - If `pesertaId` is present (Individual Mode):
        - Skip `is_phantom_padding: false` filter.
        - Skip the `.or('nilai.lt.3, ...')` findings-only filter.

### 3. Update `DataReportClient.tsx`
Improve error messaging and ensure the fetch button is only blocked if the selection is truly invalid.
- **File**: `app/(main)/qa-analyzer/reports/data/DataReportClient.tsx`

## Verification Plan
1. **Individual Mode**:
    - Select an agent with only perfect scores (100%).
    - Verify that "Terakhir diaudit" context appears correctly (not "Tidak ada data audit").
    - Verify that clicking "Cari Data" returns the audit rows.
2. **Layanan Mode (Group)**:
    - Verify that group reports still only show findings (scores < 3) to keep the list concise.
3. **Regression**:
    - Ensure export to Excel still works with the new data rows.
