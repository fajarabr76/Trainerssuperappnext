# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate verified frontend data-fetching waterfalls and reduce safe, mapped Supabase over-fetching without changing auth, RBAC, SIDAK scoring, Profiler clone/copy behavior, or cache semantics.

**Architecture:** Apply `Promise.all` only after prerequisite auth/scope data is available, so independent server reads run concurrently while existing access gates remain sequential. Replace `.select('*')` only where the exact returned columns are already proven from local interfaces or immediate usage; defer broad cleanup for clone/copy/export/scoring paths that need a separate mapping audit.

**Tech Stack:** Next.js App Router, React Server Components, Supabase, TypeScript

---

## Guardrails

- Do not change database schema, migrations, cache policy, middleware, auth, RBAC, leader scope filtering, SIDAK scoring formulas, phantom padding semantics, or Profiler copy/clone output.
- Read each target file immediately before editing and apply minimal unified diffs.
- Do not run a broad `select('*')` sweep.
- Treat performance gains as expected until measured after deployment or route-level profiling.
- Keep `app/(main)/profiler/actions.ts`, `app/(main)/profiler/services/profilerService.server.ts`, and non-period/non-weight `qaService.server.ts` cleanup deferred unless a later plan maps every required column.

## Task 1: Frontend Waterfall - QA Leader Dashboard

**Files:**
- Modify: `app/(main)/qa-analyzer/dashboard/page.tsx`

- [ ] **Step 1: Confirm target block still exists**

Run:
```bash
rg -n "getFolders\\(null, participantIds\\)|getIndicators\\(dominantService\\)" "app/(main)/qa-analyzer/dashboard/page.tsx"
```

Expected: sequential fetches still appear around the leader branch after `dominantService` has been resolved.

- [ ] **Step 2: Refactor independent leader reads to `Promise.all`**

Replace:
```tsx
      const foldersData = await profilerServiceServer.getFolders(null, participantIds);
      const periodsData = await qaServiceServer.getPeriods();
      const availableYearsData = await qaServiceServer.getAvailableYears();
      const indicatorsResult = await qaServiceServer.getIndicators(dominantService);
```

With:
```tsx
      const [foldersData, periodsData, availableYearsData, indicatorsResult] = await Promise.all([
        profilerServiceServer.getFolders(null, participantIds),
        qaServiceServer.getPeriods(),
        qaServiceServer.getAvailableYears(),
        qaServiceServer.getIndicators(dominantService)
      ]);
```

- [ ] **Step 3: Verify no behavior changed in this branch**

Check that these lines still remain after the refactor:
```tsx
      service = dominantService;
```

```tsx
      const allowedFolderNames = foldersData.map((f: ProfilerFolder) => f.name);
```

```tsx
      const leaderTopAgents = (periodData.topAgents || []).filter(
        (a: { agentId: string }) => participantIds.includes(a.agentId)
      );
```

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/qa-analyzer/dashboard/page.tsx"
git commit -m "perf(sidak): parallelize leader dashboard setup reads"
```

## Task 2: Frontend Waterfall - Monitoring Dashboard

**Files:**
- Modify: `app/(main)/dashboard/monitoring/page.tsx`

- [ ] **Step 1: Confirm target block still exists**

Run:
```bash
sed -n '1,40p' "app/(main)/dashboard/monitoring/page.tsx"
```

Expected: `requirePageAccess()` is awaited first, then `getMonitoringHistory()`, `getCurrentWibMonth()`, `getUsageAggregation()`, `buildFullPricingEditorList()`, and `getBillingSettings()` are evaluated sequentially.

- [ ] **Step 2: Refactor independent monitoring reads to `Promise.all`**

Replace:
```tsx
  const initialResults = await getMonitoringHistory();
  const wibNow = getCurrentWibMonth();
  const initialUsage = await getUsageAggregation({ year: wibNow.year, month: wibNow.month });
  const canEditPricing = role === 'trainer' || role === 'admin';

  const initialPricing: PricingEditorEntry[] = canEditPricing ? await buildFullPricingEditorList() : [];
  const initialBilling = canEditPricing ? await getBillingSettings() : null;
