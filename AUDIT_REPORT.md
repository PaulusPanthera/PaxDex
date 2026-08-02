# PaxDex v0.24 Audit Report

## Result

The context-aware shiny-safety rebuild passes JavaScript syntax, Python compilation and the complete generated-data validator.

## Safety corrections

- Safari encounter tables contain no active safety warnings and suppress start-delay markers.
- Perish Song is suppressed in horde-only contexts.
- Rage Powder and Follow Me appear only where multiple opposing Pokémon may be present.
- Curse remains restricted to Ghost-type users.
- Weather-dependent Dry Skin/Solar Power warnings are excluded because the static dump does not expose active encounter weather.
- Healing Wish, Lunar Dance, forced-switch moves and unverified Drifblim compound behavior remain excluded pending in-game verification.

## Added coverage

- Rage Powder: 88 tables
- Follow Me: 24 tables / 28 affected component rows
- Belly Drum: 66 tables
- Teleport: 358 tables
- Sticky Barb: 105 tables
- Smeargle / Sketch: 20 tables
- Ditto / Transform: 251 tables
- Trick or Switcheroo: 127 tables

## Generated-data totals

- 649 Pokémon
- 58,375 hunt options
- 12,400 encounter tables
- 12,400 Route Searcher rows
- 2,145 5× training rows
- 395 maximum-yield EV rows
- 124 held-item icons

## Automated checks

- `node --check js/app.js`: passed
- `python -m py_compile scripts/build_data.py scripts/validate_data.py`: passed
- `python scripts/validate_data.py`: passed
- Shared and generated safety-rule files match exactly
- Phase previews match full encounter-table safety data
- Browser automation was unavailable in the container; DOM wiring, CSS parsing, syntax and generated data were checked independently.
