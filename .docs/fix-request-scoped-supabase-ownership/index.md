---
feature: fix-request-scoped-supabase-ownership
status: ready_for_implementation
non_trivial: true
requires_api_doc: true
requires_data_model_doc: true
required_docs: Source/README.md, spec.md, architecture.md, runtime-flows.md, test-plan.md, api.md, data-model.md
execution_snapshot_docs: spec.md, architecture.md, runtime-flows.md, test-plan.md
---

# fix-request-scoped-supabase-ownership

## Summary

Remove the remaining fixed startup owner path from Supabase runtime storage. User-owned data must be scoped by active JWT user, signed internal owner, or explicit system enumeration.

## Implementation Readiness

- Status: `ready_for_implementation`
- Baseline snapshots: `Execution/baseline-*.md`
- Current slice source: first non-`committed` row in `Execution/slice-tracker.md`
- This branch stacks on PR #14 until `fix/migration-auth-filestore-retirement` merges.

## Document Flow

```mermaid
flowchart LR
  SRC[Source/README.md] --> SPEC[spec.md]
  SRC --> ARCH[architecture.md]
  SRC --> FLOW[runtime-flows.md]
  SRC --> TEST[test-plan.md]
  SRC --> API[api.md]
  SRC --> DATA[data-model.md]

  SPEC --> EXEC[Execution/*]
  ARCH --> EXEC
  FLOW --> EXEC
  TEST --> EXEC
  API --> EXEC
  DATA --> EXEC
```