```

With:
```tsx
  const wibNow = getCurrentWibMonth();
  const canEditPricing = role === 'trainer' || role === 'admin';

  const [initialResults, initialUsage, initialPricing, initialBilling] = await Promise.all([
    getMonitoringHistory(),
    getUsageAggregation({ year: wibNow.year, month: wibNow.month }),
    canEditPricing ? buildFullPricingEditorList() : Promise.resolve([] as PricingEditorEntry[]),
    canEditPricing ? getBillingSettings() : Promise.resolve(null)
  ]);
```

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/dashboard/monitoring/page.tsx"
git commit -m "perf(monitoring): parallelize initial dashboard reads"
```

## Task 3: Safe Backend Select Cleanup - SIDAK Periods And Weights

**Files:**
- Modify: `app/(main)/qa-analyzer/services/qaService.server.ts`
- Modify: `app/(main)/qa-analyzer/actions.ts`

- [ ] **Step 1: Confirm mapped occurrences**

Run:
```bash
rg -n -U "from\\('qa_periods'\\)[\\s\\S]{0,120}select\\('\\*'\\)|from\\('qa_service_weights'\\)[\\s\\S]{0,120}select\\('\\*'\\)" "app/(main)/qa-analyzer/services/qaService.server.ts" "app/(main)/qa-analyzer/actions.ts"
```

Expected: `qa_periods.select('*')` appears in `qaService.server.ts`, and `qa_service_weights.select('*')` appears in `actions.ts`.

- [ ] **Step 2: Replace `qa_periods` wildcard selects**

Change only `qa_periods` wildcard selects in `app/(main)/qa-analyzer/services/qaService.server.ts` from:
```ts
.from('qa_periods').select('*')
```

To:
```ts
.from('qa_periods').select('id, month, year, created_at')
```

Use the same column list for multiline equivalents:
```ts
.from('qa_periods')
.select('id, month, year, created_at')
```

- [ ] **Step 3: Replace `qa_service_weights` wildcard select**

In `getAllServiceWeightsAction()` in `app/(main)/qa-analyzer/actions.ts`, replace:
```ts
const { data, error } = await supabase.from('qa_service_weights').select('*');
```

With:
```ts
const { data, error } = await supabase
  .from('qa_service_weights')
  .select('service_type, critical_weight, non_critical_weight, scoring_mode');
```

- [ ] **Step 4: Verify mapped columns match local types**

Confirm:
```bash
sed -n '100,110p' "app/(main)/qa-analyzer/lib/qa-types.ts"
sed -n '1,18p' "app/(main)/qa-analyzer/lib/qa-types.ts"
```

Expected:
- `QAPeriod` uses `id`, `month`, `year`, optional `created_at`, and derived optional `label`.
- `ServiceWeight` uses `service_type`, `critical_weight`, `non_critical_weight`, and `scoring_mode`.

- [ ] **Step 5: Commit**

```bash
git add "app/(main)/qa-analyzer/services/qaService.server.ts" "app/(main)/qa-analyzer/actions.ts"
git commit -m "perf(sidak): use explicit selects for periods and weights"
```

## Task 4: Safe Backend Select Cleanup - Summary Reader

**Files:**
- Modify: `app/(main)/qa-analyzer/services/summaryReader.server.ts`

- [ ] **Step 1: Replace both `qa_dashboard_period_summary` wildcard selects**

In `getDashboardRangeDataFromSummary()` and `getDashboardRangeTrendFromSummary()`, replace:
```ts
.select('*')
```

For queries on `qa_dashboard_period_summary`, use:
```ts
.select('period_id, total_agents, total_defects, zero_error_count, avg_agent_score, compliance_count, critical_count, non_critical_count')
```

- [ ] **Step 2: Verify usage remains covered**

Run:
```bash
rg -n "row\\.(total_agents|total_defects|zero_error_count|avg_agent_score|compliance_count|critical_count|non_critical_count)|summaryByPeriod|getDashboardRange(Data|Trend)FromSummary" "app/(main)/qa-analyzer/services/summaryReader.server.ts"
```

