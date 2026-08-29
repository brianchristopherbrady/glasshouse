---
name: Test conventions
description: Conventions for packages/*/tests/**/*.test.ts in flowbook.
applyTo: 'packages/core/tests/**,packages/cli/tests/**,packages/ui/src/**/*.test.ts'
---

# Test conventions

- Tests must be deterministic. Do not depend on wall-clock time, network
  access, or the real `.flowbook/` directory — use a temp directory (see
  `packages/core/tests/runner.test.ts` for the pattern) or in-memory fixtures.
- One behavior per `it(...)`. Prefer several small, clearly named tests over
  one large test with many assertions.
- Prefer real execution over mocks: `packages/core/server/runner/engine.ts`'s
  `executeRun()` genuinely runs a registered workflow's code (real file I/O
  in a temp sandbox via `seedArtifacts`), so tests assert on real Spans and
  real artifact content, not a simulated trace.
