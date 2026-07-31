# PaxDex v0.18 Audit Report

## Changes checked

- Semantic Pokédex categories are derived from encounter sources rather than display method names.
- Lure-exclusive categories require an actual `lure` source component.
- Safari categories require a location where Safari battle rules apply.
- 5×/3× horde categories distinguish one-species 100% tables from split tables.
- Category season/time availability matches the underlying hunt tables.
- Wild danger warnings are generated from each species' current four level-up moves across the encounter level range.
- Only the first two normal ability slots are considered; hidden abilities remain excluded.
- Phase previews and full encounter tables contain matching warning data.

## Automated checks

- Python builder and validator compile successfully.
- JavaScript syntax passes `node --check`.
- 649 Pokémon entries and 58,370 hunt options validate.
- 12,398 full encounter tables and Route Searcher rows validate.
- All semantic category and category-availability summaries match detailed encounter data.
- Voltorb Selfdestruct regression passes at applicable wild levels.
- Existing Lure, natural-horde, Sweet Scent, Safari Zone Gate, Safari estimates and slowdown regressions pass.

## Browser note

The execution environment used for this patch blocks Chromium from opening local/private-network pages. Browser rendering was therefore not claimed as an automated pass; the production code was checked through syntax, generated-data and reference validation.
