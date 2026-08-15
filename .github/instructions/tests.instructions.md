---
name: Test conventions
description: Conventions for tests/**/*.test.ts in AGENTARIUM.
applyTo: 'tests/**'
---

# Test conventions

- Tests must be deterministic. Do not depend on wall-clock time, network
  access, or the real `.agentarium/` directory — use a temp directory (see
  `tests/event-store.test.ts` for the pattern) or in-memory fixtures.
- Prefer constructing events with `createEvent` from `shared/events.ts` over
  hand-built object literals, so provenance consistency is checked for free.
- One behavior per `it(...)`. Prefer several small, clearly named tests over
  one large test with many assertions.
- When adding a new world validation rule, add both a passing and a failing
  fixture case in `tests/world-validator.test.ts`.
