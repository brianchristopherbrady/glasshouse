---
on: schedule
engine: claude
permissions:
  contents: write
  pull-requests: write
safe-outputs:
  - create-pull-request
---

Run a scheduled dependency audit, flag vulnerable packages, and open a PR
with safe upgrades.
