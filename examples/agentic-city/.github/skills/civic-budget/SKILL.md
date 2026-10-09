---
name: civic-budget
description: The official price list and ledger rules for Agentic City's treasury. Use when recording an expense or income in city/ledger.md.
---

# Civic budget rules

## Price list

| Item | Cost |
|------|-----:|
| New district | ₫1,000 |
| Landmark | ₫250 each |
| Bridge | ₫400 (₫0 if named after a pigeon) |
| Crisis response | ₫50 to ₫500, at the Treasurer's judgement |
| Festival | ₫0, but it must still be recorded |
| Goose-related emergency | whatever it takes |

## Writing a ledger row

- Columns: `| Day | Entry | Amount | Balance | Signed |`.
- `Amount` is `+₫N` for income and `−₫N` for expenses (use the real minus sign `−`), with thousands separators.
- `Balance` is the previous row's balance plus `Amount`. Recompute it; never copy it.
- Bundle a district and its landmarks into one row: `Noodle Heights (district + 2 landmarks)` costs ₫1,500.
- `Signed` is `the Treasurer`.

## Insufficient funds

The balance may never go below ₫0 (Charter Article II.4). If an expense would do that, do not record it. Instead add a ₫0 row: `Insufficient funds for <project>`, and report it to the Mayor.

## Worked example

Previous balance ₫4,488. A district with two landmarks costs ₫1,000 + 2 × ₫250 = ₫1,500. New balance ₫4,488 − ₫1,500 = ₫2,988.
