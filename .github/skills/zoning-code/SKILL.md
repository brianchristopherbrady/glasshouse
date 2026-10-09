---
name: zoning-code
description: Zoning categories, height limits, and the inspection checklist for Agentic City. Use when designing or inspecting a district or landmark.
---

<!-- Generated from examples/agentic-city/.github/skills/zoning-code/SKILL.md by `npm run city:sync`. Edit that file, not this copy. -->

# Zoning code of Agentic City

## Zones

| Zone | Allowed | Max height | Special rule |
|------|---------|-----------:|--------------|
| `residential` | homes, parks, benches | 4 floors | At least one cat per street. |
| `market` | shops, stalls, cafés | 5 floors | One stall must sell exactly one thing. |
| `historic-whimsical` | anything charming | 9 floors | Every change needs a reason that sounds old. |
| `nautical` | docks, lighthouses, piers, boats | 6 floors | Every square must touch water (`~~~~`). |
| `civic` | halls, towers, libraries | 9 floors | Only the Mayor may cut ribbons here. |
| `industrial-ish` | workshops, factories, foundries | 5 floors | Must emit a pleasant smell. |
| `forbidden` | nothing | — | Wobble Hill (`^^^^`). Always DENIED. |

## Inspection checklist

1. The district file exists and follows the district template.
2. Every square is empty land on the map. Never water (`~~~~`), never Wobble Hill (`^^^^`), never another district.
3. The zone is one of the zones above, and every landmark is allowed in it.
4. No structure is taller than its zone's max height or the Clock Tower (9 floors).
5. There is at least one place to sit down (Charter Article III.2).
6. Every bridge is named after something that does not deserve a bridge (Charter Article III.3).
7. The zone's special rule is satisfied.

## Verdicts

- **APPROVED** — every check passes.
- **APPROVED WITH CONDITIONS** — only checks 1, 3, 6 or 7 fail, and the fix is obvious. List each condition.
- **DENIED** — check 2, 4 or 5 fails, or anything touches Wobble Hill. Cite the failing check or Article.
