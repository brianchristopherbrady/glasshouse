# Building Inspector -- Actions

## 1.1.1
Classified `issue-overpass-load` as `systemic_confirmed`: structural
engineers confirmed the Overpass is load-bearing for Transit Hub Terminal
Three's east entrance, tracing to `sourceRelationshipId: rel-overpass-supports-transit`
with a real `semanticAffinityChain` (`undocumented-dependency`,
`east-entrance-load-path`) -- see `issue-tracking`. Logged the issue with
`loggedBy: building-safety-division` and `assignedTo: city-council`, since
authorizing the fix isn't within Building Inspector's own standing. Proposed
`correction-brace-overpass` (`reinforce`, not `sever`) since severing during
business hours would strand east-entrance foot traffic with no documented
fallback route (see `zoning-review`). Escalated to the Mayor for sign-off,
since this touches a `systemic_confirmed` issue (`WARN_SYSTEMIC_CASCADE`).

## 1.1.3
Executed `correction-brace-overpass` under `auth-council-2024-overpass-brace`.
Ran `world-validation`: `ERR_*` clear; `WARN_SYSTEMIC_CASCADE` present and
expected (this correction is the reason it fired); `WARN_AFFINITY_UNRESOLVED`
still open on `issue-water-pressure`, unrelated, tracked separately.
Correction complete; `issue-overpass-load` stays open pending confirmation
the reinforcement holds under real load.

## 2.1.2
Classified `issue-water-pressure` as `systemic_candidate`: East Canal
Pumphouse's pressure drop correlates with Founders' Plaza Fountain's evening
cycle via `rel-pumphouse-feeds-fountain`, but no broader pattern is
documented yet -- `semanticAffinityChain` stays empty honestly
(`WARN_AFFINITY_UNRESOLVED`), not a placeholder to be silenced. Logged the
issue (`loggedBy: building-safety-division`) and assigned it to Public Works
(`assignedTo: department-of-public-works`), confirming this is
infrastructure-scoped, not structural, and that Public Works has standing
to `reconcile` it directly without a separate authorization.
