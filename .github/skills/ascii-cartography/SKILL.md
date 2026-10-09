---
name: ascii-cartography
description: How to read and edit the official ASCII map in examples/agentic-city/city/map.md without breaking its grid. Use when adding, moving, or removing a district on the map.
---

<!-- Generated from examples/agentic-city/.github/skills/ascii-cartography/SKILL.md by `npm run city:sync`. Edit that file, not this copy. -->

# Editing the official map

The map in `examples/agentic-city/city/map.md` is a fixed-width grid inside a `text` code block. Rows are numbered, columns are lettered.

## Cell format

Every cell is exactly **4 characters**, separated by **one space**. Row labels are padded to 5 characters.

| Cell | Meaning |
|------|---------|
| `....` | Empty land, buildable |
| `~~~~` | Water, never buildable |
| `^^^^` | Wobble Hill, never buildable |
| `[XX]` | A district, where `XX` is its two-letter code |

## Adding a district

1. Pick empty squares (`....`) that touch an existing district or water (cities grow outwards, not in random patches).
2. Replace each chosen `....` with the district code, e.g. `[NH]`. Keep the 4-character width.
3. Add a legend row: `| NH | Noodle Heights | C2, D2 |`. Codes must be unique.
4. Never change water, Wobble Hill, the column header, or the row numbers.

## Running out of land

If no suitable empty square exists, add a column `F` or a row `6` filled with `....`, keeping every cell aligned. Mention the expansion in your report to the Mayor.
