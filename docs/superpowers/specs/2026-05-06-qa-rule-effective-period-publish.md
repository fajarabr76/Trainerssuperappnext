# QA Rule Versioning: Effective Period on Publish

**Date:** 2026-05-06
**Status:** Approved (Pending Implementation)
**Topic:** Versioning & Deployment Flow

## Problem Statement
The current versioning system for QA Rules assigns the effective period during draft creation. This lacks flexibility if a user wants to move a finalized draft to a different month or if a revision is intended for a future period. Additionally, the lack of explicit period labels for drafts in the UI creates ambiguity.

## Proposed Solution
Restore the ability to select the **Target Effective Period** during the `publish` flow. This ensures drafts can be redirected as needed. We will also enhance visibility of these periods in the sidebar and draft panels.

## Key Changes

### 1. Database (Supabase)
*   **Modify RPC `publish_rule_version`**:
    *   Add parameter `p_effective_period_id uuid`.
    *   **Authoritative Validation (Server-side)**:
        *   Reject if a version with status `published` already exists for the same `service_type` and `p_effective_period_id`.
        *   Reject if another `draft` exists for the same `service_type` and `p_effective_period_id` (User must delete manually).
    *   **Atomicity**: 
        1.  Update the draft's `effective_period_id` to the target.
        2.  Recalculate `version_number` as `MAX(version_number) + 1` for the new period.
        3.  Apply statuses (`published` for current, `superseded` for old one if it existed).

### 2. Backend (Server Actions)
*   Update `publishRuleVersionAction(versionId, effectivePeriodId, changeReason?)` to pass the new parameter to the service and RPC.

### 3. Frontend (QaVersionedSettings.tsx)
*   **Publish Modal**:
    *   Add a period selector at the top (dropdown).
    *   Pre-populate with the draft's current `effective_period_id`.
    *   Update the `v[X]` preview label dynamically based on selected period.
    *   **Logic Change**: Require `changeReason` if `draft.created_from_version_id` is NOT NULL (indicating it's a revision), regardless of the final version number.
*   **Sidebar**:
    *   Display period information as a subtitle below the version number: `Efektif: [Bulan] [Tahun]`.
*   **Draft Panel**:
    *   Display the draft's current target period explicitly in the banner.

## Business Rules & Constraints
*   **Mandatory Change Reason**: Required if the draft was created from another version (`created_from_version_id IS NOT NULL`).
*   **Unique Constraints**: Enforcement of `(service_type, effective_period_id, status='published')` is handled by the RPC and DB unique indexes.
*   **Draft Cleanup**: Users must manually delete conflicting drafts for the target period before publishing to it.

## Verification Plan
1.  **UI Test**: Open publish modal, change period, ensure version preview updates.
2.  **Conflict Test**: Attempt to publish to a period that already has a `published` version (Should Fail).
3.  **Atomicity Test**: Verify that moving a draft to a new period correctly updates its `version_number` and statuses of other versions in that period.
4.  **Documentation**: Update `docs/QA_SMOKE_TEST_VERSIONED_RULES.md` to reflect the new publish flow.

## Approval
- [x] User Approved (2026-05-06)
