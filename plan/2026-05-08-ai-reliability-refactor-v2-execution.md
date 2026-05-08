# AI Reliability Refactor v2 (Loophole-Closed) - Execution Plan

- [x] **Task 1: KETIK durable review pipeline (DB & API)**
  - Add `ketik_review_jobs` table with `session_id`, `status`, lease fields, attempt count, error, timestamps, and unique active job constraint per session. (Migration)
  - `POST /api/ketik/review` only enqueues/claims job idempotently and sets session lifecycle to `processing`.

- [x] **Task 2: KETIK Worker & Polling Endpoint**
  - Add authenticated poll endpoint returning canonical status (`pending|processing|completed|failed`) and result readiness.
  - Add worker execution path with lease-based claim/reclaim logic, retry budget, and stuck-job recovery.
  - In review worker, persist review rows first, then update `ketik_history` scores + `review_status='completed'` last.
  - If `ketik_history` says completed but review row missing, auto-heal by reopening to retriable failure state.

- [x] **Task 3: Shared status and UI contracts (KETIK UI)**
  - Extend KETIK status unions/types/mappers/components to include `processing`.
  - Disable duplicate trigger while queued/processing and show deterministic progress/error copy.
  - Remove silent fallthroughs in refresh paths; all fetch failures produce explicit state transitions.

- [x] **Task 4: AI routing consistency (PDKT & Telefun)**
  - PDKT evaluate route uses normalized `config.selectedModel` as primary source.
  - Telefun text-side AI flows route by provider (`Gemini/OpenRouter`) from normalized model id.
  - Telefun settings parsing coerces invalid legacy model ids to valid defaults.
  - Standardize transient retry policy and user-facing error taxonomy across modules.

- [x] **Task 5: Data and docs integrity**
  - Migration includes safe backfill before constraints.
  - Add constraint/index guards for status domain and active-job uniqueness.
  - Update docs/modules + changelog to exactly match shipped behavior and lifecycle.
