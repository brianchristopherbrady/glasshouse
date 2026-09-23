---
on: issues
engine: copilot
permissions:
  issues: write
  contents: read
safe-outputs:
  - add-comment
  - add-labels
---

Triage newly opened issues, classify severity, and route security-relevant
ones to the security reviewer.
