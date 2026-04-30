# Plan: Fix QA Analyzer Individual Report Data (v1)

The individual report data in the QA Analyzer (`qa-analyzer/reports/data`) is currently showing an error ("Tidak ada data audit") or an empty state when it should show data. This is caused by overly restrictive filtering in the data fetching logic that excludes perfect scores and phantom sessions.

## Objective
Fix the individual data report so the context can detect clean audit months, while the table/export only displays real finding rows that contain both "Temuan Agen" (`ketidaksesuaian`) and "Seharusnya" (`sebaiknya`).

## Analysis & Root Cause
1.  **Restrictive Period Detection**: `getLastAuditedMonthAction` in `app/(main)/qa-analyzer/actions.ts` filters out phantom padding sessions. If an agent only has "Clean Sessions" (Perfect Score), the system fails to detect an audited month, setting `endMonth` to 0.
2.  **Presentation Semantics**: `getDataReportRows` is a table/export view for real findings, not an audit-presence or scoring view. It must not show phantom padding rows, and it should only show rows with both `ketidaksesuaian` and `sebaiknya`.

## Proposed Changes

### 1. Update `getLastAuditedMonthAction`
Include phantom sessions when searching for the last audited month so the correct period context is displayed.
- **File**: `app/(main)/qa-analyzer/actions.ts`
- **Change**: Remove the `is_phantom_padding` filter.

### 2. Update `getDataReportRows`
Keep report data focused on real findings for both service and individual modes.
- **File**: `app/(main)/qa-analyzer/services/qaService.server.ts`
- **Logic**:
    - Exclude `is_phantom_padding = true` from the table/export rows.
    - Require non-empty `ketidaksesuaian`.
    - Require non-empty `sebaiknya`.

### 3. Update `DataReportClient.tsx`
Move the report settings from the left sidebar into a top filter bar so the table uses the full width and there is no double-sidebar layout.
- **File**: `app/(main)/qa-analyzer/reports/data/DataReportClient.tsx`

## Verification Plan
1. **Individual Mode**:
    - Select an agent with only phantom/perfect clean sessions.
    - Verify that "Terakhir diaudit" context can still appear correctly.
    - Verify that clicking "Tampilkan Data" does not show phantom rows in the table/export.
    - Select an agent with real rows containing both `ketidaksesuaian` and `sebaiknya`; verify those rows are displayed.
2. **Layanan Mode (Group)**:
    - Verify that group reports only show rows with both `ketidaksesuaian` and `sebaiknya`.
3. **Regression**:
    - Ensure export to Excel still works with the visible table rows.
    - Ensure `/qa-analyzer/reports/data` filter controls are in the top bar, not a left sidebar.
