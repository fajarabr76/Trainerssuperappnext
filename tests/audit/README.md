# Audit Regression Suite

These tests validate critical security and reliability invariants discovered during formal audit rounds. They exercise branches and modules that are not covered by the standard unit/integration test suites.

## When to Run

Run this suite whenever any of the following changes:

- SIDAK server actions (auth guards, leader scope resolution, folder access)
- Telefun WebSocket proxy lifecycle (connection handling, usage flushing)
- Auth/RBAC helper changes in `app/lib/authz.ts`
- Leader access control (`app/lib/access-control/`)
- `apps/telefun-server/src/server.ts`

Run from the main repository root:

```bash
npx vitest run tests/audit
```

## Suite Contents

| File | Scope | Tests |
|------|-------|-------|
| `sidak-auth-guards-audit.test.ts` | SIDAK auth/RBAC hardening, leader scope, folder enforcement | 11 |
| `telefun-usage-flush-audit.test.ts` | Telefun usage flush on all lifecycle paths, idempotency | 5 |

## Design Notes

- These tests import source code directly from worktree branches (`.worktrees/`) to validate the fixes in isolation. If the worktrees are deleted, these tests will fail to load.
- Mock design avoids call-order-dependent counters where possible; prefer deterministic mocks keyed by query intent.
- Telefun tests intentionally produce stderr output for simulated connection failures — this is expected noise, not test failure.
