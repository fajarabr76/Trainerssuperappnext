# Performance Optimization Design Specification

**Date:** 2026-05-06
**Topic:** Comprehensive Performance Optimization (Frontend & Backend)

## 1. Goal
To significantly improve application loading speeds and reduce database payload overhead by eliminating frontend data-fetching waterfalls and optimizing backend Supabase queries.

## 2. Background & Motivation
Based on recommendations from Context7 regarding Next.js and Supabase best practices, an audit of the codebase revealed two major inefficiencies:
- **Frontend Waterfalls:** Certain Server Components (specifically in `qa-analyzer/dashboard` and `dashboard/monitoring`) execute sequential `await` calls for independent data fetching operations. This causes the page to wait for each request to finish sequentially before starting the next.
- **Over-fetching (select *):** 27 instances of `.select('*')` were found across core server services and server actions. This fetches all columns from the database, increasing memory usage and network transfer times, even when only a subset of columns is required by the UI or logic.

## 3. Scope & Impact
This is a **Comprehensive** optimization targeting:
- `app/(main)/qa-analyzer/dashboard/page.tsx`
- `app/(main)/dashboard/monitoring/page.tsx`
- `app/(main)/qa-analyzer/services/qaService.server.ts`
- `app/(main)/profiler/services/profilerService.server.ts`
- `app/(main)/qa-analyzer/actions.ts`
- `app/(main)/profiler/actions.ts`
- `app/actions/leader-access.ts`
- `app/(main)/qa-analyzer/services/summaryReader.server.ts`

The impact will be a faster time-to-first-byte (TTFB) on dashboards and reduced memory footprint for server actions.

## 4. Proposed Solution

### 4.1 Frontend Data Fetching (Next.js)
Refactor sequential `await` calls for independent asynchronous functions into `Promise.all` arrays. 

**Example (Current):**
```typescript
const foldersData = await profilerServiceServer.getFolders(null, participantIds);
const periodsData = await qaServiceServer.getPeriods();
const availableYearsData = await qaServiceServer.getAvailableYears();
const indicatorsResult = await qaServiceServer.getIndicators(dominantService);
```

**Example (Proposed):**
```typescript
const [foldersData, periodsData, availableYearsData, indicatorsResult] = await Promise.all([
  profilerServiceServer.getFolders(null, participantIds),
  qaServiceServer.getPeriods(),
  qaServiceServer.getAvailableYears(),
  qaServiceServer.getIndicators(dominantService)
]);
```

### 4.2 Backend Query Optimization (Supabase)
Replace `.select('*')` with explicit column selections based on the requirements of the caller functions or the return types defined in the codebase.

**Implementation Strategy:**
1. Identify the target function containing `.select('*')`.
2. Trace the data usage within that function and its immediate callers.
3. Determine the exact interface or database schema definition (e.g., via `app/lib/authz.ts` or similar type files).
4. Update the query to `.select('col1, col2, id, created_at')` explicitly.
5. If the target is used generically in multiple places, explicitly list all columns defined in its TypeScript interface to ensure safety, while still avoiding dynamic full-table scans.

## 5. Alternatives Considered
- **Frontend-only optimization:** Rejected by user in favor of a comprehensive approach to ensure maximum performance gains.
- **Index Advisor (Supabase):** Could not be executed via MCP without tokens; however, query payload reduction (explicit selects) provides immediate benefit regardless of indexing.

## 6. Verification Strategy
- **Static Analysis:** Run `npm run type-check` to ensure no properties were accidentally omitted from the `select` that are expected by TypeScript interfaces.
- **Manual Smoke Testing:** Verify the Dashboards (`/qa-analyzer/dashboard`, `/dashboard/monitoring`) load without missing data or rendering errors.