Expected: every accessed field from `summaryRows` is included in the explicit select.

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/qa-analyzer/services/summaryReader.server.ts"
git commit -m "perf(sidak): narrow dashboard summary selects"
```

## Task 5: Safe Backend Select Cleanup - Leader Access Groups

**Files:**
- Modify: `app/actions/leader-access.ts`

- [ ] **Step 1: Replace `access_groups` wildcard select**

In `getAccessGroups()`, replace:
```ts
.select('*')
```

With:
```ts
.select('id, name, description, scope_type, is_active, created_at')
```

- [ ] **Step 2: Replace `access_group_items` wildcard select**

In `getAccessGroupItems()`, replace:
```ts
.select('*')
```

With:
```ts
.select('id, access_group_id, field_name, field_value, is_active')
```

- [ ] **Step 3: Verify mapped columns match local interfaces**

Run:
```bash
sed -n '30,46p' app/actions/leader-access.ts
```

Expected:
- `AccessGroupRow` fields are fully covered except `item_count`, which is computed from `access_group_items`.
- `AccessGroupItemRow` fields are fully covered.

- [ ] **Step 4: Commit**

```bash
git add app/actions/leader-access.ts
git commit -m "perf(access): narrow leader access group selects"
```

## Task 6: Verification And Deferred Scope Check

**Files:**
- Check: `app/(main)/qa-analyzer/actions.ts`
- Check: `app/(main)/qa-analyzer/services/qaService.server.ts`
- Check: `app/(main)/qa-analyzer/services/summaryReader.server.ts`
- Check: `app/actions/leader-access.ts`
- Check: `app/(main)/profiler/actions.ts`
- Check: `app/(main)/profiler/services/profilerService.server.ts`

- [ ] **Step 1: Confirm mapped wildcard selects are removed**

Run:
```bash
rg -n -U "from\\('qa_service_weights'\\)[\\s\\S]{0,120}select\\('\\*'\\)" "app/(main)/qa-analyzer/actions.ts"
rg -n -U "from\\('qa_periods'\\)[\\s\\S]{0,120}select\\('\\*'\\)" "app/(main)/qa-analyzer/services/qaService.server.ts"
rg -n -U "from\\('qa_dashboard_period_summary'\\)[\\s\\S]{0,160}select\\('\\*'\\)" "app/(main)/qa-analyzer/services/summaryReader.server.ts"
rg -n -U "from\\('access_groups'\\)[\\s\\S]{0,120}select\\('\\*'\\)|from\\('access_group_items'\\)[\\s\\S]{0,120}select\\('\\*'\\)" app/actions/leader-access.ts
```

Expected: no mapped safe target remains as `.select('*')`.

- [ ] **Step 2: Confirm remaining wildcard selects are deferred intentionally**

Run:
```bash
rg -n "select\\('\\*'\\)" "app/(main)/profiler/actions.ts" "app/(main)/profiler/services/profilerService.server.ts" "app/(main)/qa-analyzer/services/qaService.server.ts"
```

Expected: remaining wildcard selects are limited to deferred Profiler clone/copy/full-participant flows and non-period SIDAK service paths that need a separate column mapping audit.

- [ ] **Step 3: Run static and SIDAK verification**

Run:
```bash
npm run lint
npm run type-check
npm run test:sidak
```

Expected: all commands pass.

- [ ] **Step 4: Manual smoke tests**

Verify these flows in the app:
- `/qa-analyzer/dashboard` as trainer/admin: dashboard renders and filters still work.
- `/qa-analyzer/dashboard` as leader: dashboard remains scoped to approved participants and does not fall back to all participants.
- `/dashboard/monitoring` as trainer/admin: history, usage, pricing editor, and billing settings render.
- `/dashboard/monitoring` as leader: page renders without pricing edit data.

- [ ] **Step 5: Final commit**

If the previous task commits were not made individually, commit the completed batch:
```bash
git add "app/(main)/qa-analyzer/dashboard/page.tsx" "app/(main)/dashboard/monitoring/page.tsx" "app/(main)/qa-analyzer/services/qaService.server.ts" "app/(main)/qa-analyzer/actions.ts" "app/(main)/qa-analyzer/services/summaryReader.server.ts" "app/actions/leader-access.ts"
git commit -m "perf: optimize dashboard reads and mapped supabase selects"
```

## Deferred Backend Cleanup

These occurrences remain out of scope for this revision:
- `app/(main)/profiler/actions.ts`: several `profiler_peserta.select('*')` reads are used to duplicate/copy participant rows; narrowing columns could silently drop copied fields.
- `app/(main)/profiler/services/profilerService.server.ts`: participant reads return `Peserta[]` and are used by multiple UI flows; they need a dedicated `Peserta` column mapping.
- `app/(main)/qa-analyzer/services/qaService.server.ts`: non-period wildcard selects touch rule snapshots, export/detail, trend, scoring, and phantom-padding-sensitive flows; each needs separate mapping and SIDAK parity checks.
