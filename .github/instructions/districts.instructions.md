---
applyTo: 'examples/agentic-city/city/districts/**'
description: The required template for district files.
---

<!-- Generated from examples/agentic-city/.github/instructions/districts.instructions.md by `npm run city:sync`. Edit that file, not this copy. -->

# District file template

Every file in `examples/agentic-city/city/districts/` has a kebab-case name (`noodle-heights.md`) and exactly this shape:

~~~markdown
# <District Name>

- **Code:** <two uppercase letters, unique on the map legend>
- **Squares:** <map squares, e.g. C2, D2>
- **Zoning:** <one zone from the zoning-code skill>
- **Founded:** Day N of the Founding
- **Population:** <a number, plus any notable non-human residents>

## Vibe

<Two or three sentences of atmosphere.>

## Landmarks

- **<Landmark name>** — <height> floors. <One sentence about it.>

## Inspection notes

- Day N: <VERDICT>. <Notes.> — the Building Inspector
~~~

The City Planner writes everything except `## Inspection notes`, which only the Building Inspector adds to (leave the heading in place with no bullets when creating a district).
